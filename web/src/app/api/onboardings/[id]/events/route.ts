import { forward, reply } from "@/server/api";
import { events } from "@/server/engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0);
  return (await forward(req, `/api/onboardings/${id}/events`)) ?? reply(await events(id, after));
}
