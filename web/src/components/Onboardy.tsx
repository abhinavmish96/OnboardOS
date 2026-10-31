"use client";

/**
 * Onboardy: the admin's chat assistant, a persistent bubble in the corner of the dashboard.
 * Built on ChatKit (OpenAI's chat UI) talking to our own agent service through
 * /api/chatkit. The conversation is stored server-side; the last thread id is kept in
 * localStorage so a refresh reopens it. The chat stays mounted while closed, so nothing is
 * lost by toggling the bubble.
 */
import { useEffect, useRef, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";
import { cn } from "@/lib/utils";

const THREAD_KEY = "onboardy.thread";
const OPEN_KEY = "onboardy.open";
// ChatKit renders in its own frame, so the brand fonts are given by URL (Google Fonts, latin).
const FONT = "https://fonts.gstatic.com/s/inclusivesans/v5/0nk8C9biPuwflXcJ46P4PGWE08T-gfZusL0kQqtf";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private window: the chat still works, it just won't reopen the thread */
  }
}

export function Onboardy({
  onboardingId,
  onChanged,
  onOpenOnboarding,
}: {
  onboardingId: string | null;
  onChanged: () => void;
  onOpenOnboarding: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const idRef = useRef(onboardingId);
  idRef.current = onboardingId;
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => setOpen(read(OPEN_KEY) === "1"), []);
  useEffect(() => write(OPEN_KEY, open ? "1" : null), [open]);

  const chat = useChatKit({
    api: {
      url: "/api/chatkit",
      domainKey: process.env.NEXT_PUBLIC_CHATKIT_DOMAIN_KEY ?? "domain_pk_localhost_dev",
      // Every message carries the onboarding the admin is looking at.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (idRef.current) headers.set("x-onboardos-onboarding", idRef.current);
        return fetch(input, { ...init, headers });
      },
    },
    initialThread: typeof window === "undefined" ? null : read(THREAD_KEY),
    theme: {
      colorScheme: "light",
      radius: "round",
      density: "normal",
      color: {
        grayscale: { hue: 45, tint: 6, shade: 0 },
        accent: { primary: "#0e1113", level: 1 },
      },
      typography: {
        baseSize: 15,
        fontFamily: '"Inclusive Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
        fontFamilyMono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
        fontSources: [
          { family: "Inclusive Sans", src: `${FONT}cBt96WZsUUPYsA1y.woff2`, weight: 400, display: "swap" },
          { family: "Inclusive Sans", src: `${FONT}Qht96WZsUUPYsA1y.woff2`, weight: 500, display: "swap" },
        ],
      },
    },
    header: {
      title: { text: "Onboardy" },
      rightAction: { icon: "close", onClick: () => setOpen(false) },
    },
    history: { enabled: true, showDelete: true, showRename: true },
    startScreen: {
      greeting: "Hi, I'm Onboardy. Ask about this launch, or tell me what to do.",
      prompts: [
        { label: "Where are we?", prompt: "Where are we, and what needs my attention?", icon: "compass" },
        { label: "What needs my approval?", prompt: "Which documents are waiting for my approval, and what do they say?", icon: "check-circle" },
        { label: "What changed in the latest version?", prompt: "What changed in the latest version of the Ledger Mapping?", icon: "document" },
        { label: "Why is this launch blocked?", prompt: "What's blocking launch right now?", icon: "info" },
      ],
    },
    composer: { placeholder: "Ask Onboardy or tell it what to do…" },
    onThreadChange: ({ threadId }) => write(THREAD_KEY, threadId),
    onResponseEnd: () => {
      onChanged();
      if (!openRef.current) setUnread(true);
    },
    onEffect: ({ name, data }) => {
      if (name === "onboarding.changed") onChanged();
      if (name === "onboarding.open" && typeof data?.id === "string") onOpenOnboarding(data.id);
    },
  });

  return (
    <div className="fixed right-5 bottom-5 z-40 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      <div
        className={cn(
          "h-[min(640px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-ink/10 bg-cream shadow-2xl transition-all duration-200",
          open ? "translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-3 opacity-0",
        )}
        role="dialog"
        aria-label="Onboardy chat"
        aria-hidden={!open}
      >
        <ChatKit control={chat.control} className="block h-full w-full" />
      </div>
      <button
        onClick={() => {
          setOpen((o) => !o);
          setUnread(false);
        }}
        className="group flex h-14 items-center gap-2.5 rounded-full bg-ink pr-5 pl-2 text-cream shadow-xl transition hover:bg-ink/90"
        aria-expanded={open}
        aria-label={open ? "Close Onboardy" : "Open Onboardy"}
      >
        <span className="relative grid h-10 w-10 place-items-center rounded-full bg-terracotta">
          <svg viewBox="0 0 120 80" className="h-6 w-6 text-cream" fill="none" aria-hidden>
            <path
              d="M14 34c0-14 18-24 44-24s46 9 46 23-19 23-43 23c-6 0-12-.5-17-2l-14 12 3-15C21 47 14 41 14 34Z"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinejoin="round"
            />
          </svg>
          {unread && <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink bg-peach" />}
        </span>
        <span className="font-medium">{open ? "Close" : "Onboardy"}</span>
      </button>
    </div>
  );
}
