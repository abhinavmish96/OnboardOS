import { forward, reply } from "@/server/api";
import { snapshot } from "@/server/engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (await forward(req, `/api/onboardings/${id}`)) ?? reply(await snapshot(id));
}
