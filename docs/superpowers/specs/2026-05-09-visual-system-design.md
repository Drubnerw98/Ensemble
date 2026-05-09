# Visual system design

**Date:** 2026-05-09
**Status:** Approved, awaiting implementation plan
**Scope:** "Mini visual overhaul" before build step 6 (consensus flow). Lock a token-driven visual system, build four component primitives, polish voter convergence as the hero. No layout restructure, no light theme, no cross-site harmonization (parked).

## Why now

The repo has roughly 650 lines of UI across four files. After step 6 (consensus flow) and step 7 (mobile polish) ship, that number doubles or triples and a system retrofit becomes expensive. Locking tokens and primitives now means future components inherit the system instead of being retrofitted.

The durable artifact of this work is the **token system**, not any individual component. A future cross-site audit (Resonance, Constellation, Ensemble at roughly 95% complete) can harmonize palettes by editing tokens in one place per app, without rewriting components.

## Locked design constraints

These were fixed during brainstorming and are not in scope to revisit during implementation.

1. **Dark base.** Keep `#05060a`. Resonance and Constellation share this base, so cross-site cohesion is already partial.
2. **Saffron accent, used rarely.** The accent appears at three places: brand chrome (primary CTA, focus ring), the social moment (voter convergence), and consensus celebration (when threshold crosses, designed in step 6). Everywhere else stays dark and restrained.
3. **Two warm hues, not one.** Saffron owns "good things" (brand, social, consensus). Terracotta-shifted amber owns problems (errors, warnings). They visually rhyme but do not collide.
4. **Mono eyebrows, humanist sans body.** The tracked uppercase eyebrow stays in mono (gives Ensemble its "studio" feel). Body shifts from Fira Sans to a humanist sans paired with the same mono family.
5. **Type family: IBM Plex Sans + IBM Plex Mono.** Designed as a paired family. Free (SIL OFL). Not "Vercel-coded." Defense: "the eyebrow mono and body sans relate metrically, not coincidentally."
6. **Six-step type scale, hard cap.** Forces hierarchy through composition and weight, not size proliferation.
7. **Baseline polish on everything, voter convergence as the hero.** Consistent focus rings, transitions, hover, empty states across all components. Voter convergence gets dedicated craft (sizing, vote-lands motion, "you voted" ring).
8. **One runtime motion library: Framer Motion.** One spring, used once, on the hero moment.

## Visual tokens

All tokens live in `src/styles/globals.css` under `@theme`. Tailwind v4 surfaces them as utility classes automatically.

### Color

```
--color-bg              #05060a   keep    base background
--color-surface         #0c0f16   NEW     elevated cards (replaces bg-white/[0.02])
--color-border          #1a1f2a   NEW     standard borders (replaces border-white/10)
--color-border-strong   #2a3140   NEW     focus + active borders (replaces border-white/30)
--color-text            #e9ecf2   keep    primary text
--color-text-muted      #a1a8b3   keep    secondary text
--color-accent          #E8A857   NEW     saffron, brand + social + consensus
--color-accent-soft     #B8843A   NEW     saffron at lower contrast (text on dark)
--color-warn            #DB7B47   NEW     terracotta-shifted amber for errors / warnings
```

The two warm hues are deliberate. Saffron and terracotta are visually related (both warm, both saturated, both fit the dark editorial direction) but distinct enough that "consensus reached" and "couldn't load profile" cannot be confused.

### Type

```
--font-sans     "IBM Plex Sans",  ui-sans-serif, system-ui, ...
--font-mono     "IBM Plex Mono",  ui-monospace, "SF Mono", Menlo, monospace
--font-display  same as --font-mono
```

Imported via Google Fonts at the top of `globals.css`. Existing Fira Sans / Fira Code import is removed in the same edit.

Six-step scale:

```
eyebrow      11px  mono   uppercase  tracking-[0.22em]   text-muted
body-sm      13px  sans   normal     tracking-normal     text
body         15px  sans   normal     tracking-normal     text
lead         17px  sans   normal     tracking-tight      text
h2           24px  sans   light      tracking-tight      text
h1           32px  sans   light      tracking-tight      text
```

### Spacing

No new tokens. Commit to a spacing vocabulary using Tailwind defaults:

- **Inside components:** `gap-2`, `gap-3`
- **Between siblings:** `gap-4`, `gap-6`
- **Between sections:** `space-y-8`, `space-y-12`

Avoid ad hoc steps (`gap-5`, `space-y-7`). The vocabulary is intentionally narrow.

### Motion

```
--motion-fast   150ms  ease-out                                hover, focus, color transitions
--motion-base   250ms  ease-out                                appear/disappear, layout shifts
--motion-hero   400ms  cubic-bezier(0.34, 1.56, 0.64, 1)       voter-stack vote-lands only
```

The hero curve is a real spring (slight overshoot). Used in exactly one place. Everything else is plain ease-out. The point is that the spring **only happens at the hero moment**, so the moment feels earned.

## Component primitives

Four primitives. Live in `src/components/ui/`. Each is small, has a clear API, and replaces three or more inline duplications.

### `Button`

Three variants, two sizes. No other props beyond standard `<button>` attributes.

```ts
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost'  // default: 'secondary'
  size?: 'sm' | 'md'                            // default: 'md'
} & React.ButtonHTMLAttributes<HTMLButtonElement>
```

- **primary:** `bg-accent text-bg hover:bg-accent/90`. Used once per surface (the surface CTA).
- **secondary:** `border border-border bg-transparent text-text hover:bg-surface`. Most common variant.
- **ghost:** `text-text-muted hover:text-warn`. For destructive or de-emphasized actions ("remove").

Replaces six hand-rolled button patterns currently spread across `Home.tsx`, `Landing.tsx`, `SessionUI.tsx`.

### `Card`

Compound component. Always `rounded-lg border border-border bg-surface p-5`.

```ts
<Card>
  <Card.Eyebrow count={candidates.length}>Candidates</Card.Eyebrow>
  <Card.Body>...</Card.Body>
</Card>
```

Replaces five `rounded-lg border border-white/10 bg-white/[0.02] p-5` instances.

### `Eyebrow`

Atom for tracked-mono section labels. Standalone OR via `<Card.Eyebrow>`.

```ts
type EyebrowProps = {
  count?: number  // appends ` · {count}` if provided
  children: React.ReactNode
}
```

Renders `font-display text-[11px] tracking-[0.22em] text-text-muted uppercase`. Replaces six inline duplications of the same Tailwind soup.

### `AvatarStack`

The primitive that earns its keep. Currently `VoterStack` lives inline in `SessionUI.tsx` lines 358 to 398.

```ts
type AvatarStackProps = {
  userIds: readonly string[]
  userInfoById: ReadonlyMap<string, { name?: string; avatarUrl?: string }>
  max?: number              // default: 3
  size?: 'sm' | 'md'        // default: 'sm'
  showCount?: boolean       // trailing total
  highlight?: boolean       // saffron ring around the stack (used for "you voted" hero state)
}
```

- `size='sm'` is 20px (current voter stack size).
- `size='md'` is 28px (used on candidate rows after the hero polish).
- `highlight` adds `ring-2 ring-accent/50 ring-offset-2 ring-offset-bg` to the stack wrapper.

Used twice: voter stack on candidate rows (with `highlight` when the user has voted), presence/in-the-room area (no highlight, smaller).

### What is **not** a primitive

- **Inputs.** The two existing inputs (join code centered uppercase, candidate title left-aligned) are different shapes. One reuse is not an abstraction.
- **Avatar (single).** Used inside `AvatarStack` and inside `MemberChip` only. Two uses, simple shape, stays inline. Extract on third use.
- **Tooltips, dialogs, dropdowns.** None exist. Build when the third use shows up.

The discipline is "three uses or it stays inline." Premature abstraction is more expensive than copy-paste.

## Voter convergence hero

Three concrete changes to existing code. All three land in the same pass on `SessionUI.tsx`.

### 1. Avatar size up

Current voter stack uses `h-5 w-5` (20px). Faces read as decoration next to the vote button. Change candidate-row stacks to `size='md'` (28px), stack offset from `-ml-1.5` to `-ml-2.5`. Faces become the visual anchor of each row.

### 2. Vote-lands motion

When a vote arrives, the newly added avatar springs in:

- Scale from 0.6 to 1.05 to 1.0 over 400ms
- Curve: `cubic-bezier(0.34, 1.56, 0.64, 1)` (the `--motion-hero` value)
- Existing avatars in the stack do not move

Implementation: `<AnimatePresence>` from Framer Motion wraps the visible-avatars list inside `AvatarStack`. New entries get an `initial`, `animate`, and `exit` (no exit motion needed; see below).

### 3. "You voted" ring

When the candidate row's `voted` prop is true, the `AvatarStack` renders with `highlight={true}`, which adds `ring-2 ring-accent/50 ring-offset-2 ring-offset-bg`. This replaces the current border-color cue on the "Voted" button as the primary visual signal. The button still toggles label, but the visual link from "I clicked vote" to "my face is in the stack with a ring" is what readers will feel.

### Explicitly out of scope for the hero

- **Vote-removal motion.** When a user un-votes, the avatar disappears without exit animation. The hero moment is about *adding*, not removing. Adding exit motion would cheapen the entry spring.
- **Avatar hover tooltips.** Already provided via `title` attribute. Sufficient.

## Migration plan

Five ordered edits. Each is independently committable.

### Step 1: `src/styles/globals.css`

- Replace Fira Sans / Fira Code Google Fonts import with IBM Plex Sans / IBM Plex Mono.
- Add new `--color-*` tokens (surface, border, border-strong, accent, accent-soft, warn).
- Add new `--motion-*` tokens.
- Update `--font-*` tokens to point at Plex.
- Old tokens (`--color-bg`, `--color-text`, `--color-text-muted`) stay. New tokens are additive.

### Step 2: `src/components/ui/`

- Create `Button.tsx`, `Card.tsx`, `Eyebrow.tsx`, `AvatarStack.tsx`.
- Pure additive. Nothing imports them yet.
- Each file has a colocated `*.test.tsx` (Vitest, happy-dom) covering: variant rendering, accessibility props pass through, hero state for AvatarStack.

Note: test setup is not yet in the project (`decisions.md` lists testing as TBD). If Vitest is not yet configured at implementation time, the implementation plan should add it as a precondition step or move the tests to a follow-up. Do not skip the test scaffold silently.

### Step 3: Migrate `src/routes/Landing.tsx`

32 lines, smallest blast radius. Migration validates the system catches obvious mistakes early.

### Step 4: Migrate `src/routes/Home.tsx`

156 lines, single owner of the join-code input.

### Step 5: Migrate `src/components/SessionUI.tsx` and apply the hero

398 lines. Migrate to primitives and apply the three voter-convergence hero changes in the same pass. Largest file, biggest payoff, last.

### Verification

After step 5: `grep -rE 'border-white/|bg-white/\[' src/` returns zero matches. That is the system-fully-adopted check, not partially.

Run `pnpm typecheck` and `pnpm build` after each step. Both must pass before the next step.

### New runtime dependency

`framer-motion`. Approximately 50KB gzipped after tree-shaking. Used for one `<AnimatePresence>` on the voter stack. The cost is small relative to the value of the hero moment, and the library is the standard React motion choice.

## Out of scope (parked in `docs/followups.md`)

Captured for the future cross-site audit, not building now:

- Two-column desktop layout for the session view
- Session-arrival animations
- Mobile-first density variants
- Light theme
- Cross-site palette harmonization (Resonance + Constellation + Ensemble at roughly 95% complete)
- Consensus reveal moment (designed inside build step 6, not here)

## Defense in interview

The decisions an interviewer would plausibly ask about, with the answers.

**"Why a system instead of just polishing the existing UI?"**
Tokens in one file are extractable. Polishing inline Tailwind is not. The cross-site audit needs a system to harmonize against, not a pile of styled components.

**"Why two warm colors instead of one?"**
"Consensus reached" and "couldn't load profile" should not look the same. Saffron owns good things, terracotta owns problems. Both warm, both fit the editorial direction, no visual collision.

**"Why IBM Plex over Inter or Geist?"**
Plex Sans and Plex Mono are designed as a paired family. The eyebrow mono and the body sans relate metrically, not coincidentally. Inter is the durable choice but reads cold against the social direction. Geist is right for the eyebrows but reads as Vercel-coded.

**"Why a six-step type scale instead of more?"**
A narrow scale forces hierarchy through composition and weight. Twelve steps lets every component invent a new size, which is how design systems lose coherence. Six is enough for a portfolio app and easy to defend.

**"Why one motion library and one spring?"**
The vote-lands moment needs to feel earned. If everything springs, nothing does. Restraint is the point.

**"Why scope this so narrowly?"**
A wider redesign distracts from build step 6 (consensus flow), which is the actual interview differentiator. The system + primitives + one hero is the minimum that produces a portfolio-grade screenshot and unblocks future work.

## Change log

- 2026-05-09: Initial spec, approved through brainstorm.
