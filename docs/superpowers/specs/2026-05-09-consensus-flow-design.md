# Consensus flow design

**Date:** 2026-05-09
**Status:** Drafted, awaiting drub review
**Scope:** Build step 7. Threshold logic, "tonight's pick" surface, tie handling, host model, and reveal mechanic. No mobile polish (step 8), no persistence (ephemeral remains).

## Why now

Voting works end-to-end (approval voting, attributed avatars, hardened auth, token-driven UI). The room can express preferences but can't make a decision — there is no "winner" concept. Consensus closes the loop from "we voted" to "we picked," which is the actual product promise.

The architectural calls here are interview-defensible: a configurable threshold rule, a peer-friendly host model, a CRDT-resolved random tiebreaker, and a state machine small enough to hold in mind. Each is logged in `decisions.md` after spec approval.

## Locked design decisions

These were settled in brainstorming and are not in scope to revisit during implementation.

1. **Threshold is configurable per session.** Host picks one of three rules: `unanimous`, `majority`, `first-to-n`. Rule is set when the host enters the room and adjustable while voting is open.
2. **Random tiebreaker.** When multiple candidates tie at the threshold, one is picked at random with a brief spin animation cycling through the tied set before settling. Frame: "the room agreed; chance picked."
3. **Lock + reconsider lifecycle.** Threshold-crossing locks the room into a `decided` state. Voting is frozen. Only the host can press "Reconsider" to reopen voting.
4. **Room creator is host.** Whoever opens the session is the host. Host migrates to the longest-connected remaining member if the host drops.
5. **Hero card transition + tiebreaker spin.** On `decided`, the winner animates upward into a "Tonight's pick" hero card above the candidate list, saffron accent active, presence avatars settle into it. On a tied crossing, a brief 1.2s spin cycles tied candidates before the hero transition.

## Architecture

### Approach: storage-stored consensus state

A new `consensus` LiveObject lives in Liveblocks Storage alongside `candidates` and `votes`. It holds the host id, the active threshold rule, the phase, the winner, and the tied set. Each client reactively detects threshold-crossings from `votes + threshold + presentMembers`; the first client to detect writes the transition. Liveblocks' CRDT semantics resolve concurrent writes to a single converged state — same shape as how votes already work today. Random tiebreaker runs on the writing client; all other clients sync to that result and play the spin animation locally as a UI effect, settling on the stored `winnerId`.

### Why this shape

- **Live and peer-to-peer**: no server round-trip on the moment, no new infra. Same managed Liveblocks dependency the rest of the app already uses.
- **Small state machine**: `voting ↔ decided`, two transitions, both observable from one LiveObject.
- **Race semantics already handled**: simultaneous threshold detection by two clients converges via CRDT last-writer-wins, same way `castVote` does today.
- **Random tiebreaker matches the desired UX**: nondeterminism is the *feature* — "chance picked" — and all clients converge on the same `winnerId`.

### Tradeoff accepted

The random tiebreaker is nondeterministic across replays — if the same room state is reproduced, a different candidate might win. Acceptable because (a) this is the desired user-facing behavior, and (b) ephemeral sessions mean there is no replay scenario to worry about.

### Alternatives considered

- **Fully derived state, no `phase` field**: ruled out because each client running its own `Math.random()` would pick a different tied winner, breaking convergence. A deterministic seed would kill the "chance picked" narrative.
- **Server-authoritative `/api/decide`**: ruled out because it adds a network round-trip to a moment that should feel instant. The auth function precedent doesn't extend — there's no security reason to centralize deciding.

## Data model

Add to `src/lib/liveblocks.ts`:

```ts
export type ThresholdRule =
  | { kind: "unanimous" }
  | { kind: "majority" }
  | { kind: "first-to-n"; n: number };

export type ConsensusPhase = "voting" | "decided";

export type Consensus = {
  hostId: string;                    // userId of room creator (or migrated host)
  threshold: ThresholdRule;
  phase: ConsensusPhase;
  winnerId: string | null;           // candidateId; null while voting
  tiedIds: string[];                 // tied set captured at decision moment, for spin UI
  decidedAt: number | null;          // ms timestamp of phase transition
  [key: string]: unknown;            // LsonObject constraint
};
```

Storage shape becomes:

```ts
Storage: {
  candidates: LiveList<LiveObject<Candidate>>;
  votes: LiveMap<string, LiveList<string>>;
  consensus: LiveObject<Consensus>;
};
```

The `consensus` LiveObject is created at room initialization with `phase: 'voting'`, `threshold: { kind: 'unanimous' }`, `hostId: <creator userId>`, the rest null. Initialization happens in the room provider's `initialStorage` factory (`src/lib/liveblocks.ts` and the route that opens the room), with `hostId` set to the Clerk user id of whoever first connects.

### Why `tiedIds` is stored

A late joiner who arrives after the spin animation has played sees the `decided` state directly — they don't need the spin. But a client that was *present* when the transition happened needs to know the tied set to render the cycle. Storing `tiedIds` means every client renders the same spin from the same data, no out-of-band signaling needed.

## State transitions

### Threshold-check function

Pure function in `src/lib/consensus.ts`:

```ts
function evaluate(
  votes: Map<candidateId, voterIds[]>,
  threshold: ThresholdRule,
  presentMemberIds: Set<string>
): { winnerId: string | null; tiedIds: string[] };
```

Returns `{ winnerId: null, tiedIds: [] }` when threshold is not crossed. Otherwise returns the winning candidate (chosen via random pick when tied) and the tied set for the spin animation. The tied set always includes the winner — `tiedIds.length === 1` is the single-winner case, `tiedIds.length > 1` is the tied case, and the UI uses that length to decide whether to play the spin.

Threshold semantics:

- **Unanimous**: every present member has voted for the candidate. Denominator is `presentMemberIds.size`.
- **Majority**: more than 50% of present members voted for the candidate. Denominator is `presentMemberIds.size`. Strictly greater than half (a 2-2 tie does not cross).
- **First-to-n**: candidate has at least `n` votes. Denominator is fixed by host.

When multiple candidates pass simultaneously, all of them are returned in `tiedIds` and one is picked at random for `winnerId`.

### Vote-and-presence semantics

**Votes persist regardless of presence.** A user who voted and disconnected leaves their vote in storage. The threshold denominator is *current* presence. This means a leaver's preference still counts for the candidate they voted for, but the threshold check adapts to who is currently in the room.

Tradeoff: leaving the room can cause threshold to cross (e.g., the one holdout disconnects, leaving a unanimous remainder). Acceptable because (a) it matches the social fiction — "the room continues without you, and your last preference still counts" — and (b) avoiding it would require disconnect-driven vote cleanup, which Liveblocks doesn't expose cleanly. Documented behavior, not a bug.

### Transition: voting → decided

Each client reactively runs `evaluate()` every render (via `useStorage` + `useOthers`). When a client detects a non-null `winnerId` while `phase === 'voting'`, it writes the transition in a single Liveblocks mutation:

```ts
consensus.update({
  phase: "decided",
  winnerId,
  tiedIds,
  decidedAt: Date.now(),
});
```

If two clients detect simultaneously, both write. Liveblocks' CRDT picks one; both clients converge on that final value. The losing write is silently overwritten — fine because both writes contain valid winner picks from the same tied set.

### Transition: decided → voting (reconsider)

Host-only mutation. Clears `winnerId`, `tiedIds`, `decidedAt`, and resets `phase: 'voting'`. **All votes are cleared as part of the same mutation** — the room starts vote-tally over with the same candidate list intact.

Why clear votes: if reconsider only flipped phase, the same threshold would re-cross immediately on the next render, locking the room into a no-op loop. Clearing the winner's votes only would still leave the threshold half-met and feel state-y. Full vote clear is the simplest mental model: "let's vote again on the same options."

### Transition: host migration

When the host's userId is no longer in the present member set, all clients evaluate "who is the new host" via a deterministic rule: the present member with the longest-running connectionId (lowest connectionId number wins, since Liveblocks assigns them monotonically). The chosen client writes `consensus.update({ hostId: <self.id> })`. CRDT resolves concurrent writes.

Edge case: if the dropping host is also the only person in the room, the next-joining member becomes host on join. If everyone has left, the room ceases to exist (Liveblocks ephemeral) and the question is moot.

### Threshold rule changes mid-voting

Host can change the rule via the rule-picker UI while `phase === 'voting'`. Changing the rule re-runs `evaluate()` on next render against existing votes. If the new rule is already crossed by current state, threshold-crossing fires immediately. Acceptable behavior — the host changed the rules, the room gets the immediate result.

Threshold rule **cannot** be changed while `phase === 'decided'`. The host must reconsider first.

## UX

### Pre-vote / voting state

The host sees a rule-picker control above the candidates list, in a card-eyebrow surface:

```
THRESHOLD                    [ Unanimous ▾ ]
                             [ Majority   ]
                             [ First to N ]    [ N: 2 ]
```

Default rule on room creation: `unanimous`. When `first-to-n` is selected, an inline number input appears with default `n = max(2, ceil(presentCount / 2))`. Non-host members see the rule as read-only text in the same eyebrow position: `THRESHOLD: Unanimous`.

Voting works exactly as today — toggle votes on candidates, see live tally via the AvatarStack on each row.

### Decision moment (single winner)

When `phase` flips to `decided` and `tiedIds.length === 1`:

1. The winning candidate's row briefly pulses with the saffron accent.
2. A "Tonight's pick" hero card animates in above the candidate list, taking the winner's title, the saffron accent ring, and an avatar stack of everyone who voted for it.
3. The candidate list dims to a muted state, vote toggles disabled.
4. The host sees a "Reconsider" button on the hero card. Non-hosts see no action there.

Animation: one Framer Motion spring, ~400ms total, on the hero card slide-in. Reuses the motion vocabulary established in the visual system spec.

### Decision moment (tied → spin)

When `phase` flips to `decided` and `tiedIds.length > 1`:

1. Tied candidates pulse-cycle with the saffron accent for ~1.2s. The cycle runs locally on every client; visual order is determined by `tiedIds` array order so all clients see the same sequence.
2. After the cycle, the winning candidate (`winnerId`) is the one that "stops" highlighted. All other tied candidates dim back to muted.
3. The hero card transition runs from there, identical to the single-winner path.

The spin is purely a local UI effect. The `winnerId` is already settled in storage before the spin starts; the cycle just visualizes "chance picked" while the room watches.

### Decided state (steady)

Hero card stays visible at the top of the session. Candidate list below remains rendered but muted: vote toggles, add/remove buttons, and the rule-picker are all disabled. The host's "Reconsider" button is the only interactive element until pressed.

A late joiner arriving in `decided` state sees the hero card and the muted list directly, no animation. The room state is fully reconstructable from storage; there is no "you missed the moment" gap.

### Reconsider

Host presses "Reconsider" on the hero card. The hero card animates out (reverse of the slide-in), the muted list returns to active, all votes clear, and the room is back in `voting` state. Members see the transition live.

### Locked actions while decided

While `phase === 'decided'`:

- Casting votes: disabled.
- Adding candidates: disabled.
- Removing candidates: disabled.
- Changing threshold rule: disabled.
- Reconsider (host only): enabled.

Defense-in-depth: each mutation function checks `phase === 'voting'` server-side (well, client-side-but-validated, since this is Liveblocks) before applying changes. A misbehaving client can't bypass UI gating.

## Edge cases

### Empty room

If everyone leaves, the Liveblocks room dies. No persistence concern. New visitors get a fresh room.

### First-to-N where N > present count

Host can set N higher than the present count (e.g., N=5 with 3 in the room). Threshold simply can't be crossed until enough members join or vote. The rule-picker UI shows a soft warning: `N > present count — threshold cannot be reached yet.` No hard validation; the host might be expecting more arrivals.

### Host changes rule to one that's already crossed

The new rule's threshold is evaluated on the next render. If it's already met by current votes, threshold-crossing fires immediately. Same behavior as if the votes had crossed naturally.

### Disconnected host's vote

The host's userId stays in `consensus.hostId` while their vote stays in `votes` until presence drops. When presence drops, host migration fires (someone else becomes host) but the disconnected ex-host's vote stays in storage until reconsider. Consistent with the vote-persistence rule.

### Reconsider race

If two members both try to reconsider in the same instant, both writes hit Liveblocks. The mutation idempotently flips `phase` to `voting` and clears `winnerId`/`tiedIds`/`decidedAt`/`votes`. Second write is a no-op against already-cleared state. No race issue.

But: both writes also need to be host-authorized. The mutation must check `self.id === consensus.hostId` before applying. Non-host client's call is a no-op.

## Testing

Unit tests for the threshold-check pure function (`src/lib/consensus.ts`):

- `unanimous`: 0/3 voted → no winner; 2/3 voted → no winner; 3/3 voted → that candidate wins.
- `majority`: 1/3 voted → no; 2/3 voted → wins; 2/4 voted → no (50% is not majority); 3/4 voted → wins.
- `first-to-n`: votes < n → no; votes ≥ n → wins.
- Ties: two candidates with full unanimous → both in `tiedIds`, `winnerId` is one of them.
- Empty inputs: zero candidates / zero present members → no winner, no error.
- Random tiebreaker stability: with the same seeded RNG, repeated calls produce the same winner. (Use `Math.random` directly; this test stubs it.)

Component tests for the UI states (`src/components/SessionUI.test.tsx`):

- Threshold-picker renders only for host.
- Vote toggles disabled when `phase === 'decided'`.
- Hero card renders with winner title and avatar stack.
- Reconsider button visible only to host.
- Reconsider clears `votes` and flips phase.

No happy-path E2E in this spec — the existing test infra doesn't cover Liveblocks integration, and adding it is out of scope. Real-user verification continues to be drub running two browser windows post-deploy.

## Decisions to log to `decisions.md`

After spec approval, append entries for:

1. **Consensus state model: storage-stored, CRDT-resolved.** Considered storage-stored vs derived vs server-authoritative. Chose storage-stored because of the random-tiebreaker convergence requirement.
2. **Threshold function: configurable per session.** Considered unanimous-only, majority-only, first-to-N-only, configurable. Chose configurable to match real-group flexibility.
3. **Tie handling: random pick.** Considered shortlist, runoff, random, host-breaks. Chose random because it preserves the peer-to-peer feel and makes a distinctive UX moment.
4. **Lifecycle: lock + reconsider.** Considered live tally, terminal lock, lock+reconsider. Chose lock+reconsider for decisive moment plus escape hatch.
5. **Authority: room creator is host.** Considered peer-to-peer, room-creator-is-host, asymmetric quorum. Chose creator-is-host for clean roles and simple migration semantics.

## Out of scope

- **Mobile breakpoints / responsive layout**: lands in build step 8.
- **Persistence of "tonight's pick"**: stays ephemeral per the locked persistence decision. Will revisit if real-user feedback shows people want history.
- **Resonance integration in candidates**: pulling from recommendations or cross-referencing profiles. Tracked separately as a build-step in `CLAUDE.md`.
- **Host transfer UX**: explicit "give the host role to X" gesture. Migration on drop is automatic; manual transfer is not in MVP.
- **Custom tiebreaker rules per session**: only random for now. Configurability could expand later.
- **Confetti / sound effects on decided**: deliberate restraint per the visual system spec ("if everything springs, nothing does").
