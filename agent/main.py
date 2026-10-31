"""Onboardy: the admin's chat assistant inside OnboardOS.

A ChatKit server (self-hosted) running an Agents SDK agent. Onboardy works only through the
OnboardOS API, the same one the dashboard uses, so it can never do something the UI couldn't:
the workflow stays the authority, approvals stay tied to a document version, and every
change shows up in the dashboard's activity feed.

Run:  OPENAI_API_KEY=... .venv/bin/uvicorn main:app --port 8002
Env:  ONBOARDOS_API (default http://localhost:8000), ONBOARDY_MODEL (default gpt-4.1-mini)
"""

import os
import uuid
from collections.abc import AsyncIterator
from typing import Any

import httpx
from agents import Agent, RunContextWrapper, Runner, function_tool
from chatkit.agents import AgentContext, simple_to_agent_input, stream_agent_response
from chatkit.server import ChatKitServer, StreamingResult
from chatkit.types import ClientEffectEvent, ThreadMetadata, ThreadStreamEvent, UserMessageItem
from fastapi import FastAPI, Request
from fastapi.responses import Response, StreamingResponse

from store import make_store

API = os.environ.get("ONBOARDOS_API", "http://localhost:8000").rstrip("/")
MODEL = os.environ.get("ONBOARDY_MODEL", "gpt-4.1-mini")
HISTORY = 30  # thread items sent to the model each turn

Ctx = RunContextWrapper[AgentContext[dict[str, Any]]]


# ── the OnboardOS API ───────────────────────────────────────────────────────


async def call(method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any] | list[Any]:
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.request(method, f"{API}{path}", json=body)
    data = res.json()
    if res.status_code >= 400:
        return {"error": data.get("error", res.text), "code": data.get("code")}
    return data


def onboarding_id(ctx: Ctx) -> str | None:
    """The onboarding open in the admin's dashboard (sent with every request), unless a tool
    switched to another in this conversation."""
    return ctx.context.thread.metadata.get("onboarding_id") or ctx.context.request_context.get("onboarding_id")


async def refresh_dashboard(ctx: Ctx, onboarding: str) -> None:
    """Tell the dashboard to re-read state right away (it also polls every second)."""
    await ctx.context.stream(ClientEffectEvent(name="onboarding.changed", data={"id": onboarding}))


def brief(o: dict[str, Any]) -> dict[str, Any]:
    """What the model needs from a snapshot, without every mapping row."""
    approvals = o.get("approvals", [])
    return {
        "id": o["id"],
        "company": o["requirements"]["company"],
        "status": o["status"],
        "tasks": [{"task": t["title"], "status": t["status"], "summary": t.get("summary")} for t in o["tasks"]],
        "documents": [
            {
                "document_id": d["id"],
                "title": d["title"],
                "current_version": d["currentVersion"],
                "status": d["status"],
                "latest_decision": next(
                    (
                        {"decision": a["decision"], "comment": a.get("comment")}
                        for a in reversed(approvals)
                        if a["documentId"] == d["id"] and a["version"] == d["currentVersion"]
                    ),
                    None,
                ),
            }
            for d in o["documents"]
        ],
        "clock_offset_hours": round(o["clock"]["offsetMinutes"] / 60, 1),
    }


# ── tools ───────────────────────────────────────────────────────────────────


@function_tool
async def get_onboarding_status(ctx: Ctx) -> Any:
    """The current onboarding: its status, every workflow stage, and each document's current
    version, status and latest decision. Call this before answering anything about progress."""
    oid = onboarding_id(ctx)
    if not oid:
        return {"error": "No onboarding is open. Offer to start one."}
    o = await call("GET", f"/api/onboardings/{oid}")
    return o if "error" in o else brief(o)  # type: ignore[arg-type]


@function_tool
async def get_document(ctx: Ctx, document_id: str, version: int | None = None) -> Any:
    """One document's mapping rows, compliance findings and decisions, for a version (default:
    the current one). Use it to explain what a document says or what changed.

    Args:
        document_id: "accounting_configuration" or "ledger_mapping".
        version: a version number; omit for the current version.
    """
    oid = onboarding_id(ctx)
    o = await call("GET", f"/api/onboardings/{oid}")
    if "error" in o:
        return o
    d = next((x for x in o["documents"] if x["id"] == document_id), None)  # type: ignore[index]
    if d is None:
        return {"error": f"No document {document_id}"}
    v = version or d["currentVersion"]
    found = next((x for x in d["versions"] if x["version"] == v), None)
    if found is None:
        return {"error": f"{d['title']} has no version {v} yet"}
    previous = next((x for x in d["versions"] if x["version"] == v - 1), None)
    return {
        "title": d["title"],
        "version": v,
        "is_current": v == d["currentVersion"],
        "status": d["status"] if v == d["currentVersion"] else "superseded",
        "reason": found.get("reason"),
        "rows": found["rows"],
        "changed_from_previous": [
            {"scenario": r["scenario"], "before": {"debit": p["debit"], "credit": p["credit"]},
             "after": {"debit": r["debit"], "credit": r["credit"]}}
            for r, p in zip(found["rows"], previous["rows"] if previous else [], strict=False)
            if (r["debit"], r["credit"]) != (p["debit"], p["credit"])
        ],  # fmt: skip
        "compliance_findings": found["complianceFindings"],
        "decisions": [a for a in o["approvals"] if a["documentId"] == document_id],  # type: ignore[index]
    }


@function_tool
async def get_activity(ctx: Ctx, last: int = 12) -> Any:
    """The most recent workflow events, newest last, including agent-to-agent relay messages.

    Args:
        last: how many events to return (default 12).
    """
    oid = onboarding_id(ctx)
    events = await call("GET", f"/api/onboardings/{oid}/events")
    if isinstance(events, dict):
        return events
    return [
        {"at": e["at"], "type": e["type"], "from": e["actor"], "to": e.get("to"), "message": e["message"],
         "transport": e.get("transport")}
        for e in events[-last:]
    ]  # fmt: skip


@function_tool
async def review_document(
    ctx: Ctx, document_id: str, version: int, decision: str, comment: str | None = None
) -> Any:
    """Record the admin's decision on a document version. Only when the admin has clearly said
    to approve or reject that document in this conversation; never on your own judgement.
    A rejection needs a comment saying what to change; it starts the agents' correction.

    Args:
        document_id: "accounting_configuration" or "ledger_mapping".
        version: the version the admin is deciding on (must be the current one).
        decision: "approved" or "rejected".
        comment: required for "rejected": what must change, in the admin's words.
    """
    if decision not in ("approved", "rejected"):
        return {"error": "decision must be approved or rejected"}
    if decision == "rejected" and not (comment or "").strip():
        return {"error": "Ask the admin what needs to change before rejecting."}
    oid = onboarding_id(ctx)
    result = await call(
        "POST",
        f"/api/onboardings/{oid}/review",
        {
            "documentId": document_id,
            "version": version,
            "decision": decision,
            "comment": comment,
            "reviewer": "Admin (via Onboardy)",
            "operationId": f"onboardy-{uuid.uuid4()}",
        },
    )
    if "error" in result:
        return result
    await refresh_dashboard(ctx, oid)  # type: ignore[arg-type]
    return brief(result)  # type: ignore[arg-type]


@function_tool
async def advance_clock(ctx: Ctx, hours: int = 25) -> Any:
    """Demo only: move the onboarding's clock forward to show overdue-approval escalation.

    Args:
        hours: hours to advance (default 25, past the 24h approval SLA).
    """
    oid = onboarding_id(ctx)
    result = await call("POST", f"/api/onboardings/{oid}/clock", {"advanceMinutes": hours * 60})
    if "error" in result:
        return result
    await refresh_dashboard(ctx, oid)  # type: ignore[arg-type]
    return brief(result)  # type: ignore[arg-type]


@function_tool
async def start_onboarding(ctx: Ctx) -> Any:
    """Start a new SpookyStream onboarding and open it in the dashboard."""
    o = await call("POST", "/api/onboardings", {})
    if "error" in o:
        return o
    ctx.context.thread.metadata["onboarding_id"] = o["id"]  # type: ignore[index]
    await ctx.context.stream(ClientEffectEvent(name="onboarding.open", data={"id": o["id"]}))  # type: ignore[index]
    return brief(o)  # type: ignore[arg-type]


INSTRUCTIONS = """You are Onboardy, the admin's assistant inside OnboardOS, an AI business launch orchestrator.
Finance, Document and Compliance agents take a new business (here the fictional SpookyStream, a
$12.99/month streaming subscription) from requirements to launch-ready accounting; a human
approves every document.

How you work:
- Look things up with your tools before answering; never guess a status, version or number.
- You act only through the OnboardOS workflow. Approve or reject only when the admin clearly says
  so for that document, and always for its current version. Before approving, say which document
  and version you're approving. For a rejection, get the change they want in their words.
- A document is launch-ready only when its current version is approved. A revision makes earlier
  approvals stale: say so if they ask why an approval "disappeared".
- Agent-to-agent messages marked transport "simulated" are simulated; don't call them Agent Relay.
- All data is fictional; never present it as real accounting advice.

Style: short and plain, like a capable ops colleague. Lead with the answer. Name documents and
versions ("Ledger Mapping v2"). Use a short list when there are several items. After you change
something, say what changed and what happens next. The dashboard updates by itself."""

onboardy = Agent[AgentContext[dict[str, Any]]](
    name="Onboardy",
    model=MODEL,
    instructions=INSTRUCTIONS,
    tools=[get_onboarding_status, get_document, get_activity, review_document, advance_clock, start_onboarding],
)


# ── ChatKit server ──────────────────────────────────────────────────────────


class OnboardyServer(ChatKitServer[dict[str, Any]]):
    async def respond(
        self, thread: ThreadMetadata, input_user_message: UserMessageItem | None, context: dict[str, Any]
    ) -> AsyncIterator[ThreadStreamEvent]:
        # The dashboard's open onboarding wins: the chat follows what the admin is looking at.
        if context.get("onboarding_id"):
            thread.metadata["onboarding_id"] = context["onboarding_id"]
        agent_context = AgentContext(thread=thread, store=self.store, request_context=context)
        page = await self.store.load_thread_items(thread.id, None, HISTORY, "desc", context)
        items = list(reversed(page.data))
        result = Runner.run_streamed(onboardy, await simple_to_agent_input(items), context=agent_context)
        async for event in stream_agent_response(agent_context, result):
            yield event
        await self.store.save_thread(thread, context)


STORE = make_store()
server = OnboardyServer(STORE)
app = FastAPI(title="Onboardy")


@app.post("/chatkit")
async def chatkit(request: Request) -> Response:
    context = {
        "user_id": request.headers.get("x-onboardos-admin", "admin"),
        "onboarding_id": request.headers.get("x-onboardos-onboarding") or None,
    }
    result = await server.process(await request.body(), context)
    if isinstance(result, StreamingResult):
        return StreamingResponse(result, media_type="text/event-stream")
    return Response(content=result.json, media_type="application/json")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"ok": "onboardy", "model": MODEL, "api": API, "store": type(STORE).__name__}
