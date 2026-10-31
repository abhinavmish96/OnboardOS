/**
 * OnboardingActor — Terse durable actor for OnboardOS.
 *
 * Each onboarding gets its own actor instance (keyed by onboarding ID).
 * All state is @Persisted, surviving restarts and dormancy automatically.
 * The actor exposes operations that the Express server calls via the
 * generated typed client.
 *
 * IMPORTANT: Terse requires every method on an Actor to be async.
 */
import { Actor, Persisted } from "durable-actors";

// ── Inline contract types ──────────────────────────────────────────────────

type AgentId = "finance_agent" | "document_agent" | "compliance_agent";
type Actor_ = AgentId | "orchestrator" | "human_reviewer";
type TaskId =
  | "business_requirements" | "finance_mapping" | "document_generation"
  | "compliance_review" | "human_approval" | "launch_readiness";
type DocumentId = "accounting_configuration" | "ledger_mapping";
type TaskStatus = "blocked" | "ready" | "running" | "done" | "changes_requested";
type DocumentStatus = "generating" | "in_compliance_review" | "awaiting_approval" | "changes_requested" | "approved";
type Decision = "approved" | "rejected";
type OnboardingStatus = "in_progress" | "awaiting_review" | "revising" | "launch_ready";
type WorkflowEventType =
  | "onboarding.started" | "task.started" | "task.completed"
  | "document.generated" | "document.compliance_reviewed"
  | "review.approved" | "review.rejected" | "relay.message"
  | "document.revision_started" | "approval.overdue" | "onboarding.launch_ready";

interface MappingRow { scenario: string; ruleId: string; debit: string; credit: string; note?: string; }
interface DocumentVersion { version: number; createdAt: string; createdBy: AgentId; reason?: string; rows: MappingRow[]; complianceFindings: string[]; }
interface Doc { id: DocumentId; title: string; currentVersion: number; status: DocumentStatus; versions: DocumentVersion[]; }
interface Task { id: TaskId; title: string; owner: Actor_; status: TaskStatus; dependsOn: TaskId[]; startedAt?: string; completedAt?: string; summary?: string; }
interface Approval { id: string; documentId: DocumentId; version: number; decision: Decision; comment?: string; reviewer: string; at: string; operationId: string; }
interface WorkflowEvent {
  id: string; seq: number; at: string; type: WorkflowEventType; actor: Actor_; message: string;
  taskId?: TaskId; documentId?: DocumentId; version?: number;
  threadId?: string; to?: Actor_; transport?: "agent_relay" | "simulated"; operationId?: string;
}
interface BusinessRequirements { company: string; product: string; priceUsd: number; billingInterval: "month"; refundPolicy: string; launchDate: string; }

interface OnboardingState {
  id: string; requirements: BusinessRequirements; status: OnboardingStatus;
  tasks: Task[]; documents: Doc[]; approvals: Approval[];
  clock: { offsetMinutes: number; approvalSlaMinutes: number };
  createdAt: string; updatedAt: string;
}

type StepKind = "finance" | "generate" | "compliance" | "relay_correction" | "relay_ack" | "revise" | "recheck";
interface Step { kind: StepKind; dueAt: number; documentId?: DocumentId; threadId?: string; }
interface RelayMsg { from: Actor_; to: Actor_; threadId: string; text: string; documentId?: DocumentId; }

// ── Seed data ──────────────────────────────────────────────────────────────

const SPOOKYSTREAM: BusinessRequirements = {
  company: "SpookyStream", product: "Monthly streaming subscription",
  priceUsd: 12.99, billingInterval: "month",
  refundPolicy: "Full refund within 7 days of a charge if fewer than 2 hours were streamed; otherwise no refund.",
  launchDate: "2026-11-15",
};

const FINANCE_RULES = [
  { ruleId: "ACR-1001", scenario: "New subscription charge" },
  { ruleId: "ACR-1002", scenario: "Monthly revenue recognition" },
  { ruleId: "ACR-1003", scenario: "Refund within 7 days" },
  { ruleId: "ACR-1004", scenario: "Failed payment retry" },
];

const ACCOUNTING_CONFIGURATION: MappingRow[] = [
  { scenario: "Billing plan", ruleId: "CFG-01", debit: "—", credit: "—", note: "$12.99 / month, billed in advance" },
  { scenario: "Revenue schedule", ruleId: "CFG-02", debit: "—", credit: "—", note: "Ratable over the 1-month service period" },
  { scenario: "Refund window", ruleId: "CFG-03", debit: "—", credit: "—", note: "7 days, under 2 streamed hours" },
  { scenario: "Tax handling", ruleId: "CFG-04", debit: "—", credit: "—", note: "Tax collected separately, excluded from revenue" },
];

const LEDGER_MAPPING_V1: MappingRow[] = [
  { scenario: "New subscription charge", ruleId: "ACR-1001", debit: "Cash", credit: "Deferred revenue" },
  { scenario: "Monthly revenue recognition", ruleId: "ACR-1002", debit: "Deferred revenue", credit: "Subscription revenue" },
  { scenario: "Refund within 7 days", ruleId: "ACR-1003", debit: "Refund expense", credit: "Subscription revenue", note: "Books the refund as new revenue" },
  { scenario: "Failed payment retry", ruleId: "ACR-1004", debit: "Accounts receivable", credit: "Deferred revenue" },
];

const LEDGER_MAPPING_V2: MappingRow[] = [
  LEDGER_MAPPING_V1[0], LEDGER_MAPPING_V1[1],
  { scenario: "Refund within 7 days", ruleId: "ACR-1003", debit: "Deferred revenue", credit: "Cash", note: "Reverses the deferred revenue from the charge" },
  LEDGER_MAPPING_V1[3],
];

const TASK_DEFS: Omit<Task, "status">[] = [
  { id: "business_requirements", title: "Business requirements", owner: "orchestrator", dependsOn: [] },
  { id: "finance_mapping", title: "Finance mapping", owner: "finance_agent", dependsOn: ["business_requirements"] },
  { id: "document_generation", title: "Documents generated", owner: "document_agent", dependsOn: ["finance_mapping"] },
  { id: "compliance_review", title: "Compliance review", owner: "compliance_agent", dependsOn: ["document_generation"] },
  { id: "human_approval", title: "Human approval", owner: "human_reviewer", dependsOn: ["compliance_review"] },
  { id: "launch_readiness", title: "Launch readiness", owner: "orchestrator", dependsOn: ["human_approval"] },
];

// ── Pure helpers (NOT methods — no async requirement) ──────────────────────

const iso = (ms: number) => new Date(ms).toISOString();
const uuid = () => crypto.randomUUID();

function isLaunchReady(docs: Doc[], approvals: Approval[]): boolean {
  return docs.every((d) => {
    const forCurrent = approvals.filter((a) => a.documentId === d.id && a.version === d.currentVersion);
    return d.currentVersion > 0 && forCurrent.at(-1)?.decision === "approved";
  });
}

// ── The Actor ──────────────────────────────────────────────────────────────

export class OnboardingActor extends Actor {
  @Persisted private state: OnboardingState | null = null;
  @Persisted private events: WorkflowEvent[] = [];
  @Persisted private steps: Step[] = [];
  @Persisted private operations: Record<string, OnboardingState> = {};
  @Persisted private awaitingSince: Record<string, number> = {};
  @Persisted private overdueFlagged: string[] = [];
  @Persisted private lastRelayMessages: RelayMsg[] = [];

  // All helpers are inlined into the public async methods below to avoid
  // Terse's "every method must be async" constraint on private helpers.
  // We use standalone functions that take+return state instead.

  async start(onboardingId: string, reqRequirements?: Partial<BusinessRequirements>): Promise<OnboardingState> {
    const now = Date.now();
    const id = onboardingId;
    const requirements = { ...SPOOKYSTREAM, ...(reqRequirements ?? {}) };
    this.events = [];
    this.steps = [];
    this.operations = {};
    this.awaitingSince = {};
    this.overdueFlagged = [];
    this.lastRelayMessages = [];
    this.state = {
      id, requirements, status: "in_progress",
      tasks: TASK_DEFS.map((t) => ({ ...t, status: "blocked" as const })),
      documents: [
        { id: "accounting_configuration", title: "Accounting Configuration", currentVersion: 0, status: "generating", versions: [] },
        { id: "ledger_mapping", title: "Ledger Mapping", currentVersion: 0, status: "generating", versions: [] },
      ],
      approvals: [], clock: { offsetMinutes: 0, approvalSlaMinutes: 24 * 60 },
      createdAt: iso(now), updatedAt: iso(now),
    };

    pushEvent(this, { type: "onboarding.started", actor: "orchestrator",
      message: `${requirements.company} onboarding started: $${requirements.priceUsd}/${requirements.billingInterval}` }, now);
    doSetTask(this, "business_requirements", "done", now, "Price, billing and refund policy captured");
    doSetTask(this, "finance_mapping", "running", now);
    this.steps = [{ kind: "finance", dueAt: now + 2000 }];
    return this.state;
  }

  async getSnapshot(): Promise<OnboardingState | null> {
    if (!this.state) return null;
    this.lastRelayMessages = [];
    doAdvance(this, Date.now());
    return this.state;
  }

  async getEvents(after: number = 0): Promise<WorkflowEvent[]> {
    if (!this.state) return [];
    doAdvance(this, Date.now());
    return this.events.filter((e) => e.seq > after);
  }

  async getLastRelayMessages(): Promise<RelayMsg[]> {
    const msgs = this.lastRelayMessages;
    this.lastRelayMessages = [];
    return msgs;
  }

  async reviewDocument(
    documentId: DocumentId, version: number, decision: Decision,
    operationId: string, comment?: string, reviewer?: string,
  ): Promise<{ result: OnboardingState; error?: string; code?: string }> {
    if (!this.state) return { result: null as any, error: "not initialized", code: "not_found" };
    const now = Date.now();
    this.lastRelayMessages = [];
    doAdvance(this, now);

    if (this.operations[operationId]) return { result: this.operations[operationId] };

    const d = this.state.documents.find((x) => x.id === documentId);
    if (!d) return { result: null as any, error: `no document ${documentId}`, code: "not_found" };
    if (version !== d.currentVersion || d.status !== "awaiting_approval") {
      return { result: null as any, error: `${d.title} v${version} is not awaiting approval (current v${d.currentVersion}, ${d.status})`, code: "stale_version" };
    }

    const rev = reviewer ?? "Finance reviewer";
    this.state = {
      ...this.state,
      approvals: [...this.state.approvals, {
        id: uuid(), documentId: d.id, version: d.currentVersion, decision,
        comment, reviewer: rev, at: iso(now), operationId,
      }],
    };
    const awsince = { ...this.awaitingSince };
    delete awsince[d.id];
    this.awaitingSince = awsince;

    if (decision === "rejected") {
      const docs = this.state.documents.map((x) =>
        x.id === d.id ? { ...x, status: "changes_requested" as const } : x);
      this.state = { ...this.state, documents: docs, status: "revising",
        tasks: this.state.tasks.map((t) => t.id === "human_approval" ? { ...t, status: "changes_requested" as const } : t) };
      const threadId = `thread-${d.id}-v${d.currentVersion}`;
      pushEvent(this, {
        type: "review.rejected", actor: "human_reviewer", documentId: d.id, version: d.currentVersion,
        threadId, operationId, message: `${d.title} v${d.currentVersion} rejected: "${comment ?? "changes requested"}"`,
      }, now);
      this.steps = [...this.steps, { kind: "relay_correction", dueAt: now + 1000, documentId: d.id, threadId }];
    } else {
      const docs = this.state.documents.map((x) =>
        x.id === d.id ? { ...x, status: "approved" as const } : x);
      this.state = { ...this.state, documents: docs };
      pushEvent(this, {
        type: "review.approved", actor: "human_reviewer", documentId: d.id, version: d.currentVersion,
        operationId, message: `${d.title} v${d.currentVersion} approved`,
      }, now);
      if (isLaunchReady(this.state.documents, this.state.approvals)) {
        doSetTask(this, "human_approval", "done", now, "Every document approved at its current version");
        doSetTask(this, "launch_readiness", "done", now, "Ready to launch");
        this.state = { ...this.state, status: "launch_ready" };
        pushEvent(this, { type: "onboarding.launch_ready", actor: "orchestrator",
          message: `${this.state.requirements.company} is ready to launch` }, now);
      } else if (this.state.status !== "revising") {
        this.state = {
          ...this.state,
          status: this.state.documents.some((x) => x.status === "awaiting_approval") ? "awaiting_review" : "in_progress",
        };
      }
    }

    const ops = { ...this.operations };
    ops[operationId] = JSON.parse(JSON.stringify(this.state));
    this.operations = ops;
    return { result: this.state };
  }

  async advanceClock(minutes: number): Promise<{ result: OnboardingState | null; error?: string; code?: string }> {
    if (!this.state) return { result: null, error: "not initialized", code: "not_found" };
    if (!(minutes > 0)) return { result: null, error: "advanceMinutes must be positive", code: "invalid" };
    this.lastRelayMessages = [];
    this.state = {
      ...this.state,
      clock: { ...this.state.clock, offsetMinutes: this.state.clock.offsetMinutes + minutes },
    };
    doAdvance(this, Date.now());
    return { result: this.state };
  }
}

// ── Free functions that mutate actor fields (avoids async method constraint) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing @Persisted private fields from free fns
function pushEvent(a: any, e: Omit<WorkflowEvent, "id" | "seq" | "at">, at: number): void {
  a.events = [...a.events, { ...e, id: uuid(), seq: a.events.length + 1, at: iso(at) } as WorkflowEvent];
  a.state = { ...a.state!, updatedAt: iso(at) };
}

function doSetTask(a: any, id: TaskId, status: TaskStatus, at: number, summary?: string): void {
  const t = a.state!.tasks.find((x: Task) => x.id === id)!;
  const updated: Task = { ...t, status };
  if (status === "running") updated.startedAt = iso(at);
  if (status === "done") updated.completedAt = iso(at);
  if (summary) updated.summary = summary;
  a.state = { ...a.state!, tasks: a.state!.tasks.map((x: Task) => (x.id === id ? updated : x)) };
  pushEvent(a, {
    type: status === "done" ? "task.completed" : "task.started",
    actor: t.owner, taskId: id,
    message: status === "done" ? `${t.title}: ${summary ?? "done"}` : `${t.title} started`,
  }, at);
}

function doRelay(a: any, from: Actor_, to: Actor_, threadId: string, text: string, at: number, documentId?: DocumentId): void {
  pushEvent(a, { type: "relay.message", actor: from, to, threadId, documentId, transport: "agent_relay", message: text }, at);
  a.lastRelayMessages = [...a.lastRelayMessages, { from, to, threadId, text, documentId }];
}

function doRunStep(a: any, s: Step, at: number): void {
  switch (s.kind) {
    case "finance": {
      doSetTask(a, "finance_mapping", "done", at, `${FINANCE_RULES.length} scenarios mapped to accounting rules`);
      doRelay(a, "finance_agent", "document_agent", "thread-mapping",
        `Mapping ready: ${FINANCE_RULES.map((f) => f.ruleId).join(", ")}. Please draft Accounting Configuration and Ledger Mapping.`, at);
      doSetTask(a, "document_generation", "running", at);
      a.steps = [...a.steps, { kind: "generate", dueAt: at + 2000 }];
      break;
    }
    case "generate": {
      const docs = [...a.state!.documents];
      for (const [id, rows] of [["accounting_configuration", ACCOUNTING_CONFIGURATION], ["ledger_mapping", LEDGER_MAPPING_V1]] as const) {
        const d = docs.find((x: Doc) => x.id === id)!;
        const updated = { ...d, currentVersion: 1, status: "in_compliance_review" as const,
          versions: [...d.versions, { version: 1, createdAt: iso(at), createdBy: "document_agent" as const, rows, complianceFindings: [] as string[] }] };
        docs[docs.indexOf(d)] = updated;
        pushEvent(a, { type: "document.generated", actor: "document_agent", documentId: id, version: 1, message: `${d.title} v1 generated` }, at);
      }
      a.state = { ...a.state!, documents: docs };
      doSetTask(a, "document_generation", "done", at, "Accounting Configuration v1 and Ledger Mapping v1");
      doSetTask(a, "compliance_review", "running", at);
      a.steps = [...a.steps, { kind: "compliance", dueAt: at + 2000 }];
      break;
    }
    case "compliance":
    case "recheck": {
      const ids: DocumentId[] = s.kind === "recheck" ? [s.documentId!] : ["accounting_configuration", "ledger_mapping"];
      const docs = [...a.state!.documents];
      const awsince = { ...a.awaitingSince };
      for (const id of ids) {
        const d = docs.find((x: Doc) => x.id === id)!;
        const v = d.versions[d.versions.length - 1];
        const findings = id === "ledger_mapping" && v.version === 1
          ? ["Simulated check: all scenarios have a rule ID", "Refund entry not verified against revenue policy"]
          : ["Simulated check: all scenarios have a rule ID", "No policy conflicts found"];
        const updatedV = { ...v, complianceFindings: findings };
        const updated = { ...d, status: "awaiting_approval" as const, versions: [...d.versions.slice(0, -1), updatedV] };
        docs[docs.indexOf(d)] = updated;
        awsince[id] = at + a.state!.clock.offsetMinutes * 60_000;
        pushEvent(a, { type: "document.compliance_reviewed", actor: "compliance_agent", documentId: id, version: v.version,
          message: `${d.title} v${v.version} reviewed: ${findings.length} findings, sent for approval` }, at);
      }
      a.state = { ...a.state!, documents: docs };
      a.awaitingSince = awsince;
      if (s.kind === "compliance") doSetTask(a, "compliance_review", "done", at, "Simulated review recorded findings");
      const ha = a.state!.tasks.find((t: Task) => t.id === "human_approval")!;
      if (ha.status !== "running") doSetTask(a, "human_approval", "running", at);
      a.state = { ...a.state!, status: "awaiting_review" };
      break;
    }
    case "relay_correction": {
      const d = a.state!.documents.find((x: Doc) => x.id === s.documentId)!;
      doRelay(a, "finance_agent", "document_agent", s.threadId!,
        `Correction for ${d.title} v${d.currentVersion}: refunds within 7 days must debit Deferred revenue and credit Cash (reverse the deferral), not credit Subscription revenue. Keep rule ACR-1003.`,
        at, d.id);
      a.steps = [...a.steps, { kind: "relay_ack", dueAt: at + 1000, documentId: d.id, threadId: s.threadId }];
      break;
    }
    case "relay_ack": {
      const d = a.state!.documents.find((x: Doc) => x.id === s.documentId)!;
      doRelay(a, "document_agent", "finance_agent", s.threadId!,
        `Acknowledged. Regenerating ${d.title} as v${d.currentVersion + 1}.`, at, d.id);
      pushEvent(a, { type: "document.revision_started", actor: "document_agent", documentId: d.id, version: d.currentVersion + 1,
        message: `${d.title} v${d.currentVersion + 1} in progress` }, at);
      a.steps = [...a.steps, { kind: "revise", dueAt: at + 2000, documentId: d.id, threadId: s.threadId }];
      break;
    }
    case "revise": {
      const d = a.state!.documents.find((x: Doc) => x.id === s.documentId)!;
      const version = d.currentVersion + 1;
      const docs = [...a.state!.documents];
      const updated = { ...d, currentVersion: version, status: "in_compliance_review" as const,
        versions: [...d.versions, { version, createdAt: iso(at), createdBy: "document_agent" as const,
          reason: "Revision: refunds reverse deferred revenue", rows: LEDGER_MAPPING_V2, complianceFindings: [] as string[] }] };
      docs[docs.indexOf(d)] = updated;
      a.state = { ...a.state!, documents: docs };
      pushEvent(a, { type: "document.generated", actor: "document_agent", documentId: d.id, version,
        threadId: s.threadId, message: `${d.title} v${version} generated from the correction thread` }, at);
      a.steps = [...a.steps, { kind: "recheck", dueAt: at + 2000, documentId: d.id }];
      break;
    }
  }
}

function doAdvance(a: any, now: number): void {
  let sorted = [...a.steps].sort((x: Step, y: Step) => x.dueAt - y.dueAt);
  while (sorted.length && sorted[0].dueAt <= now) {
    const s = sorted.shift()!;
    a.steps = sorted;
    doRunStep(a, s, s.dueAt);
    sorted = [...a.steps].sort((x: Step, y: Step) => x.dueAt - y.dueAt);
  }
  a.steps = sorted;

  const clockNow = now + a.state!.clock.offsetMinutes * 60_000;
  const flagged = [...a.overdueFlagged];
  for (const d of a.state!.documents) {
    const since = a.awaitingSince[d.id];
    const key = `${d.id}:v${d.currentVersion}`;
    if (d.status === "awaiting_approval" && since && !flagged.includes(key)) {
      if (clockNow - since > a.state!.clock.approvalSlaMinutes * 60_000) {
        flagged.push(key);
        pushEvent(a, { type: "approval.overdue", actor: "orchestrator", documentId: d.id, version: d.currentVersion,
          message: `${d.title} v${d.currentVersion} approval is overdue (SLA ${a.state!.clock.approvalSlaMinutes / 60}h): escalated to the finance lead` }, now);
      }
    }
  }
  a.overdueFlagged = flagged;
}
