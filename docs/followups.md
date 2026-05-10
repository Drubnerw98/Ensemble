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
  - [2026-05-09 — Extract shared UserInfo type](#2026-05-09--extract-shared-userinfo-type)
  - [2026-05-09 — Disabled controls need accessible reason](#2026-05-09--disabled-controls-need-accessible-reason)
  - [2026-05-09 — Consider extracting consensus logic from SessionUI](#2026-05-09--consider-extracting-consensus-logic-from-sessionui)
  - [2026-05-09 — Voter avatars crush on candidate rows under multi-vote load](#2026-05-09--voter-avatars-crush-on-candidate-rows-under-multi-vote-load)
  - [2026-05-09 — Items-per-pull input shows pre-clamp value until storage round-trip](#2026-05-09--items-per-pull-input-shows-pre-clamp-value-until-storage-round-trip)
  - [2026-05-10 — Integration coverage for the all-present-Done gating effect](#2026-05-10--integration-coverage-for-the-all-present-done-gating-effect)
  - [2026-05-10 — Stale "void reference" comment above pullCandidates mutation](#2026-05-10--stale-void-reference-comment-above-pullcandidates-mutation)
- [Resolved](#resolved)
  - [2026-05-09 — Winning candidate row pulse on consensus transition](#2026-05-09--winning-candidate-row-pulse-on-consensus-transition-1)
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

### 2026-05-09 — Voter avatars crush on candidate rows under multi-vote load

**What:** When multiple voters cast votes on the same candidate, the avatar stack on the candidate row visually crushes (avatars squish, layout gets awkward). Drub flagged it during a session where multiple votes were cast.

**Why noticed:** Drub raised it as a side note while planning the next build phase. Likely a layout issue inside `CandidateRow` (the row uses `flex items-center` with the title set to `min-w-0 truncate` and the right-side cluster `shrink-0`, but the AvatarStack itself may be losing aspect ratio or horizontal space when many voters land at once). Probably worse on narrow viewports.

**Anchors:**

- `src/components/SessionUI.tsx` — `CandidateRow` (the `<li>` row layout and AvatarStack placement)
- `src/components/ui/AvatarStack.tsx` — the stack primitive itself, in case the squish is intrinsic to the component rather than the row layout

**Shape of work:** Reproduce locally with 4-5 simulated votes and inspect. Likely a `min-w-0` missing somewhere, an `aspect-square` not being held on the avatar img, or insufficient room when title text takes most of the row. Could fold into the mobile breakpoints + polish pass (build step 8) since it touches the same surface, or fix sooner if the Resonance candidate population work surfaces it on every row.

**Open questions:**

- Is the crush happening only at narrow widths or also on desktop?
- Are the avatars losing aspect ratio (rendered as ovals) or just visually overlapping more aggressively than intended?

### 2026-05-09 — Items-per-pull input shows pre-clamp value until storage round-trip

**What:** The host's "Items per pull" number input in `ThresholdPicker` is controlled, but UI-side clamping is enforced only by the HTML `min={1} max={20}` attributes (which the browser respects for spinner buttons but not for arbitrary keyboard input). When a host types `0` or `25` directly, the input shows that value until the `setCandidatesPerPull` mutation clamps it server-side and the Liveblocks round-trip pushes the clamped value back to the prop. Brief visual mismatch; no incorrect storage state.

**Why noticed:** Surfaced during the final cross-cutting review of the Resonance candidate population implementation on 2026-05-09. Reviewer flagged it as a Minor UX rough edge. An earlier mid-implementation fix attempt to add a `>= 1` guard in `handlePerPullChange` was reverted because it broke the controlled-input typing flow (intermediate keystroke values would be rejected). The current state is acceptable for MVP because the stored value is always correct.

**Anchors:**

- `src/components/ThresholdPicker.tsx` (`handlePerPullChange`, the input element)
- `src/components/SessionUI.tsx` (`setCandidatesPerPull` mutation, which clamps to 1-20)

**What's been considered:**

- Naive `>= 1` guard rejects typing flow (clearing the input emits 0 and stops further onChange propagation).
- A debounced or onBlur-only commit would feel sluggish for what should be an instant control.
- A controlled local-state mirror with deferred clamp on commit is the standard React pattern for this case but adds component state Card.Eyebrow doesn't currently have.

**Shape of work:** Either accept the rough edge or add a thin local-state layer in the input that defers clamping until blur/Enter. Likely lands during build step 8 (mobile + polish) when input UX gets a deliberate review.

**Open questions:**

- Does drub care enough about the brief visual mismatch to invest in a controlled-with-local-buffer pattern?

### 2026-05-10 — Integration coverage for the all-present-Done gating effect

**What:** The detection effect at `src/components/SessionUI.tsx` (post-finalize-voting, in the second `useEffect` after the hooks block) is the load-bearing change of the finalize-voting feature: it gates `lockConsensus` on `allPresentDone`. There is no automated test that exercises it. Verification today is the spec's manual two-browser script. Acceptable for MVP, but a regression here would silently revert the feature and a lint or refactor pass could break the early-return without any test catching it.

**Why noticed:** Surfaced during the post-implementation review of the finalize-voting feature on 2026-05-10. The reviewer flagged this as MVP-acceptable but called the gating effect "the load-bearing change of the whole feature" with one untested integration point. The spec at `docs/superpowers/specs/2026-05-10-finalize-voting-design.md` explicitly notes the test gap. The feature was friend-test driven (the auto-lock-on-first-cross was found too eager); a future-friend-test regression here would be expensive to debug without a guarding test.

**Anchors:**

- `src/components/SessionUI.tsx` (the detection `useEffect` that gates on `allPresentDone`, and the `allPresentDone` / `readyCount` `useMemo`s above it)
- `docs/superpowers/specs/2026-05-10-finalize-voting-design.md` (spec acknowledges the gap)
- `decisions.md` 2026-05-10 entry "Finalize-voting model" (the architectural call this test would protect)

**What's been considered:**

- Existing test infra (Vitest + happy-dom + RTL) does not mock Liveblocks rooms. Component tests cover ReadyCard in isolation but not the SessionUI wiring.
- A pure unit test on a `useConsensusRoom` hook (after the connector-extraction followup lands) would be the natural seam: hook input is `{ phase, threshold, votesSnapshot, presentMemberIds, selfPresence, othersPresence }` and output is `{ shouldLock, evaluation, ... }`. Pure function, easy to test without Liveblocks.
- A Liveblocks integration test using their test utils is heavier; not free but would also catch presence-related bugs in vote handler wrappers and reconsider self-reset.

**Shape of work:** Probably folds into the `useConsensusRoom` extraction (`docs/followups.md:157-167`). Once the gating logic is a pure-function-shaped hook, write tests that drive it through the four state combinations: voting + not-all-done (no lock), voting + all-done + no winner (no lock, hint shown), voting + all-done + winner (lock fires once), decided (no-op). Estimate: 2 hours combined with the extraction, half of that on tests.

**Open questions:**

- Land alongside the connector extraction, or separately first as a Liveblocks-test-utils integration test?

### 2026-05-10 — Stale "void reference" comment above pullCandidates mutation

**What:** `src/components/SessionUI.tsx` has a comment block at lines 204-205 that reads `// Wired to the Pull button in Task 9. The void reference below // satisfies tsconfig's noUnusedLocals between this task and Task 9.`. The void reference it described was removed in commits `5eb55de` and `6471a61` when the Pull button actually shipped. The comment now refers to nothing.

**Why noticed:** Flagged during the post-implementation review of the finalize-voting feature on 2026-05-10. Two-line delete, no behavior change. Worth catching during the next inline edit to that area.

**Anchors:**

- `src/components/SessionUI.tsx:204-205` (the stale comment block)
- Commits `5eb55de`, `6471a61` (where the void reference was removed)

**Shape of work:** Delete two lines. Trivial.

## Resolved

(items move here when ticketed and shipped, or fixed inline)

### 2026-05-09 — Winning candidate row pulse on consensus transition

**What:** The consensus-flow spec calls for the winning candidate's row in the candidates list to "briefly pulse with the saffron accent" when the threshold first crosses. The hero card slide-in shipped, but the row-level pulse did not. Visual moment is slightly less rich than spec-described.

**Why noticed:** Surfaced during the final cross-cutting code review of the consensus flow implementation on 2026-05-09. Spec line 166 of `docs/superpowers/specs/2026-05-09-consensus-flow-design.md` describes the pulse explicitly. Plan task 11 covered the spin animation and slide-in but did not include a row-pulse implementation.

**Resolved 2026-05-10 (commit `ec7b8c6`):** Shipped a 600ms saffron box-shadow pulse on the winning `CandidateRow`. Gated on `observedTransition` (returned from `useConsensusRoom`) so late joiners do not replay it. Keyframe returns to resting at 100% so the class can stay applied without leaving a permanent visual. Chosen to fire in parallel with the hero card slide-in rather than sequentially since hero already runs a 1.2s spin reveal that occupies the moment; a sequential pulse would have either preceded the phase flip (impossible) or come after a 1.2s lull (dead time). Implementation: `@keyframes row-pulse` and `.animate-row-pulse` in `src/styles/globals.css`, plumbed via `justDecidedId: string | null` prop on `CandidatesPanel`.

## Abandoned

(items move here when explicitly decided against)
