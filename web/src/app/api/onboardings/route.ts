import { forward, reply } from "@/server/api";
import { start } from "@/server/engine";
import type { StartRequest } from "@contract/contract";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const proxied = await forward(req, "/api/onboardings");
  if (proxied) return proxied;
  const body = (await req.json().catch(() => ({}))) as StartRequest;
  return reply(start(body));
}
