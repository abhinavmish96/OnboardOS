import { forward, reply } from "@/server/api";
import { review } from "@/server/engine";
import type { ReviewRequest } from "@contract/contract";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proxied = await forward(req, `/api/onboardings/${id}/review`);
  if (proxied) return proxied;
  const body = (await req.json()) as ReviewRequest;
  if (!body?.documentId || !body.version || !body.decision || !body.operationId) {
    return reply({ error: "documentId, version, decision and operationId are required", code: "invalid" as const });
  }
  return reply(review(id, body));
}
