import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RevisionLoop } from "@/components/RevisionLoop";
import { RotatingWord } from "@/components/RotatingWord";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8000";

function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-xs text-white">OS</span>
      OnboardOS
    </span>
  );
}

function Cta({ secondary = "See how it works" }: { secondary?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button asChild size="lg" className="rounded-full px-6">
        <a href={APP_URL}>Try the live demo</a>
      </Button>
      <Button asChild size="lg" variant="outline" className="rounded-full bg-white/70 px-6">
        <a href="#how">{secondary}</a>
      </Button>
    </div>
  );
}

const STAGES = [
  { name: "Business requirements", state: "done" },
  { name: "Finance mapping", state: "done" },
  { name: "Documents generated", state: "done" },
  { name: "Compliance review", state: "done" },
  { name: "Human approval", state: "now" },
  { name: "Launch readiness", state: "next" },
];

function HeroMock() {
  return (
    <Card className="mx-auto w-full max-w-4xl overflow-hidden border-white/60 bg-white/85 py-0 text-left shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2 border-b px-5 py-3 text-xs text-muted-foreground">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <span className="ml-3">SpookyStream · Monthly streaming subscription · $12.99</span>
        <Badge className="ml-auto bg-amber-100 text-amber-900" variant="secondary">
          Needs your review
        </Badge>
      </div>
      <div className="grid gap-0 md:grid-cols-[220px_1fr]">
        <ol className="space-y-3 border-b p-5 text-sm md:border-r md:border-b-0">
          {STAGES.map((s) => (
            <li key={s.name} className="flex items-center gap-2.5">
              <span
                className={
                  s.state === "done"
                    ? "h-3 w-3 rounded-full bg-emerald-500"
                    : s.state === "now"
                      ? "h-3 w-3 animate-pulse rounded-full bg-amber-400"
                      : "h-3 w-3 rounded-full border-2 border-slate-300"
                }
              />
              <span className={s.state === "next" ? "text-muted-foreground" : ""}>{s.name}</span>
            </li>
          ))}
        </ol>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Ledger Mapping</span>
            <Badge variant="outline" className="text-xs">v2</Badge>
            <span className="text-xs text-muted-foreground">Revised after your comment</span>
            <Button size="sm" className="ml-auto h-8 rounded-full bg-emerald-600 hover:bg-emerald-700">
              Approve v2
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border text-sm">
            {[
              ["New subscription charge", "Cash", "Deferred revenue", false],
              ["Monthly recognition", "Deferred revenue", "Subscription revenue", false],
              ["Refund within 7 days", "Deferred revenue", "Cash", true],
            ].map(([scenario, debit, credit, changed]) => (
              <div
                key={scenario as string}
                className={`grid grid-cols-3 gap-2 border-b px-3 py-2 last:border-0 ${changed ? "bg-emerald-50" : ""}`}
              >
                <span className="font-medium">{scenario}</span>
                <span>{debit}</span>
                <span>
                  {changed && <s className="mr-1 text-rose-500">Subscription revenue</s>}
                  {credit}
                </span>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm">
            <div className="mb-0.5 text-xs font-medium text-muted-foreground">Finance Agent → Document Agent</div>
            Correction: refunds must reverse deferred revenue. Regenerating as v2.
          </div>
        </div>
      </div>
    </Card>
  );
}

const AGENTS = [
  { title: "Finance Agent", body: "Turns your pricing, billing and refund policy into accounting scenarios and rule mappings.", color: "bg-violet-100 text-violet-800" },
  { title: "Document Agent", body: "Drafts the Accounting Configuration and Ledger Mapping, and redrafts them when you push back.", color: "bg-sky-100 text-sky-800" },
  { title: "Compliance Agent", body: "Checks every version before it reaches you and records what it found.", color: "bg-teal-100 text-teal-800" },
  { title: "You", body: "Approve or reject each document. Nothing launches without your sign-off on the current version.", color: "bg-amber-100 text-amber-900" },
];

const GUARANTEES = [
  { title: "Approvals belong to a version", body: "Approve v1, and a v2 needs its own approval. An old yes never launches new work." },
  { title: "A no starts the fix", body: "Your comment goes to the agents as a threaded correction. You see the exchange, then the new version." },
  { title: "Nothing is lost on a restart", body: "Every step is persisted as an event. Refresh, redeploy or crash: the launch picks up where it was." },
  { title: "Stalled reviews get escalated", body: "An approval past its SLA is flagged and routed to the right lead, not left in someone's inbox." },
  { title: "One click counts once", body: "Every decision carries an operation id, so a double click or a retry never approves twice." },
  { title: "Agents talk, the workflow decides", body: "Agents coordinate over threaded messages. Only the workflow marks work as done." },
];

const FAQ = [
  ["What does OnboardOS actually produce?", "The launch paperwork a new business needs before it can take money: an accounting configuration and a ledger mapping for each payment scenario, reviewed by a compliance agent and approved by a person."],
  ["Do agents ever approve their own work?", "No. Agents draft, correct and check. Only a human reviewer approves, and only the version in front of them."],
  ["What happens when I reject a document?", "Your comment becomes a correction thread between the Finance and Document agents. A new version is drafted, checked again, and comes back to you. The rejected version stays in the history."],
  ["Is the demo using real accounting rules?", "No. SpookyStream and every rule in the demo are fictional. They show how the workflow behaves, not accounting advice."],
  ["What if the server restarts mid-launch?", "State lives in a durable workflow, not in the browser or in a running model. Work resumes from the last recorded step."],
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="absolute inset-x-0 top-0 z-10">
        <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5 sm:px-6">
          <Logo />
          <div className="ml-auto hidden items-center gap-6 text-sm text-slate-700 sm:flex">
            <a href="#how" className="hover:text-slate-900">How it works</a>
            <a href="#guarantees" className="hover:text-slate-900">Guarantees</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
          </div>
          <Button asChild size="sm" className="ml-auto rounded-full sm:ml-0">
            <a href={APP_URL}>Try the demo</a>
          </Button>
        </nav>
      </header>

      {/* Hero, on a sky backdrop */}
      <section className="relative overflow-hidden bg-gradient-to-b from-sky-200 via-sky-100 to-white px-4 pt-32 pb-20 text-center sm:px-6">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-white/50 blur-3xl" />
        <div className="relative mx-auto max-w-3xl">
          <Badge variant="secondary" className="mb-5 rounded-full bg-white/80 px-3 py-1 text-slate-700">
            AI business launch orchestrator
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            Launch your <RotatingWord />
            <br />
            without the back-and-forth.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">
            Finance, document and compliance agents take a new business from requirements to launch-ready
            accounting. You approve every document. When you say no, they fix it.
          </p>
          <div className="mt-8">
            <Cta />
          </div>
        </div>
        <div className="relative mt-14">
          <HeroMock />
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          The work isn&apos;t the problem. The handoffs are.
        </h2>
        <p className="mt-4 text-lg text-slate-600">
          Finance maps the scenarios, someone drafts the documents, compliance reviews them, a reviewer sends one
          back, and the fix starts over in a new email thread. Launches stall between people, not inside the work.
        </p>
      </section>

      {/* How it works */}
      <section id="how" className="bg-slate-50 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Three agents. One reviewer. One launch.</h2>
            <p className="mt-3 text-slate-600">Each agent owns a step. The workflow owns the state.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AGENTS.map((a, i) => (
              <Card key={a.title} className="bg-white">
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">0{i + 1}</span>
                    <Badge variant="secondary" className={a.color}>{a.title}</Badge>
                  </div>
                  <p className="text-sm text-slate-700">{a.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-16 grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">Say no. Watch it get fixed.</h3>
              <p className="mt-3 text-slate-600">
                A rejection isn&apos;t a dead end. Your comment becomes a correction thread between agents, a new version
                is drafted and re-checked, and it comes back to you. Your earlier approval doesn&apos;t carry over: the new
                version needs its own.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-slate-700">
                <li>· The rejected version stays in the history, with your comment</li>
                <li>· Changed cells are highlighted against the version you rejected</li>
                <li>· Launch is ready only when every current version is approved</li>
              </ul>
            </div>
            <Card className="bg-white">
              <CardContent>
                <RevisionLoop />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Guarantees */}
      <section id="guarantees" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Built so a launch can&apos;t go wrong quietly.</h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {GUARANTEES.map((g) => (
            <div key={g.title} className="rounded-2xl border p-6">
              <h3 className="font-semibold">{g.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{g.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Example */}
      <section className="px-4 pb-20 sm:px-6">
        <Card className="mx-auto max-w-4xl bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <Badge variant="secondary" className="mb-3 bg-white">Example launch · fictional</Badge>
              <h3 className="text-xl font-semibold">SpookyStream: $12.99 a month, refunds within 7 days</h3>
              <p className="mt-2 text-sm text-slate-700">
                Four payment scenarios mapped, two documents drafted, one rejected for booking refunds as revenue,
                corrected through an agent thread, re-approved, launch ready.
              </p>
            </div>
            <Button asChild size="lg" className="rounded-full">
              <a href={APP_URL}>Run it yourself</a>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Questions worth asking.</h2>
        <Accordion type="single" collapsible className="mt-8">
          {FAQ.map(([q, a]) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger className="text-left text-base">{q}</AccordionTrigger>
              <AccordionContent className="text-slate-600">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Closing CTA, on a coast-toned backdrop */}
      <section className="bg-gradient-to-b from-white via-teal-50 to-sky-200 px-4 py-24 text-center sm:px-6">
        <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
          Drafting isn&apos;t the hard part. Getting to approved is.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-700">See the whole loop, rejection included, in about a minute.</p>
        <div className="mt-8">
          <Cta secondary="How it works" />
        </div>
      </section>

      <footer className="border-t px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 text-sm text-slate-500">
          <Logo />
          <span>The AI business launch orchestrator.</span>
          <span className="ml-auto">Built at a hackathon · 2026 · All demo data is fictional</span>
        </div>
      </footer>
    </div>
  );
}
