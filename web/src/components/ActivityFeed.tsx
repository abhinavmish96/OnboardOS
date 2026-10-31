import type { WorkflowEvent } from "@contract/contract";
import { Badge } from "@/components/ui/badge";
import { ACTOR_LABEL } from "@/lib/client";
import { cn } from "@/lib/utils";

const COLOR: Record<string, string> = {
  finance_agent: "bg-sage text-ink",
  document_agent: "bg-teal text-ink",
  compliance_agent: "bg-sand text-ink",
  orchestrator: "bg-muted text-ink",
  human_reviewer: "bg-peach text-ink",
};

function time(at: string) {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function Who({ actor }: { actor: string }) {
  return (
    <Badge variant="secondary" className={cn("rounded px-1.5", COLOR[actor])}>
      {ACTOR_LABEL[actor]}
    </Badge>
  );
}

export function ActivityFeed({ events }: { events: WorkflowEvent[] }) {
  return (
    <ul className="space-y-2.5">
      {[...events].reverse().map((e) => {
        const relay = e.type === "relay.message";
        const alert = e.type === "review.rejected" || e.type === "approval.overdue";
        const done = e.type === "onboarding.launch_ready" || e.type === "review.approved";
        return (
          <li
            key={e.id}
            className={cn(
              "rounded-lg border p-3 text-sm",
              relay && "border-dusty-pink/40 bg-dusty-pink/15",
              alert && "border-clay/30 bg-clay/10",
              done && "border-sage bg-sage/30",
              !relay && !alert && !done && "bg-card",
            )}
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <Who actor={e.actor} />
              {relay && e.to && (
                <>
                  <span className="text-muted-foreground">→</span>
                  <Who actor={e.to} />
                </>
              )}
              <span className="ml-auto text-muted-foreground">{time(e.at)}</span>
            </div>
            <p>{e.message}</p>
            {relay && (
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {e.transport === "agent_relay" ? "Agent Relay" : "Simulated relay"} · {e.threadId}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
