import type { Task } from "@contract/contract";
import { ACTOR_LABEL } from "@/lib/client";

const DOT: Record<Task["status"], string> = {
  done: "bg-emerald-500 border-emerald-500",
  running: "bg-amber-400 border-amber-400 animate-pulse",
  changes_requested: "bg-rose-500 border-rose-500",
  ready: "bg-white border-slate-400",
  blocked: "bg-white border-slate-300",
};
const LABEL: Record<Task["status"], string> = {
  done: "Done",
  running: "In progress",
  changes_requested: "Changes requested",
  ready: "Ready",
  blocked: "Waiting",
};

export function Workflow({ tasks }: { tasks: Task[] }) {
  return (
    <ol className="relative space-y-5">
      {tasks.map((t, i) => (
        <li key={t.id} className="relative flex gap-3">
          {i < tasks.length - 1 && (
            <span className="absolute left-[7px] top-5 h-[calc(100%+4px)] w-px bg-border" />
          )}
          <span className={`relative mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${DOT[t.status]}`} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-foreground">{t.title}</span>
              <span
                className={`text-xs ${t.status === "changes_requested" ? "text-rose-600" : "text-muted-foreground"}`}
              >
                {LABEL[t.status]}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">{ACTOR_LABEL[t.owner]}</div>
            {t.summary && <div className="mt-0.5 text-sm text-muted-foreground">{t.summary}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
