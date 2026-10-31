/**
 * OnboardOS backend — Express server on port 4000.
 *
 * Uses Terse durable actors for state persistence and Agent Relay for
 * real agent-to-agent messaging. The five contract endpoints are served
 * exactly as the stand-in does, but with durable state and real relay.
 */
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ApiError, ClockRequest, ReviewRequest, StartRequest } from "./contract.js";

// ── Terse actor client ─────────────────────────────────────────────────────
// The generated client connects to the durable-actors runtime on port 7100.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — generated JS, no .d.ts in the import path for tsx
import { actors } from "../generated/index.js";

// ── Agent Relay (SDK) ──────────────────────────────────────────────────────

import { AgentRelay } from "@agent-relay/sdk";

const RELAY_URL = process.env.RELAY_URL ?? "http://127.0.0.1:8787";
let relay: InstanceType<typeof AgentRelay>;
const agentClients: Record<string, Awaited<ReturnType<InstanceType<typeof AgentRelay>["workspace"]["reconnect"]>>> = {};

async function initRelay(): Promise<void> {
  const fs = await import("node:fs");
  // Load workspace key
  let workspaceKey = process.env.RELAY_WORKSPACE_KEY;
  if (!workspaceKey) {
    try {
      const ws = JSON.parse(fs.readFileSync(`${process.env.HOME}/.agentworkforce/relay/workspaces.json`, "utf8"));
      workspaceKey = ws.workspaces?.[ws.active]?.key;
    } catch {}
  }
  if (!workspaceKey) {
    console.warn("Agent Relay: no workspace key found");
    return;
  }

  relay = new AgentRelay({ baseUrl: RELAY_URL, workspaceKey });

  // Load agent tokens
  const agentTokens: Record<string, string> = {};
  try {
    const data = JSON.parse(fs.readFileSync(`${process.env.HOME}/.agentworkforce/relay/agent-tokens.json`, "utf8"));
    for (const [key, token] of Object.entries(data.tokens as Record<string, string>)) {
      const name = key.split("|").pop()!;
      agentTokens[name] = token;
    }
  } catch {}

  // Connect each agent
  for (const [name, token] of Object.entries(agentTokens)) {
    try {
      agentClients[name] = await relay.workspace.reconnect({ apiToken: token });
      console.log(`Agent Relay: connected ${name}`);
    } catch (err) {
      console.warn(`Agent Relay: failed to connect ${name}:`, err);
    }
  }
}

async function relaySend(from: string, to: string, text: string): Promise<string | null> {
  const client = agentClients[from];
  if (!client) {
    console.log(`[relay-noop] ${from} → ${to}: ${text.slice(0, 80)}...`);
    return null;
  }
  try {
    const result = await client.sendMessage({ to: `@${to}`, text });
    const msgId = (result as any)?.messageId ?? (result as any)?.id ?? null;
    console.log(`[relay] ${from} → ${to} (msg ${msgId})`);
    return msgId;
  } catch (err) {
    console.warn(`[relay] send error:`, err);
    return null;
  }
}

/**
 * After each actor operation, drain any relay messages the actor queued
 * and send them through Agent Relay.
 */
async function drainRelayMessages(actorId: string): Promise<void> {
  // One drain at a time per onboarding, so a reader can wait for sends already in flight.
  const previous = draining.get(actorId) ?? Promise.resolve();
  const next = previous.then(async () => {
    try {
      const actor = actors.OnboardingActor.get(actorId);
      const msgs = await actor.getLastRelayMessages();
      for (const m of msgs) {
        if (await relaySend(m.from, m.to, m.text)) markSent(actorId, m);
      }
    } catch {
      // Actor may not have relay messages; ignore
    }
  });
  draining.set(actorId, next);
  return next;
}

// ── What Agent Relay actually accepted ──────────────────────────────────────
// The actor records every agent message as "simulated"; only a message Agent Relay accepted
// is shown as "agent_relay". Kept on disk so the labels survive a restart.

const draining = new Map<string, Promise<void>>();
const SENT_FILE = path.join(process.cwd(), ".data", "relay-sent.json"); // run from backend/
const sent = new Set<string>(loadSent());

function relayKey(onboardingId: string, m: { from: string; to?: string; threadId?: string; text?: string; message?: string }): string {
  return [onboardingId, m.threadId ?? "", m.from, m.to ?? "", m.text ?? m.message ?? ""].join("\u0000");
}
function loadSent(): string[] {
  try {
    return JSON.parse(fs.readFileSync(SENT_FILE, "utf8"));
  } catch {
    return [];
  }
}
function markSent(onboardingId: string, m: { from: string; to: string; threadId: string; text: string }): void {
  sent.add(relayKey(onboardingId, m));
  fs.mkdirSync(path.dirname(SENT_FILE), { recursive: true });
  fs.writeFileSync(`${SENT_FILE}.tmp`, JSON.stringify([...sent]));
  fs.renameSync(`${SENT_FILE}.tmp`, SENT_FILE);
}
function withTransport(onboardingId: string, events: any[]): any[] {
  return events.map((e) =>
    e.type === "relay.message"
      ? { ...e, transport: sent.has(relayKey(onboardingId, { from: e.actor, to: e.to, threadId: e.threadId, message: e.message })) ? "agent_relay" : "simulated" }
      : e,
  );
}

// ── Express app ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (_req.method === "OPTIONS") return res.sendStatus(204) as unknown as void;
  next();
});

const STATUS: Record<string, number> = { not_found: 404, stale_version: 409, invalid: 400 };

function reply(res: express.Response, result: unknown) {
  if (result && typeof result === "object" && "error" in result && "code" in result) {
    const err = result as ApiError;
    return res.status(STATUS[err.code] ?? 500).json(err);
  }
  res.json(result);
}

// Map onboarding IDs to their actor IDs (the actor ID is the onboarding ID)
// We use a simple in-memory registry; the actor itself holds durable state.
const onboardingActors = new Map<string, true>();

// POST /api/onboardings
app.post("/api/onboardings", async (req, res) => {
  try {
    const body = (req.body ?? {}) as StartRequest;
    // Actor ID = onboarding ID — the dashboard polls with this ID
    const actorId = crypto.randomUUID().slice(0, 8);
    const actor = actors.OnboardingActor.get(actorId);
    const state = await actor.start(actorId, body.requirements);
    onboardingActors.set(actorId, true);
    // Drain relay messages (finance→document handoff)
    setTimeout(() => drainRelayMessages(actorId), 2500);
    setTimeout(() => drainRelayMessages(actorId), 5000);
    setTimeout(() => drainRelayMessages(actorId), 7500);
    res.json(state);
  } catch (err) {
    console.error("start error:", err);
    res.status(500).json({ error: String(err), code: "invalid" });
  }
});

// GET /api/onboardings/:id
app.get("/api/onboardings/:id", async (req, res) => {
  try {
    const actor = actors.OnboardingActor.get(req.params.id);
    const state = await actor.getSnapshot();
    if (!state) return res.status(404).json({ error: `onboarding ${req.params.id} not found`, code: "not_found" });
    await drainRelayMessages(req.params.id);
    res.json(state);
  } catch (err) {
    console.error("snapshot error:", err);
    res.status(404).json({ error: `onboarding ${req.params.id} not found`, code: "not_found" });
  }
});

// GET /api/onboardings/:id/events
app.get("/api/onboardings/:id/events", async (req, res) => {
  try {
    const after = parseInt(req.query.after as string, 10) || 0;
    const actor = actors.OnboardingActor.get(req.params.id);
    const evts = await actor.getEvents(after);
    // Send what this read queued (and wait for sends already in flight) before labelling:
    // the dashboard reads each event once, so the label must be final when served.
    await drainRelayMessages(req.params.id);
    res.json(withTransport(req.params.id, evts));
  } catch (err) {
    res.status(404).json({ error: `onboarding ${req.params.id} not found`, code: "not_found" });
  }
});

// POST /api/onboardings/:id/review
app.post("/api/onboardings/:id/review", async (req, res) => {
  try {
    const body = req.body as ReviewRequest;
    const actor = actors.OnboardingActor.get(req.params.id);
    const result = await actor.reviewDocument(
      body.documentId, body.version, body.decision,
      body.operationId, body.comment, body.reviewer,
    );
    if (result.error && result.code) {
      return res.status(STATUS[result.code] ?? 400).json({ error: result.error, code: result.code });
    }
    // Drain relay messages for rejection→correction flow
    setTimeout(() => drainRelayMessages(req.params.id), 1500);
    setTimeout(() => drainRelayMessages(req.params.id), 3000);
    setTimeout(() => drainRelayMessages(req.params.id), 5000);
    setTimeout(() => drainRelayMessages(req.params.id), 7000);
    res.json(result.result);
  } catch (err) {
    console.error("review error:", err);
    res.status(500).json({ error: String(err), code: "invalid" });
  }
});

// POST /api/onboardings/:id/clock
app.post("/api/onboardings/:id/clock", async (req, res) => {
  try {
    const body = req.body as ClockRequest;
    const actor = actors.OnboardingActor.get(req.params.id);
    const result = await actor.advanceClock(body.advanceMinutes);
    if (result.error && result.code) {
      return res.status(STATUS[result.code] ?? 400).json({ error: result.error, code: result.code });
    }
    res.json(result.result);
  } catch (err) {
    console.error("clock error:", err);
    res.status(500).json({ error: String(err), code: "invalid" });
  }
});

// ── Start ──────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "4000", 10);

async function main() {
  await initRelay();
  app.listen(PORT, () => {
    console.log(`OnboardOS backend listening on http://localhost:${PORT}`);
    console.log(`  Terse actors: http://127.0.0.1:7100`);
    console.log(`  Agent Relay:  ${RELAY_URL}`);
  });
}

main().catch(console.error);
