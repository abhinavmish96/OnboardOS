/**
 * Every API route goes through here: to the durable actor backend when BACKEND_URL is set
 * (Aditi's service, same contract), otherwise to the local stand-in engine.
 */
import { NextResponse } from "next/server";
import type { ApiError } from "@contract/contract";

const BACKEND = process.env.BACKEND_URL?.replace(/\/$/, "");

export const usingBackend = Boolean(BACKEND);

export async function forward(req: Request, path: string): Promise<NextResponse | null> {
  if (!BACKEND) return null;
  const url = new URL(req.url);
  const res = await fetch(`${BACKEND}${path}${url.search}`, {
    method: req.method,
    headers: { "content-type": "application/json" },
    body: req.method === "GET" ? undefined : await req.text(),
    cache: "no-store",
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "content-type": "application/json", "x-onboardos-backend": "actor" },
  });
}

const STATUS: Record<ApiError["code"], number> = { not_found: 404, stale_version: 409, invalid: 400 };

export function reply<T>(result: T | ApiError): NextResponse {
  if (result && typeof result === "object" && "error" in result && "code" in result) {
    return NextResponse.json(result, { status: STATUS[(result as ApiError).code] });
  }
  return NextResponse.json(result, { headers: { "x-onboardos-backend": "stand-in" } });
}
