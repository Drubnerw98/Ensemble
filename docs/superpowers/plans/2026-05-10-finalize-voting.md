# Finalize-voting implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the auto-lock-on-first-cross consensus trigger with a per-user "I'm ready" gesture. Threshold evaluation runs only when all present users have marked themselves Done. Host has a "Finalize now" override. Vote changes reset the editing user's Done flag. New "Ready" card sits below CandidatesPanel. Backed by the spec at `docs/superpowers/specs/2026-05-10-finalize-voting-design.md`.

**Architecture:** Liveblocks Presence gains `votingComplete: boolean`. The threshold detection effect in SessionUI gates on `allPresentDone` instead of firing on any vote change. Vote handler wrappers reset the calling user's `votingComplete` to false alongside the storage mutation. Reconsider self-reset extends the existing prev-phase tracker. ReadyCard is a new presentation component. MemberChip gets a small Done indicator.

**Tech Stack:** Vite + React 19 + TypeScript, Liveblocks (`@liveblocks/react/suspense`), Tailwind v4, Vitest + happy-dom + RTL.

**Test commands:** `pnpm test` (single run), `pnpm test:watch` (TDD loop), `pnpm typecheck`, `pnpm check` (full pre-merge gate).

**Commit cadence:** Per drub's project memory, commit AND push at every meaningful checkpoint. Each task ends with a commit + push.

---

## File map

**Modified:**

- `src/lib/liveblocks.ts`: Presence schema gains `votingComplete: boolean`.
- `src/routes/Session.tsx`: `initialPresence={{ votingComplete: false }}`.
- `src/components/SessionUI.tsx`:
  - Import `useUpdateMyPresence` from `@liveblocks/react/suspense`
  - Add `updateMyPresence` hook call
  - Add `allPresentDone` and `currentEvaluation` useMemos
  - Add `handleVote`/`handleUnvote` wrappers (mutate + reset presence)
  - Add `handleToggleReady` and `handleFinalizeNow` handlers
  - Refactor detection useEffect to gate on `allPresentDone`
  - Extend prev-phase block to reset own `votingComplete` on decided->voting transition
  - Render `<ReadyCard />` below `CandidatesPanel` when `phase === "voting"`
  - Pass `done` from each member's presence to `MemberChip`
- `src/components/SessionUI.tsx` (MemberChip): accept `done?: boolean` prop, render saffron check indicator when true.
- `decisions.md`: append the finalize-voting decision.
- `CLAUDE.md`: append decision #24 to the locked-decisions list.

**Created:**

- `src/components/ReadyCard.tsx`: presentation component.
- `src/components/ReadyCard.test.tsx`: render + interaction tests.

---

## Task 1: Presence schema + initialPresence

**Files:**

- Modify: `src/lib/liveblocks.ts`
- Modify: `src/routes/Session.tsx`

- [ ] **Step 1: Update the Presence type augmentation**

In `/Users/drub/repos/Ensemble/src/lib/liveblocks.ts`, find:

```ts
declare global {
  interface Liveblocks {
    Presence: Record<string, never>;
    Storage: {
      candidates: LiveList<LiveObject<Candidate>>;
      votes: LiveMap<string, LiveList<string>>;
      consensus: LiveObject<Consensus>;
    };
    UserMeta: {
      id: string;
      info: {
        name: string;
        avatarUrl?: string;
      };
    };
  }
}
```

Replace `Presence: Record<string, never>;` with:

```ts
    Presence: { votingComplete: boolean };
```

That is the entire change to `liveblocks.ts`. The whole file should now have:

```ts
declare global {
  interface Liveblocks {
    Presence: { votingComplete: boolean };
    Storage: {
      candidates: LiveList<LiveObject<Candidate>>;
      votes: LiveMap<string, LiveList<string>>;
      consensus: LiveObject<Consensus>;
    };
    UserMeta: {
      id: string;
      info: {
        name: string;
        avatarUrl?: string;
      };
    };
  }
}
```

- [ ] **Step 2: Update `Session.tsx` initial presence**

In `/Users/drub/repos/Ensemble/src/routes/Session.tsx`, find the `<RoomProvider>` JSX. The current `initialPresence` reads:

```tsx
<RoomProvider
  id={roomId}
  initialPresence={{}}
  initialStorage={{
```

Replace `initialPresence={{}}` with:

```tsx
  initialPresence={{ votingComplete: false }}
```

- [ ] **Step 3: Verify typecheck (expected partial fail)**

Run: `pnpm typecheck`
Expected: PASS for the project. The augmented Presence type now requires `votingComplete: boolean` everywhere `Presence` is used, but no consumer reads `presence.votingComplete` yet, so no breakage. The `initialPresence` change in Session.tsx satisfies the type contract.

If typecheck fails somewhere unexpected, STOP and report.

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Expected: PASS. 85 tests should still pass; the type change is purely structural and doesn't affect test surfaces.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/liveblocks.ts src/routes/Session.tsx
git commit -m "$(cat <<'EOF'
Add votingComplete to Liveblocks Presence schema

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 2: ReadyCard presentation component

**Files:**

- Create: `src/components/ReadyCard.tsx`
- Create: `src/components/ReadyCard.test.tsx`

The component is presentation-only: pure props in, callbacks out. Same pattern as ThresholdPicker and HeroCard.

- [ ] **Step 1: Write the failing test**

Create `/Users/drub/repos/Ensemble/src/components/ReadyCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadyCard } from "./ReadyCard";

const baseProps = {
  selfReady: false,
  readyCount: 0,
  presentCount: 2,
  isHost: false,
  noConsensusYet: false,
  finalizeDisabled: true,
  onToggleReady: () => {},
  onFinalizeNow: () => {},
};

describe("ReadyCard", () => {
  it("renders the eyebrow with the ready ratio", () => {
    render(<ReadyCard {...baseProps} readyCount={1} presentCount={2} />);
    expect(screen.getByText(/ready/i)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 2/)).toBeInTheDocument();
  });

  it("button reads 'I'm ready' when selfReady is false", () => {
    render(<ReadyCard {...baseProps} selfReady={false} />);
    expect(
      screen.getByRole("button", { name: /i'?m ready/i }),
    ).toBeInTheDocument();
  });

  it("button reads 'Not ready yet' when selfReady is true", () => {
    render(<ReadyCard {...baseProps} selfReady={true} />);
    expect(
      screen.getByRole("button", { name: /not ready yet/i }),
    ).toBeInTheDocument();
  });

  it("calls onToggleReady with the negated current value", async () => {
    const onToggleReady = vi.fn<(ready: boolean) => void>();
    render(
      <ReadyCard
        {...baseProps}
        selfReady={false}
        onToggleReady={onToggleReady}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /i'?m ready/i }));
    expect(onToggleReady).toHaveBeenCalledWith(true);
  });

  it("hides the Finalize now button when isHost is false", () => {
    render(<ReadyCard {...baseProps} isHost={false} />);
    expect(
      screen.queryByRole("button", { name: /finalize now/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the Finalize now button when isHost is true", () => {
    render(<ReadyCard {...baseProps} isHost={true} />);
    expect(
      screen.getByRole("button", { name: /finalize now/i }),
    ).toBeInTheDocument();
  });

  it("disables Finalize now when finalizeDisabled is true", () => {
    render(
      <ReadyCard {...baseProps} isHost={true} finalizeDisabled={true} />,
    );
    const btn = screen.getByRole("button", { name: /finalize now/i });
    expect(btn).toBeDisabled();
  });

  it("enables Finalize now when finalizeDisabled is false and calls onFinalizeNow", async () => {
    const onFinalizeNow = vi.fn();
    render(
      <ReadyCard
        {...baseProps}
        isHost={true}
        finalizeDisabled={false}
        onFinalizeNow={onFinalizeNow}
      />,
    );
    const btn = screen.getByRole("button", { name: /finalize now/i });
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    expect(onFinalizeNow).toHaveBeenCalledTimes(1);
  });

  it("hides the no-consensus hint when noConsensusYet is false", () => {
    render(<ReadyCard {...baseProps} noConsensusYet={false} />);
    expect(
      screen.queryByText(/no candidate has crossed the threshold/i),
    ).not.toBeInTheDocument();
  });

  it("shows the no-consensus hint when noConsensusYet is true", () => {
    render(<ReadyCard {...baseProps} noConsensusYet={true} />);
    expect(
      screen.getByText(/no candidate has crossed the threshold/i),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/components/ReadyCard.test.tsx`
Expected: FAIL with `Cannot find module './ReadyCard'`.

- [ ] **Step 3: Implement `ReadyCard`**

Create `/Users/drub/repos/Ensemble/src/components/ReadyCard.tsx`:

```tsx
import { Button, Card } from "./ui";

export function ReadyCard({
  selfReady,
  readyCount,
  presentCount,
  isHost,
  noConsensusYet,
  finalizeDisabled,
  onToggleReady,
  onFinalizeNow,
}: {
  selfReady: boolean;
  readyCount: number;
  presentCount: number;
  isHost: boolean;
  noConsensusYet: boolean;
  finalizeDisabled: boolean;
  onToggleReady: (ready: boolean) => void;
  onFinalizeNow: () => void;
}) {
  return (
    <Card>
      <Card.Eyebrow>{`Ready, ${readyCount} / ${presentCount}`}</Card.Eyebrow>
      <Card.Body>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            variant={selfReady ? "secondary" : "primary"}
            onClick={() => onToggleReady(!selfReady)}
          >
            {selfReady ? "Not ready yet" : "I'm ready"}
          </Button>
          {isHost ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={finalizeDisabled}
              onClick={onFinalizeNow}
            >
              Finalize now
            </Button>
          ) : null}
        </div>
        {noConsensusYet ? (
          <p className="mt-3 text-xs text-text-muted">
            No candidate has crossed the threshold yet, change votes and
            re-ready up.
          </p>
        ) : null}
      </Card.Body>
    </Card>
  );
}
```

The eyebrow text uses a comma instead of an em-dash separator per drub's project convention (no em-dashes).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/ReadyCard.test.tsx`
Expected: PASS for all 10 tests.

The first test "renders the eyebrow with the ready ratio" uses two assertions: `getByText(/ready/i)` (case-insensitive substring match for "Ready") and `getByText(/1 \/ 2/)` (regex match for "1 / 2"). Both should match the eyebrow's text.

- [ ] **Step 5: Run full check**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS (3 pre-existing Card.tsx fast-refresh warnings only). Total tests should be 95 (85 prior + 10 new).

- [ ] **Step 6: Commit and push**

```bash
git add src/components/ReadyCard.tsx src/components/ReadyCard.test.tsx
git commit -m "$(cat <<'EOF'
Add ReadyCard presentation component for finalize-voting

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 3: Wire SessionUI for finalize-voting

**Files:**

- Modify: `src/components/SessionUI.tsx`

This is the main behavioral change. After this commit, the room will:
- No longer auto-lock on every vote change
- Lock only when all present users have hit "I'm ready"
- Reset the editing user's Done on cast/unvote
- Show the host a "Finalize now" override
- Render the ReadyCard when phase is voting

- [ ] **Step 1: Add `useUpdateMyPresence` and `ReadyCard` imports**

At the top of `/Users/drub/repos/Ensemble/src/components/SessionUI.tsx`, update the Liveblocks import block to include `useUpdateMyPresence`:

```tsx
import {
  useMutation,
  useOthers,
  useSelf,
  useStorage,
  useUpdateMyPresence,
} from "@liveblocks/react/suspense";
```

Add `ReadyCard` to the local component imports:

```tsx
import { ReadyCard } from "./ReadyCard";
```

(Add this line near the existing `import { ThresholdPicker } from "./ThresholdPicker";` line.)

- [ ] **Step 2: Call `useUpdateMyPresence` and derive `allPresentDone`**

Inside the `SessionUI` component body, just below `const profile = useResonanceProfile();`, add:

```tsx
const updateMyPresence = useUpdateMyPresence();

const allPresentDone = useMemo(() => {
  if (!self.presence?.votingComplete) return false;
  for (const other of others) {
    if (!other.id) continue;
    if (!other.presence?.votingComplete) return false;
  }
  return true;
}, [self.presence?.votingComplete, others]);
```

The deps array for `allPresentDone` triggers recomputation whenever self's flag changes or any other's presence updates (which `useOthers()` returns a new array reference for).

- [ ] **Step 3: Derive `currentEvaluation` and `noConsensusYet`**

Below `allPresentDone`, add:

```tsx
const currentEvaluation = useMemo(
  () =>
    evaluate(
      votesSnapshot,
      consensus.threshold as ThresholdRule,
      presentMemberIds,
    ),
  [votesSnapshot, consensus.threshold, presentMemberIds],
);

const noConsensusYet =
  consensus.phase === "voting" &&
  allPresentDone &&
  currentEvaluation.winnerId === null;

const finalizeDisabled = currentEvaluation.winnerId === null;
```

Note: `votesSnapshot`, `presentMemberIds`, and the `evaluate` import already exist in the file from prior work. Reuse them.

- [ ] **Step 4: Update the detection effect to gate on `allPresentDone`**

Find the existing detection effect (the one that calls `lockConsensus`). It currently looks like:

```tsx
useEffect(() => {
  if (consensus.phase !== "voting") return;
  // Liveblocks widens nested LiveObject fields to Lson via the
  // [key: string]: Lson | undefined index signature on Consensus,
  // re-narrow to the original ThresholdRule shape.
  const result = evaluate(
    votesSnapshot,
    consensus.threshold as ThresholdRule,
    presentMemberIds,
  );
  if (result.winnerId === null) return;
  lockConsensus({
    winnerId: result.winnerId,
    tiedIds: result.tiedIds,
  });
}, [
  consensus.phase,
  consensus.threshold,
  votesSnapshot,
  presentMemberIds,
  lockConsensus,
]);
```

Replace the body and dependency array with:

```tsx
useEffect(() => {
  if (consensus.phase !== "voting") return;
  if (!allPresentDone) return;
  // Liveblocks widens nested LiveObject fields to Lson via the
  // [key: string]: Lson | undefined index signature on Consensus,
  // re-narrow to the original ThresholdRule shape.
  const result = evaluate(
    votesSnapshot,
    consensus.threshold as ThresholdRule,
    presentMemberIds,
  );
  if (result.winnerId === null) return;
  lockConsensus({
    winnerId: result.winnerId,
    tiedIds: result.tiedIds,
  });
}, [
  consensus.phase,
  consensus.threshold,
  votesSnapshot,
  presentMemberIds,
  allPresentDone,
  lockConsensus,
]);
```

The single behavioral change: the early return `if (!allPresentDone) return;` and the new dep `allPresentDone`.

- [ ] **Step 5: Add vote handler wrappers**

Below the existing `castVote` and `unvote` mutation declarations, add:

```tsx
const handleVote = (candidateId: string) => {
  castVote(candidateId);
  updateMyPresence({ votingComplete: false });
};

const handleUnvote = (candidateId: string) => {
  unvote(candidateId);
  updateMyPresence({ votingComplete: false });
};
```

These wrap the storage mutations and follow up with a presence update. Casting/unvoting always implies "I'm not done yet."

- [ ] **Step 6: Add toggle-ready and finalize handlers**

Below the vote handler wrappers, add:

```tsx
const handleToggleReady = (ready: boolean) => {
  updateMyPresence({ votingComplete: ready });
};

const handleFinalizeNow = () => {
  if (!isHost) return;
  if (consensus.phase !== "voting") return;
  if (currentEvaluation.winnerId === null) return;
  lockConsensus({
    winnerId: currentEvaluation.winnerId,
    tiedIds: currentEvaluation.tiedIds,
  });
};
```

- [ ] **Step 7: Compute `readyCount` for ReadyCard**

Below `allPresentDone`, add:

```tsx
const readyCount = useMemo(() => {
  let count = self.presence?.votingComplete ? 1 : 0;
  for (const other of others) {
    if (!other.id) continue;
    if (other.presence?.votingComplete) count += 1;
  }
  return count;
}, [self.presence?.votingComplete, others]);
```

The `presentCount` is `presentMemberIds.size` (already computed).

- [ ] **Step 8: Render `<ReadyCard />` below `CandidatesPanel`**

Find where `<CandidatesPanel ... />` is rendered. Just below it (still inside the `<section>`), add:

```tsx
{consensus.phase === "voting" ? (
  <ReadyCard
    selfReady={self.presence?.votingComplete ?? false}
    readyCount={readyCount}
    presentCount={presentMemberIds.size}
    isHost={isHost}
    noConsensusYet={noConsensusYet}
    finalizeDisabled={finalizeDisabled}
    onToggleReady={handleToggleReady}
    onFinalizeNow={handleFinalizeNow}
  />
) : null}
```

When phase is `decided`, the ReadyCard is not rendered (HeroCard takes its visual role). When voting, ReadyCard is the room's finalization surface.

- [ ] **Step 9: Wire `handleVote` / `handleUnvote` into `<CandidatesPanel />`**

Find the existing `<CandidatesPanel ... />` render. The current props pass `onVote={castVote}` and `onUnvote={unvote}`. Replace with:

```tsx
onVote={handleVote}
onUnvote={handleUnvote}
```

These callbacks now reset Done as a side effect of voting.

- [ ] **Step 10: Verify typecheck, lint, and tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS. 95 tests should still pass.

If lint flags `react-hooks/set-state-in-effect` anywhere, the call site is wrong. The wrappers (`handleVote`, `handleUnvote`, `handleToggleReady`, `handleFinalizeNow`) are not effects; they are event handlers. They can call `updateMyPresence` freely.

- [ ] **Step 11: Commit and push**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Gate consensus on all-present-Done and add ReadyCard render

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 4: Reconsider self-reset

**Files:**

- Modify: `src/components/SessionUI.tsx`

When the host triggers Reconsider, storage clears. Each client's own `votingComplete` should reset to false locally so the next round starts fresh.

- [ ] **Step 1: Extend the prev-phase block**

In `/Users/drub/repos/Ensemble/src/components/SessionUI.tsx`, find the existing prev-phase tracking block:

```tsx
if (prevPhase !== consensus.phase) {
  // Phase changed: update prevPhase and adjust observedTransition in the
  // same aborted-render pass so the next committed render has both correct.
  setPrevPhase(consensus.phase);
  if (prevPhase === "voting" && consensus.phase === "decided") {
    setObservedTransition(true);
  } else if (consensus.phase === "voting") {
    // Reconsider returned to voting: clear the gate for the next round.
    setObservedTransition(false);
  }
}
```

Add an `updateMyPresence` call inside the reconsider branch:

```tsx
if (prevPhase !== consensus.phase) {
  setPrevPhase(consensus.phase);
  if (prevPhase === "voting" && consensus.phase === "decided") {
    setObservedTransition(true);
  } else if (consensus.phase === "voting") {
    // Reconsider returned to voting: clear the animation gate AND reset
    // own votingComplete so the next round starts fresh.
    setObservedTransition(false);
    updateMyPresence({ votingComplete: false });
  }
}
```

The `updateMyPresence` call happens during render. This is fine because `updateMyPresence` from Liveblocks is a stable reference and the call itself does not trigger a synchronous re-render of THIS client (it dispatches a network update). It is not an effect; it is part of the derived-state pattern documented in the prev-phase block's existing comment.

If lint flags this as `react-hooks/set-state-in-render` or similar, move the call into a useEffect that depends on `consensus.phase`. The render-time approach is preferred because it stays consistent with the existing pattern in the same block.

- [ ] **Step 2: Verify typecheck, lint, and tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS. 95 tests should still pass.

If lint flags the render-time call, switch to:

```tsx
useEffect(() => {
  if (prevPhase === "decided" && consensus.phase === "voting") {
    updateMyPresence({ votingComplete: false });
  }
}, [prevPhase, consensus.phase, updateMyPresence]);
```

Place this effect just after the existing prev-phase block. Note: the prev-phase block updates `prevPhase` synchronously during render, but the useEffect reads it after commit, so it sees the value AFTER the update. Confirm by mentally walking through a phase transition before committing.

- [ ] **Step 3: Commit and push**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Reset own votingComplete on decided to voting transition

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 5: MemberChip Done indicator

**Files:**

- Modify: `src/components/SessionUI.tsx`

Each member chip in the presence card gains a small saffron indicator when that user has marked themselves Done.

- [ ] **Step 1: Update `MemberChip` to accept a `done` prop**

In `/Users/drub/repos/Ensemble/src/components/SessionUI.tsx`, find the `MemberChip` function. Its current signature looks like:

```tsx
function MemberChip({
  name,
  avatarUrl,
  isYou,
}: {
  name?: string;
  avatarUrl?: string;
  isYou?: boolean;
}) {
```

Update the prop type and signature:

```tsx
function MemberChip({
  name,
  avatarUrl,
  isYou,
  done,
}: {
  name?: string;
  avatarUrl?: string;
  isYou?: boolean;
  done?: boolean;
}) {
```

- [ ] **Step 2: Render the indicator inside the chip**

Find the chip's return JSX (a `<li>` with an avatar + name). Add a small saffron indicator after the name when `done` is true:

```tsx
return (
  <li className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-text">
    {avatarUrl ? (
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="h-5 w-5 rounded-full object-cover"
      />
    ) : (
      <span className="inline-block h-5 w-5 rounded-full bg-white/10" />
    )}
    <span>
      {name ?? "Anonymous"}
      {isYou && <span className="ml-1 text-text-muted">(you)</span>}
    </span>
    {done ? (
      <span
        aria-label="ready"
        title="Ready"
        className="inline-block h-2 w-2 rounded-full bg-accent"
      />
    ) : null}
  </li>
);
```

The indicator is a 8px saffron dot with `aria-label="ready"` for accessibility. The existing image className gains `object-cover` for consistency with AvatarStack (the prior mobile polish pass added `object-cover` there; the chip avatar should match).

- [ ] **Step 3: Pass `done` from each member's presence in the presence-card render**

Find where the presence card renders the list of `MemberChip`s. The current loop renders:

```tsx
<MemberChip
  key={self.connectionId}
  name={self.info?.name}
  avatarUrl={self.info?.avatarUrl}
  isYou
/>
{others.map((m) => (
  <MemberChip
    key={m.connectionId}
    name={m.info?.name}
    avatarUrl={m.info?.avatarUrl}
  />
))}
```

Update to pass `done` from each member's presence:

```tsx
<MemberChip
  key={self.connectionId}
  name={self.info?.name}
  avatarUrl={self.info?.avatarUrl}
  isYou
  done={self.presence?.votingComplete ?? false}
/>
{others.map((m) => (
  <MemberChip
    key={m.connectionId}
    name={m.info?.name}
    avatarUrl={m.info?.avatarUrl}
    done={m.presence?.votingComplete ?? false}
  />
))}
```

- [ ] **Step 4: Verify typecheck, lint, and tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS. 95 tests should still pass.

- [ ] **Step 5: Commit and push**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Show Done indicator on member chips when user is ready

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 6: Verification, decisions log, CLAUDE.md update

**Files:**

- Modify: `decisions.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the full check pipeline**

Run: `pnpm check`
Expected: PASS (typecheck, lint, build, test all green). 95 tests should pass.

If anything fails, STOP and report. Do not commit until everything is green.

- [ ] **Step 2: Append a decision to `decisions.md`**

Read `/Users/drub/repos/Ensemble/decisions.md` first to confirm the existing format. Append one new entry below the existing latest entry (newest at bottom):

```markdown
---

## 2026-05-10 — Finalize-voting model: per-user Done flag, all-present-Done auto-finalizes

**Considered**: **Live-tally with auto-lock on first cross** (status quo, found too eager during friend-test), **host-only Finalize button** (less peer-to-peer), **per-user Done flag with auto-finalize when all are Done plus host override** (chosen).

**Decision**: Per-user Done flag stored in Liveblocks Presence as `votingComplete: boolean`. The voting-to-decided transition fires only when all present users have marked themselves Done. Casting or un-voting resets the editing user's Done flag. Host has a "Finalize now" override that bypasses the all-done gate.

**Why**: Friend-test directly demonstrated the auto-lock model was too eager: with two users in a unanimous-threshold room, the first to vote on a candidate the other had already voted for caused an instant lock, and the second user never got to express their full preferences. Approval voting wants users to mark several picks; the trigger needs to be a deliberate gesture, not a state-derived auto-fire. Per-user Done preserves the live tally (no hidden-then-reveal model), keeps voting peer-to-peer (every member's gesture matters), and lets the room collectively decide when to evaluate. Done lives in Presence (per-user, ephemeral) rather than Storage so each client owns their own flag without coordinated cross-client writes. Reconsider triggers a local self-reset when each client observes the decided-to-voting transition. Host's Finalize-now override fits the existing room-creator-is-host pattern.

**Tradeoff accepted**: One more gesture per voting round than the auto-lock model. Acceptable because the friend test directly demonstrated the auto-lock model was too eager, and "I'm ready" is a natural group-decision gesture.

**Would revisit if**: Real users find the gesture redundant in trusted small-group sessions (unlikely given the friend-test feedback), or the asymmetry between vote (live) and Done (gesture) creates confusion about what's committed.
```

After writing, run `rg "—" decisions.md` to scan. Pre-existing em-dashes in older entries should remain untouched. Verify the new entry contains no em-dashes (the dashes in the `## 2026-05-10 — Title` header are em-dashes that match the file's existing convention; that is acceptable).

- [ ] **Step 3: Update `CLAUDE.md` decisions list**

Read `/Users/drub/repos/Ensemble/CLAUDE.md` first.

Find the `## Current state` "Architectural decisions locked" list (currently ends at 23 after the mobile-polish pass added two entries). Append:

```markdown
24. Finalize-voting: per-user Done flag in Presence, all-present-Done auto-finalizes, host has Finalize-now override.
```

This pass does not have its own build step in the existing build-steps list (it is a hot-fix to step 7 / step 9 friend-test feedback). Do not add a new build step. Leave the build-steps section unchanged.

- [ ] **Step 4: Run the check pipeline once more**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add decisions.md CLAUDE.md
git commit -m "$(cat <<'EOF'
Log finalize-voting decision and update locked-decisions list

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 6: Manual verification (drub-driven, post-deploy)**

Vercel auto-deploys from main. Once deployed:

1. Open the deployed app on two browser windows in different accounts.
2. Both join the same session, default unanimous threshold, default 5 items per pull.
3. User A pulls candidates and votes for several titles. Confirm: nothing locks. The Ready card shows "0 / 2 ready" and the user A's chip has no done indicator.
4. User A clicks "I'm ready." Confirm: their chip gets a saffron dot, the Ready card shows "1 / 2 ready," and the room does NOT lock yet.
5. User B votes for a couple of titles. Confirm: A's done state stays (vote-changes-reset only the editing user). The room still does not lock.
6. User B clicks "I'm ready." Confirm: BOTH chips have dots, Ready card shows "2 / 2 ready," and the room locks IF a candidate has crossed the unanimous threshold. Always-spin runs for 1.2s then HeroCard.
7. If no candidate has crossed (e.g., A and B voted for different titles): the Ready card stays visible and shows the no-consensus hint. User A or B can change a vote (their own done flips off, ready count drops to 1/2), and the loop continues.
8. Host (whichever opened the session) tests Reconsider on the HeroCard. Confirm: room returns to voting, both clients' done flags reset (chips lose their dots, Ready card shows "0 / 2 ready").
9. Host tests "Finalize now" while one user is not Done. Confirm: if there is a winner at the current vote state, the room locks regardless of the not-Done user. If no winner, the button is disabled.
10. Have one user disconnect mid-session. Confirm: present count drops, the remaining user's "all done" status now equals the room state (if they're done, threshold fires).

If any step misbehaves, capture symptoms and report.

---

## Notes

- **Test infra constraint:** The threshold-detection and presence-reset logic is integration-level (touches Liveblocks presence + storage + effects). The existing test infra does not mock Liveblocks rooms. Verification of this logic is manual two-browser testing post-deploy. Only the `ReadyCard` component is unit-tested in this pass.
- **No worktree:** drub works on main per project memory. Each task ends with commit + push to origin/main.
- **Em-dash discipline:** drub's project convention is no em-dashes in writing. The strings rendered by `ReadyCard` and the comments added in this plan use commas, periods, or "to" instead.
- **Hot-fix, not a new build step:** This pass addresses friend-test feedback against the consensus flow. It does not warrant its own build-step entry in CLAUDE.md.
