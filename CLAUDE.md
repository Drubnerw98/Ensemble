# CLAUDE.md — Ensemble

Working rules for this project. Loads on every Claude Code conversation in this repo. Update as the project evolves — this file is the source of truth for *how* we work; `decisions.md` is the source of truth for *what* we've decided.

## What this is

Ensemble is a real-time multi-user companion to **Resonance** and **Constellation** — the third app in a deliberately paired ecosystem.

- **Resonance** ([github.com/Drubnerw98/Resonance](https://github.com/Drubnerw98/Resonance)) maps a user's taste DNA into a structured profile and recommends across formats.
- **Constellation** ([github.com/Drubnerw98/Constellation](https://github.com/Drubnerw98/Constellation)) visualizes that profile as a force-directed canvas.
- **Ensemble** is the layer where two or more users converge their profiles in real time and decide what to watch, read, or play together.

Shared Clerk OAuth across all three. Reads Resonance's API via bearer token (the same pattern Constellation uses). Adds a real-time multi-user surface that the other two don't have.

## Why this project exists

Drub is building Ensemble as a portfolio piece to demonstrate distributed-systems intuition (sync engines, presence, conflict resolution, optimistic UI) on top of an ecosystem that already shows full-stack AI work (Resonance) and visual craft (Constellation).

**Every architectural decision needs to be one drub can defend in an interview.** That's the bar, not "did the feature ship." The decisions log is the artifact that proves it.

## The engineer-vs-implementer boundary

**Drub makes the architectural calls. Claude implements.** This is a hard rule.

### Drub:

- Makes architectural decisions (data model, library choice, scope, abstraction boundaries)
- Owns what ships at MVP and what cuts
- Decides when to graduate, refactor, or rewrite
- Reviews and approves every entry in `decisions.md`

### Claude:

- Implements features once the architecture is locked
- Refactors, writes tests, debugs, types
- **Surfaces options + tradeoffs when a real decision is needed; does NOT pick.**
- Drafts decision-log entries for drub to review and refine

### When Claude has a decision to make

If Claude hits a decision point with a real tradeoff (library choice, schema shape, abstraction boundary, error-handling pattern, sync-state model, persistence shape), **stop the implementation**. Surface 2-3 options with their tradeoffs and ask. Do not guess. Do not pick the "obvious" default. The whole point of this constraint is that drub can articulate every call live in an interview.

### What "real tradeoff" means

Not every choice is architectural. Naming a variable, picking which test to write first, deciding between `.ts` and `.tsx` for a file — those are implementation choices. Just do them.

A **real tradeoff** is one where:

- Two or more options have meaningfully different long-term consequences
- An interviewer might plausibly ask *"why did you pick X over Y?"*
- The wrong answer would be hard to undo

When in doubt, pause and ask. The cost of one extra question is low; the cost of an architectural call drub can't defend is high.

## Decision-asking protocol

When a real tradeoff comes up:

1. **Stop the implementation.**
2. **Surface options** in this format: option name → what it gets you → tradeoff accepted.
3. **Recommend** one with reasoning.
4. **Wait for drub to greenlight or push back.**
5. **Once decided, draft the entry for `decisions.md`.** Drub reviews/edits.

## What gets logged to `decisions.md`

Every architectural call gets an entry in this format:

```
## [YYYY-MM-DD] — [Decision title]

**Considered**: option A, option B, option C.
**Decision**: chosen option.
**Why**: reasoning, in drub's voice — this is what an interviewer will hear.
**Tradeoff accepted**: the cost being paid.
**Would revisit if**: conditions that would tip the call.
```

The bar for logging: would an interviewer plausibly ask *"why did you pick X over Y?"* If yes, log it. Implementation choices don't need entries.

The **"Would revisit if"** line is non-optional. Naming the conditions that would invalidate a call — instead of claiming the decision is correct forever or apologizing for it — is the senior-engineer move.

## Working preferences (drub)

These come from drub's global preferences. Restated here in case the global doesn't load in this environment.

**Communication shape:**

- Brief responses. State what's about to happen, run the work, summarize what changed. No padding, no running narration.
- Greenlights are short ("yeah", "send it", "go"). Don't ask for re-confirmation when drub has already approved a plan.
- No emojis in regular communication.
- End-of-turn summaries: 1-2 sentences.

**Engineering judgment:**

- Push back when you disagree. Drub explicitly invites it. Saying yes to bad ideas is worse than friction.
- If something feels bigger than drub thinks, say so honestly. Scope honesty over forced optimism.
- Quality > speed for AI features. Don't propose Haiku/cost-saving swaps unsolicited.
- Drub is a self-taught dev with deep TS/React/Node and product instincts. Treat as a senior collaborator who appreciates pushback.

**Workflow rhythm:**

- Run typecheck and (for frontend) build before claiming work done.
- Commit at meaningful checkpoints. Bare one-line subject; body if needed; trailer:
  `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
- Never push to remote unless drub asks. Never amend a published commit. Never skip hooks (`--no-verify`). Never force-push to main.
- DB migrations: confirm before applying against any shared environment.

## Engineering principles (apply by default)

These are drub's principles, demonstrated working in Resonance and now applied to Ensemble. Flag deviations.

1. **Schema as contract AND validator.** One Zod schema constrains the API/sync surface AND validates at runtime. Same schema, both jobs.
2. **Validate at boundaries, trust internals.** External APIs (Resonance, Liveblocks events), user input, sync events — validate. Internal function signatures — trust the type system.
3. **Server-enforce, don't trust clients.** Liveblocks rooms can be authenticated server-side; auth/authorization rules belong there, not in the client.
4. **Defense-in-depth on auth.** Every user-scoped operation checks user identity explicitly, even past auth middleware.
5. **Status-coded errors for user-state.** Throw `Error & { status: number }` for non-server faults; centralized handler maps `.status` to HTTP code.
6. **`Promise.allSettled` when one failure shouldn't kill the batch.**
7. **Premature scale is wrong; graduate when the failure mode bites.** Liveblocks-managed first, self-hosted Yjs later if and only if the failure mode actually appears.
8. **Restraint over completeness.** Cut weak features, ship strong ones cleanly. Same restraint Constellation applied to per-item rationale.
9. **Heuristics with stated tradeoffs are fine.** When no closed-form solution exists, name the tradeoff explicitly.
10. **Comments answer WHY, never WHAT.** Constraints, invariants, surprising behavior, references to past incidents.

## Stack (locked)

- **Frontend**: Vite + React 19 + TypeScript (matches Constellation)
- **Auth**: Clerk (shared OAuth instance with Resonance + Constellation)
- **Real-time**: Liveblocks (managed sync, free tier)
- **Resonance integration**: bearer token via Clerk session (same pattern as Constellation)
- **Hosting**: Vercel SPA, no new backend service for MVP
- **Styling**: Tailwind v4 (set up at scaffold, matches the other two). Not yet logged in `decisions.md`; still owed.

## Current state

**Phase**: TMDB integration shipped. Poster thumbnails on CandidateRow and HeroCard. Autocomplete on manual entry with freeform fallback. Resonance pulls enriched with TMDB metadata before storage write. Mobile polish, consensus flow, and visual system live underneath.

**Architectural decisions locked** (see `decisions.md` for the full reasoning):

1. Project name: Ensemble
2. Sync engine: Liveblocks
3. Persistence: ephemeral sessions for MVP
4. Auth scope: Resonance users only
5. Session sharing: opaque link + 6-character room code
6. Resonance read access: bearer-token pattern
7. Hosting: Vercel SPA + Liveblocks managed
8. Liveblocks auth: token-mint via Vercel serverless function
9. Session ID strategy: room code IS the Liveblocks room ID (ephemeral, no mapping layer)
10. Candidate source: manual title-only for first cut
11. Test runner: Vitest + happy-dom + React Testing Library
12. Visual system: token-driven (saffron + terracotta, IBM Plex pair, six-step type scale). Spec at `docs/superpowers/specs/2026-05-09-visual-system-design.md`.
13. Consensus state model: storage-stored, CRDT-resolved.
14. Threshold function: configurable per session (unanimous, majority, first-to-N).
15. Tie handling: random pick with spin reveal.
16. Lifecycle: lock + reconsider, votes cleared on reconsider.
17. Authority: room creator is host, migrates to lowest-connectionId member on drop.
18. Candidate source: hybrid library + recommendations on the client.
19. Trigger: per-user "Pull from my Resonance" button.
20. Candidate shape: title, type, year, multi-attribution addedBy.
21. Items per pull: host-configurable, default 5.
22. Mobile breakpoint strategy: single breakpoint at sm (640px).
23. Touch targets: 44px on mobile via Button primitive shim.
24. Finalize-voting: per-user Done flag in Presence, all-present-Done auto-finalizes, host has Finalize-now override.
25. TMDB integration: serverless proxy hides v3 read token, candidate schema gains optional posterUrl + tmdbId, autocomplete on manual entry with freeform fallback, Resonance pulls enriched before storage write.

**Next step**: Deploy and real-user test (build step 9). Ship to Vercel, run a session with a friend.

## Build steps (rough order, not strict)

Drub said no week-by-week — here are the discrete steps. Adjust as we learn.

1. **Initialize**: ✅ repo, CLAUDE.md, decisions.md, Vite + React 19 + TS + Tailwind v4 + ESLint + Prettier scaffolded.
2. **Auth + Resonance read**: ✅ Clerk scaffolding, sign in, fetch own profile from Resonance via bearer token (commit `e91b744`).
3. **Session shell, single-user**: ✅ create / join a session by URL or code (commit `efb8f71`). Manual candidate list still pending.
4. **Wire Liveblocks**: ✅ rooms, token auth, session create/join wired. Verify presence and shared-list updates in two browsers if not already confirmed.
5. **Voting + presence**: ✅ approval voting with attributed avatars (commit `530f5cf`), Liveblocks-auth hardened (commit `8b25bb9`).
6. **Visual system pass**: ✅ tokens, four primitives, voter-convergence hero. Spec at `docs/superpowers/specs/2026-05-09-visual-system-design.md`.
7. **Consensus flow**: ✅ configurable threshold, random tiebreaker, lock + reconsider, hero card reveal.
7.5. **Resonance candidate population**: ✅ per-user pull, hybrid mix, multi-attribution, host-configurable volume.
8. **Mobile breakpoints + polish**: ✅ stacked rows on mobile, 44px touch targets, avatar crush + items-per-pull fixes.
9. **Deploy + real-user test**: ← here. Ship to Vercel, run it with a friend.

## External dependencies

- **Resonance API**: `https://resonance-server-t4r8.onrender.com/api/*`
  - Bearer-token authenticated via Clerk session token
  - Endpoints used: `/profile/export` (existing). New endpoints may be needed and will be added to Resonance as separate, controlled changes.
- **Liveblocks**: `liveblocks.io` — managed sync service, free tier
- **Clerk**: shared OAuth instance with Resonance + Constellation
- **Vercel**: frontend hosting

## Conventions to lock when scaffolding

Status: directory layout, Tailwind v4 styling, and test runner are set up. Tailwind tokens and tests are now logged in `decisions.md`. Directory layout, CI, and commit conventions still TBD. Log to `decisions.md` as each is locked.

- Directory layout (`src/components/`, `src/routes/`, `src/lib/`, etc.)
- Styling system (✅ tokens locked in `decisions.md` and `globals.css`)
- Test setup (✅ Vitest + happy-dom + React Testing Library, logged in `decisions.md`)
- CI workflow (GitHub Actions matching Constellation's `check.yml` pattern)
- Commit prefix conventions (or none, match drub's existing repos)

## A note on the decisions log

The `Why` lines in `decisions.md` are the most important part of this whole project. Each one is what drub will say in an interview when asked *"walk me through that call."*

Initial entries were drafted from our scoping conversation. **Drub: review each `Why` and edit any phrasing that doesn't sound like you.** The reasoning should match what you'd actually say live.

## Side notes written by me

In any writing you do avoid overtly AI seeming tells such as M Dashes, avoid usage of emojis

