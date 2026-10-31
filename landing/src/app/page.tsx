import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bubble, Field, Loop, Mark, Rays, Tick } from "@/components/Art";
import { RevisionLoop } from "@/components/RevisionLoop";
import { RotatingWord } from "@/components/RotatingWord";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8000";

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 text-lg font-medium tracking-tight">
      <Mark className={light ? "bg-cream text-ink" : ""} />
      <span className={light ? "text-cream" : ""}>OnboardOS</span>
    </span>
  );
}

function Cta({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        asChild
        size="lg"
        className={dark ? "h-12 rounded-xl bg-cream px-5 text-base text-ink hover:bg-cream/90" : "h-12 rounded-xl px-5 text-base"}
      >
        <a href={APP_URL}>Try the live demo</a>
      </Button>
      <Button
        asChild
        size="lg"
        variant="outline"
        className={
          dark
            ? "h-12 rounded-xl border-cream/30 bg-transparent px-5 text-base text-cream hover:bg-cream/10 hover:text-cream"
            : "h-12 rounded-xl border-ink/20 bg-transparent px-5 text-base"
        }
      >
        <a href="#how">How it works</a>
      </Button>
    </div>
  );
}

const STAGES = [
  ["Business requirements", "done"],
  ["Finance mapping", "done"],
  ["Documents generated", "done"],
  ["Compliance review", "done"],
  ["Human approval", "now"],
  ["Launch readiness", "next"],
] as const;

function ProductMock() {
  return (
    <div className="w-full max-w-xl rounded-2xl border border-ink/10 bg-paper/95 text-left text-ink shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-3">
        <span className="font-mono text-xs uppercase tracking-wider text-ink/60">SpookyStream · $12.99/mo</span>
        <Badge className="ml-auto rounded-full bg-peach font-mono text-[10px] uppercase tracking-wider text-ink" variant="secondary">
          Needs review
        </Badge>
      </div>
      <div className="grid sm:grid-cols-[170px_1fr]">
        <ol className="space-y-2.5 border-b border-ink/10 p-4 text-sm sm:border-r sm:border-b-0">
          {STAGES.map(([name, state]) => (
            <li key={name} className="flex items-center gap-2">
              <span
                className={
                  state === "done"
                    ? "h-2.5 w-2.5 rounded-full bg-ok"
                    : state === "now"
                      ? "h-2.5 w-2.5 animate-pulse rounded-full bg-terracotta"
                      : "h-2.5 w-2.5 rounded-full border-2 border-ink/25"
                }
              />
              <span className={state === "next" ? "text-ink/50" : ""}>{name}</span>
            </li>
          ))}
        </ol>
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">Ledger Mapping</span>
            <span className="label-pill !px-2 !py-0.5 !text-[10px]">v2</span>
            <Button size="sm" className="ml-auto h-8 rounded-lg bg-ok text-cream hover:bg-ok/90">
              Approve v2
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border border-ink/10 text-[13px]">
            {[
              ["Subscription charge", "Cash", "Deferred revenue", false],
              ["Monthly recognition", "Deferred revenue", "Revenue", false],
              ["Refund ≤ 7 days", "Deferred revenue", "Cash", true],
            ].map(([s, d, c, changed]) => (
              <div key={s as string} className={`grid grid-cols-3 gap-2 border-b border-ink/10 px-3 py-2 last:border-0 ${changed ? "bg-sage/30" : ""}`}>
                <span className="font-medium">{s}</span>
                <span>{d}</span>
                <span>
                  {changed && <s className="mr-1 text-danger">Revenue</s>}
                  {c}
                </span>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-dusty-pink/25 p-3 text-[13px]">
            <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-ink/60">
              Finance Agent → Document Agent
            </div>
            Refunds must reverse deferred revenue. Regenerating as v2.
          </div>
        </div>
      </div>
    </div>
  );
}

const AGENTS = [
  { n: "01", title: "Finance Agent", body: "Turns pricing, billing and refund policy into accounting scenarios and rule mappings.", bg: "bg-sage" },
  { n: "02", title: "Document Agent", body: "Drafts the Accounting Configuration and Ledger Mapping, and redrafts them when you push back.", bg: "bg-teal" },
  { n: "03", title: "Compliance Agent", body: "Checks every version before it reaches you and records what it found.", bg: "bg-sand" },
  { n: "04", title: "You", body: "Approve or reject each document. Nothing launches without your sign-off on the current version.", bg: "bg-peach" },
];

const GUARANTEES = [
  ["Approvals belong to a version", "Approve v1, and v2 needs its own approval. An old yes never launches new work."],
  ["A no starts the fix", "Your comment goes to the agents as a threaded correction. You see the exchange, then the new version."],
  ["Nothing is lost on a restart", "Every step is a recorded event. Refresh, redeploy or crash: the launch picks up where it was."],
  ["Stalled reviews escalate", "An approval past its SLA is flagged and routed to the right lead, not left in an inbox."],
  ["One click counts once", "Every decision carries an operation id, so a double click or retry never approves twice."],
  ["Agents talk, the workflow decides", "Agents coordinate over threads. Only the workflow marks work as done."],
];

const FAQ = [
  ["What does OnboardOS produce?", "The launch paperwork a new business needs before it can take money: an accounting configuration and a ledger mapping for each payment scenario, checked by a compliance agent and approved by a person."],
  ["Do agents ever approve their own work?", "No. Agents draft, correct and check. Only a human reviewer approves, and only the version in front of them."],
  ["What happens when I reject a document?", "Your comment becomes a correction thread between the Finance and Document agents. A new version is drafted, checked again and comes back to you. The rejected version stays in the history."],
  ["Is the demo using real accounting rules?", "No. SpookyStream and every rule in the demo are fictional. They show how the workflow behaves, not accounting advice."],
  ["What if the server restarts mid-launch?", "State lives in a durable workflow, not in the browser or a running model. Work resumes from the last recorded step."],
];

export default function Home() {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-5 sm:px-8">
        <Logo />
        <nav className="ml-auto hidden items-center gap-7 font-mono text-xs uppercase tracking-wider text-ink/70 md:flex">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#loop" className="hover:text-ink">The loop</a>
          <a href="#guarantees" className="hover:text-ink">Guarantees</a>
          <a href="#faq" className="hover:text-ink">FAQ</a>
        </nav>
        <Button asChild className="ml-auto h-10 rounded-xl px-4 md:ml-0">
          <a href={APP_URL}>Try the demo</a>
        </Button>
      </header>

      {/* Hero: a rosewood block beside a blurred colour field */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid overflow-hidden rounded-3xl lg:grid-cols-2">
          <div className="flex flex-col justify-between gap-10 bg-rosewood px-7 py-10 sm:px-12 sm:py-14">
            <span className="label-pill w-fit">AI business launch orchestrator</span>
            <h1 className="text-5xl leading-[1.04] font-medium tracking-tight sm:text-6xl">
              Onboard new <RotatingWord /> in weeks, <span className="whitespace-nowrap">not months.</span>
            </h1>
            <div className="space-y-7">
              <p className="max-w-md text-lg text-ink/80">
                Finance, document and compliance agents take each business you onboard from requirements to
                launch-ready accounting. You approve every document. When you say no, they fix it.
              </p>
              <Cta />
            </div>
          </div>
          <Field tone="ember" className="min-h-[520px]">
            <Bubble className="absolute top-10 left-10 w-28 opacity-90" />
            <Rays className="absolute right-10 bottom-10 w-16 opacity-90" />
            <div className="flex h-full items-center justify-center p-6 sm:p-10">
              <ProductMock />
            </div>
          </Field>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-4xl px-5 py-24 sm:px-8">
        <span className="label-pill">The problem</span>
        <h2 className="mt-6 text-4xl leading-tight font-medium tracking-tight sm:text-5xl">
          The work isn&apos;t the problem. The handoffs are.
        </h2>
        <p className="mt-5 max-w-2xl text-lg text-ink/75">
          Finance maps the scenarios, someone drafts the documents, compliance reviews them, a reviewer sends one back,
          and the fix starts over in a new email thread. Launches stall between people, not inside the work.
        </p>
      </section>

      {/* Agents: one colour block each */}
      <section id="how" className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="label-pill">How it works</span>
            <h2 className="mt-6 text-4xl font-medium tracking-tight sm:text-5xl">Three agents. One reviewer.</h2>
          </div>
          <p className="ml-auto max-w-sm text-ink/70">Each agent owns a step. The workflow owns the state.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AGENTS.map((a) => (
            <div key={a.title} className={`flex min-h-64 flex-col justify-between rounded-3xl p-7 ${a.bg}`}>
              <span className="font-mono text-sm text-ink/60">{a.n}</span>
              <div>
                <h3 className="text-2xl font-medium tracking-tight">{a.title}</h3>
                <p className="mt-2 text-[15px] text-ink/75">{a.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The loop, on forest */}
      <section id="loop" className="mx-auto mt-24 max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 rounded-3xl bg-forest px-7 py-12 text-cream sm:px-12 sm:py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="label-pill bg-cream/10 text-cream">The loop</span>
            <h2 className="mt-6 text-4xl leading-tight font-medium tracking-tight sm:text-5xl">
              Say no. Watch it get fixed.
            </h2>
            <p className="mt-5 max-w-md text-lg text-cream/70">
              Your comment becomes a correction thread between agents. A new version is drafted, re-checked and comes
              back to you. Your earlier approval doesn&apos;t carry over: the new version needs its own.
            </p>
            <ul className="mt-6 space-y-2 font-mono text-sm text-cream/60">
              <li>→ rejected versions stay in the history</li>
              <li>→ changed cells highlighted against what you rejected</li>
              <li>→ launch ready only when every current version is approved</li>
            </ul>
            <Loop className="mt-8 w-32 opacity-80" />
          </div>
          <div className="rounded-2xl bg-cream p-4 text-ink sm:p-5">
            <RevisionLoop />
          </div>
        </div>
      </section>

      {/* Guarantees, on sand */}
      <section id="guarantees" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <span className="label-pill">Guarantees</span>
        <h2 className="mt-6 max-w-2xl text-4xl font-medium tracking-tight sm:text-5xl">
          Built so a launch can&apos;t go wrong quietly.
        </h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-3">
          {GUARANTEES.map(([t, b]) => (
            <div key={t} className="bg-paper p-7">
              <h3 className="text-lg font-medium">{t}</h3>
              <p className="mt-2 text-[15px] text-ink/70">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Example */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid overflow-hidden rounded-3xl lg:grid-cols-[1.2fr_1fr]">
          <div className="bg-sand px-7 py-12 sm:px-12">
            <span className="label-pill">Example launch · fictional</span>
            <h3 className="mt-6 text-3xl font-medium tracking-tight sm:text-4xl">
              SpookyStream: $12.99 a month, refunds within 7 days.
            </h3>
            <p className="mt-4 max-w-lg text-ink/75">
              Four payment scenarios mapped, two documents drafted, one rejected for booking refunds as revenue,
              corrected through an agent thread, re-approved, launch ready.
            </p>
            <Button asChild className="mt-7 h-12 rounded-xl px-5 text-base">
              <a href={APP_URL}>Run it yourself</a>
            </Button>
          </div>
          <Field tone="oasis" className="min-h-72">
            <Tick className="absolute top-1/2 left-1/2 w-36 -translate-x-1/2 -translate-y-1/2" />
            <span className="label-pill absolute bottom-6 left-6 bg-cream/80">Launch ready</span>
          </Field>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-4xl px-5 py-24 sm:px-8">
        <span className="label-pill">FAQ</span>
        <h2 className="mt-6 text-4xl font-medium tracking-tight sm:text-5xl">Questions worth asking.</h2>
        <Accordion type="single" collapsible className="mt-8">
          {FAQ.map(([q, a]) => (
            <AccordionItem key={q} value={q} className="border-ink/15">
              <AccordionTrigger className="py-5 text-left text-lg font-medium hover:no-underline">{q}</AccordionTrigger>
              <AccordionContent className="text-base text-ink/70">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Closing, on terracotta */}
      <section className="mx-auto max-w-7xl px-5 pb-10 sm:px-8">
        <div className="grid overflow-hidden rounded-3xl lg:grid-cols-[1.4fr_1fr]">
          <div className="bg-terracotta px-7 py-14 sm:px-12">
            <h2 className="max-w-xl text-4xl leading-tight font-medium tracking-tight sm:text-6xl">
              Drafting isn&apos;t the hard part. Getting to approved is.
            </h2>
            <p className="mt-5 max-w-md text-lg text-ink/80">See the whole loop, rejection included, in about a minute.</p>
            <div className="mt-8">
              <Cta />
            </div>
          </div>
          <Field tone="dune" className="min-h-72">
            <Bubble className="absolute top-12 right-12 w-24" />
            <Rays className="absolute bottom-12 left-12 w-14" />
          </Field>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-10 sm:px-8">
        <Logo />
        <span className="text-ink/60">The AI business launch orchestrator.</span>
        <span className="ml-auto font-mono text-xs uppercase tracking-wider text-ink/50">
          Built at a hackathon · 2026 · demo data is fictional
        </span>
      </footer>
    </div>
  );
}
