/**
 * Stand-in workflow backend, used when BACKEND_URL isn't set. It implements the shared
 * contract the way the durable actor must: state persisted (Supabase, or a local file; see
 * repo.ts), an append-only event
 * history, agent work advanced by explicit timed steps (no long-running process), reviews
 * tied to a document version, idempotent by operationId. Its relay messages are labelled
 * "simulated"; the real backend sends them through Agent Relay.
 */
import crypto from "node:crypto";
import {
  isLaunchReady,
  type Actor,
  type ApiError,
  type ClockRequest,
  type Document,
  type DocumentId,
  type Onboarding,
  type ReviewRequest,
  type StartRequest,
  type Task,
  type TaskId,
  type WorkflowEvent,
} from "@contract/contract";
import {
  ACCOUNTING_CONFIGURATION,
  FINANCE_RULES,
  LEDGER_MAPPING_V1,
  LEDGER_MAPPING_V2,
  SPOOKYSTREAM,
} from "./seed";

import { repo, type Step, type WorkflowRecord as Record_ } from "./repo";

const SECOND = 1000;


const iso = (ms: number) => new Date(ms).toISOString();

function emit(r: Record_, e: Omit<WorkflowEvent, "id" | "seq" | "at">, at = Date.now()): void {
  r.events.push({ ...e, id: crypto.randomUUID(), seq: r.events.length + 1, at: iso(at) });
  r.onboarding.updatedAt = iso(at);
}
function task(r: Record_, id: TaskId): Task {
  return r.onboarding.tasks.find((t) => t.id === id)!;
}
function doc(r: Record_, id: DocumentId): Document {
  return r.onboarding.documents.find((d) => d.id === id)!;
}
function setTask(r: Record_, id: TaskId, status: Task["status"], at: number, summary?: string): void {
  const t = task(r, id);
  t.status = status;
  if (status === "running") t.startedAt = iso(at);
  if (status === "done") t.completedAt = iso(at);
  if (summary) t.summary = summary;
  emit(
    r,
    {
      type: status === "done" ? "task.completed" : "task.started",
      actor: t.owner,
      taskId: id,
      message: status === "done" ? `${t.title}: ${summary ?? "done"}` : `${t.title} started`,
    },
    at,
  );
}
function relay(r: Record_, from: Actor, to: Actor, threadId: string, message: string, at: number, documentId?: DocumentId): void {
  emit(r, { type: "relay.message", actor: from, to, threadId, documentId, transport: "simulated", message }, at);
}

const TASKS: Omit<Task, "status">[] = [
  { id: "business_requirements", title: "Business requirements", owner: "orchestrator", dependsOn: [] },
  { id: "finance_mapping", title: "Finance mapping", owner: "finance_agent", dependsOn: ["business_requirements"] },
  { id: "document_generation", title: "Documents generated", owner: "document_agent", dependsOn: ["finance_mapping"] },
  { id: "compliance_review", title: "Compliance review", owner: "compliance_agent", dependsOn: ["document_generation"] },
  { id: "human_approval", title: "Human approval", owner: "human_reviewer", dependsOn: ["compliance_review"] },
  { id: "launch_readiness", title: "Launch readiness", owner: "orchestrator", dependsOn: ["human_approval"] },
];

export async function start(req: StartRequest): Promise<Onboarding> {
  const now = Date.now();
  const id = crypto.randomUUID().slice(0, 8);
  const requirements = { ...SPOOKYSTREAM, ...(req.requirements ?? {}) };
  const r: Record_ = {
    onboarding: {
      id,
      requirements,
      status: "in_progress",
      tasks: TASKS.map((t) => ({ ...t, status: "blocked" })),
      documents: [
        { id: "accounting_configuration", title: "Accounting Configuration", currentVersion: 0, status: "generating", versions: [] },
        { id: "ledger_mapping", title: "Ledger Mapping", currentVersion: 0, status: "generating", versions: [] },
      ],
      approvals: [],
      clock: { offsetMinutes: 0, approvalSlaMinutes: 24 * 60 },
      createdAt: iso(now),
      updatedAt: iso(now),
    },
    events: [],
    steps: [],
    operations: [],
    awaitingSince: {},
    overdueFlagged: [],
  };
  emit(r, { type: "onboarding.started", actor: "orchestrator", message: `${requirements.company} onboarding started: $${requirements.priceUsd}/${requirements.billingInterval}` }, now);
  setTask(r, "business_requirements", "done", now, "Price, billing and refund policy captured");
  setTask(r, "finance_mapping", "running", now);
  r.steps.push({ kind: "finance", dueAt: now + 2 * SECOND });
  await repo.create(r);
  return r.onboarding;
}

/** Run every step whose time has come. Called on each read, so a restart loses nothing. */
function advance(r: Record_, now: number): void {
  r.steps.sort((a, b) => a.dueAt - b.dueAt);
  while (r.steps.length && r.steps[0].dueAt <= now) {
    const s = r.steps.shift()!;
    run(r, s, s.dueAt);
  }
  const clockNow = now + r.onboarding.clock.offsetMinutes * 60 * SECOND;
  for (const d of r.onboarding.documents) {
    const since = r.awaitingSince[d.id];
    const key = `${d.id}:v${d.currentVersion}`;
    if (d.status === "awaiting_approval" && since && !r.overdueFlagged.includes(key)) {
      if (clockNow - since > r.onboarding.clock.approvalSlaMinutes * 60 * SECOND) {
        r.overdueFlagged.push(key);
        emit(r, { type: "approval.overdue", actor: "orchestrator", documentId: d.id, version: d.currentVersion, message: `${d.title} v${d.currentVersion} approval is overdue (SLA ${r.onboarding.clock.approvalSlaMinutes / 60}h): escalated to the finance lead` }, now);
      }
    }
  }
}

function run(r: Record_, s: Step, at: number): void {
  const o = r.onboarding;
  switch (s.kind) {
    case "finance": {
      setTask(r, "finance_mapping", "done", at, `${FINANCE_RULES.length} scenarios mapped to accounting rules`);
      relay(r, "finance_agent", "document_agent", "thread-mapping", `Mapping ready: ${FINANCE_RULES.map((f) => f.ruleId).join(", ")}. Please draft Accounting Configuration and Ledger Mapping.`, at);
      setTask(r, "document_generation", "running", at);
      r.steps.push({ kind: "generate", dueAt: at + 2 * SECOND });
      break;
    }
    case "generate": {
      for (const [id, rows] of [["accounting_configuration", ACCOUNTING_CONFIGURATION], ["ledger_mapping", LEDGER_MAPPING_V1]] as const) {
        const d = doc(r, id);
        d.versions.push({ version: 1, createdAt: iso(at), createdBy: "document_agent", rows, complianceFindings: [] });
        d.currentVersion = 1;
        d.status = "in_compliance_review";
        emit(r, { type: "document.generated", actor: "document_agent", documentId: id, version: 1, message: `${d.title} v1 generated` }, at);
      }
      setTask(r, "document_generation", "done", at, "Accounting Configuration v1 and Ledger Mapping v1");
      setTask(r, "compliance_review", "running", at);
      r.steps.push({ kind: "compliance", dueAt: at + 2 * SECOND });
      break;
    }
    case "compliance":
    case "recheck": {
      const ids = s.kind === "recheck" ? [s.documentId!] : (["accounting_configuration", "ledger_mapping"] as DocumentId[]);
      for (const id of ids) {
        const d = doc(r, id);
        const v = d.versions[d.versions.length - 1];
        v.complianceFindings =
          id === "ledger_mapping" && v.version === 1
            ? ["Simulated check: all scenarios have a rule ID", "Refund entry not verified against revenue policy"]
            : ["Simulated check: all scenarios have a rule ID", "No policy conflicts found"];
        d.status = "awaiting_approval";
        r.awaitingSince[id] = at + o.clock.offsetMinutes * 60 * SECOND;
        emit(r, { type: "document.compliance_reviewed", actor: "compliance_agent", documentId: id, version: v.version, message: `${d.title} v${v.version} reviewed: ${v.complianceFindings.length} findings, sent for approval` }, at);
      }
      if (s.kind === "compliance") setTask(r, "compliance_review", "done", at, "Simulated review recorded findings");
      if (task(r, "human_approval").status !== "running") setTask(r, "human_approval", "running", at);
      o.status = "awaiting_review";
      break;
    }
    case "relay_correction": {
      const d = doc(r, s.documentId!);
      relay(r, "finance_agent", "document_agent", s.threadId!, `Correction for ${d.title} v${d.currentVersion}: refunds within 7 days must debit Deferred revenue and credit Cash (reverse the deferral), not credit Subscription revenue. Keep rule ACR-1003.`, at, d.id);
      r.steps.push({ kind: "relay_ack", dueAt: at + SECOND, documentId: d.id, threadId: s.threadId });
      break;
    }
    case "relay_ack": {
      const d = doc(r, s.documentId!);
      relay(r, "document_agent", "finance_agent", s.threadId!, `Acknowledged. Regenerating ${d.title} as v${d.currentVersion + 1}.`, at, d.id);
      emit(r, { type: "document.revision_started", actor: "document_agent", documentId: d.id, version: d.currentVersion + 1, message: `${d.title} v${d.currentVersion + 1} in progress` }, at);
      r.steps.push({ kind: "revise", dueAt: at + 2 * SECOND, documentId: d.id, threadId: s.threadId });
      break;
    }
    case "revise": {
      const d = doc(r, s.documentId!);
      const version = d.currentVersion + 1;
      d.versions.push({ version, createdAt: iso(at), createdBy: "document_agent", reason: "Revision: refunds reverse deferred revenue", rows: LEDGER_MAPPING_V2, complianceFindings: [] });
      d.currentVersion = version;
      d.status = "in_compliance_review";
      emit(r, { type: "document.generated", actor: "document_agent", documentId: d.id, version, threadId: s.threadId, message: `${d.title} v${version} generated from the correction thread` }, at);
      r.steps.push({ kind: "recheck", dueAt: at + 2 * SECOND, documentId: d.id });
      break;
    }
  }
}

const notFound = (id: string): ApiError => ({ error: `onboarding ${id} not found`, code: "not_found" });

export async function snapshot(id: string): Promise<Onboarding | ApiError> {
  const out = await repo.update(id, (r) => {
    advance(r, Date.now());
    return r.onboarding;
  });
  return out ?? notFound(id);
}

export async function events(id: string, after = 0): Promise<WorkflowEvent[] | ApiError> {
  const out = await repo.update(id, (r) => {
    advance(r, Date.now());
    return r.events.filter((e) => e.seq > after);
  });
  return out ?? notFound(id);
}

export async function review(id: string, req: ReviewRequest): Promise<Onboarding | ApiError> {
  const out = await repo.update(id, (r) => decide(r, req));
  return out ?? notFound(id);
}

function decide(r: Record_, req: ReviewRequest): Onboarding | ApiError {
  const now = Date.now();
  advance(r, now);
  if (r.operations.includes(req.operationId)) return r.onboarding; // same click twice: no second effect
  const d = r.onboarding.documents.find((x) => x.id === req.documentId);
  if (!d) return { error: `no document ${req.documentId}`, code: "not_found" };
  if (req.version !== d.currentVersion || d.status !== "awaiting_approval") {
    return { error: `${d.title} v${req.version} is not awaiting approval (current v${d.currentVersion}, ${d.status})`, code: "stale_version" };
  }
  const reviewer = req.reviewer ?? "Finance reviewer";
  r.onboarding.approvals.push({ id: crypto.randomUUID(), documentId: d.id, version: d.currentVersion, decision: req.decision, comment: req.comment, reviewer, at: iso(now), operationId: req.operationId });
  delete r.awaitingSince[d.id];
  if (req.decision === "rejected") {
    d.status = "changes_requested";
    r.onboarding.status = "revising";
    task(r, "human_approval").status = "changes_requested";
    const threadId = `thread-${d.id}-v${d.currentVersion}`;
    emit(r, { type: "review.rejected", actor: "human_reviewer", documentId: d.id, version: d.currentVersion, threadId, operationId: req.operationId, message: `${d.title} v${d.currentVersion} rejected: "${req.comment ?? "changes requested"}"` }, now);
    r.steps.push({ kind: "relay_correction", dueAt: now + SECOND, documentId: d.id, threadId });
  } else {
    d.status = "approved";
    emit(r, { type: "review.approved", actor: "human_reviewer", documentId: d.id, version: d.currentVersion, operationId: req.operationId, message: `${d.title} v${d.currentVersion} approved` }, now);
    if (isLaunchReady(r.onboarding)) {
      setTask(r, "human_approval", "done", now, "Every document approved at its current version");
      setTask(r, "launch_readiness", "done", now, "Ready to launch");
      r.onboarding.status = "launch_ready";
      emit(r, { type: "onboarding.launch_ready", actor: "orchestrator", message: `${r.onboarding.requirements.company} is ready to launch` }, now);
    } else if (r.onboarding.status !== "revising") {
      r.onboarding.status = r.onboarding.documents.some((x) => x.status === "awaiting_approval") ? "awaiting_review" : "in_progress";
    }
  }
  r.operations.push(req.operationId);
  return r.onboarding;
}

export async function clock(id: string, req: ClockRequest): Promise<Onboarding | ApiError> {
  if (!(req.advanceMinutes > 0)) return { error: "advanceMinutes must be positive", code: "invalid" };
  const out = await repo.update(id, (r) => {
    r.onboarding.clock.offsetMinutes += req.advanceMinutes;
    advance(r, Date.now());
    return r.onboarding;
  });
  return out ?? notFound(id);
}

export function latest(): Promise<Onboarding | null> {
  return repo.latest();
}
