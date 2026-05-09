# Ensemble — Architectural Decisions Log

Append-only. Every entry follows the format defined in `CLAUDE.md`.

The `Why` line in each entry is what an interviewer will hear from drub when asked *"walk me through that call."* **Drub: review every `Why` and edit any phrasing that doesn't match how you'd say it live.** Initial drafts below come from the scoping conversation.

---

## 2026-05-04 — Project name: Ensemble

**Considered**: Conjunction (astronomical alignment of celestial bodies — direct thematic continuation of Constellation), Ensemble (French for "together," multiple performers as a unified whole), Convergence (multiple things flowing to a point), Harmonic (waves combining in phase, picks up Resonance's sensory thread).

**Decision**: Ensemble.

**Why**: The product is fundamentally about people convening around shared taste. Conjunction was the cleaner astronomical thematic continuation but felt cold for a social product. Ensemble names what the product *is* — people together — directly. The musical/artistic association also connects to my film background, which is part of how I want the portfolio to read overall.

**Tradeoff accepted**: Less direct thematic match with Constellation's celestial vocabulary. The "ecosystem" framing now leans on Resonance's wave-theme + Ensemble's human-theme rather than a fully celestial through-line.

**Would revisit if**: Another product in the ecosystem made celestial branding load-bearing for the lineup.

---

## 2026-05-04 — Sync engine: Liveblocks

**Considered**: **Yjs** (self-hosted CRDT, max flexibility, requires running my own sync server like `y-websocket`), **Liveblocks** (managed Yjs-compatible service, React hooks, free tier), **Partykit** (Cloudflare Workers + Yjs primitives baked in, middle ground), **vanilla WebSocket** (lowest-level, manual everything).

**Decision**: Liveblocks.

**Why**: I'm a novice on real-time sync infrastructure. The thing I'm trying to demonstrate in this project is the *application architecture* of a multi-user product — presence, voting flow, optimistic UI, conflict resolution at the UX level — not the low-level sync infrastructure. Liveblocks removes the infra layer entirely so I can focus on the part that's actually new for me. React hooks (`useStorage`, `useOthers`, `useSelf`) drop in cleanly. Free tier covers MVP scope.

**Tradeoff accepted**: Vendor lock-in. Costs scale with usage at production scale. Some flexibility loss vs. raw Yjs (e.g., custom CRDT types, server-side hooks).

**Would revisit if**: Building for production traffic where the cost or flexibility ceiling becomes load-bearing, or wanting to avoid managed-service lock-in. Graduation path is Yjs + `y-websocket` on a long-lived Node process, with a small auth shim. Same shape as the in-memory→Postgres job-tracker graduation in Resonance: ship the simpler thing now, graduate when the failure mode actually bites.

---

## 2026-05-04 — Persistence model: ephemeral sessions for MVP

**Considered**: **Ephemeral** (Liveblocks holds in-session state only, nothing persisted beyond the session), **Partial-persist** (snapshot "tonight's pick" on session end to Postgres), **Full-persist** (full session history queryable, including all votes / all candidates).

**Decision**: Ephemeral for MVP. Architecture leaves a clean path to partial-persist post-MVP.

**Why**: MVP value is the live group experience. History is "nice to have." Ephemeral is the simplest thing that works and avoids a database migration before there's even a working sync layer. Adding persistence later is an additive change, not a rewrite.

**Tradeoff accepted**: Sessions disappear when everyone leaves the room. No "remember last week's group pick" UI in v1.

**Would revisit if**: Real-user feedback shows people want to revisit past sessions, or "tonight's pick" needs to feed back into Resonance as a feedback signal (i.e., the group decision becomes a strong signal for future recommendations). Then add a snapshot-on-session-end write to Postgres — likely on Resonance's existing DB rather than spinning up a new one.

---

## 2026-05-04 — Auth scope: Resonance users only

**Considered**: **Resonance users only** (must have a Resonance account), **anyone-with-Clerk** (allow non-Resonance users to join sessions, perhaps with a default sample profile), **fully open** (no auth at all).

**Decision**: Resonance users only.

**Why**: The whole value prop of Ensemble is *"we use your existing taste profile to find what your group will agree on."* Non-Resonance users have no profile, so the product has nothing to give them. Reuses the Clerk OAuth instance already shared between Resonance and Constellation — zero new auth surface to build. Simplest user model.

**Tradeoff accepted**: Friction for users who want to try Ensemble before signing up for Resonance. They have to onboard to Resonance first, which is its own multi-turn AI flow.

**Would revisit if**: User research shows the cross-product onboarding kills group adoption (e.g., a Resonance user invites three friends, two bounce because they don't want to do Resonance's onboarding). Then add a "guest mode" that uses a default sample profile so new users can participate in someone else's session before deciding whether to commit to Resonance.

---

## 2026-05-04 — Session sharing: opaque link + 6-character room code

**Considered**: **Link only** (`/s/<opaque-id>`), **room code only** (Jackbox-style 6-character), **friend list / invite system**, **link AND code** (both available, link as canonical).

**Decision**: Both. The link is the canonical share method; the room code is for verbal/screen-share situations.

**Why**: Link is universal — copy-paste in any chat, works on every device. Room code is the UX nicety that makes "what's the code?" work over voice or when looking at someone else's screen. Both fall out of the same underlying session ID, so it's not really two surfaces — it's two ways to reach the same record. No friend list because friend lists are a whole feature surface (search, requests, blocks, presence-on-friends-list) and we don't need any of it for MVP.

**Tradeoff accepted**: Two share methods to keep in sync. Both URLs and codes have to resolve to the same session, and the code-to-session mapping has to be maintained somewhere.

**Would revisit if**: Adding social features (find friends, see friends' active sessions, get notified when a friend opens a session). At that point the friend list becomes load-bearing and the room code might become redundant.

---

## 2026-05-04 — Resonance read access: bearer-token pattern (Constellation precedent)

**Considered**: **Bearer-token** (same pattern as Constellation — Clerk session token sent to Resonance API, server verifies), **service-account** (Ensemble has its own credential to Resonance), **direct DB access** (Ensemble reads Resonance's Postgres directly — explicitly forbidden, breaks separation of concerns).

**Decision**: Bearer-token, same as Constellation.

**Why**: Already proven, reuses infrastructure I built and understand, clean cross-app contract. Resonance's API is the source of truth for taste profiles + library + recommendations; Ensemble is a consumer. The bearer-token pattern keeps the dependency direction clean (Ensemble depends on Resonance, never the other way around) and means every read is scoped to the user's own data automatically (the Clerk session identifies the user, the API enforces user-scoped queries).

**Tradeoff accepted**: Resonance's API needs to expose any new endpoints Ensemble requires — for instance, if Ensemble needs to read library items beyond what `/profile/export` returns. Couples Ensemble's read surface to Resonance's API shape; changes to Resonance's API need to be coordinated.

**Would revisit if**: Resonance's API became a performance bottleneck (Ensemble making many concurrent calls during sessions), or Ensemble needed *write* access to Resonance's domain — which would itself be a sign that Ensemble's scope had crossed into Resonance's territory and the architecture needed rethinking.

---

## 2026-05-04 — Hosting: Vercel SPA + Liveblocks managed

**Considered**: **Vercel SPA + Liveblocks** (frontend on Vercel, sync infra on Liveblocks, no new backend), **Vercel SPA + custom sync backend on Render** (run y-websocket on Render alongside Resonance's API), **fully self-hosted** (run everything on a VPS).

**Decision**: Vercel SPA + Liveblocks managed.

**Why**: Matches Constellation's deploy pattern (Vercel SPA), so I'm not learning new deploy infrastructure for this project. Liveblocks handles sync infra so there's no new backend service to maintain. Resonance's existing Render Express handles the API reads. Simplest possible deployment topology — three managed services in the chain (Vercel + Clerk + Liveblocks) but no new self-hosted infrastructure.

**Tradeoff accepted**: Three managed services in the dependency chain. Cost predictability depends on each provider's pricing changes. If any one of them has an outage, the relevant feature breaks.

**Would revisit if**: Liveblocks costs become significant, or reliability becomes a problem. Then graduate to self-hosted Yjs on Render alongside Resonance, sharing the long-lived Node process. Same graduation pattern as the rest of the engineering principles.

---

## 2026-05-05 — Liveblocks auth: token-mint via Vercel serverless function

**Considered**: **Public-key only** (frontend connects with Liveblocks publishable key, anyone with a room ID + the public key can join), **token-mint via Vercel function** (`/api/liveblocks-auth.ts` verifies the Clerk session server-side, mints a per-room Liveblocks JWT scoped via `session.allow(room, FULL_ACCESS)`).

**Decision**: Token-mint via Vercel serverless function.

**Why**: The Auth Scope decision was "Resonance users only," and Defense-in-Depth says enforce server-side. Public-key would let anyone on the internet with a guessed room ID join — the principle says no. Cost is small: one Vercel Node function on the existing Vercel project, no new service. The function is ~40 lines: verify Clerk token, fetch the user's display info, mint the Liveblocks token. Same shape as Resonance's existing Express middleware — server is the source of truth on identity.

**Tradeoff accepted**: One serverless function on Vercel to maintain; cold-start on the function (Vercel Node functions warm fast but the first connect after a quiet period takes ~200-500ms); two new env vars on Vercel (`CLERK_SECRET_KEY`, `LIVEBLOCKS_SECRET_KEY`).

**Would revisit if**: The function becomes a bottleneck (high concurrency joining at once) — at that scale, move to Edge runtime. If we ever wanted unauthenticated guest mode (per the Auth Scope "Would revisit if"), the auth endpoint becomes the natural place to mint guest tokens with restricted access.

---

## 2026-05-05 — Session ID strategy: room code IS the Liveblocks room ID

**Considered**: **Code IS room ID** (6-char `[A-HJKMNP-Z2-9]` code is both the URL slug and the Liveblocks room ID, no mapping layer), **opaque ID + code alias** (Liveblocks room is a cuid; the 6-char code is a separate alias mapped via a KV store or Resonance DB).

**Decision**: Code IS room ID for MVP.

**Why**: Sessions are ephemeral (per the persistence decision). With ephemeral state, there's no shared mapping layer to maintain — when the room dies, so does the code. ~10⁹ codes from a 31-char alphabet is plenty for the traffic an MVP sees, and visually-ambiguous chars (0/O/1/I/L) are removed so codes are speakable. Adds zero infrastructure: no KV, no DB write, no API surface. Joining a session is literally entering a room ID.

**Tradeoff accepted**: Brute-force enumeration is theoretically possible (10⁹ space, but the auth function is rate-limited by Vercel and only Resonance users can mint tokens). Code length is fixed at 6 — switching to 7 later would be a one-line change but breaks any links anyone has bookmarked.

**Would revisit if**: Persistence comes back (per the persistence "Would revisit if"), or session lifetime stretches past one sitting. At that point a stable opaque ID becomes load-bearing and codes become aliases that can be retired.

---

## 2026-05-05 — Candidate source: manual title-only for first cut

**Considered**: **Manual title-only** (any member types a title, all see it), **pull from one user's Resonance recs** (signed-in user's recommendation list becomes the candidate pool, others vote on it), **cross-reference both users' Resonance profiles** (intersection of taste signals seeds the pool).

**Decision**: Manual title-only for the first end-to-end cut. Resonance integration and cross-referencing are separate, sequenced checkpoints.

**Why**: Goal of the first Liveblocks cut is to prove the sync layer works end-to-end (two browsers, same list, presence). Pulling from Resonance recs adds a fetch + dedup layer that has nothing to do with whether sync is correct — bundling them obscures which thing broke when something does. Each future variant is a PR-sized addition: "pull recs into a session" is one checkpoint, "cross-reference profiles" is another.

**Tradeoff accepted**: The first deployable version is functionally lo-fi — typing titles by hand isn't the long-term experience. Acceptable because real-user testing requires the sync layer working first, and we can layer the Resonance integration on top once that foundation is verified.

**Would revisit if**: Never — this is explicitly first-cut. The next checkpoint already has "pull from Resonance recs" planned.

---

## 2026-05-09 — Test runner: Vitest with happy-dom + React Testing Library

**Considered**: **Vitest + happy-dom + RTL**, **Vitest + jsdom**, **Jest + jsdom**, **no tests for MVP**.

**Decision**: Vitest with happy-dom and React Testing Library.

**Why**: Vitest is Vite-native, so the test runner shares config and transforms with the dev server — no second toolchain to keep in sync. happy-dom is faster than jsdom and covers everything component-level tests need. RTL is the standard React testing surface, so the patterns I write here are the same patterns I'd write at any React shop. The cost of "no tests for MVP" is shipping primitives that have no regression net for the cross-site visual audit, and that audit is the whole point of building a token-driven system.

**Tradeoff accepted**: happy-dom occasionally diverges from real-browser behavior on edge cases (Shadow DOM, some CSS APIs that aren't fully implemented). For unit tests on UI primitives this hasn't bitten me, but it would for anything visual-regression or layout-dependent.

**Would revisit if**: We adopt Storybook (Storybook + Playwright component tests would replace happy-dom for primitives), need real visual regression testing, or component logic grows past what unit tests can cover.

---

## 2026-05-09 — Visual system: token-driven, saffron + terracotta on dark

**Considered**: **Lean polish** (refine existing inline Tailwind in place, no system), **system in components only** (visual decisions baked into components, no shared tokens), **token-driven system** (tokens in Tailwind v4 `@theme`, four primitives consume them).

**Decision**: Token-driven system in Tailwind v4 `@theme` plus four primitives (Button, Card, Eyebrow, AvatarStack) in `src/components/ui/`. IBM Plex Sans + Plex Mono. Saffron (`#E8A857`) for brand / social / consensus, terracotta (`#DB7B47`) for warnings. One Framer Motion spring on AvatarStack vote-lands.

**Why**: Tokens in one file are extractable; the cross-site audit (Resonance + Constellation + Ensemble at roughly 95% complete) needs a system to harmonize against, not a pile of styled components. Plex Sans + Plex Mono are designed as a paired family, which makes the eyebrow-mono / body-sans relationship intentional rather than coincidental — Inter would have been the safer pick but reads cold against the social direction; Geist was right for the eyebrows but reads as Vercel-coded. Saffron and terracotta as two warm hues rather than one shared amber prevents "consensus reached" and "couldn't load profile" from looking the same. The single Framer Motion spring on the vote-lands moment is the senior-restraint move: if everything springs, nothing does.

**Tradeoff accepted**: One more font import, two more color tokens, and a runtime motion library compared to "polish in place." Worth it for the durable system artifact, which is the whole point of doing this before consensus flow ships and the UI surface area doubles.

**Would revisit if**: We add a light theme (would need a parallel set of tokens), the cross-site audit picks a different shared palette or font pairing, or Framer Motion gets superseded by a smaller alternative we adopt elsewhere in the ecosystem.
