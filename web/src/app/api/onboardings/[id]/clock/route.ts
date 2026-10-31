import { forward, reply } from "@/server/api";
import { clock } from "@/server/engine";
import type { ClockRequest } from "@contract/contract";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proxied = await forward(req, `/api/onboardings/${id}/clock`);
  if (proxied) return proxied;
  return reply(await clock(id, (await req.json()) as ClockRequest));
}
