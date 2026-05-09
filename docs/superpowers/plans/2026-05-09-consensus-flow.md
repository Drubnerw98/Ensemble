# Consensus flow implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land build step 7 — configurable threshold, random tiebreaker, lock + reconsider lifecycle, host model, and hero-card reveal — backing the spec at `docs/superpowers/specs/2026-05-09-consensus-flow-design.md`.

**Architecture:** Storage-stored consensus state in a new `consensus: LiveObject<Consensus>` node in Liveblocks Storage. Pure `evaluate()` function in `src/lib/consensus.ts` runs reactively on each client; first client to detect threshold-cross writes the transition. Liveblocks CRDT handles concurrent writes. UI splits into presentation components (`HeroCard`, `ThresholdPicker`) that the SessionUI connector wires up.

**Tech Stack:** Vite + React 19 + TypeScript, Liveblocks (`@liveblocks/react/suspense`), Tailwind v4 with the locked token system, Vitest + happy-dom + RTL, Framer Motion 12 for the spring on the hero transition.

**Test commands:** `pnpm test` (single run), `pnpm test:watch` (TDD loop), `pnpm typecheck`, `pnpm check` (full pre-merge gate).

**Commit cadence:** Per drub's project memory, commit AND push at every meaningful checkpoint. Each task ends with a commit + push.

---

## File map

**Created:**

- `src/lib/consensus.ts` — `ThresholdRule`, `evaluate()` pure function. No Liveblocks dependency.
- `src/lib/consensus.test.ts` — unit tests for `evaluate()`.
- `src/components/HeroCard.tsx` — "Tonight's pick" presentation component.
- `src/components/HeroCard.test.tsx` — render tests.
- `src/components/ThresholdPicker.tsx` — host-only rule picker.
- `src/components/ThresholdPicker.test.tsx` — render tests.

**Modified:**

- `src/lib/liveblocks.ts` — add `Consensus`, `ConsensusPhase`, augment `Storage` to include `consensus: LiveObject<Consensus>`.
- `src/routes/Session.tsx` — initialize the `consensus` LiveObject with `hostId` from Clerk and `threshold: { kind: 'unanimous' }`.
- `src/components/SessionUI.tsx` — read `consensus` storage, render `ThresholdPicker` and `HeroCard`, run transition-detection and host-migration effects, gate mutations on phase, expose reconsider mutation.
- `decisions.md` — append five entries listed in the spec's "Decisions to log" section.
- `CLAUDE.md` — flip build step 7 to ✅ and update "Current state" / "Next step".

---

## Task 1: Add types to `src/lib/liveblocks.ts`

**Files:**

- Modify: `src/lib/liveblocks.ts`

- [ ] **Step 1: Replace the Liveblocks types module with the consensus-augmented version**

Replace the entire file contents with:

```ts
import type { LiveList, LiveMap, LiveObject } from "@liveblocks/client";

// Index signature satisfies Liveblocks' LsonObject constraint — values
// stored in Liveblocks Storage must be primitives, Live* nodes, or plain
// objects that allow string-keyed access.
export type Candidate = {
  id: string;
  title: string;
  addedBy: string;
  addedAt: number;
  [key: string]: string | number;
};

export type ThresholdRule =
  | { kind: "unanimous" }
  | { kind: "majority" }
  | { kind: "first-to-n"; n: number };

export type ConsensusPhase = "voting" | "decided";

export type Consensus = {
  hostId: string;
  threshold: ThresholdRule;
  phase: ConsensusPhase;
  winnerId: string | null;
  tiedIds: string[];
  decidedAt: number | null;
  // Wider index signature than Candidate's — Consensus holds nested
  // objects (threshold), arrays (tiedIds), and nullable primitives.
  [key: string]: unknown;
};

// Module augmentation tells Liveblocks' hooks (useStorage, useSelf, etc.)
// what shape our room data has so they're typed end-to-end.
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

- [ ] **Step 2: Verify typecheck still compiles**

Run: `pnpm typecheck`
Expected: PASS. The `consensus` field is referenced nowhere yet so adding it to the augmented Storage interface doesn't break call sites — it just becomes a required init field that the next task will fill.

Note: typecheck WILL fail at `src/routes/Session.tsx` because `initialStorage` no longer matches `Storage`. That's expected and gets fixed in Task 3 — record the failure but do not commit yet. Run typecheck again after Task 3 to confirm it goes green.

- [ ] **Step 3: Commit and push**

```bash
git add src/lib/liveblocks.ts
git commit -m "$(cat <<'EOF'
Add consensus types to Liveblocks Storage augmentation

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 2: Pure `evaluate()` function in `src/lib/consensus.ts`

**Files:**

- Create: `src/lib/consensus.ts`
- Test: `src/lib/consensus.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/lib/consensus.test.ts` with:

```ts
import { describe, expect, it, vi } from "vitest";
import { evaluate } from "./consensus";
import type { ThresholdRule } from "./liveblocks";

function rule(kind: ThresholdRule["kind"], n?: number): ThresholdRule {
  if (kind === "first-to-n") return { kind, n: n ?? 0 };
  return { kind } as ThresholdRule;
}

describe("evaluate", () => {
  describe("unanimous", () => {
    it("returns no winner when no one has voted", () => {
      const result = evaluate(
        new Map(),
        rule("unanimous"),
        new Set(["u1", "u2"]),
      );
      expect(result).toEqual({ winnerId: null, tiedIds: [] });
    });

    it("returns no winner when only some present members voted", () => {
      const result = evaluate(
        new Map([["c1", ["u1"]]]),
        rule("unanimous"),
        new Set(["u1", "u2", "u3"]),
      );
      expect(result).toEqual({ winnerId: null, tiedIds: [] });
    });

    it("returns winner when all present members voted for one candidate", () => {
      const result = evaluate(
        new Map([["c1", ["u1", "u2", "u3"]]]),
        rule("unanimous"),
        new Set(["u1", "u2", "u3"]),
      );
      expect(result).toEqual({ winnerId: "c1", tiedIds: ["c1"] });
    });

    it("ignores votes from non-present members in the denominator", () => {
      const result = evaluate(
        new Map([["c1", ["u1", "u2"]]]),
        rule("unanimous"),
        new Set(["u1", "u2"]),
      );
      expect(result).toEqual({ winnerId: "c1", tiedIds: ["c1"] });
    });
  });

  describe("majority", () => {
    it("returns no winner at exactly 50%", () => {
      const result = evaluate(
        new Map([["c1", ["u1", "u2"]]]),
        rule("majority"),
        new Set(["u1", "u2", "u3", "u4"]),
      );
      expect(result).toEqual({ winnerId: null, tiedIds: [] });
    });

    it("returns winner when strict majority is reached", () => {
      const result = evaluate(
        new Map([["c1", ["u1", "u2", "u3"]]]),
        rule("majority"),
        new Set(["u1", "u2", "u3", "u4"]),
      );
      expect(result).toEqual({ winnerId: "c1", tiedIds: ["c1"] });
    });

    it("returns no winner when nobody has crossed", () => {
      const result = evaluate(
        new Map([
          ["c1", ["u1"]],
          ["c2", ["u2"]],
        ]),
        rule("majority"),
        new Set(["u1", "u2", "u3"]),
      );
      expect(result).toEqual({ winnerId: null, tiedIds: [] });
    });
  });

  describe("first-to-n", () => {
    it("returns no winner below n", () => {
      const result = evaluate(
        new Map([["c1", ["u1"]]]),
        rule("first-to-n", 2),
        new Set(["u1", "u2", "u3"]),
      );
      expect(result).toEqual({ winnerId: null, tiedIds: [] });
    });

    it("returns winner at n", () => {
      const result = evaluate(
        new Map([["c1", ["u1", "u2"]]]),
        rule("first-to-n", 2),
        new Set(["u1", "u2", "u3"]),
      );
      expect(result).toEqual({ winnerId: "c1", tiedIds: ["c1"] });
    });

    it("returns winner above n", () => {
      const result = evaluate(
        new Map([["c1", ["u1", "u2", "u3"]]]),
        rule("first-to-n", 2),
        new Set(["u1", "u2", "u3"]),
      );
      expect(result).toEqual({ winnerId: "c1", tiedIds: ["c1"] });
    });
  });

  describe("ties", () => {
    it("returns all tied candidates and a randomly chosen winner under unanimous", () => {
      const spy = vi.spyOn(Math, "random").mockReturnValue(0); // picks index 0
      try {
        const result = evaluate(
          new Map([
            ["c1", ["u1", "u2"]],
            ["c2", ["u1", "u2"]],
          ]),
          rule("unanimous"),
          new Set(["u1", "u2"]),
        );
        expect(result.tiedIds.sort()).toEqual(["c1", "c2"]);
        expect(result.tiedIds).toContain(result.winnerId);
      } finally {
        spy.mockRestore();
      }
    });

    it("picks deterministically when Math.random is stubbed", () => {
      const spy = vi.spyOn(Math, "random").mockReturnValue(0.99); // picks last index
      try {
        const result = evaluate(
          new Map([
            ["c1", ["u1", "u2"]],
            ["c2", ["u1", "u2"]],
          ]),
          rule("unanimous"),
          new Set(["u1", "u2"]),
        );
        const sorted = [...result.tiedIds].sort();
        expect(result.winnerId).toBe(sorted[sorted.length - 1]);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe("edge cases", () => {
    it("handles empty members and empty votes", () => {
      const result = evaluate(new Map(), rule("unanimous"), new Set());
      expect(result).toEqual({ winnerId: null, tiedIds: [] });
    });

    it("handles empty members under majority without dividing by zero", () => {
      const result = evaluate(new Map(), rule("majority"), new Set());
      expect(result).toEqual({ winnerId: null, tiedIds: [] });
    });

    it("ignores candidates with zero votes", () => {
      const result = evaluate(
        new Map([
          ["c1", []],
          ["c2", ["u1", "u2"]],
        ]),
        rule("unanimous"),
        new Set(["u1", "u2"]),
      );
      expect(result).toEqual({ winnerId: "c2", tiedIds: ["c2"] });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/consensus.test.ts`
Expected: FAIL — `Cannot find module './consensus'` (file doesn't exist yet).

- [ ] **Step 3: Implement `evaluate()`**

Create `src/lib/consensus.ts`:

```ts
import type { ThresholdRule } from "./liveblocks";

export type EvaluateResult = {
  winnerId: string | null;
  tiedIds: string[];
};

// Pure threshold evaluator. Returns the candidate(s) that just crossed
// the configured threshold against the current presence set, with a
// random pick when multiple cross simultaneously. Vote-and-presence
// semantics: votes from non-present members count toward their
// candidate, but the threshold denominator is the present set.
export function evaluate(
  votes: ReadonlyMap<string, readonly string[]>,
  threshold: ThresholdRule,
  presentMemberIds: ReadonlySet<string>,
): EvaluateResult {
  const presentCount = presentMemberIds.size;

  const crossed: string[] = [];
  for (const [candidateId, voterIds] of votes) {
    const presentVoteCount = voterIds.length;
    if (presentVoteCount === 0) continue;

    if (matchesThreshold(presentVoteCount, threshold, presentCount)) {
      crossed.push(candidateId);
    }
  }

  if (crossed.length === 0) {
    return { winnerId: null, tiedIds: [] };
  }

  const winnerId = crossed[Math.floor(Math.random() * crossed.length)];
  return { winnerId, tiedIds: crossed };
}

function matchesThreshold(
  voteCount: number,
  threshold: ThresholdRule,
  presentCount: number,
): boolean {
  switch (threshold.kind) {
    case "unanimous":
      // Avoids the degenerate "0/0 = unanimous" — empty rooms can't
      // reach consensus.
      return presentCount > 0 && voteCount >= presentCount;
    case "majority":
      // Strictly greater than half: 2/4 is not majority.
      return presentCount > 0 && voteCount * 2 > presentCount;
    case "first-to-n":
      return voteCount >= threshold.n;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/consensus.test.ts`
Expected: PASS — all 14 tests green.

- [ ] **Step 5: Run full check**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit and push**

```bash
git add src/lib/consensus.ts src/lib/consensus.test.ts
git commit -m "$(cat <<'EOF'
Add evaluate() for threshold + tied-set consensus check

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 3: Initialize `consensus` storage in `src/routes/Session.tsx`

**Files:**

- Modify: `src/routes/Session.tsx`

- [ ] **Step 1: Add `useUser` import and `LiveObject` import**

At the top of `src/routes/Session.tsx`, change the imports:

```ts
import { useCallback } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth, useUser } from "@clerk/clerk-react";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense";
import { LiveList, LiveMap, LiveObject } from "@liveblocks/client";
import { isValidSessionCode } from "../lib/sessionCode";
import { SessionUI } from "../components/SessionUI";
```

- [ ] **Step 2: Add `consensus` to `initialStorage`**

Inside `Session()`, add `const { user } = useUser();` near `const { getToken } = useAuth();`. Then update the `RoomProvider`'s `initialStorage`:

```tsx
<RoomProvider
  id={roomId}
  initialPresence={{}}
  initialStorage={{
    candidates: new LiveList([]),
    votes: new LiveMap(),
    consensus: new LiveObject({
      hostId: user?.id ?? "",
      threshold: { kind: "unanimous" },
      phase: "voting",
      winnerId: null,
      tiedIds: [],
      decidedAt: null,
    }),
  }}
>
```

Why `user?.id ?? ""`: `initialStorage` is only used the first time the room is created. If `user` is somehow not loaded at that moment (it should be, because Clerk gating wraps this route), the empty-string fallback is a degenerate host id that the host-migration effect (Task 9) will replace on the next render. Cleaner than throwing in a render path.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit and push**

```bash
git add src/routes/Session.tsx
git commit -m "$(cat <<'EOF'
Initialize consensus LiveObject with hostId and unanimous default

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 4: `HeroCard` presentation component

**Files:**

- Create: `src/components/HeroCard.tsx`
- Test: `src/components/HeroCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/HeroCard.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeroCard } from "./HeroCard";

const userInfoById = new Map([
  ["u1", { name: "Alice", avatarUrl: undefined }],
  ["u2", { name: "Bob", avatarUrl: undefined }],
]);

describe("HeroCard", () => {
  it("renders the winner title and 'Tonight's pick' eyebrow", () => {
    render(
      <HeroCard
        winnerTitle="Dune Part Two"
        voterIds={["u1", "u2"]}
        userInfoById={userInfoById}
        isHost={false}
        onReconsider={() => {}}
      />,
    );
    expect(screen.getByText("Dune Part Two")).toBeInTheDocument();
    expect(screen.getByText(/tonight'?s pick/i)).toBeInTheDocument();
  });

  it("shows the Reconsider button only when isHost is true", () => {
    const { rerender } = render(
      <HeroCard
        winnerTitle="X"
        voterIds={[]}
        userInfoById={userInfoById}
        isHost={false}
        onReconsider={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /reconsider/i }),
    ).not.toBeInTheDocument();

    rerender(
      <HeroCard
        winnerTitle="X"
        voterIds={[]}
        userInfoById={userInfoById}
        isHost={true}
        onReconsider={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: /reconsider/i }),
    ).toBeInTheDocument();
  });

  it("calls onReconsider when host clicks the button", async () => {
    const onReconsider = vi.fn();
    render(
      <HeroCard
        winnerTitle="X"
        voterIds={[]}
        userInfoById={userInfoById}
        isHost={true}
        onReconsider={onReconsider}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /reconsider/i }),
    );
    expect(onReconsider).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/components/HeroCard.test.tsx`
Expected: FAIL — `Cannot find module './HeroCard'`.

- [ ] **Step 3: Implement `HeroCard`**

Create `src/components/HeroCard.tsx`:

```tsx
import { motion } from "framer-motion";
import { AvatarStack, Button, Card } from "./ui";

type UserInfo = { name?: string; avatarUrl?: string };

export function HeroCard({
  winnerTitle,
  voterIds,
  userInfoById,
  isHost,
  onReconsider,
}: {
  winnerTitle: string;
  voterIds: readonly string[];
  userInfoById: ReadonlyMap<string, UserInfo>;
  isHost: boolean;
  onReconsider: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      <Card className="border-accent/40 bg-accent/[0.04]">
        <Card.Eyebrow>Tonight&apos;s pick</Card.Eyebrow>
        <Card.Body>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-light tracking-tight text-text">
                {winnerTitle}
              </h2>
              <div className="mt-3">
                <AvatarStack
                  userIds={voterIds}
                  userInfoById={userInfoById}
                  size="md"
                  max={5}
                  showCount
                  highlight
                />
              </div>
            </div>
            {isHost ? (
              <Button variant="secondary" size="sm" onClick={onReconsider}>
                Reconsider
              </Button>
            ) : null}
          </div>
        </Card.Body>
      </Card>
    </motion.div>
  );
}
```

If `Card` does not currently accept a `className` prop, drop the prop here and use a plain div wrapper inside `Card.Body` to apply the accent. Verify by reading `src/components/ui/Card.tsx` before starting; if `className` isn't supported, restructure to:

```tsx
<Card>
  <Card.Eyebrow>Tonight&apos;s pick</Card.Eyebrow>
  <Card.Body>
    <div className="rounded-md border border-accent/40 bg-accent/[0.04] p-3">
      ...
    </div>
  </Card.Body>
</Card>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/HeroCard.test.tsx`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit and push**

```bash
git add src/components/HeroCard.tsx src/components/HeroCard.test.tsx
git commit -m "$(cat <<'EOF'
Add HeroCard presentation component for tonight's pick

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 5: `ThresholdPicker` presentation component

**Files:**

- Create: `src/components/ThresholdPicker.tsx`
- Test: `src/components/ThresholdPicker.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/ThresholdPicker.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThresholdPicker } from "./ThresholdPicker";
import type { ThresholdRule } from "../lib/liveblocks";

describe("ThresholdPicker", () => {
  it("renders read-only when isHost is false", () => {
    render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={false}
        presentCount={3}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText(/unanimous/i)).toBeInTheDocument();
  });

  it("renders a select when isHost is true", () => {
    render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={true}
        presentCount={3}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("emits onChange with the selected rule", async () => {
    const onChange = vi.fn<(rule: ThresholdRule) => void>();
    render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={true}
        presentCount={3}
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(screen.getByRole("combobox"), "majority");
    expect(onChange).toHaveBeenCalledWith({ kind: "majority" });
  });

  it("shows the N input only when first-to-n is selected", () => {
    const { rerender } = render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={true}
        presentCount={3}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();

    rerender(
      <ThresholdPicker
        threshold={{ kind: "first-to-n", n: 2 }}
        isHost={true}
        presentCount={3}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("warns when N exceeds present count", () => {
    render(
      <ThresholdPicker
        threshold={{ kind: "first-to-n", n: 5 }}
        isHost={true}
        presentCount={2}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/cannot be reached yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/components/ThresholdPicker.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ThresholdPicker`**

Create `src/components/ThresholdPicker.tsx`:

```tsx
import { Card } from "./ui";
import type { ThresholdRule } from "../lib/liveblocks";

const RULE_LABELS: Record<ThresholdRule["kind"], string> = {
  unanimous: "Unanimous",
  majority: "Majority",
  "first-to-n": "First to N",
};

export function ThresholdPicker({
  threshold,
  isHost,
  presentCount,
  onChange,
}: {
  threshold: ThresholdRule;
  isHost: boolean;
  presentCount: number;
  onChange: (rule: ThresholdRule) => void;
}) {
  function handleKindChange(kind: ThresholdRule["kind"]) {
    if (kind === "first-to-n") {
      const defaultN = Math.max(2, Math.ceil(presentCount / 2));
      onChange({ kind: "first-to-n", n: defaultN });
    } else {
      onChange({ kind });
    }
  }

  function handleNChange(value: number) {
    if (Number.isFinite(value) && value >= 1) {
      onChange({ kind: "first-to-n", n: Math.floor(value) });
    }
  }

  const showWarning =
    threshold.kind === "first-to-n" && threshold.n > presentCount;

  return (
    <Card>
      <Card.Eyebrow>Threshold</Card.Eyebrow>
      <Card.Body>
        <div className="flex flex-wrap items-center gap-3 text-sm text-text">
          {isHost ? (
            <>
              <select
                value={threshold.kind}
                onChange={(e) =>
                  handleKindChange(e.target.value as ThresholdRule["kind"])
                }
                className="rounded-md border border-border bg-transparent px-3 py-1.5 text-text focus:border-border-strong focus:outline-none"
              >
                {(Object.keys(RULE_LABELS) as ThresholdRule["kind"][]).map(
                  (kind) => (
                    <option key={kind} value={kind}>
                      {RULE_LABELS[kind]}
                    </option>
                  ),
                )}
              </select>
              {threshold.kind === "first-to-n" ? (
                <label className="flex items-center gap-2 text-text-muted">
                  N:
                  <input
                    type="number"
                    min={1}
                    value={threshold.n}
                    onChange={(e) => handleNChange(Number(e.target.value))}
                    className="w-16 rounded-md border border-border bg-transparent px-2 py-1 text-text focus:border-border-strong focus:outline-none"
                  />
                </label>
              ) : null}
            </>
          ) : (
            <span>
              {RULE_LABELS[threshold.kind]}
              {threshold.kind === "first-to-n" ? ` (N=${threshold.n})` : null}
            </span>
          )}
          {showWarning ? (
            <span className="text-xs text-warn">
              N &gt; present count — threshold cannot be reached yet.
            </span>
          ) : null}
        </div>
      </Card.Body>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/components/ThresholdPicker.test.tsx`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit and push**

```bash
git add src/components/ThresholdPicker.tsx src/components/ThresholdPicker.test.tsx
git commit -m "$(cat <<'EOF'
Add ThresholdPicker for host-only rule configuration

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 6: Wire consensus state into `SessionUI`

**Files:**

- Modify: `src/components/SessionUI.tsx`

- [ ] **Step 1: Add storage reads and component imports**

At the top of `src/components/SessionUI.tsx`, change the imports:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserButton, useUser } from "@clerk/clerk-react";
import {
  useMutation,
  useOthers,
  useSelf,
  useStorage,
} from "@liveblocks/react/suspense";
import { LiveList, LiveObject } from "@liveblocks/client";
import type { Candidate, ThresholdRule } from "../lib/liveblocks";
import { evaluate } from "../lib/consensus";
import { AvatarStack, Button, Card } from "./ui";
import { HeroCard } from "./HeroCard";
import { ThresholdPicker } from "./ThresholdPicker";
```

Inside `SessionUI()`, add a third `useStorage` call:

```tsx
const candidates = useStorage((root) => root.candidates);
const votes = useStorage((root) => root.votes);
const consensus = useStorage((root) => root.consensus);
```

- [ ] **Step 2: Compute the present-member set and host status**

Below `userInfoById`, add:

```tsx
const presentMemberIds = useMemo(() => {
  const set = new Set<string>();
  if (self.id) set.add(self.id);
  for (const other of others) if (other.id) set.add(other.id);
  return set;
}, [self.id, others]);

const isHost = self.id === consensus.hostId;
```

- [ ] **Step 3: Add the threshold-rule mutation**

Below `unvote`, add:

```tsx
const setThreshold = useMutation(({ storage }, rule: ThresholdRule) => {
  const c = storage.get("consensus");
  if (c.get("phase") !== "voting") return;
  c.set("threshold", rule);
}, []);
```

- [ ] **Step 4: Render the threshold picker and a placeholder hero region**

Inside the `<section>`, between the `RoomCodeCard` and `CandidatesPanel`, add:

```tsx
<ThresholdPicker
  threshold={consensus.threshold}
  isHost={isHost}
  presentCount={presentMemberIds.size}
  onChange={setThreshold}
/>

{consensus.phase === "decided" && consensus.winnerId ? (
  <HeroCard
    winnerTitle={
      candidates.find((c) => c.id === consensus.winnerId)?.title ??
      "(removed)"
    }
    voterIds={votes.get(consensus.winnerId) ?? EMPTY_VOTER_LIST}
    userInfoById={userInfoById}
    isHost={isHost}
    onReconsider={() => {
      /* wired in Task 8 */
    }}
  />
) : null}
```

- [ ] **Step 5: Verify typecheck and tests still pass**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit and push**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Wire ThresholdPicker and HeroCard into SessionUI scaffold

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 7: Transition detection (voting → decided)

**Files:**

- Modify: `src/components/SessionUI.tsx`

- [ ] **Step 1: Add the transition mutation**

Below `setThreshold`, add:

```tsx
const lockConsensus = useMutation(
  (
    { storage },
    payload: { winnerId: string; tiedIds: string[] },
  ) => {
    const c = storage.get("consensus");
    // Idempotent: only the first detector locks.
    if (c.get("phase") !== "voting") return;
    if (c.get("winnerId") !== null) return;
    c.update({
      phase: "decided",
      winnerId: payload.winnerId,
      tiedIds: payload.tiedIds,
      decidedAt: Date.now(),
    });
  },
  [],
);
```

- [ ] **Step 2: Add the detection effect**

Below the `presentMemberIds` and `isHost` declarations, add:

```tsx
const votesSnapshot = useMemo(() => {
  const map = new Map<string, readonly string[]>();
  for (const [id, voters] of votes) map.set(id, voters);
  return map;
}, [votes]);

useEffect(() => {
  if (consensus.phase !== "voting") return;
  const result = evaluate(votesSnapshot, consensus.threshold, presentMemberIds);
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

Note: `evaluate()` calls `Math.random()` for ties. Each render that triggers detection runs `evaluate()` with a fresh random; the FIRST `lockConsensus` write wins via the idempotency guard inside the mutation. Subsequent re-runs see `phase === 'decided'` and skip.

- [ ] **Step 3: Verify typecheck and tests still pass**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit and push**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Detect threshold-cross and lock consensus state

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 8: Reconsider mutation

**Files:**

- Modify: `src/components/SessionUI.tsx`

- [ ] **Step 1: Add the reconsider mutation**

Below `lockConsensus`, add:

```tsx
const reconsider = useMutation(({ storage, self }) => {
  const c = storage.get("consensus");
  if (self.id !== c.get("hostId")) return; // host-only
  if (c.get("phase") !== "decided") return; // already voting
  c.update({
    phase: "voting",
    winnerId: null,
    tiedIds: [],
    decidedAt: null,
  });
  // Full vote reset — see spec for rationale.
  const votesMap = storage.get("votes");
  for (const key of Array.from(votesMap.keys())) {
    votesMap.delete(key);
  }
}, []);
```

- [ ] **Step 2: Wire `reconsider` into the HeroCard**

Replace the placeholder `onReconsider={() => {}}` (or `/* wired in Task 8 */`) with `onReconsider={reconsider}`:

```tsx
<HeroCard
  winnerTitle={
    candidates.find((c) => c.id === consensus.winnerId)?.title ??
    "(removed)"
  }
  voterIds={votes.get(consensus.winnerId) ?? EMPTY_VOTER_LIST}
  userInfoById={userInfoById}
  isHost={isHost}
  onReconsider={reconsider}
/>
```

- [ ] **Step 3: Verify typecheck and tests still pass**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit and push**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Add host-only reconsider mutation that resets votes and phase

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 9: Lock mutations while phase === 'decided'

**Files:**

- Modify: `src/components/SessionUI.tsx`

- [ ] **Step 1: Gate each storage mutation on phase**

Update `addCandidate`, `removeCandidate`, `castVote`, `unvote` to no-op when `phase === 'decided'`. Each mutation gets a guard at the top:

```tsx
const addCandidate = useMutation(
  ({ storage }, title: string) => {
    if (storage.get("consensus").get("phase") !== "voting") return;
    storage.get("candidates").push(
      new LiveObject<Candidate>({
        id: crypto.randomUUID(),
        title,
        addedBy: user?.id ?? "unknown",
        addedAt: Date.now(),
      }),
    );
  },
  [user?.id],
);

const removeCandidate = useMutation(({ storage }, id: string) => {
  if (storage.get("consensus").get("phase") !== "voting") return;
  const list = storage.get("candidates");
  const votesMap = storage.get("votes");
  for (let i = list.length - 1; i >= 0; i--) {
    if (list.get(i)?.get("id") === id) {
      list.delete(i);
      votesMap.delete(id);
      return;
    }
  }
}, []);

const castVote = useMutation(({ storage, self }, candidateId: string) => {
  if (storage.get("consensus").get("phase") !== "voting") return;
  const votesMap = storage.get("votes");
  const list = votesMap.get(candidateId);
  if (!list) {
    votesMap.set(candidateId, new LiveList([self.id]));
    return;
  }
  for (let i = 0; i < list.length; i++) {
    if (list.get(i) === self.id) return;
  }
  list.push(self.id);
}, []);

const unvote = useMutation(({ storage, self }, candidateId: string) => {
  if (storage.get("consensus").get("phase") !== "voting") return;
  const votesMap = storage.get("votes");
  const list = votesMap.get(candidateId);
  if (!list) return;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list.get(i) === self.id) {
      list.delete(i);
      return;
    }
  }
}, []);
```

- [ ] **Step 2: Disable UI controls when phase === 'decided'**

In `CandidatesPanel`, accept a new `locked: boolean` prop and pass it through to disable buttons and inputs. Update the `CandidatesPanel` call site:

```tsx
<CandidatesPanel
  candidates={candidates}
  votes={votes}
  userInfoById={userInfoById}
  votedCandidateIds={votedCandidateIds}
  locked={consensus.phase === "decided"}
  onAdd={addCandidate}
  onRemove={removeCandidate}
  onVote={castVote}
  onUnvote={unvote}
/>
```

Update `CandidatesPanel` and `CandidateRow` signatures to accept `locked`:

```tsx
function CandidatesPanel({
  candidates,
  votes,
  userInfoById,
  votedCandidateIds,
  locked,
  onAdd,
  onRemove,
  onVote,
  onUnvote,
}: {
  candidates: readonly { readonly id: string; readonly title: string }[];
  votes: ReadonlyMap<string, readonly string[]>;
  userInfoById: ReadonlyMap<string, UserInfo>;
  votedCandidateIds: ReadonlySet<string>;
  locked: boolean;
  onAdd: (title: string) => void;
  onRemove: (id: string) => void;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
}) {
  // ... existing body ...
  // disable input + Add button when locked:
  //   <input disabled={locked} ... />
  //   <Button type="submit" disabled={locked || !draft.trim()}>Add</Button>
  // pass locked through to CandidateRow
}

function CandidateRow({
  candidate,
  voterIds,
  userInfoById,
  voted,
  locked,
  onVote,
  onUnvote,
  onRemove,
}: {
  // ... existing props ...
  locked: boolean;
}) {
  // disable Vote and remove buttons when locked
  // <Button disabled={locked} onClick={...}>Vote/Voted</Button>
  // <Button disabled={locked} onClick={...}>remove</Button>
}
```

Apply `disabled={locked}` to the input, Add button, Vote button, and remove button. Don't dim or hide — disabled is enough for the muted feel.

- [ ] **Step 3: Verify typecheck and tests still pass**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit and push**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Lock candidate and vote mutations while phase is decided

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 10: Host migration effect

**Files:**

- Modify: `src/components/SessionUI.tsx`

- [ ] **Step 1: Add the host migration mutation**

Below `reconsider`, add:

```tsx
const setHost = useMutation(({ storage }, newHostId: string) => {
  const c = storage.get("consensus");
  // Idempotent: only write when current host actually needs replacing.
  if (c.get("hostId") === newHostId) return;
  c.set("hostId", newHostId);
}, []);
```

- [ ] **Step 2: Add the migration effect**

Add a new `useEffect` near the transition-detection effect:

```tsx
useEffect(() => {
  if (!self.id) return;
  const hostId = consensus.hostId;
  // Build the present member list as { id, connectionId } pairs so we
  // can pick deterministically. self comes first, others after.
  const present: { id: string; connectionId: number }[] = [];
  if (self.id) {
    present.push({ id: self.id, connectionId: self.connectionId });
  }
  for (const o of others) {
    if (o.id) present.push({ id: o.id, connectionId: o.connectionId });
  }
  if (present.length === 0) return;

  const hostStillPresent = present.some((p) => p.id === hostId);
  if (hostStillPresent) return;

  // Lowest connectionId = longest-connected = deterministic across
  // clients. Whoever fits the rule writes the migration; CRDT picks
  // one if multiple write at once.
  const successor = present.reduce((min, p) =>
    p.connectionId < min.connectionId ? p : min,
  );
  if (successor.id === self.id) {
    setHost(self.id);
  }
}, [self.id, self.connectionId, others, consensus.hostId, setHost]);
```

- [ ] **Step 3: Verify typecheck and tests still pass**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit and push**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Migrate host to longest-connected member when current host drops

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 11: Tiebreaker spin animation + late-joiner gate

**Files:**

- Modify: `src/components/SessionUI.tsx`
- Modify: `src/components/HeroCard.tsx`
- Modify: `src/components/HeroCard.test.tsx`

The spin is a local UI effect that cycles through `tiedIds` for ~1.2 seconds before settling on `winnerId`. Storage already holds the final winner; the spin is purely cosmetic.

**Late-joiner gate:** the spec requires that late joiners arriving in `decided` state see the hero card with **no animation** (no spin, no slide-in). Implement this by tracking `previousPhase` in `SessionUI` — only clients whose `previousPhase === 'voting'` saw the transition. We pass an `animateOnMount` prop to `HeroCard`; late joiners get `false` and skip both the spin and the Framer Motion enter animation.

- [ ] **Step 1: Add a spin test to `HeroCard.test.tsx`**

Add to `HeroCard.test.tsx`:

```tsx
import { act } from "@testing-library/react";

// existing tests above ...

describe("HeroCard spin and animateOnMount", () => {
  it("renders the winner directly when not spinning", () => {
    render(
      <HeroCard
        winnerTitle="Winner"
        voterIds={[]}
        userInfoById={userInfoById}
        isHost={false}
        onReconsider={() => {}}
        spinningTitles={[]}
        animateOnMount={true}
      />,
    );
    expect(screen.getByText("Winner")).toBeInTheDocument();
  });

  it("cycles through spinning titles before settling on the winner when animateOnMount", () => {
    vi.useFakeTimers();
    try {
      render(
        <HeroCard
          winnerTitle="Winner"
          voterIds={[]}
          userInfoById={userInfoById}
          isHost={false}
          onReconsider={() => {}}
          spinningTitles={["Alpha", "Beta", "Winner"]}
          animateOnMount={true}
        />,
      );
      expect(screen.getByRole("heading")).toHaveTextContent(/Alpha|Beta|Winner/);
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByRole("heading")).toHaveTextContent("Winner");
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders the winner immediately when animateOnMount is false (late joiner)", () => {
    render(
      <HeroCard
        winnerTitle="Winner"
        voterIds={[]}
        userInfoById={userInfoById}
        isHost={false}
        onReconsider={() => {}}
        spinningTitles={["Alpha", "Beta", "Winner"]}
        animateOnMount={false}
      />,
    );
    // No spin even with multiple tied titles — late joiner sees winner directly.
    expect(screen.getByRole("heading")).toHaveTextContent("Winner");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/components/HeroCard.test.tsx`
Expected: FAIL — `spinningTitles` prop is unknown.

- [ ] **Step 3: Update `HeroCard` to accept `spinningTitles` and `animateOnMount`**

Replace the contents of `src/components/HeroCard.tsx`:

```tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AvatarStack, Button, Card } from "./ui";

type UserInfo = { name?: string; avatarUrl?: string };

const SPIN_TICK_MS = 140;
const SPIN_TOTAL_MS = 1200;

export function HeroCard({
  winnerTitle,
  voterIds,
  userInfoById,
  isHost,
  onReconsider,
  spinningTitles = [],
  animateOnMount = true,
}: {
  winnerTitle: string;
  voterIds: readonly string[];
  userInfoById: ReadonlyMap<string, UserInfo>;
  isHost: boolean;
  onReconsider: () => void;
  spinningTitles?: readonly string[];
  animateOnMount?: boolean;
}) {
  const shouldSpin = animateOnMount && spinningTitles.length > 1;
  const [tickIndex, setTickIndex] = useState(0);
  const [settled, setSettled] = useState(!shouldSpin);

  useEffect(() => {
    if (!shouldSpin) {
      setSettled(true);
      return;
    }
    setSettled(false);
    const tick = window.setInterval(() => {
      setTickIndex((i) => i + 1);
    }, SPIN_TICK_MS);
    const settle = window.setTimeout(() => {
      window.clearInterval(tick);
      setSettled(true);
    }, SPIN_TOTAL_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(settle);
    };
  }, [shouldSpin, spinningTitles]);

  const displayedTitle = settled
    ? winnerTitle
    : (spinningTitles[tickIndex % spinningTitles.length] ?? winnerTitle);

  // Skip Framer Motion enter animation for late joiners — the moment
  // already happened, mounting fresh shouldn't re-play it.
  const motionProps = animateOnMount
    ? {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { type: "spring" as const, stiffness: 220, damping: 24 },
      }
    : { initial: false as const };

  return (
    <motion.div {...motionProps}>
      <Card>
        <Card.Eyebrow>Tonight&apos;s pick</Card.Eyebrow>
        <Card.Body>
          <div className="rounded-md border border-accent/40 bg-accent/[0.04] p-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-2xl font-light tracking-tight text-text">
                  {displayedTitle}
                </h2>
                {settled ? (
                  <div className="mt-3">
                    <AvatarStack
                      userIds={voterIds}
                      userInfoById={userInfoById}
                      size="md"
                      max={5}
                      showCount
                      highlight
                    />
                  </div>
                ) : null}
              </div>
              {isHost && settled ? (
                <Button variant="secondary" size="sm" onClick={onReconsider}>
                  Reconsider
                </Button>
              ) : null}
            </div>
          </div>
        </Card.Body>
      </Card>
    </motion.div>
  );
}
```

Note: existing `isHost` and earlier render tests in Task 4 still pass because they don't supply `animateOnMount` and the default is `true`, with no `spinningTitles`. Re-run prior test cases to confirm.

- [ ] **Step 4: Pass `spinningTitles` and `animateOnMount` through SessionUI**

In `src/components/SessionUI.tsx`, track whether *this client* observed the voting → decided transition (vs. mounted into a `decided` room as a late joiner). Use state — not a derived value — so the flag stays stable for the entire decided phase and HeroCard doesn't see it flip mid-spin.

Add near the other hooks:

```tsx
const prevPhaseRef = useRef<ConsensusPhase | null>(null);
const [observedTransition, setObservedTransition] = useState(false);

useEffect(() => {
  if (
    prevPhaseRef.current === "voting" &&
    consensus.phase === "decided"
  ) {
    setObservedTransition(true);
  }
  if (consensus.phase === "voting") {
    // Reconsider returned the room to voting — clear so the next
    // decision can re-arm the animation gate cleanly.
    setObservedTransition(false);
  }
  prevPhaseRef.current = consensus.phase;
}, [consensus.phase]);
```

Add `useRef` to the React import, and `ConsensusPhase` to the type-only import from `../lib/liveblocks`.

Then derive the spinning titles from `consensus.tiedIds` and `candidates`. Replace the HeroCard render with:

```tsx
{consensus.phase === "decided" && consensus.winnerId ? (
  <HeroCard
    winnerTitle={
      candidates.find((c) => c.id === consensus.winnerId)?.title ??
      "(removed)"
    }
    voterIds={votes.get(consensus.winnerId) ?? EMPTY_VOTER_LIST}
    userInfoById={userInfoById}
    isHost={isHost}
    onReconsider={reconsider}
    spinningTitles={consensus.tiedIds.map(
      (id) => candidates.find((c) => c.id === id)?.title ?? "(removed)",
    )}
    animateOnMount={observedTransition}
  />
) : null}
```

Late joiners: `previousPhaseRef.current` is `null` on first render, so `observedTransition` is `false` — no spin, no slide-in. Connected clients that watched the transition: `previousPhaseRef.current` was `"voting"` on the previous render — `observedTransition` is `true`, and the spin/slide-in plays once. After the first post-transition render, `previousPhaseRef.current` becomes `"decided"` and the value falls back to `false`, but by then `HeroCard` is already mounted and has captured the prop.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/components/HeroCard.test.tsx`
Expected: PASS — all tests including spin tests.

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit and push**

```bash
git add src/components/HeroCard.tsx src/components/HeroCard.test.tsx src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Add tiebreaker spin animation cycling tied titles before settling

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 12: Verification, decisions log, CLAUDE.md update

**Files:**

- Modify: `decisions.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the full check pipeline**

Run: `pnpm check`
Expected: PASS (typecheck, lint, build, test all green).

If anything fails, fix before proceeding.

- [ ] **Step 2: Append decisions to `decisions.md`**

Append five entries to `decisions.md` (newest at bottom is the current convention). Use the existing entry format. Drub will refine the `Why` lines to match his voice during review.

```markdown
---

## 2026-05-09 — Consensus state model: storage-stored, CRDT-resolved

**Considered**: **Storage-stored** (a `consensus: LiveObject<...>` node in Liveblocks Storage; first client to detect threshold-cross writes the transition), **derived** (compute consensus state every render with no `phase` field), **server-authoritative** (Vercel function `/api/decide` runs the random pick and writes back via REST).

**Decision**: Storage-stored, CRDT-resolved.

**Why**: Two of the three options were ruled out by load-bearing requirements. Derived state breaks down on the random tiebreaker — each client running its own `Math.random()` would pick a different tied winner, and the convergence requires a single source of truth. A deterministic seed would kill the "chance picked" narrative. Server-authoritative adds a network round-trip to a moment that should feel instant, and the auth-function precedent doesn't extend — there's no security reason to centralize deciding. Storage-stored leverages Liveblocks' CRDT semantics that already power voting: simultaneous threshold-detections by multiple clients converge to a single committed state via last-writer-wins on the LiveObject.

**Tradeoff accepted**: The random tiebreaker is nondeterministic across replays. Acceptable because (a) the nondeterminism is the desired UX — "chance decided" — and (b) ephemeral sessions mean there is no replay scenario where the difference would surface.

**Would revisit if**: Persistence comes back (per the persistence "Would revisit if") and replay determinism becomes load-bearing for analytics or audit. At that point a server-side decider with a stored seed becomes the natural answer.

---

## 2026-05-09 — Threshold function: configurable per session

**Considered**: **Unanimous-only** (every present member must vote), **majority-only** (>50% of present), **first-to-N-only** (host-set target), **configurable per session** (host picks one of the three at session start).

**Decision**: Configurable per session.

**Why**: Real groups disagree about what "consensus" means. Couples watching a movie want unanimous; a friend group of six picking takeout doesn't want one holdout to deadlock dinner; a 4-watching-3-deciding scenario wants first-to-N. Hard-coding any one rule mismatches a meaningful share of sessions and would force users to work around the product. The cost is a small UI surface (a select + an N input for first-to-n) and a discriminated-union type — both well within the existing token system and tooling.

**Tradeoff accepted**: A small choice surface for the host at session start. Default of `unanimous` keeps the path of least resistance honest to the product's "we agree" framing.

**Would revisit if**: Real-user observation shows hosts never change the default (default-only would drop the surface) or always immediately switch (the default is wrong).

---

## 2026-05-09 — Tie handling: random pick with spin reveal

**Considered**: **All tied candidates win as a shortlist** (room agrees on a set, decides off-app), **tiebreaker round** (re-vote on the tied set), **random pick** (app rolls a die), **host breaks tie** (creator decides manually).

**Decision**: Random pick from the tied set, with a brief spin animation cycling through the tied candidates before settling on the winner.

**Why**: Approval voting makes ties the common case rather than the exception, so the rule has to be fast and reliably one-shot — it'll fire often. Shortlist pushes the decision back off-app, undoing the entire premise. A runoff round adds a heavier state machine (round 1 vs round 2) for what is supposed to be a friend-group casual experience. Host-as-arbiter elevates the host from "set the rule" to "decide the room's outcome," which changes the social shape of the product (peer-to-peer becomes top-down). Random pick is decisive, fast, and the spin animation makes the moment distinctive — the framing "the room agreed; chance picked" is more interesting than "majority won."

**Tradeoff accepted**: Some users will dislike randomness as a deciding mechanism. Accepted because it preserves the egalitarian feel and makes a memorable UX moment that "majority wins" would not.

**Would revisit if**: User feedback shows the random moment feels unfair or buggy ("the wheel was rigged"), or if tie incidence is much lower than expected (in which case a heavier runoff might be tolerable for the rare case).

---

## 2026-05-09 — Lifecycle: lock + reconsider

**Considered**: **Live tally only** (threshold-crossing is a UI flourish; tally stays live), **terminal lock** (threshold-crossing freezes the room, no un-decide), **lock + reconsider** (threshold-crossing locks; host can press a button to unlock).

**Decision**: Lock + reconsider. Reconsider clears all votes and returns to the voting phase.

**Why**: Live-only weakens the "we decided" beat to nothing — no narrative, no closure, just a banner. Terminal lock has the strongest moment but no recovery path: a single misclick or premature crossing means starting a brand-new session. Lock + reconsider gives the moment real weight (votes pause, hero card slides in, the room recognizes the outcome) while preserving an escape hatch. Clearing all votes on reconsider — rather than just the winner's votes — sidesteps the no-op-loop where the same threshold instantly re-crosses; it also matches the natural mental model "let's vote again."

**Tradeoff accepted**: A single host can repeatedly reconsider, which in a hostile group could become a grief vector. Accepted because the intended use case is friend groups, not strangers, and the CLAUDE.md "Auth scope: Resonance users only" decision already pre-screens for that.

**Would revisit if**: Sessions stretch to larger or less-trusted groups where reconsider needs a quorum, or if real-user testing shows the moment feels too easily undone.

---

## 2026-05-09 — Authority: room creator is host

**Considered**: **Anyone (peer-to-peer)** (any member configures rule and triggers reconsider), **room creator is host** (whoever opened the session has those powers; migrates to longest-connected member if they drop), **anyone configures, majority reconsiders** (asymmetric: open rule-setting, quorum-gated unlock).

**Decision**: Room creator is host. Migration on disconnect is automatic to the longest-connected remaining member.

**Why**: The product is fundamentally peer-to-peer in spirit — voting itself is fully symmetric. But two operations need a single decider: setting the threshold rule, and unlocking after consensus. Both are "configure the room" gestures, not "express my preference" gestures, so attaching them to a single role is natural. Creator-is-host has the cleanest mental model — "the person who started this is steering" — and avoids an explicit role-assignment flow. Migration to longest-connected uses Liveblocks' monotonically-increasing connectionId, so all clients pick the same successor without coordination.

**Tradeoff accepted**: A host who drops loses their role even if they intended to come back. Accepted because the alternative — preserving host across disconnects — would require persistence and explicit reclaim flows, neither of which fit MVP scope.

**Would revisit if**: We add explicit host-transfer UX (give the role to X), or if drub's friend-group testing shows host migration on disconnect feels disorienting.
```

- [ ] **Step 3: Update `CLAUDE.md` build steps and current state**

In `CLAUDE.md`:

Find the `## Current state` section. Update the "Phase" line and "Next step" line to reflect that step 7 is shipped:

```markdown
**Phase**: Consensus flow shipped. Configurable threshold (unanimous / majority / first-to-N), random tiebreaker with spin animation, lock + reconsider lifecycle, room-creator host with migration. Visual system and approval voting still live underneath.
```

```markdown
**Next step**: Mobile breakpoints and polish (build step 8). Responsive layout, empty states, edge cases.
```

In the `## Build steps` section, flip step 7 to ✅ and update step 8 to "← here":

```markdown
7. **Consensus flow**: ✅ configurable threshold, random tiebreaker, lock + reconsider, hero card reveal.
8. **Mobile breakpoints + polish**: ← here. Responsive layout, empty states, edge cases.
9. **Deploy + real-user test**: ship to Vercel, run it with a friend.
```

Also extend the "Architectural decisions locked" list with five new entries (12–16):

```markdown
13. Consensus state model: storage-stored, CRDT-resolved.
14. Threshold function: configurable per session (unanimous / majority / first-to-N).
15. Tie handling: random pick with spin reveal.
16. Lifecycle: lock + reconsider, votes cleared on reconsider.
17. Authority: room creator is host, migrates to longest-connected on drop.
```

- [ ] **Step 4: Run the check pipeline once more**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add decisions.md CLAUDE.md
git commit -m "$(cat <<'EOF'
Log consensus-flow decisions and update build state

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 6: Manual verification (drub-driven, post-deploy)**

Vercel auto-deploys from main. Once deployed:

1. Open two browser windows in different profiles, both signed into Resonance.
2. Window A: create a session, observe `Threshold: Unanimous` rule-picker visible only to A.
3. Window B: join the session via room code. Observe rule-picker as read-only.
4. Both windows: add candidates, vote on candidates. Observe live tally.
5. Both windows vote for the same candidate. Observe hero card slide-in.
6. Window A: press Reconsider. Observe votes cleared, voting resumes.
7. Switch threshold to "Majority" in Window A. Vote 2/2 for one candidate. Observe winner.
8. Reconsider, switch to "First to 2", and observe winner at 2 votes.
9. Vote tie scenario: switch to unanimous, both vote for two candidates each. Observe spin → settle.
10. Window A closes the tab. Window B observes host migration (rule-picker becomes editable).

---

## Notes

- **No e2e tests:** The existing test infrastructure does not cover Liveblocks integration. Adding Liveblocks mocks for SessionUI integration tests is out of scope per the spec. Verification is manual two-browser testing post-deploy.
- **Liveblocks CRDT race tolerance:** Several mutations (`lockConsensus`, `setHost`) are written defensively as idempotent so concurrent writes converge cleanly. This is the same shape as `castVote` already.
- **Math.random in tests:** The two tied-pick tests in `consensus.test.ts` stub `Math.random` via `vi.spyOn`. No production code path exposes the random source for swap-out — keeping it inline matches the rest of the codebase.
- **Spec cross-reference:** Each task header in this plan can be matched back to a spec section. If a task feels unmotivated, re-read the linked section in `docs/superpowers/specs/2026-05-09-consensus-flow-design.md`.
