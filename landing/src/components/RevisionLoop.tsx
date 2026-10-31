"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** The rejection-and-recovery loop, played on repeat: the thing that makes OnboardOS. */
const STEPS = [
  { who: "Human reviewer", tone: "rose", text: "Ledger Mapping v1 rejected: “Refunds must reverse deferred revenue, not recognize new revenue.”" },
  { who: "Finance Agent → Document Agent", tone: "violet", text: "Correction: refunds debit Deferred revenue and credit Cash. Keep rule ACR-1003." },
  { who: "Document Agent → Finance Agent", tone: "violet", text: "Acknowledged. Regenerating Ledger Mapping as v2." },
  { who: "Compliance Agent", tone: "sky", text: "Ledger Mapping v2 reviewed. Sent back for approval." },
  { who: "Human reviewer", tone: "emerald", text: "Ledger Mapping v2 approved. Every document approved at its current version." },
  { who: "Orchestrator", tone: "emerald", text: "SpookyStream is ready to launch." },
] as const;

const TONE: Record<string, string> = {
  rose: "border-transparent bg-peach",
  violet: "border-transparent bg-dusty-pink/30",
  sky: "border-transparent bg-teal/60",
  emerald: "border-transparent bg-sage/50",
};

export function RevisionLoop() {
  const [shown, setShown] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setShown((n) => (n >= STEPS.length + 2 ? 1 : n + 1)), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="space-y-2.5">
      {STEPS.slice(0, Math.min(shown, STEPS.length)).map((s, i) => (
        <div
          key={i}
          className={cn("rounded-xl border p-3 text-sm shadow-sm animate-in fade-in slide-in-from-bottom-1", TONE[s.tone])}
        >
          <div className="mb-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink/60">
            {s.who}
            {s.who.includes("→") && (
              <Badge variant="outline" className="h-5 font-mono text-[10px]">
                thread-ledger_mapping-v1
              </Badge>
            )}
          </div>
          <p className="text-foreground">{s.text}</p>
        </div>
      ))}
    </div>
  );
}
