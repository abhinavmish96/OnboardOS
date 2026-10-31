import type {
  ApiError,
  ClockRequest,
  Onboarding,
  ReviewRequest,
  WorkflowEvent,
} from "@contract/contract";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error((body as ApiError).error), body);
  return body as T;
}

export const api = {
  start: () => call<Onboarding>("/api/onboardings", { method: "POST", body: "{}" }),
  get: (id: string) => call<Onboarding>(`/api/onboardings/${id}`),
  events: (id: string, after = 0) =>
    call<WorkflowEvent[]>(`/api/onboardings/${id}/events?after=${after}`),
  review: (id: string, req: ReviewRequest) =>
    call<Onboarding>(`/api/onboardings/${id}/review`, { method: "POST", body: JSON.stringify(req) }),
  clock: (id: string, req: ClockRequest) =>
    call<Onboarding>(`/api/onboardings/${id}/clock`, { method: "POST", body: JSON.stringify(req) }),
};

export const ACTOR_LABEL: Record<string, string> = {
  finance_agent: "Finance Agent",
  document_agent: "Document Agent",
  compliance_agent: "Compliance Agent",
  orchestrator: "Orchestrator",
  human_reviewer: "Human reviewer",
};
