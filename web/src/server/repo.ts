/**
 * Where workflow state lives. Supabase Postgres when SUPABASE_DB_URL is set (one row per
 * onboarding, locked for the length of each request, events and approvals in their own
 * tables), otherwise a local JSON file for offline development.
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import type { Approval, DocumentId, Onboarding, WorkflowEvent } from "@contract/contract";

export type StepKind = "finance" | "generate" | "compliance" | "relay_correction" | "relay_ack" | "revise" | "recheck";
export interface Step {
  kind: StepKind;
  dueAt: number;
  documentId?: DocumentId;
  threadId?: string;
}
export interface Runtime {
  steps: Step[];
  operations: string[]; // operation ids already applied (idempotency)
  awaitingSince: Partial<Record<DocumentId, number>>;
  overdueFlagged: string[];
}
export interface WorkflowRecord extends Runtime {
  onboarding: Onboarding;
  events: WorkflowEvent[];
}

export interface Repo {
  kind: "supabase" | "file";
  create(r: WorkflowRecord): Promise<void>;
  /** Load, let `fn` change the record, save. Null when there's no such onboarding. */
  update<T>(id: string, fn: (r: WorkflowRecord) => T): Promise<T | null>;
  latest(): Promise<Onboarding | null>;
}

const runtimeOf = (r: WorkflowRecord): Runtime => ({
  steps: r.steps,
  operations: r.operations,
  awaitingSince: r.awaitingSince,
  overdueFlagged: r.overdueFlagged,
});

// ── local file ──────────────────────────────────────────────────────────────

const FILE = path.join(process.cwd(), ".data", "store.json");

function readFile(): Record<string, WorkflowRecord> {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}
function writeFile(store: Record<string, WorkflowRecord>): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(store, null, 1));
  fs.renameSync(`${FILE}.tmp`, FILE); // atomic: a crash never leaves half a file
}

const fileRepo: Repo = {
  kind: "file",
  async create(r) {
    const store = readFile();
    store[r.onboarding.id] = r;
    writeFile(store);
  },
  async update(id, fn) {
    const store = readFile();
    const r = store[id];
    if (!r) return null;
    if (!Array.isArray(r.operations)) r.operations = []; // older files kept a map here
    const out = fn(r);
    writeFile(store);
    return out;
  },
  async latest() {
    const all = Object.values(readFile()).map((r) => r.onboarding);
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return all[0] ?? null;
  },
};

// ── Supabase Postgres ───────────────────────────────────────────────────────

type Sql = ReturnType<typeof postgres>;
const g = globalThis as unknown as { __onboardosSql?: Sql };

function sql(): Sql {
  // One pool per server process (dev reloads reuse it). prepare: false for Supabase's pooler.
  g.__onboardosSql ??= postgres(process.env.SUPABASE_DB_URL!, { max: 5, prepare: false, idle_timeout: 20 });
  return g.__onboardosSql;
}

function eventRow(onboardingId: string, e: WorkflowEvent) {
  return {
    onboarding_id: onboardingId, seq: e.seq, id: e.id, at: e.at, type: e.type, actor: e.actor,
    message: e.message, task_id: e.taskId ?? null, document_id: e.documentId ?? null,
    version: e.version ?? null, thread_id: e.threadId ?? null, to_actor: e.to ?? null,
    transport: e.transport ?? null, operation_id: e.operationId ?? null,
  }; // prettier-ignore
}
function approvalRow(onboardingId: string, a: Approval) {
  return {
    id: a.id, onboarding_id: onboardingId, document_id: a.documentId, version: a.version,
    decision: a.decision, comment: a.comment ?? null, reviewer: a.reviewer, at: a.at,
    operation_id: a.operationId,
  }; // prettier-ignore
}
function toEvent(row: Record<string, unknown>): WorkflowEvent {
  const e: WorkflowEvent = {
    id: String(row.id), seq: Number(row.seq), at: new Date(row.at as string).toISOString(),
    type: row.type as WorkflowEvent["type"], actor: row.actor as WorkflowEvent["actor"],
    message: String(row.message),
  }; // prettier-ignore
  if (row.task_id) e.taskId = row.task_id as WorkflowEvent["taskId"];
  if (row.document_id) e.documentId = row.document_id as DocumentId;
  if (row.version != null) e.version = Number(row.version);
  if (row.thread_id) e.threadId = String(row.thread_id);
  if (row.to_actor) e.to = row.to_actor as WorkflowEvent["to"];
  if (row.transport) e.transport = row.transport as WorkflowEvent["transport"];
  if (row.operation_id) e.operationId = String(row.operation_id);
  return e;
}

const supabaseRepo: Repo = {
  kind: "supabase",
  async create(r) {
    await sql().begin(async (tx) => {
      const o = r.onboarding;
      await tx`
        insert into onboardos.onboardings (id, company, status, snapshot, runtime, created_at, updated_at)
        values (${o.id}, ${o.requirements.company}, ${o.status}, ${tx.json(JSON.parse(JSON.stringify(o)))},
                ${tx.json(JSON.parse(JSON.stringify(runtimeOf(r))))}, ${o.createdAt}, ${o.updatedAt})`;
      if (r.events.length) await tx`insert into onboardos.events ${tx(r.events.map((e) => eventRow(o.id, e)))}`;
    });
  },
  async update(id, fn) {
    return sql().begin(async (tx) => {
      const [row] = await tx`
        select snapshot, runtime from onboardos.onboardings where id = ${id} for update`;
      if (!row) return null;
      const events = (await tx`
        select * from onboardos.events where onboarding_id = ${id} order by seq`).map(toEvent);
      const runtime = row.runtime as Partial<Runtime>;
      const r: WorkflowRecord = {
        onboarding: row.snapshot as Onboarding,
        events,
        steps: runtime.steps ?? [],
        operations: runtime.operations ?? [],
        awaitingSince: runtime.awaitingSince ?? {},
        overdueFlagged: runtime.overdueFlagged ?? [],
      };
      const lastSeq = events.length;
      const knownApprovals = new Set(r.onboarding.approvals.map((a) => a.id));
      const out = fn(r);
      const o = r.onboarding;
      await tx`
        update onboardos.onboardings
        set status = ${o.status}, snapshot = ${tx.json(JSON.parse(JSON.stringify(o)))},
            runtime = ${tx.json(JSON.parse(JSON.stringify(runtimeOf(r))))}, updated_at = ${o.updatedAt}
        where id = ${id}`;
      const newEvents = r.events.filter((e) => e.seq > lastSeq);
      if (newEvents.length) await tx`insert into onboardos.events ${tx(newEvents.map((e) => eventRow(id, e)))}`;
      const newApprovals = o.approvals.filter((a) => !knownApprovals.has(a.id));
      if (newApprovals.length) await tx`insert into onboardos.approvals ${tx(newApprovals.map((a) => approvalRow(id, a)))}`;
      return out;
    }) as Promise<ReturnType<typeof fn> | null>;
  },
  async latest() {
    const [row] = await sql()`select snapshot from onboardos.onboardings order by created_at desc limit 1`;
    return row ? (row.snapshot as Onboarding) : null;
  },
};

export const repo: Repo = process.env.SUPABASE_DB_URL ? supabaseRepo : fileRepo;
