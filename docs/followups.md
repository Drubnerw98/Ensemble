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

## Resolved

(items move here when ticketed and shipped, or fixed inline)

## Abandoned

(items move here when explicitly decided against)
