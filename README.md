# OnboardOS: the AI business launch orchestrator

Agents coordinate a real business process for a fictional customer (**SpookyStream**, a
$12.99/month streaming subscription), take a human rejection, correct the work through a
real agent-to-agent thread, and get the launch unblocked.

```
OnboardOS/
  shared/contract.ts   ← THE contract: types, event names, API shapes. Both halves import it.
  web/                 ← Next.js dashboard (Abhi), shadcn/ui
    src/app/page.tsx         one dashboard route
    src/components/          Workflow · DocumentCard · ReviewModal · ActivityFeed
    src/app/api/onboardings  API routes: forward to BACKEND_URL, else the stand-in
    src/server/engine.ts     stand-in backend (reference implementation of the contract)
    src/server/seed.ts       SpookyStream data, fictional rules, Ledger Mapping v1 / v2
  landing/             ← marketing landing page (shadcn/ui), links to the dashboard
  backend/             ← Terse durable actor + Agent Relay (Aditi) — to be created
```

## Run it

```bash
cd web && npm install && npm run dev -- -p 8000        # dashboard: http://localhost:8000
cd landing && npm install && npm run dev -- -p 8001    # landing page: http://localhost:8001
```

The landing page's "Try the demo" buttons go to `NEXT_PUBLIC_APP_URL` (default
`http://localhost:8000`).

With no `BACKEND_URL`, the dashboard runs on the stand-in engine (state in `web/.data/`),
so the whole demo works today. To use Aditi's backend:

```bash
BACKEND_URL=http://localhost:4000 npm run dev
```

Every `/api/onboardings/*` call is then forwarded unchanged to the backend.

## The demo (acceptance test)

1. Start SpookyStream onboarding.
2. Watch agents generate Accounting Configuration v1 and Ledger Mapping v1.
3. Reject Ledger Mapping v1: *"Refund transactions must reverse deferred revenue, not recognize new revenue."*
4. See the Finance Agent → Document Agent correction thread (Agent Relay).
5. Ledger Mapping v2 appears (changed cells highlighted against v1).
6. Refresh the browser: nothing is lost (the id is in the URL, state is on the server).
7. Approve v2 (and Accounting Configuration) → **Launch ready**.

Bonus: "Advance clock 25h" while an approval waits → overdue escalation event.

**Invariant:** launch is ready only when every document's latest decision *for its current
version* is an approval (`isLaunchReady` in `shared/contract.ts`). A revision makes old
approvals stale. A review for any other version returns **409 `stale_version`**.

---

## Plan for Aditi (backend)

**Goal:** replace `web/src/server/engine.ts` with a Terse durable actor that serves the same
five endpoints, and make the agent messages real Agent Relay messages. The dashboard
doesn't change; you point `BACKEND_URL` at your service.

### API you serve (shapes in `shared/contract.ts`)

| Endpoint | Body | Returns | Notes |
|---|---|---|---|
| `POST /api/onboardings` | `StartRequest` | `Onboarding` | Defaults to SpookyStream (`web/src/server/seed.ts`) |
| `GET /api/onboardings/:id` | — | `Onboarding` | Full authoritative snapshot |
| `GET /api/onboardings/:id/events?after=<seq>` | — | `WorkflowEvent[]` | Only events with `seq > after`; `seq` strictly increasing |
| `POST /api/onboardings/:id/review` | `ReviewRequest` | `Onboarding` | 409 `stale_version` unless `version == currentVersion` and status `awaiting_approval`; same `operationId` twice → same result, no second effect |
| `POST /api/onboardings/:id/clock` | `ClockRequest` | `Onboarding` | Adds minutes; overdue approvals emit `approval.overdue` once per document version |

Errors are `ApiError` (`{ error, code }`) with 404 / 409 / 400. The dashboard polls GET
snapshot + events every second.

### Actor operations (from the plan)

| Operation | Behaviour |
|---|---|
| `start()` | Create the onboarding, mark requirements done, start Finance |
| `completeTask()` | Save output, unblock dependents (`Task.dependsOn`) |
| `reviewDocument()` | Persist the decision for that version; reject → start revision |
| `reviseDocument()` | Finance → Document correction over Agent Relay, new version, re-run compliance, back to `awaiting_approval` |
| `advanceClock()` | Shift the demo clock, flag overdue approvals |
| `getSnapshot()` | The `Onboarding` object |

Copy the step order from `engine.ts` (`finance → generate → compliance`, and on reject
`relay_correction → relay_ack → revise → recheck`). It's the behaviour the UI is built and
tested against. Persist an **append-only event list + snapshot**; agent work resumes from
explicit steps, not a long-running LLM loop.

### Agent Relay

- Register `finance_agent`, `document_agent`, `compliance_agent`.
- Mapping handoff: one thread (`thread-mapping`). Each rejection: one thread
  `thread-<documentId>-v<version>` carrying the correction and the acknowledgement.
- For every message actually sent, emit a `relay.message` event with `actor`, `to`,
  `threadId` and **`transport: "agent_relay"`**. The stand-in uses `"simulated"`; the UI
  shows which, so never label a simulated message as Agent Relay.
- Relay carries messages only. The actor decides when a task is done.

### Order of work

1. Actor persists `Onboarding` + events; `POST`/`GET` work; restart keeps state.
2. Timed steps through compliance → `awaiting_approval`.
3. `review` with version check + `operationId` idempotency; reject → v2; approve → launch ready.
4. Swap the correction and ack to real Agent Relay messages.
5. `clock` + overdue escalation.
6. Run the acceptance test against `BACKEND_URL` together.

Quick check of your service (mirrors the run that passes on the stand-in):

```bash
B=http://localhost:4000/api/onboardings
ID=$(curl -s -X POST $B -d '{}' | jq -r .id); sleep 7
curl -s -X POST $B/$ID/review -d '{"documentId":"ledger_mapping","version":2,"decision":"approved","operationId":"x"}'   # 409
curl -s -X POST $B/$ID/review -d '{"documentId":"ledger_mapping","version":1,"decision":"rejected","comment":"Refunds must reverse deferred revenue.","operationId":"op1"}' | jq .status   # "revising"
curl -s -X POST $B/$ID/review -d '{"documentId":"accounting_configuration","version":1,"decision":"approved","operationId":"op2"}' > /dev/null
sleep 7
curl -s -X POST $B/$ID/review -d '{"documentId":"ledger_mapping","version":2,"decision":"approved","operationId":"op3"}' | jq .status   # "launch_ready"
```

## Status

| | Who | State |
|---|---|---|
| Contract, event names, API | Both | Done (`shared/contract.ts`) |
| Dashboard, versions, approval modal, activity feed | Abhi | Done, on the stand-in |
| Terse actor persistence | Aditi | To do |
| Finance and Document agent outputs | Aditi | Stand-in has fixed outputs |
| Real Agent Relay exchange | Aditi | To do |
| Wire reject → revise → approve → ready | Both | Works on the stand-in |
| Refresh / restart recovery, escalation | Both | Works on the stand-in |

All accounting rules and data here are fictional.
