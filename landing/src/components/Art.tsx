/**
 * Our own artwork in the desert style: motion-blurred colour fields with white hand-drawn
 * doodles. No third-party photos; swap in real images from /public when we have them.
 */
import { cn } from "@/lib/utils";

const FIELDS = {
  ember: "radial-gradient(60% 70% at 70% 40%, #f8dbca 0%, transparent 60%), radial-gradient(80% 90% at 20% 80%, #d53712 0%, transparent 65%), linear-gradient(120deg, #db704c, #cc9087)",
  dune: "radial-gradient(70% 80% at 30% 30%, #fbfaf4 0%, transparent 55%), radial-gradient(90% 90% at 80% 90%, #db704c 0%, transparent 60%), linear-gradient(160deg, #d6d0c3, #cec4bb)",
  oasis: "radial-gradient(60% 70% at 70% 30%, #c3d3ce 0%, transparent 60%), radial-gradient(90% 90% at 20% 90%, #1c525d 0%, transparent 65%), linear-gradient(140deg, #adb49c, #344b5a)",
} as const;

export function Field({
  tone = "ember",
  className,
  children,
}: {
  tone?: keyof typeof FIELDS;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0 scale-110 blur-2xl" style={{ background: FIELDS[tone] }} />
      {/* horizontal light streaks: the motion-blur feel */}
      <div
        className="absolute inset-0 opacity-40 mix-blend-soft-light"
        style={{
          background:
            "repeating-linear-gradient(180deg, transparent 0 22px, rgba(255,255,255,.55) 22px 26px, transparent 26px 60px)",
          filter: "blur(6px)",
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

export function Bubble({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={cn("text-white", className)} fill="none" aria-hidden>
      <path
        d="M14 34c0-14 18-24 44-24s46 9 46 23-19 23-43 23c-6 0-12-.5-17-2l-14 12 3-15C21 47 14 41 14 34Z"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="44" cy="33" r="3.5" fill="currentColor" />
      <circle cx="59" cy="33" r="3.5" fill="currentColor" />
      <circle cx="74" cy="33" r="3.5" fill="currentColor" />
    </svg>
  );
}

export function Rays({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={cn("text-white", className)} fill="none" aria-hidden>
      <path d="M30 8h40M22 26l26 16M12 44l4 30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Tick({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 60" className={cn("text-white", className)} fill="none" aria-hidden>
      <path d="M8 32c8 6 14 12 20 20C40 34 54 18 72 8" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Loop({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 60" className={cn("text-white", className)} fill="none" aria-hidden>
      <path
        d="M10 40c10-28 40-30 48-10s-24 26-26 8 30-30 58-12"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M82 18l8 8-11 3" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Mark({ className }: { className?: string }) {
  return (
    <span className={cn("grid h-8 w-8 place-items-center rounded-lg bg-ink text-cream", className)} aria-hidden>
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
        <rect x="7" y="1" width="2" height="5" rx="1" />
        <rect x="7" y="10" width="2" height="5" rx="1" />
        <rect x="1" y="7" width="5" height="2" rx="1" />
        <rect x="10" y="7" width="5" height="2" rx="1" />
        <rect x="6.5" y="6.5" width="3" height="3" rx="0.5" />
      </svg>
    </span>
  );
}
