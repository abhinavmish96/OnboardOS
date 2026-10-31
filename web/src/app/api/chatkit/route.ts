/**
 * Onboardy's chat endpoint. The browser talks to this route; it forwards to the Onboardy
 * agent service (ChatKit server) and streams the reply back, so the agent's address and
 * keys never reach the browser.
 */
export const dynamic = "force-dynamic";

const ONBOARDY = (process.env.ONBOARDY_URL ?? "http://localhost:8002").replace(/\/$/, "");

export async function POST(req: Request) {
  let upstream: Response;
  try {
    upstream = await fetch(`${ONBOARDY}/chatkit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-onboardos-onboarding": req.headers.get("x-onboardos-onboarding") ?? "",
        "x-onboardos-admin": "admin",
      },
      body: await req.text(),
    });
  } catch {
    return Response.json({ error: "Onboardy is offline. Start it with: cd agent && ./run.sh" }, { status: 503 });
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": "no-cache",
    },
  });
}
