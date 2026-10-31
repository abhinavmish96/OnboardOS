/**
 * OnboardOS backend — Express server on port 4000.
 * Serves the five endpoints defined in shared/contract.ts.
 */
import express from "express";
import type { ApiError, ClockRequest, ReviewRequest, StartRequest } from "./contract.js";
import { start, snapshot, events, review, clock } from "./engine.js";

const app = express();
app.use(express.json());

// CORS — the Next.js dev server runs on a different port
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (_req.method === "OPTIONS") return res.sendStatus(204) as unknown as void;
  next();
});

const STATUS: Record<string, number> = { not_found: 404, stale_version: 409, invalid: 400 };

function reply(res: express.Response, result: unknown) {
  if (result && typeof result === "object" && "error" in result && "code" in result) {
    const err = result as ApiError;
    return res.status(STATUS[err.code] ?? 500).json(err);
  }
  res.json(result);
}

// POST /api/onboardings
app.post("/api/onboardings", (req, res) => {
  const body = (req.body ?? {}) as StartRequest;
  reply(res, start(body));
});

// GET /api/onboardings/:id
app.get("/api/onboardings/:id", (req, res) => {
  reply(res, snapshot(req.params.id));
});

// GET /api/onboardings/:id/events
app.get("/api/onboardings/:id/events", (req, res) => {
  const after = parseInt(req.query.after as string, 10) || 0;
  reply(res, events(req.params.id, after));
});

// POST /api/onboardings/:id/review
app.post("/api/onboardings/:id/review", (req, res) => {
  const body = req.body as ReviewRequest;
  reply(res, review(req.params.id, body));
});

// POST /api/onboardings/:id/clock
app.post("/api/onboardings/:id/clock", (req, res) => {
  const body = req.body as ClockRequest;
  reply(res, clock(req.params.id, body));
});

const PORT = parseInt(process.env.PORT ?? "4000", 10);
app.listen(PORT, () => {
  console.log(`OnboardOS backend listening on http://localhost:${PORT}`);
});
