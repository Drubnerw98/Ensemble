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

---

## 2026-05-09 — Consensus state model: storage-stored, CRDT-resolved

**Considered**: **Storage-stored** (a `consensus: LiveObject<...>` node in Liveblocks Storage; first client to detect threshold-cross writes the transition), **derived** (compute consensus state every render with no `phase` field), **server-authoritative** (Vercel function `/api/decide` runs the random pick and writes back via REST).

**Decision**: Storage-stored, CRDT-resolved.

**Why**: Two of the three options were ruled out by load-bearing requirements. Derived state breaks down on the random tiebreaker: each client running its own `Math.random()` would pick a different tied winner, and the convergence requires a single source of truth. A deterministic seed would kill the "chance picked" narrative. Server-authoritative adds a network round-trip to a moment that should feel instant, and the auth-function precedent doesn't extend (there's no security reason to centralize deciding). Storage-stored leverages Liveblocks' CRDT semantics that already power voting: simultaneous threshold-detections by multiple clients converge to a single committed state via last-writer-wins on the LiveObject.

**Tradeoff accepted**: The random tiebreaker is nondeterministic across replays. Acceptable because (a) the nondeterminism is the desired UX ("chance decided") and (b) ephemeral sessions mean there is no replay scenario where the difference would surface.

**Would revisit if**: Persistence comes back (per the persistence "Would revisit if") and replay determinism becomes load-bearing for analytics or audit. At that point a server-side decider with a stored seed becomes the natural answer.

---

## 2026-05-09 — Threshold function: configurable per session

**Considered**: **Unanimous-only** (every present member must vote), **majority-only** (>50% of present), **first-to-N-only** (host-set target), **configurable per session** (host picks one of the three at session start).

**Decision**: Configurable per session.

**Why**: Real groups disagree about what "consensus" means. Couples watching a movie want unanimous; a friend group of six picking takeout doesn't want one holdout to deadlock dinner; a 4-watching-3-deciding scenario wants first-to-N. Hard-coding any one rule mismatches a meaningful share of sessions and would force users to work around the product. The cost is a small UI surface (a select and an N input for first-to-n) and a discriminated-union type, both well within the existing token system and tooling.

**Tradeoff accepted**: A small configuration choice for the host at session start. Default of `unanimous` keeps the path of least resistance honest to the product's "we agree" framing.

**Would revisit if**: Real-user observation shows hosts never change the default (default-only would drop the surface) or always immediately switch (the default is wrong).

---

## 2026-05-09 — Tie handling: random pick with spin reveal

**Considered**: **All tied candidates win as a shortlist** (room agrees on a set, decides off-app), **tiebreaker round** (re-vote on the tied set), **random pick** (app rolls a die), **host breaks tie** (creator decides manually).

**Decision**: Random pick from the tied set, with a brief spin animation cycling through the tied candidates before settling on the winner.

**Why**: Approval voting makes ties the common case rather than the exception, so the rule has to be fast and reliably one-shot (it'll fire often). Shortlist pushes the decision back off-app, undoing the entire premise. A runoff round adds a heavier state machine (round 1 vs round 2) for what is supposed to be a friend-group casual experience. Host-as-arbiter elevates the host from "set the rule" to "decide the room's outcome," which changes the social shape of the product (peer-to-peer becomes top-down). Random pick is decisive, fast, and the spin animation makes the moment distinctive. The framing "the room agreed; chance picked" is more interesting than "majority won."

**Tradeoff accepted**: Some users will dislike randomness as a deciding mechanism. Accepted because it preserves the egalitarian feel and makes a memorable UX moment that "majority wins" would not.

**Would revisit if**: User feedback shows the random moment feels unfair or buggy ("the wheel was rigged"), or if tie incidence is much lower than expected (in which case a heavier runoff might be tolerable for the rare case).

---

## 2026-05-09 — Lifecycle: lock + reconsider

**Considered**: **Live tally only** (threshold-crossing is a UI flourish; tally stays live), **terminal lock** (threshold-crossing freezes the room, no un-decide), **lock + reconsider** (threshold-crossing locks; host can press a button to unlock).

**Decision**: Lock + reconsider. Reconsider clears all votes and returns to the voting phase.

**Why**: Live-only weakens the "we decided" beat to nothing: no narrative, no closure, just a banner. Terminal lock has the strongest moment but no recovery path; a single misclick or premature crossing means starting a brand-new session. Lock + reconsider gives the moment real weight (votes pause, hero card slides in, the room recognizes the outcome) while preserving an escape hatch. Clearing all votes on reconsider (rather than just the winner's votes) sidesteps the no-op loop where the same threshold instantly re-crosses; it also matches the natural mental model "let's vote again."

**Tradeoff accepted**: A single host can repeatedly reconsider, which in a hostile group could become a grief vector. Accepted because the intended use case is friend groups (not strangers), and the "Auth scope: Resonance users only" decision already pre-screens for that.

**Would revisit if**: Sessions stretch to larger or less-trusted groups where reconsider needs a quorum, or if real-user testing shows the moment feels too easily undone.

---

## 2026-05-09 — Authority: room creator is host

**Considered**: **Anyone (peer-to-peer)** (any member configures rule and triggers reconsider), **room creator is host** (whoever opened the session has those powers; migrates to longest-connected member if they drop), **anyone configures, majority reconsiders** (asymmetric: open rule-setting, quorum-gated unlock).

**Decision**: Room creator is host. Migration on disconnect is automatic to the lowest-connectionId remaining member.

**Why**: The product is fundamentally peer-to-peer in spirit (voting itself is fully symmetric). But two operations need a single decider: setting the threshold rule and unlocking after consensus. Both are "configure the room" gestures, not "express my preference" gestures, so attaching them to a single role is natural. Creator-is-host has the cleanest mental model ("the person who started this is steering") and avoids an explicit role-assignment flow. Migration to lowest connectionId in the present set uses Liveblocks' unique per-connection ids, so all clients pick the same successor without coordination.

**Tradeoff accepted**: A host who drops loses their role even if they intended to come back. Accepted because the alternative (preserving host across disconnects) would require persistence and explicit reclaim flows, neither of which fit MVP scope.

**Would revisit if**: We add explicit host-transfer UX (give the role to X), or if drub's friend-group testing shows host migration on disconnect feels disorienting.

---

## 2026-05-09 — Candidate source: hybrid library + recommendations on the client

**Considered**: **Server-side slicing** (new Resonance endpoint that returns a pre-sliced candidate set), **client-side slicing** (widen `/profile/export` consumption, slice locally), **cached profile in Liveblocks** (persist the snapshot per user, slice from cache).

**Decision**: Client-side slicing. Widen the existing `/profile/export` consumer to include `library` and `recommendations`; slice via a pure `pickCandidates` function in `src/lib/candidates.ts`.

**Why**: Slicing policy is an Ensemble UX decision, not a Resonance concern. Resonance also serves Constellation, so adding feature-specific endpoints there should clear a higher bar. Widening an existing read is cheaper and faster than coordinating cross-repo changes. The pure function is fully testable. If profile-export ever becomes expensive enough to matter, server-side slicing is a graduation path.

**Tradeoff accepted**: Each pull re-fetches the entire profile-export payload, including themes and archetypes that the call site does not use. Acceptable because the endpoint is already tuned for export and Constellation reads it the same way.

**Would revisit if**: Profile-export response grows large enough that the per-pull bandwidth cost is observable, or Resonance gains a recommendation surface that we want server-mediated for personalization or rate-limiting reasons.

---

## 2026-05-09 — Trigger: per-user pull button

**Considered**: **Host auto-pull on session create** (whoever opens the room contributes their slice automatically), **per-user pull button** (every member gets their own button to contribute their slice), **empty-by-default with on-demand host pull** (no auto-pull; host can press a button if they want).

**Decision**: Per-user pull button.

**Why**: Voting is fully symmetric (every member's vote weighs equally). The candidate pool should be too. Letting each member contribute their own slice gives every voter contribution agency and matches the egalitarian voting model. Host auto-pull would put one user's taste at the center and undercut the "shared decision" framing. Empty-by-default is too conservative for an MVP that needs to demonstrate the value prop.

**Tradeoff accepted**: More UI surface (a button per user instead of a single host gesture), and more dedup logic to handle overlap when two members both have the same title. The dedup logic doubles as a feature (multi-attribution agreement signal).

**Would revisit if**: Real-user testing shows members never press the button (the auto-pull would have been correct), or that the social pressure of seeing each other's library is uncomfortable enough to deter pulls.

---

## 2026-05-09 — Candidate shape: title, type, year, multi-attribution addedBy

**Considered**: **Title only** (status quo), **title + minimal metadata** (type and year), **title + rich metadata** (cover art, blurb, deep links).

**Decision**: Title + minimal metadata. `Candidate` gains `type: CandidateType` and `year: number | null`. `addedBy` becomes `LiveList<string>` to support multi-attribution.

**Why**: Type and year disambiguate (two films named "Joker") at low cost: one closed-union type, one nullable number, no image loading. Rich metadata is appealing but doubles the rendering surface and storage payload, and "lo-fi clean" is closer to the Resonance/Constellation visual language than "rich card." Multi-attribution is a free agreement signal that emerges naturally from dedup.

**Tradeoff accepted**: A schema change to `Candidate` (storage shape break), but ephemeral sessions mean no migration is needed. Manual entries default to type "unknown" and no year, which is honest about the lo-fi nature of typed-by-hand data.

**Would revisit if**: Real-user testing shows users want covers and blurbs (and the cost of fetching them is acceptable), or if "unknown" type pollutes the UI in confusing ways.

---

## 2026-05-09 — Items per pull: host-configurable, default 5

**Considered**: **Fixed 5**, **fixed 10**, **host-configurable per session**.

**Decision**: Host-configurable, default 5, range 1 to 20. Control sits inside the existing ThresholdPicker card body, host-only.

**Why**: Same asymmetry the consensus flow already accepted: hosts own "configure the room" gestures, members own "express my preference" gestures. Pull volume is a configuration decision, so attaching it to the host role is consistent. Host-configurable also covers small-room and large-room cases without separate logic. Default of 5 lands sessions around 8-15 candidates with overlap, which is the scannable range.

**Tradeoff accepted**: One more host control (alongside the threshold rule). Surface area in the host UI grows, but stays inside one card so the visual cost is small.

**Would revisit if**: Hosts always change the default (default is wrong) or never touch it (configuration was overengineered).

---

## 2026-05-10 — Mobile breakpoint strategy: single breakpoint at sm (640px)

**Considered**: **Single breakpoint at sm** (one pivot, mobile vs everything else), **two-tier (sm + md)** (mobile, tablet, desktop), **three-tier (sm + md + lg)** (mobile, tablet, small desktop, large desktop).

**Decision**: Single breakpoint at sm (640px). Below: phone-shaped layout. At and above: current desktop layout. No tablet-specific tier.

**Why**: The build step 8 pass is tactical, not crafted. Multi-tier responsive design earns its keep when product surfaces have meaningfully different shapes at multiple widths. Ensemble's session view is the only complex page; everything else (Landing, Home) is already simple. One pivot is cheaper to reason about, cheaper to verify (two viewports: 375 and 1024), and matches the only existing breakpoint in the codebase (the sm:grid-cols-2 on Home). If real-user testing on tablets shows the layout feels wrong in the 640 to 1023 range, an md tier becomes the natural addition.

**Tradeoff accepted**: Tablets (640 to 1023px) get the desktop layout. The candidate row's horizontal arrangement may feel slightly cramped on a portrait tablet at 768px width. Acceptable because tablets are not a primary use case (the friend test happens on phones and laptops) and adding a tier without evidence is premature.

**Would revisit if**: Real-user testing surfaces a tablet-specific complaint, or the cross-site visual audit prefers a shared multi-tier system.

---

## 2026-05-10 — Touch targets: 44px on mobile via Button primitive shim

**Considered**: **Apple HIG (44pt)**, **Material (48dp)**, **keep current sizes**, **selective bump on Vote and Add only**.

**Decision**: 44px on mobile, applied at the Button primitive via `min-h-11 sm:min-h-0`. The form input in CandidatesPanel matches via the same shim so the form line aligns visually.

**Why**: Apple HIG and Material differ by 4px; Apple's 44 fits Tailwind's `min-h-11` directly with no custom value. Bumping at the primitive level means every Button consumer benefits with no API change and no per-consumer audit. Selective bump (Vote and Add only) was tempting but brittle: any new button in the app would have to be remembered. The primitive shim is one edit and load-bearing forever. Keep-current-sizes was the cheapest option but loses the friend-test on a phone where fat-finger misses on the Vote button would shape the first impression.

**Tradeoff accepted**: Rows feel slightly taller on mobile than they would with the desktop sizes. Fits the stacked-row decision: the row is already taller on mobile because content stacks, so the buttons being taller is consistent rather than out of place.

**Would revisit if**: Real-user testing shows the mobile layout feels cramped despite the bump (suggests deeper density work), or accessibility audit finds 44px is insufficient (then bump to 48px to match Material).

---

## 2026-05-10 — Finalize-voting model: per-user Done flag, all-present-Done auto-finalizes

**Considered**: **Live-tally with auto-lock on first cross** (status quo, found too eager during friend-test), **host-only Finalize button** (less peer-to-peer), **per-user Done flag with auto-finalize when all are Done plus host override** (chosen).

**Decision**: Per-user Done flag stored in Liveblocks Presence as `votingComplete: boolean`. The voting-to-decided transition fires only when all present users have marked themselves Done. Casting or un-voting resets the editing user's Done flag. Host has a "Finalize now" override that bypasses the all-done gate.

**Why**: Friend-test directly demonstrated the auto-lock model was too eager: with two users in a unanimous-threshold room, the first to vote on a candidate the other had already voted for caused an instant lock, and the second user never got to express their full preferences. Approval voting wants users to mark several picks; the trigger needs to be a deliberate gesture, not a state-derived auto-fire. Per-user Done preserves the live tally (no hidden-then-reveal model), keeps voting peer-to-peer (every member's gesture matters), and lets the room collectively decide when to evaluate. Done lives in Presence (per-user, ephemeral) rather than Storage so each client owns their own flag without coordinated cross-client writes. Reconsider triggers a local self-reset when each client observes the decided-to-voting transition. Host's Finalize-now override fits the existing room-creator-is-host pattern.

**Tradeoff accepted**: One more gesture per voting round than the auto-lock model. Acceptable because the friend test directly demonstrated the auto-lock model was too eager, and "I'm ready" is a natural group-decision gesture.

**Would revisit if**: Real users find the gesture redundant in trusted small-group sessions (unlikely given the friend-test feedback), or the asymmetry between vote (live) and Done (gesture) creates confusion about what's committed.

---

## 2026-05-10 -- TMDB integration for candidate enrichment

**Considered**: client-side direct (key in bundle, simpler), serverless proxy (chosen), no-enrichment-only-text (status quo).

**Decision**: Vercel serverless proxy at `api/tmdb.ts` with the v3 Read Access Token in env. Clerk-auth required (Resonance-users-only convention). Single search/multi endpoint maps to a tight `TmdbResult` shape (tmdbId, title, year, posterUrl, mediaType). Candidate schema gains optional `posterUrl` and `tmdbId`. Manual entry via TMDB-backed autocomplete with freeform fallback for obscure titles. Resonance pulls enriched in parallel before storage write.

**Why**: Posters are the single biggest visual upgrade for the room: cards stop being text and start feeling like a media decision tool. Serverless proxy keeps the key out of the bundle and matches the existing `api/liveblocks-auth.ts` pattern. Search-multi covers movie+tv in one call, matching the existing watchable-types filter. Optional schema fields preserve backward compatibility with existing rooms.

**Tradeoff accepted**: Each candidate add has a TMDB round-trip (a few hundred ms typed-to-suggestion); each Resonance pull has 5 concurrent lookups. Acceptable because TMDB free tier is generous (~50/sec) and the UX is "type a title, see results" which already implies waiting.

**Would revisit if**: TMDB rate-limits start biting (move to cached search results), or genres/runtime become important enough to justify a per-candidate details lookup.
