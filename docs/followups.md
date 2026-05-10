# Followups

A queue between "noticed it" and "decided what to do about it." Items might become Jira tickets, get fixed inline during related work, or be explicitly abandoned. Triage periodically.

Format: see the user-level `~/.claude/CLAUDE.md` "Followup detection" section.

## Contents

- [Active](#active)
  - [2026-05-09 — Cross-site visual audit (Resonance + Constellation + Ensemble)](#2026-05-09--cross-site-visual-audit-resonance--constellation--ensemble)
  - [2026-05-09 — Two-column desktop layout for session view](#2026-05-09--two-column-desktop-layout-for-session-view)
  - [2026-05-09 — Session-arrival animation](#2026-05-09--session-arrival-animation)
  - [2026-05-09 — Mobile-first density variants](#2026-05-09--mobile-first-density-variants)
  - [2026-05-09 — Light theme](#2026-05-09--light-theme)
  - [2026-05-09 — Winning candidate row pulse on consensus transition](#2026-05-09--winning-candidate-row-pulse-on-consensus-transition)
  - [2026-05-09 — Extract shared UserInfo type](#2026-05-09--extract-shared-userinfo-type)
  - [2026-05-09 — Disabled controls need accessible reason](#2026-05-09--disabled-controls-need-accessible-reason)
  - [2026-05-09 — Consider extracting consensus logic from SessionUI](#2026-05-09--consider-extracting-consensus-logic-from-sessionui)
- [Resolved](#resolved)
- [Abandoned](#abandoned)

## Active

### 2026-05-09 — Cross-site visual audit (Resonance + Constellation + Ensemble)

**What:** Once all three apps reach roughly 95% complete, run a deliberate visual audit across the three to harmonize palette, type, spacing, motion vocabulary, AND favicon / app-icon family. Each app keeps its own identity but the three feel like one ecosystem.

Note (2026-05-09): all three currently have SVG favicons that follow a loose family pattern — Resonance is concentric circles in emerald on `#0a0a0a`, Constellation is a star network in pale amber on `#05060a`, Ensemble is three overlapping saffron circles on `#05060a`. The audit should harmonize: dark-base hex (currently slightly inconsistent: `#0a0a0a` vs `#05060a`), accent color story (one accent per app, picked deliberately), corner radius (Resonance has `rx=5`, others have none), and add the missing PNG variants (Apple touch icon 180x180, OG image, manifest icons 192/512) coordinated across all three.

**Why noticed:** Surfaced during the Ensemble visual-system brainstorm on 2026-05-09. The Ensemble work was deliberately scoped so its tokens are extractable rather than baked-in, which makes a future audit cheap. Drub's stated goal is for the three apps to feel related but distinct. The Resonance dark base (`#05060a`) is already shared by all three.

**Anchors:**

- `docs/superpowers/specs/2026-05-09-visual-system-design.md` (Ensemble token system, the model for the other two)
- `src/styles/globals.css` (token definitions)
- `decisions.md` (locked architectural decisions for Ensemble; Resonance and Constellation have their own)
- Resonance repo: `github.com/Drubnerw98/Resonance`
- Constellation repo: `github.com/Drubnerw98/Constellation`

**What's been considered:**

- Token-driven systems mean palette swaps are one-file edits per app, no component rewrites needed.
- Audit happens at "roughly 95% complete" to avoid harmonizing against moving targets.
- Some C-tier ideas from the Ensemble brainstorm (two-column layout, arrival animations, density variants) might land in this audit instead of in Ensemble alone.

**Shape of work:**

1. Inventory all three apps' tokens, fonts, motion vocabularies (one pass per repo).
2. Decide which app's system is the reference, or define a shared meta-system.
3. Apply the unified system per repo as separate PRs, one repo at a time.

**Open questions:**

- Does Resonance or Constellation already have a token system, or do they need to be retrofitted first?
- Is there a single shared package for tokens (npm/workspace), or do they get copied per repo?

### 2026-05-09 — Two-column desktop layout for session view

**What:** Session view currently uses a single column at `max-w-3xl`. A two-column desktop layout (left: candidates, right: presence + activity feed) would give the social moment more spatial prominence and unlock space for a "live activity" rail.

**Why noticed:** Surfaced during the Ensemble visual-system brainstorm as approach C. Cut from the current pass to keep scope honest (the current overhaul is system + primitives + hero polish only). Deferred until after build step 6 (consensus flow) ships, since consensus design might want column space the layout has not yet committed to.

**Anchors:**

- `src/components/SessionUI.tsx` (current single-column session UI)
- `docs/superpowers/specs/2026-05-09-visual-system-design.md` (where this was parked)

**Shape of work:** Layout change only, no token changes. Mobile collapses back to single column. Estimate: half a session.

### 2026-05-09 — Session-arrival animation

**What:** When a user joins a session, the room could feel considered: faces appear in sequence, the room code lands with weight, accent flashes briefly. Currently the page just renders.

**Why noticed:** Floated during the Ensemble visual-system brainstorm as part of approach C (full system pass with layout experimentation). Cut from the current pass because most sessions are persistent so the moment is rarely re-experienced, which made it a poor cost-benefit for a "mini overhaul."

**Anchors:**

- `src/components/SessionUI.tsx` (where the animation would live)

**Shape of work:** Single component pass. Framer Motion staggered entrance on the room header and presence chips.

### 2026-05-09 — Mobile-first density variants

**What:** Current spec assumes desktop-first density (laptop screen-share is the primary use case). A mobile-first density variant for the secondary case (phone joiner while watching elsewhere) would give the app a cleaner small-screen experience.

**Why noticed:** Cut from the current pass because the spec optimizes for the primary use case (desktop). Worth revisiting after step 7 (mobile breakpoints + polish), where it might land naturally as part of the responsive work rather than as a separate effort.

**Anchors:**

- Build step 7 in `CLAUDE.md` ("Mobile breakpoints + polish")

**Shape of work:** Likely folded into step 7 rather than its own initiative.

### 2026-05-09 — Light theme

**What:** Ensemble is dark-only. A light theme would expand the addressable use case (daytime planning sessions, presentation mode) and give the cross-site audit one more axis to harmonize on.

**Why noticed:** Cut from the current pass for scope. Tokens-first design makes a light theme tractable later (one `@theme` block per scheme). Deferred to the cross-site audit since light theme decisions for Ensemble alone risk diverging from Resonance and Constellation.

**Anchors:**

- `src/styles/globals.css` (where the light theme tokens would live, likely behind `@media (prefers-color-scheme: light)` or a class)
- The cross-site audit followup above

**Shape of work:** Add a parallel set of light tokens. Audit every component for color decisions that assume dark.

**Open questions:**

- Single source of truth (`prefers-color-scheme`) or user-toggleable?
- Does Resonance or Constellation already have a light theme to harmonize against?

### 2026-05-09 — Winning candidate row pulse on consensus transition

**What:** The consensus-flow spec calls for the winning candidate's row in the candidates list to "briefly pulse with the saffron accent" when the threshold first crosses. The hero card slide-in shipped, but the row-level pulse did not. Visual moment is slightly less rich than spec-described.

**Why noticed:** Surfaced during the final cross-cutting code review of the consensus flow implementation on 2026-05-09. Spec line 166 of `docs/superpowers/specs/2026-05-09-consensus-flow-design.md` describes the pulse explicitly. Plan task 11 covered the spin animation and slide-in but did not include a row-pulse implementation. No test would have caught it because component tests don't exercise the live transition.

**Anchors:**

- `docs/superpowers/specs/2026-05-09-consensus-flow-design.md:166`
- `src/components/SessionUI.tsx` (the `CandidateRow` component is where a `pulse` prop or `data-just-decided` attribute would live)
- `src/components/HeroCard.tsx` (the existing slide-in animation; pulse should fire in concert)

**Shape of work:** Add a `justDecided` prop or `data-just-won` attribute to the winning `CandidateRow`, hooked to the same `observedTransition` state that gates the hero card animation. CSS keyframe via Tailwind for a one-shot saffron pulse over ~600ms. Single component pass, no token changes.

**Open questions:**

- Should the row pulse fire in parallel with the hero card slide-in, or sequentially (row pulses first, then card animates in from below)?

### 2026-05-09 — Extract shared UserInfo type

**What:** The `UserInfo = { name?: string; avatarUrl?: string }` type is currently defined in two places: `src/components/SessionUI.tsx` and `src/components/HeroCard.tsx`. They are identical today but will silently diverge if one is extended (e.g., adding a `color` field for display).

**Why noticed:** Flagged during the code-quality review of HeroCard during the consensus-flow implementation. Acceptable at the current scale, but worth extracting to a shared module the next time a third consumer needs it. Most natural home is `src/lib/types.ts` or a `src/components/types.ts` if the module stays presentation-scoped.

**Anchors:**

- `src/components/SessionUI.tsx` (one definition)
- `src/components/HeroCard.tsx` (other definition)

**Shape of work:** Trivial. One file added, two files modified to import. No behavior change.

### 2026-05-09 — Disabled controls need accessible reason

**What:** The candidates input, Add button, Vote/Voted button, and remove button all become `disabled` when `consensus.phase === "decided"`. That blocks interaction correctly, but a screen-reader user hears only "dimmed, unavailable" with no context for *why*. An `aria-describedby` pointing to a hidden status message ("voting locked, room has decided") would close the gap.

**Why noticed:** Surfaced during the code-quality review of Task 9 in the consensus-flow implementation. Low severity at this stage because no formal a11y pass has happened yet, but the pattern is now applied to four controls and only grows from here.

**Anchors:**

- `src/components/SessionUI.tsx` (CandidatesPanel input + Add button, CandidateRow Vote/Voted + remove buttons)

**Shape of work:** Add a hidden status node, point each disabled control's `aria-describedby` at it. One commit, no visual change.

### 2026-05-09 — Consider extracting consensus logic from SessionUI

**What:** `src/components/SessionUI.tsx` is now ~470 lines and holds both presentation (the room layout) and connector logic (consensus storage reads, transition detection, host migration, threshold mutations, reconsider). The connector half could move into a `useConsensusRoom` hook or similar so SessionUI is just the layout.

**Why noticed:** Flagged at multiple points during the consensus-flow implementation reviews as a "trend, not a crisis." File size grew naturally as planned tasks landed; the consensus state machine became the dominant resident of the file. Worth deciding whether to split before the next major feature.

**Anchors:**

- `src/components/SessionUI.tsx` (the file in question)

**Shape of work:** Probably an `src/hooks/useConsensusRoom.ts` returning `{ consensus, isHost, setThreshold, reconsider, ... }`. SessionUI shrinks to render-only. No behavior change, just relocation. Could land alongside step 8 (mobile breakpoints) or wait for step 9 (deploy).

**Open questions:**

- Hook or context? Hook is simpler; context would let nested components subscribe selectively.

## Resolved

(items move here when ticketed and shipped, or fixed inline)

## Abandoned

(items move here when explicitly decided against)
