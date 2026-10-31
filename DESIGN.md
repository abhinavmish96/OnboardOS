# OnboardOS design system

The look of the landing page (`landing/`) and the tool (`web/`). Both apps share it: tokens
live in each app's `src/app/globals.css` (keep them identical), components are shadcn/ui.
Inspired by the Desert Ant site: warm paper, flat muted colour blocks, big quiet type,
small mono labels. Use this before adding any screen.

## 1. Principles

1. **Paper, not screens.** Cream background, ink text, no pure white or pure black surfaces.
2. **Colour blocks carry meaning.** A flat block of one palette colour marks one thing (an
   agent, a section, a state). No gradients on blocks, no shadows to fake depth.
3. **Big type, few words.** Headlines are large and light (weight 500), two short sentences
   at most. The detail goes in body text or mono labels.
4. **Mono is for machine facts.** Labels, versions, ids, timestamps, thread names and
   section tags are JetBrains Mono, uppercase, letter-spaced. People's words never are.
5. **The state is always visible.** Every document, task and agent message shows its status
   with the same colour everywhere (section 3).
6. **Honest UI.** Never show something as real when it isn't: simulated relay messages say
   "Simulated relay", demo data says "fictional", no invented customers, logos or quotes.

## 2. Tokens

### Colour

| Token (Tailwind) | Hex | Use |
|---|---|---|
| `cream` / `bg-background` | `#fbfaf4` | Page background |
| `paper` / `bg-card` | `#fcfbf7` | Cards, panels on cream |
| `ink` / `text-foreground` | `#0e1113` | Text, primary buttons, logo mark |
| `muted` | `#f2f1ea` | Quiet fills, version tabs off |
| `muted-foreground` | `#5d6366` | Secondary text |
| `border` | ink at 12% | Hairlines; `ink/10`–`ink/20` for emphasis |
| `rosewood` | `#cc9087` | Hero / intro block |
| `sage` | `#adb49c` | Finance Agent · approved · success fills |
| `teal` | `#c3d3ce` | Document Agent · in compliance review |
| `sand` | `#d6d0c3` | Compliance Agent · example / neutral blocks |
| `peach` | `#f8dbca` | Human reviewer · awaiting approval |
| `dusty-pink` | `#b6969d` | Agent-to-agent messages (relay threads), at 15–40% |
| `terracotta` | `#db704c` | Accent: "in progress" dot, focus ring, closing CTA block |
| `forest` | `#181e1d` | Dark feature block (cream text on it) |
| `clay` | `#d53712` | Rejections, overdue: at 10–15% fill with `danger` text |
| `ok` / `warn` / `danger` / `info` | `#3c8a52` / `#c2691a` / `#be3a2e` / `#1e8c8c` | Signal text, dots, approve button |
| `dark-teal`, `slate-blue` | `#1c525d`, `#344b5a` | Art fields only |

Opacity steps used: `/10 /15 /25 /30 /40 /60 /70 /80`. Text on cream: `ink`, `ink/80`,
`ink/70`, `ink/60` (labels). On forest: `cream`, `cream/70`, `cream/60`.

### Type

| Role | Font | Size / weight | Class recipe |
|---|---|---|---|
| Display (landing hero) | Inclusive Sans | 48–72px, 500, leading 1.02 | `text-5xl sm:text-6xl xl:text-7xl font-medium tracking-tight leading-[1.02]` |
| Section heading | Inclusive Sans | 36–48px, 500 | `text-4xl sm:text-5xl font-medium tracking-tight` |
| Card title | Inclusive Sans | 20–24px, 500 | `text-xl font-medium` |
| Body | Inclusive Sans | 15–18px, 400 | `text-lg text-ink/75` (landing), `text-sm` (tool) |
| Label / tag | JetBrains Mono | 10–12px, uppercase, +0.08em | `.label-pill`, or `font-mono text-xs uppercase tracking-wider text-ink/60` |
| Data (rule ids, versions) | JetBrains Mono | 11–12px | `font-mono text-xs text-muted-foreground` |

Fonts load through `next/font/google` in `layout.tsx` (`--font-display`, `--font-code`,
mapped to Tailwind `font-sans` / `font-mono`). Don't use font weights above 600.

### Shape and space

- Radius: `--radius` 12px. Buttons and inputs `rounded-xl` (12px); cards `rounded-xl`;
  big landing blocks `rounded-3xl` (24px); pills `rounded-full`.
- No drop shadows on blocks. One exception: the product mock floating on an art field
  (`shadow-2xl`).
- Page width `max-w-7xl` (landing), `max-w-7xl` (tool); side padding `px-5 sm:px-8`.
- Section rhythm on the landing page: `py-24` between sections, `mt-6` label → heading,
  `mt-10` heading → content.

## 3. State colours (use these, everywhere)

| State | Badge | Dot | Card / row |
|---|---|---|---|
| Generating / waiting | `bg-muted text-muted-foreground` | `border-2 border-ink/20` | — |
| Agents working | `bg-teal text-ink` | `bg-terracotta animate-pulse` | — |
| In compliance review | `bg-teal text-ink` | — | — |
| Awaiting approval / needs review | `bg-peach text-ink` | `bg-terracotta animate-pulse` | — |
| Revising | `bg-dusty-pink/40 text-ink` | — | — |
| Changes requested / rejected | `bg-clay/15 text-danger` | `bg-danger` | `border-clay/30 bg-clay/10` |
| Overdue | — | — | `border-clay/30 bg-clay/10` |
| Approved / done / launch ready | `bg-sage/70 text-ink` | `bg-ok` | `border-sage bg-sage/30` |
| Changed cell (vN vs vN-1) | — | — | row `bg-sage/30`, old value `<s className="text-danger">` |

Actors keep one colour each: Finance `sage`, Document `teal`, Compliance `sand`, Human
reviewer `peach`, Orchestrator `muted`. Relay messages are `dusty-pink/15` cards with the
thread id in mono below.

## 4. Components (shadcn/ui, restyled by tokens)

Add with `npx shadcn@3.3.1 add <name>` in the app folder; the tokens restyle them, so
override as little as possible.

- **Button.** Primary: default variant (ink on cream), `h-12 rounded-xl px-5 text-base` on
  the landing page, default size in the tool. Secondary: `variant="outline"` with
  `border-ink/20 bg-transparent`. On forest: cream button + `border-cream/30` outline.
  Approve: `bg-ok text-cream`. Reject: `variant="outline" border-clay/40 text-danger`.
- **Badge.** Status only, colours from section 3. Mono uppercase when it's a machine state
  (`font-mono text-[10px] uppercase tracking-wider`).
- **Pill label** (`.label-pill`, in globals.css): section tags and kickers
  ("HOW IT WORKS", "EXAMPLE LAUNCH · FICTIONAL"). On dark blocks add `bg-cream/10 text-cream`.
- **Card.** `bg-card` on cream with a hairline border. Inside a colour block, use a cream
  card (`bg-cream`) instead of white.
- **Dialog.** Title states the object and version ("Review Ledger Mapping · v2"); the
  description says what the action applies to.
- **Table.** Mono for ids, plain text for values; changed rows per section 3.
- **Accordion** (FAQ): `border-ink/15` items, `text-lg font-medium` triggers, no underline.

## 5. Patterns

**Colour-block section** (landing): one block, one idea.
```tsx
<div className="rounded-3xl bg-sage p-7 min-h-64 flex flex-col justify-between">
  <span className="font-mono text-sm text-ink/60">01</span>
  <div><h3 className="text-2xl font-medium tracking-tight">Finance Agent</h3>
       <p className="mt-2 text-[15px] text-ink/75">…</p></div>
</div>
```

**Split hero / split CTA**: a solid block (rosewood, sand or terracotta) beside an art
field (`<Field tone="ember|dune|oasis">` from `landing/src/components/Art.tsx`), inside one
`rounded-3xl overflow-hidden` grid.

**Section opener**: pill label → big heading → one paragraph at `max-w-2xl text-ink/75`.

**Dark feature block**: `bg-forest text-cream`, body `text-cream/70`, mono bullets
`text-cream/60` starting with `→`, content card in `bg-cream text-ink`.

**Tool layout**: header (pill label, company name `text-3xl font-medium`, status badge,
progress) → three columns `lg:grid-cols-[240px_1fr_340px]`: workflow, documents, activity.
Panel titles are mono uppercase labels, not headings.

## 6. Art

- **Fields**: blurred colour gradients with soft horizontal light streaks, our stand-in for
  motion-blurred photography. Tones: `ember` (terracotta/clay/peach), `dune` (sand/cream),
  `oasis` (teal/sage/dark-teal).
- **Doodles**: white, hand-drawn, 4–5px round strokes (`Bubble`, `Rays`, `Tick`, `Loop`),
  placed in corners of fields, never over text.
- **Logo**: ink rounded square with the cream plus-mark (`Mark`), wordmark in Inclusive
  Sans 500.
- Real photos: warm, motion-blurred, single subject, placed only inside a Field-shaped
  slot. Use only images we own or license; never copy the reference site's photos.

## 7. Voice

- Headlines: two short sentences, contrast or consequence. "The work isn't the problem.
  The handoffs are." / "Say no. Watch it get fixed."
- Body: plain, specific, one claim per sentence. Name the document and the version.
- Buttons: verb + object. "Try the live demo", "Approve v2", "Request changes",
  "Run it yourself".
- Never: "seamless", "revolutionary", "AI-powered" as filler; fake numbers or logos.

## 8. Don'ts

- No new colours outside the palette; no Tailwind default colour scales (`sky-`, `emerald-`,
  `rose-`, `violet-`, `slate-`…). Check: `grep -rE "(sky|amber|emerald|rose|violet|slate)-[0-9]" src --include=*.tsx`
  (shadcn's own `components/ui` excepted).
- No gradients on text or buttons; gradients only inside art fields.
- No white (`#fff`) surfaces, no pure black text.
- No more than one terracotta element per view: it's the accent.
- Don't put mono on sentences, or uppercase on anything a person wrote.
