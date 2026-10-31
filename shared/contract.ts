/**
 * OnboardOS shared contract: the one source of truth for the dashboard (Abhi) and the
 * durable actor backend (Aditi). Both sides import these types; the API returns exactly
 * these shapes.
 *
 * Ownership: the backend actor owns workflow state. Agent Relay only carries messages.
 * The browser never decides that a task is complete; it sends a review and re-reads state.
 *
 * Invariant: a document is approved only when an approval exists for its CURRENT version.
 * A revision makes every earlier approval of that document stale.
 */

// ── ids ─────────────────────────────────────────────────────────────────────

export type AgentId = "finance_agent" | "document_agent" | "compliance_agent";
export type Actor = AgentId | "orchestrator" | "human_reviewer";

export type TaskId =
  | "business_requirements"
  | "finance_mapping"
  | "document_generation"
  | "compliance_review"
  | "human_approval"
  | "launch_readiness";

export type DocumentId = "accounting_configuration" | "ledger_mapping";

// ── customer ────────────────────────────────────────────────────────────────

export interface BusinessRequirements {
  company: string; // "SpookyStream"
  product: string; // "Monthly streaming subscription"
  priceUsd: number; // 12.99
  billingInterval: "month";
  refundPolicy: string;
  launchDate: string; // ISO date
}

// ── tasks ───────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "blocked" // waiting on dependencies
  | "ready" // dependencies done, not started
  | "running"
  | "done"
  | "changes_requested"; // a human sent it back; a revision is in flight

export interface Task {
  id: TaskId;
  title: string;
  owner: Actor;
  status: TaskStatus;
  dependsOn: TaskId[];
  startedAt?: string;
  completedAt?: string;
  summary?: string; // one line of output, for the workflow panel
}

// ── documents ───────────────────────────────────────────────────────────────

export type DocumentStatus =
  | "generating"
  | "in_compliance_review"
  | "awaiting_approval"
  | "changes_requested"
  | "approved";

export interface MappingRow {
  scenario: string; // "New subscription charge"
  ruleId: string; // "ACR-1001" (fictional)
  debit: string;
  credit: string;
  note?: string;
}

export interface DocumentVersion {
  version: number; // 1, 2, ...
  createdAt: string;
  createdBy: AgentId;
  reason?: string; // why this version exists ("Revision: refunds reverse deferred revenue")
  rows: MappingRow[];
  complianceFindings: string[];
}

export interface Document {
  id: DocumentId;
  title: string;
  currentVersion: number;
  status: DocumentStatus;
  versions: DocumentVersion[]; // oldest first; the last is current
}

// ── approvals ───────────────────────────────────────────────────────────────

export type Decision = "approved" | "rejected";

export interface Approval {
  id: string;
  documentId: DocumentId;
  version: number; // the version this decision is about; never moves to a later version
  decision: Decision;
  comment?: string;
  reviewer: string;
  at: string;
  operationId: string; // idempotency key from the client
}

// ── events ──────────────────────────────────────────────────────────────────

export type WorkflowEventType =
  | "onboarding.started"
  | "task.started"
  | "task.completed"
  | "document.generated"
  | "document.compliance_reviewed"
  | "review.approved"
  | "review.rejected"
  | "relay.message" // a real Agent Relay message between agents
  | "document.revision_started"
  | "approval.overdue"
  | "onboarding.launch_ready";

export interface WorkflowEvent {
  id: string;
  seq: number; // strictly increasing per onboarding
  at: string;
  type: WorkflowEventType;
  actor: Actor;
  message: string; // human-readable line for the activity feed
  taskId?: TaskId;
  documentId?: DocumentId;
  version?: number;
  // relay.message only
  threadId?: string;
  to?: Actor;
  transport?: "agent_relay" | "simulated"; // never claim Agent Relay for a simulated message
  operationId?: string;
}

// ── onboarding ──────────────────────────────────────────────────────────────

export type OnboardingStatus =
  | "in_progress" // agents working
  | "awaiting_review" // a human decision is needed
  | "revising" // agents are correcting a rejected document
  | "launch_ready";

export interface Onboarding {
  id: string;
  requirements: BusinessRequirements;
  status: OnboardingStatus;
  tasks: Task[];
  documents: Document[];
  approvals: Approval[];
  clock: {
    offsetMinutes: number; // demo clock advance
    approvalSlaMinutes: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ── API ─────────────────────────────────────────────────────────────────────
// POST /api/onboardings              body: StartRequest      -> Onboarding
// GET  /api/onboardings/:id          -> Onboarding
// GET  /api/onboardings/:id/events   ?after=<seq>            -> WorkflowEvent[]
// POST /api/onboardings/:id/review   body: ReviewRequest     -> Onboarding  (409 if stale)
// POST /api/onboardings/:id/clock    body: ClockRequest      -> Onboarding

export interface StartRequest {
  requirements?: Partial<BusinessRequirements>; // defaults to SpookyStream
}

export interface ReviewRequest {
  documentId: DocumentId;
  version: number; // must equal the document's current version, else 409
  decision: Decision;
  comment?: string;
  reviewer?: string;
  operationId: string; // same id twice = same result, no second effect
}

export interface ClockRequest {
  advanceMinutes: number;
}

export interface ApiError {
  error: string;
  code: "not_found" | "stale_version" | "invalid";
}

/** True only when every document's latest decision, for its current version, is an
 * approval. An approval of an earlier version never counts. */
export function isLaunchReady(o: Pick<Onboarding, "documents" | "approvals">): boolean {
  return o.documents.every((d) => {
    const forCurrent = o.approvals.filter((a) => a.documentId === d.id && a.version === d.currentVersion);
    return d.currentVersion > 0 && forCurrent.at(-1)?.decision === "approved";
  });
}
