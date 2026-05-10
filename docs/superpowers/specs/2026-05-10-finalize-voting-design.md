# Finalize-voting design

**Date:** 2026-05-10
**Status:** Drafted, awaiting drub review
**Scope:** Replace the auto-lock-on-first-cross consensus trigger with a per-user "I'm ready" gesture. Threshold evaluation runs only when all present users have marked themselves Done. Host has a "Finalize now" override. Casting or un-voting resets the editing user's Done flag. Standalone "Ready" card in the layout. No changes to the threshold rule, tiebreaker mechanics, lock + reconsider lifecycle, hero card, or always-spin reveal.

## Why now

Friend-test surfaced a real flaw: with 2 users in a unanimous-threshold room, the first user voted for several titles, and the moment the second user clicked any matching title, the room locked instantly. The second user never got to express their full preferences. Approval voting wants users to mark multiple picks; auto-lock on first cross fights that.

The fix is architectural, not cosmetic. The `voting → decided` transition needs an explicit gesture rather than a state-derived auto-trigger. Per-user Done flags are the cleanest peer-to-peer way to express "I'm finished editing my picks." When all present users are ready, the room evaluates.

This change is small in code surface but meaningful in product feel. It preserves the live tally (no hidden-then-reveal voting model) while adding the deliberate moment that was missing.

## Locked design decisions

These were settled in brainstorming and are not in scope to revisit during implementation.

1. **Per-user Done flag in Liveblocks Presence.** Each client owns their own `votingComplete: boolean`. Defaults to `false` on join. Stored in Presence (per-user, ephemeral) rather than Storage (shared, persistent), matching the per-user nature of the signal.
2. **All-present-Done auto-finalizes.** When every user with non-empty `id` in `useOthers()` plus self has `votingComplete === true`, the threshold evaluation runs once. If a winner exists, the room locks. If not, it stays in voting and surfaces a quiet hint.
3. **Vote changes reset own Done.** `castVote` and `unvote` handlers, after invoking the storage mutation, also call `updateMyPresence({ votingComplete: false })`. Editing always implies "I'm not done yet."
4. **Host has "Finalize now" override.** A host-only button on the Ready card runs `evaluate()` against current state and calls `lockConsensus` directly, bypassing the all-done gate. Disabled when no candidate has crossed the threshold (so pressing it can never silently no-op).
5. **Reconsider triggers local self-reset, not cross-client write.** When a client observes the `decided → voting` phase transition, it resets its own `votingComplete` to `false`. No mutation reaches into other clients' presence. Simpler than coordinated cross-client writes.
6. **Standalone "Ready" card layout.** A new card below CandidatesPanel anchors the finalization gesture as separate from add/vote/edit actions.
7. **No change to threshold semantics.** When the all-done gate fires, the existing pure `evaluate(votes, threshold, presentMemberIds)` runs unchanged. Threshold rule (unanimous / majority / first-to-N), random tiebreaker, and always-spin reveal are preserved.

## Architecture

### State machine

The state machine remains `voting ↔ decided` with the same transitions, but the trigger for `voting → decided` changes:

**Old trigger:** any vote change reactively runs `evaluate()`. If `winnerId !== null`, lock.

**New trigger:** any vote change OR any presence change reactively runs `evaluate()` ONLY IF all present have `votingComplete === true`. If `winnerId !== null`, lock. If null and all are done, stay in voting.

Reconsider remains host-only and clears all storage state. New: clients observe phase transitions locally and reset their own Done.

### Liveblocks Presence schema

`src/lib/liveblocks.ts`:

```ts
declare global {
  interface Liveblocks {
    Presence: { votingComplete: boolean };  // was Record<string, never>
    Storage: { ... unchanged ... };
    UserMeta: { ... unchanged ... };
  }
}
```

Default presence at room init: `{ votingComplete: false }`. Set in `Session.tsx`'s `RoomProvider initialPresence={{ votingComplete: false }}`.

### Vote mutations: per-self presence reset

The existing `castVote` and `unvote` mutations in `SessionUI.tsx` stay storage-only. The handler layer (the connector that wires them to the UI) follows up each call with a presence update. Moving the presence update outside the mutation keeps the mutation pure (storage only) and avoids any subtle race between presence and storage in concurrent rooms.

```tsx
const castVote = useMutation(({ storage, self }, candidateId: string) => {
  // unchanged storage logic
}, []);

const unvote = useMutation(({ storage, self }, candidateId: string) => {
  // unchanged storage logic
}, []);

// New, in the SessionUI body:
const updateMyPresence = useUpdateMyPresence();

function handleVote(candidateId: string) {
  castVote(candidateId);
  updateMyPresence({ votingComplete: false });
}

function handleUnvote(candidateId: string) {
  unvote(candidateId);
  updateMyPresence({ votingComplete: false });
}
```

The `<CandidatesPanel onVote={handleVote} onUnvote={handleUnvote} />` call site changes from passing the raw mutations to passing the new handlers. CandidatesPanel and CandidateRow signatures stay unchanged because they already accept `(id) => void` callbacks.

### Threshold detection effect

The existing detection effect in `SessionUI.tsx` already reads `consensus.phase`, `consensus.threshold`, `votesSnapshot`, and `presentMemberIds`. It gains a new dependency: a derived `allPresentDone` boolean that's true when self and every other in `useOthers()` have `presence.votingComplete === true`.

```tsx
const allPresentDone = useMemo(() => {
  if (!self.presence?.votingComplete) return false;
  for (const other of others) {
    if (!other.id) continue;
    if (!other.presence?.votingComplete) return false;
  }
  return true;
}, [self.presence?.votingComplete, others]);

useEffect(() => {
  if (consensus.phase !== "voting") return;
  if (!allPresentDone) return;
  const result = evaluate(
    votesSnapshot,
    consensus.threshold as ThresholdRule,
    presentMemberIds,
  );
  if (result.winnerId === null) return;
  lockConsensus({ winnerId: result.winnerId, tiedIds: result.tiedIds });
}, [
  consensus.phase,
  consensus.threshold,
  votesSnapshot,
  presentMemberIds,
  allPresentDone,
  lockConsensus,
]);
```

When `allPresentDone` is true and `winnerId` is null, the effect returns without locking. The room stays in voting. UI surfaces the no-consensus hint via deriving `noConsensusYet = allPresentDone && !winnerExists` at render time.

### Reconsider self-reset

When the host triggers `reconsider`, storage resets (phase to voting, votes empty, etc.). Each client observes this via the existing `prevPhase` tracking in SessionUI (added during the consensus flow). Extend that tracking to also reset `votingComplete` on the `decided → voting` transition:

```tsx
if (prevPhase === "decided" && consensus.phase === "voting") {
  setObservedTransition(false); // existing
  updateMyPresence({ votingComplete: false }); // new
}
```

The cross-client writes problem dissolves: every client locally resets when they observe the phase rewind.

### Host "Finalize now" override

The host has a button that calls a wrapped handler:

```tsx
function handleFinalizeNow() {
  if (!isHost) return;
  if (consensus.phase !== "voting") return;
  const result = evaluate(
    votesSnapshot,
    consensus.threshold as ThresholdRule,
    presentMemberIds,
  );
  if (result.winnerId === null) return;
  lockConsensus({ winnerId: result.winnerId, tiedIds: result.tiedIds });
}
```

The button is `disabled` when `currentWinner === null` so the host gets a clear "no winner to lock" affordance. Computed via:

```tsx
const currentWinner = useMemo(
  () =>
    evaluate(
      votesSnapshot,
      consensus.threshold as ThresholdRule,
      presentMemberIds,
    ),
  [votesSnapshot, consensus.threshold, presentMemberIds],
);
const finalizeDisabled = currentWinner.winnerId === null;
```

This adds one more `evaluate()` call per render but the function is pure and cheap.

## UX

### Ready card

A new component `ReadyCard` rendered between `CandidatesPanel` and the existing footer of the session view (currently nothing follows CandidatesPanel; ReadyCard becomes the new last card).

Layout:

```
READY · 1 / 2

[I'm ready]                    [Finalize now]   (host only, disabled when no winner)
```

When the user has marked themselves Done, the button text flips to "Not ready yet" so it reads as a toggle.

When `noConsensusYet` is true (all done, no winner), an inline hint sits below the button row:

```
No candidate has crossed the threshold yet, change votes and re-ready up.
```

When `phase === "decided"`, ReadyCard does not render (the HeroCard takes its visual role).

Component props (presentation-only, like ThresholdPicker):

```tsx
{
  selfReady: boolean;
  readyCount: number;
  presentCount: number;
  isHost: boolean;
  noConsensusYet: boolean;
  finalizeDisabled: boolean;
  onToggleReady: (ready: boolean) => void;
  onFinalizeNow: () => void;
}
```

### MemberChip Done indicator

Each `MemberChip` in the existing presence card gains an optional `done?: boolean` prop. When true, the chip shows a small saffron check (or dot) icon next to the name. Subtle, not loud, mirrors how voting states are signaled elsewhere.

The presence card maps over self + others, computing `done` from each member's presence flag:

```tsx
<MemberChip
  name={...}
  avatarUrl={...}
  isYou={...}
  done={member.presence?.votingComplete ?? false}
/>
```

### Vote button still feels live

Casting or un-voting still updates the live tally instantly (storage write). The only difference: it also resets the editing user's Done. UI feedback is unchanged at the candidate-row level. The user might notice the "I'm ready" button toggle back to "I'm ready" when they edit, which is the intended signal.

## Edge cases

- **Solo session**: 1 user, marks Ready. All-present-done is true. Evaluate runs against their votes. If they have any vote that crosses threshold, lock. If not (e.g., unanimous threshold and they haven't voted), stay voting with the no-consensus hint.
- **Late joiner during voting**: defaults to `votingComplete: false`. Threshold can't fire until they're Done. Existing users' Done flags persist; the room is now waiting on the new arrival.
- **User disconnects**: presence drops. Remaining users form the new present set. If all remaining are Done, the next render's `allPresentDone` flips true and threshold fires.
- **Host disconnects**: existing host-migration logic runs (longest-connected becomes host). The new host inherits the "Finalize now" capability immediately. Their own `votingComplete` is unchanged by the migration.
- **Reconsider during a no-consensus state**: same as today's reconsider. Storage clears (phase, votes, etc.). Each client observes the (already-voting) phase non-transition... wait. Reconsider only fires when `phase === "decided"`, so this case can't happen. (No need to plan for it.)
- **Vote change during the "all done, no winner" state**: editing user's Done resets. They are now not-Done. The `allPresentDone` flips false, no auto-lock. The room is back in active voting. Other users keep their Done flags; only the editing user's resets.
- **Concurrent Done by two users at the same instant**: both presence updates land via Liveblocks. Both clients see both flags flip true on next render. Threshold detection effect fires once on each client. CRDT idempotency on `lockConsensus` handles the simultaneous storage write (existing behavior from consensus flow).
- **Empty room**: zero present users. `allPresentDone` is false (the loop returns false on empty self). Effect never fires. Fine.

## Testing

This pass is mostly integration-level (presence + storage + effects), which the test infra doesn't cover for Liveblocks-driven flows. Existing 85 tests must continue to pass.

New unit tests where they earn their keep:

- **`ReadyCard` component**: renders Ready toggle for self, button text flips between "I'm ready" and "Not ready yet" based on `selfReady`, host-only "Finalize now" appears when `isHost`, no-consensus hint appears when `noConsensusYet`. Same presentation-component test pattern as `ThresholdPicker`.
- **No new tests for `evaluate()` itself**, the function is unchanged. The detection effect's gating change is integration logic, verified manually.
- **No new tests for the presence reset on vote**, same reasoning. Manual two-browser verification post-deploy.

## Decisions to log to `decisions.md`

After spec approval, append one entry:

**Finalize-voting model: per-user Done flag, all-present-Done auto-finalizes.** Considered: live-tally with auto-lock on first cross (status quo, was found too eager during friend-testing); host-only Finalize button (less peer-to-peer); per-user Done flag with auto-finalize when all are Done plus host override (chosen). Chose per-user Done because it keeps the live tally (peer-to-peer voting), gives every user agency to express full preferences before locking, and the room collectively decides when to evaluate. Done lives in Liveblocks Presence (per-user, ephemeral) rather than Storage. Vote changes reset own Done. Host's "Finalize now" override fits the existing room-creator-is-host pattern. Tradeoff accepted: one more gesture per voting round than the auto-lock model. Acceptable because the friend test directly demonstrated the auto-lock model was too eager.

## Out of scope

- **Cross-client presence writes**: each client manages its own. Reconsider self-reset is a local effect, not a host-driven mutation.
- **Auto-Done after timer**: ("you've been idle 30s, marking Done"), not in scope.
- **Per-candidate Ready** (ready-up per row rather than room-level): out, complicates the gesture for unclear gain.
- **"Reveal" round** (drafting phase before voting): out, would change the entire voting model.
- **Persistence of Done state across disconnects**: by design, presence is ephemeral. Done resets on reconnect.
- **Threshold rule changes**: no change to unanimous / majority / first-to-N semantics.
- **Hero card and reveal animation**: unchanged. Always-spin still triggers on lock.
