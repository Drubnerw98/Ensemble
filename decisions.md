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
