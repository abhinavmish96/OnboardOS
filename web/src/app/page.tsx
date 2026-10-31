"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Decision, Document, Onboarding, WorkflowEvent } from "@contract/contract";
import { ActivityFeed } from "@/components/ActivityFeed";
import { DocumentCard } from "@/components/DocumentCard";
import { ReviewModal } from "@/components/ReviewModal";
import { Workflow } from "@/components/Workflow";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/client";

const STATUS: Record<Onboarding["status"], { label: string; cls: string }> = {
  in_progress: { label: "Agents working", cls: "bg-teal text-ink" },
  awaiting_review: { label: "Needs your review", cls: "bg-peach text-ink" },
  revising: { label: "Revising", cls: "bg-dusty-pink/40 text-ink" },
  launch_ready: { label: "Launch ready", cls: "bg-sage/70 text-ink" },
};

function Dashboard() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [reviewing, setReviewing] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const lastSeq = useRef(0);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const [o, fresh] = await Promise.all([api.get(id), api.events(id, lastSeq.current)]);
      setOnboarding(o);
      if (fresh.length) {
        lastSeq.current = fresh[fresh.length - 1].seq;
        setEvents((prev) => [...prev, ...fresh.filter((e) => !prev.some((p) => p.id === e.id))]);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backend unreachable");
    }
  }, [id]);

  useEffect(() => {
    lastSeq.current = 0;
    setEvents([]);
    setOnboarding(null);
    if (!id) return;
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [id, refresh]);

  async function start() {
    setStarting(true);
    try {
      const o = await api.start();
      router.push(`/?id=${o.id}`); // the id lives in the URL, so a refresh resumes it
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start");
    } finally {
      setStarting(false);
    }
  }

  async function submitReview(doc: Document, decision: Decision, comment: string, operationId: string) {
    if (!id) return;
    const o = await api.review(id, {
      documentId: doc.id,
      version: doc.currentVersion,
      decision,
      comment: comment || undefined,
      operationId,
    });
    setOnboarding(o);
    refresh();
  }

  if (!id) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-4 py-12">
        <div>
          <span className="label-pill">OnboardOS</span>
          <h1 className="mt-4 text-5xl leading-tight font-medium tracking-tight">The AI business launch orchestrator</h1>
          <p className="mt-3 text-muted-foreground">
            Finance, Document and Compliance agents take a new subscription business from requirements to
            launch-ready accounting, with a human approving every document.
          </p>
        </div>
        <Card className="border-0 bg-rosewood">
          <CardHeader>
            <CardTitle className="text-2xl font-medium">SpookyStream</CardTitle>
            <CardDescription>Fictional customer · $12.99 monthly streaming subscription</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Refund policy: full refund within 7 days of a charge if fewer than 2 hours were streamed.
            </p>
            <Button onClick={start} disabled={starting}>
              {starting ? "Starting…" : "Start SpookyStream onboarding"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!onboarding) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {error ?? "Loading onboarding…"}
      </main>
    );
  }

  const done = onboarding.tasks.filter((t) => t.status === "done").length;
  const status = STATUS[onboarding.status];
  const overdue = events.some((e) => e.type === "approval.overdue");

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <span className="label-pill">OnboardOS · {onboarding.requirements.product}</span>
          <h1 className="mt-2 text-3xl font-medium tracking-tight">{onboarding.requirements.company}</h1>
        </div>
        <Badge variant="secondary" className={status.cls}>
          {status.label}
        </Badge>
        <div className="w-44">
          <Progress value={(done / onboarding.tasks.length) * 100} />
          <p className="mt-1 text-xs text-muted-foreground">
            {done} of {onboarding.tasks.length} stages complete
          </p>
        </div>
      </header>

      {onboarding.status === "launch_ready" && (
        <Alert className="border-sage bg-sage/40 text-ink">
          <AlertTitle>Launch ready</AlertTitle>
          <AlertDescription className="text-ink/80">
            Every document is approved at its current version. {onboarding.requirements.company} can launch.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Backend unreachable</AlertTitle>
          <AlertDescription>{error} · showing the last known state</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr_340px]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="font-mono text-xs font-normal uppercase tracking-wider text-muted-foreground">Workflow</CardTitle>
          </CardHeader>
          <CardContent>
            <Workflow tasks={onboarding.tasks} />
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6">
          {onboarding.documents.map((d) => (
            <DocumentCard key={d.id} doc={d} approvals={onboarding.approvals} onReview={setReviewing} />
          ))}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="font-mono text-xs font-normal uppercase tracking-wider text-muted-foreground">Agent activity</CardTitle>
            <CardDescription>{events.length} events · newest first</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[60vh] pr-3">
              <ActivityFeed events={events} />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
        <span>Demo controls:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => setOnboarding(await api.clock(onboarding.id, { advanceMinutes: 25 * 60 }))}
          disabled={onboarding.status !== "awaiting_review"}
        >
          Advance clock 25h
        </Button>
        <Button variant="outline" size="sm" onClick={() => router.push("/")}>
          New onboarding
        </Button>
        {overdue && <span className="text-danger">An approval passed its SLA and was escalated.</span>}
        <span className="ml-auto">
          Clock +{Math.round(onboarding.clock.offsetMinutes / 60)}h · id {onboarding.id}
        </span>
      </footer>

      {reviewing && (
        <ReviewModal
          doc={reviewing}
          onClose={() => setReviewing(null)}
          onSubmit={(decision, comment, op) => submitReview(reviewing, decision, comment, op)}
        />
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
