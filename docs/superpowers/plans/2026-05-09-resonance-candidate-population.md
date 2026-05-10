# Resonance candidate population implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land build step 7.5: per-user "Pull from my Resonance" button that contributes a hybrid (library + recommendations) slice to the shared candidate pool, with multi-attribution dedup, type/year metadata, and host-configurable pull volume. Backed by the spec at `docs/superpowers/specs/2026-05-09-resonance-candidate-population-design.md`.

**Architecture:** Widen `/profile/export` consumption on the client to include `library` and `recommendations` arrays. New pure `pickCandidates` function slices a hybrid set on the client. New `pullCandidates` mutation pushes deduped items into Liveblocks, appending the puller's id to `addedBy` for matching titles. Storage shape changes: `Candidate.addedBy: string` becomes `LiveList<string>` for CRDT-safe concurrent appends; new `Candidate.type` and `Candidate.year` fields; new `Consensus.candidatesPerPull` host-controlled field.

**Tech Stack:** Vite + React 19 + TypeScript, Liveblocks (`@liveblocks/react/suspense`), Tailwind v4, Vitest + happy-dom + RTL, Clerk for the bearer token.

**Test commands:** `pnpm test` (single run), `pnpm test:watch` (TDD loop), `pnpm typecheck`, `pnpm check` (full pre-merge gate).

**Commit cadence:** Per drub's project memory, commit AND push at every meaningful checkpoint. Each task ends with a commit + push.

---

## Spec assumption to verify

The plan assumes Resonance's `/profile/export` returns `library: [...]` and `recommendations: [...]` arrays where each item has `{title, type?, year?}`, ranked best-first. If the actual shape differs, Task 1 widens the adapter to normalize. If the fields don't yet exist on Resonance, that's a Resonance-side additive PR that blocks Task 1 only; the rest of the plan can proceed with mocked data and a TODO for the real wiring.

## Spec ambiguity resolved inline

The spec line "The avatars now reflect ALL pullers/adders (the new `addedBy` list)" has two readings against today's UI, where the row's `AvatarStack` shows VOTERS:

- **(a)** Replace voters with pullers in the row's `AvatarStack` (loses live vote-tally avatars).
- **(b)** Add pullers as a small caption under the title; voters keep the `AvatarStack` on the right (preserves the live tally social moment).

This plan implements **(b)**. Interpretation (a) is a one-task swap (Task 9 attribution rendering), so flip if you want during plan review.

## File map

**Created:**

- `src/lib/candidates.ts`: `pickCandidates`, `normalizeTitle`, related types. No Liveblocks dependency.
- `src/lib/candidates.test.ts`: unit tests for the pure functions.

**Modified:**

- `src/types/profile.ts`: widen `ResonanceProfileSnapshot` with `library` and `recommendations`.
- `src/lib/api.ts`: widen `RawProfileExport` and `fetchMyProfile` to read those fields.
- `src/hooks/useResonanceProfile.ts`: types only; the hook already returns whatever `fetchMyProfile` returns.
- `src/lib/liveblocks.ts`: `Candidate` gains `type`, `year`, `addedBy: LiveList<string>`; `Consensus` gains `candidatesPerPull: number`.
- `src/routes/Session.tsx`: initialize `candidatesPerPull: 5` in the consensus default.
- `src/components/SessionUI.tsx`: update `addCandidate` (new shape + dedup), add `pullCandidates` and `setCandidatesPerPull` mutations, add Pull button to `CandidatesPanel`, refresh `CandidateRow` rendering with type/year and pullers caption.
- `src/components/ThresholdPicker.tsx` + `ThresholdPicker.test.tsx`: extend with the host-only items-per-pull control.
- `decisions.md`: append four decisions from the spec.
- `CLAUDE.md`: flip build step 7.5 to ✅, advance the "current state" line, append new decisions to the locked list.

---

## Task 1: Widen Resonance profile types

**Files:**

- Modify: `src/types/profile.ts`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Widen the snapshot type**

Replace the contents of `/Users/drub/repos/Ensemble/src/types/profile.ts` with:

```ts
// Narrow client-side mirror of Resonance's TasteProfile shape. Widened
// in the Resonance candidate population pass to expose library and
// recommendations alongside themes and archetypes.

export interface TasteTheme {
  label: string;
  weight: number;
}

export interface TasteArchetype {
  label: string;
}

export interface ResonanceItem {
  title: string;
  type?: string;
  year?: number;
}

export interface ResonanceProfileSnapshot {
  themes: TasteTheme[];
  archetypes: TasteArchetype[];
  library: ResonanceItem[];
  recommendations: ResonanceItem[];
}
```

- [ ] **Step 2: Widen the API adapter**

Replace the contents of `/Users/drub/repos/Ensemble/src/lib/api.ts` with:

```ts
import type {
  ResonanceItem,
  ResonanceProfileSnapshot,
} from "../types/profile";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getApiBase(): string {
  return import.meta.env.VITE_RESONANCE_API_URL ?? "";
}

interface RawProfileItem {
  title?: unknown;
  type?: unknown;
  year?: unknown;
}

interface RawProfileExport {
  profile: {
    themes: { label: string; weight: number }[];
    archetypes: { label: string }[];
    library?: RawProfileItem[];
    recommendations?: RawProfileItem[];
  };
}

export async function fetchMyProfile(
  token: string,
): Promise<ResonanceProfileSnapshot> {
  const apiBase = getApiBase();
  if (!apiBase) {
    throw new ApiError("VITE_RESONANCE_API_URL is not configured", 0);
  }
  const res = await fetch(`${apiBase}/api/profile/export`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    let message = `Resonance API returned ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // body wasn't JSON; keep the default
    }
    throw new ApiError(message, res.status);
  }
  const raw = (await res.json()) as RawProfileExport;
  return {
    themes: raw.profile.themes.map((t) => ({
      label: t.label,
      weight: t.weight,
    })),
    archetypes: raw.profile.archetypes.map((a) => ({ label: a.label })),
    library: normalizeItems(raw.profile.library),
    recommendations: normalizeItems(raw.profile.recommendations),
  };
}

function normalizeItems(raw: RawProfileItem[] | undefined): ResonanceItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ResonanceItem[] = [];
  for (const item of raw) {
    if (typeof item?.title !== "string") continue;
    out.push({
      title: item.title,
      type: typeof item.type === "string" ? item.type : undefined,
      year: typeof item.year === "number" ? item.year : undefined,
    });
  }
  return out;
}
```

The adapter tolerates absent fields and unexpected types: missing `library` or `recommendations` becomes `[]`; items missing `title` are dropped; non-string `type` and non-number `year` become `undefined`. This means a Resonance that hasn't been updated to expose these fields yet won't crash Ensemble; pulls just yield zero candidates with a clear UI signal (handled in Task 9).

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS, `useResonanceProfile.ts` re-exports the widened type without change because it just returns `ResonanceProfileSnapshot`.

- [ ] **Step 4: Commit and push**

```bash
git add src/types/profile.ts src/lib/api.ts
git commit -m "$(cat <<'EOF'
Widen Resonance profile snapshot to include library and recommendations

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 2: Pure `pickCandidates` and `normalizeTitle` (TDD)

**Files:**

- Create: `src/lib/candidates.ts`
- Create: `src/lib/candidates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/drub/repos/Ensemble/src/lib/candidates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickCandidates, normalizeTitle } from "./candidates";
import type { ResonanceItem } from "../types/profile";

function lib(...titles: string[]): ResonanceItem[] {
  return titles.map((t) => ({ title: t, type: "movie", year: 2024 }));
}

function recs(...titles: string[]): ResonanceItem[] {
  return titles.map((t) => ({ title: t, type: "show", year: 2023 }));
}

describe("pickCandidates", () => {
  it("returns empty when count is 0", () => {
    expect(pickCandidates({ library: lib("a"), recommendations: recs("b") }, 0)).toEqual([]);
  });

  it("returns empty when both slices are empty", () => {
    expect(pickCandidates({ library: [], recommendations: [] }, 5)).toEqual([]);
  });

  it("clamps count above 20 to 20", () => {
    const big = lib(...Array.from({ length: 30 }, (_, i) => `lib${i}`));
    const result = pickCandidates({ library: big, recommendations: [] }, 100);
    expect(result.length).toBe(20);
  });

  it("default split: 5 items = 3 library + 2 recs", () => {
    const result = pickCandidates(
      {
        library: lib("L1", "L2", "L3", "L4", "L5"),
        recommendations: recs("R1", "R2", "R3", "R4", "R5"),
      },
      5,
    );
    expect(result.map((p) => p.title)).toEqual(["L1", "L2", "L3", "R1", "R2"]);
  });

  it("backfills from recs when library is short", () => {
    const result = pickCandidates(
      {
        library: lib("L1"),
        recommendations: recs("R1", "R2", "R3", "R4", "R5"),
      },
      5,
    );
    // Expected: 1 library + 2 recs (the planned share) + 2 recs backfill
    expect(result.length).toBe(5);
    expect(result.map((p) => p.title)).toContain("L1");
    expect(result.map((p) => p.title)).toContain("R1");
  });

  it("backfills from library when recs is short", () => {
    const result = pickCandidates(
      {
        library: lib("L1", "L2", "L3", "L4", "L5"),
        recommendations: recs("R1"),
      },
      5,
    );
    expect(result.length).toBe(5);
    expect(result.map((p) => p.title)).toContain("R1");
  });

  it("returns total available when both sides cannot meet count", () => {
    const result = pickCandidates(
      { library: lib("L1"), recommendations: recs("R1") },
      5,
    );
    expect(result.length).toBe(2);
  });

  it("preserves type when known", () => {
    const result = pickCandidates(
      {
        library: [{ title: "Dune", type: "movie", year: 2024 }],
        recommendations: [],
      },
      1,
    );
    expect(result[0]).toEqual({ title: "Dune", type: "movie", year: 2024 });
  });

  it("normalizes unknown type to 'unknown'", () => {
    const result = pickCandidates(
      {
        library: [{ title: "Mystery", type: "videogame", year: 2024 }],
        recommendations: [],
      },
      1,
    );
    expect(result[0].type).toBe("unknown");
  });

  it("missing type or year produces 'unknown' / null", () => {
    const result = pickCandidates(
      {
        library: [{ title: "Bare" }],
        recommendations: [],
      },
      1,
    );
    expect(result[0]).toEqual({ title: "Bare", type: "unknown", year: null });
  });

  it("type comparison is case-insensitive", () => {
    const result = pickCandidates(
      {
        library: [{ title: "X", type: "MOVIE", year: 2024 }],
        recommendations: [],
      },
      1,
    );
    expect(result[0].type).toBe("movie");
  });
});

describe("normalizeTitle", () => {
  it("lowercases", () => {
    expect(normalizeTitle("Dune Part Two")).toBe("dune part two");
  });

  it("trims", () => {
    expect(normalizeTitle("  Dune  ")).toBe("dune");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeTitle("Dune   Part    Two")).toBe("dune part two");
  });

  it("treats different casings and spacings as the same", () => {
    expect(normalizeTitle("DUNE Part   Two ")).toBe(normalizeTitle("dune part two"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/candidates.test.ts`
Expected: FAIL, `Cannot find module './candidates'`.

- [ ] **Step 3: Implement `candidates.ts`**

Create `/Users/drub/repos/Ensemble/src/lib/candidates.ts`:

```ts
import type { ResonanceItem } from "../types/profile";

export type CandidateType =
  | "movie"
  | "show"
  | "book"
  | "game"
  | "music"
  | "podcast"
  | "unknown";

export type PickedCandidate = {
  title: string;
  type: CandidateType;
  year: number | null;
};

const LIBRARY_SHARE = 0.6;
const MAX_COUNT = 20;

// Slice a hybrid candidate set from a Resonance profile snapshot.
// Default split is library-weighted (LIBRARY_SHARE = 0.6); short sides
// backfill from the other to honor the requested count when possible.
export function pickCandidates(
  profile: {
    readonly library: readonly ResonanceItem[];
    readonly recommendations: readonly ResonanceItem[];
  },
  count: number,
): PickedCandidate[] {
  const target = Math.max(0, Math.min(count, MAX_COUNT));
  if (target === 0) return [];

  const libraryShare = Math.ceil(target * LIBRARY_SHARE);
  const recsShare = target - libraryShare;

  const libraryHead = profile.library.slice(0, libraryShare);
  const recsHead = profile.recommendations.slice(0, recsShare);

  const libraryShortBy = libraryShare - libraryHead.length;
  const recsBackfill =
    libraryShortBy > 0
      ? profile.recommendations.slice(recsShare, recsShare + libraryShortBy)
      : [];

  const recsShortBy = recsShare - recsHead.length;
  const libraryBackfill =
    recsShortBy > 0
      ? profile.library.slice(libraryShare, libraryShare + recsShortBy)
      : [];

  const merged = [
    ...libraryHead,
    ...recsBackfill,
    ...recsHead,
    ...libraryBackfill,
  ];
  return merged.map(normalize);
}

function normalize(item: ResonanceItem): PickedCandidate {
  return {
    title: item.title,
    type: parseType(item.type),
    year: typeof item.year === "number" ? item.year : null,
  };
}

function parseType(raw: string | undefined): CandidateType {
  switch (raw?.toLowerCase()) {
    case "movie":
    case "show":
    case "book":
    case "game":
    case "music":
    case "podcast":
      return raw.toLowerCase() as CandidateType;
    default:
      return "unknown";
  }
}

// Collapse a title to a comparison-friendly form so dedup against
// existing candidates doesn't fail on case or whitespace differences.
export function normalizeTitle(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/candidates.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit and push**

```bash
git add src/lib/candidates.ts src/lib/candidates.test.ts
git commit -m "$(cat <<'EOF'
Add pickCandidates hybrid slicer and normalizeTitle

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 3: Widen storage types

**Files:**

- Modify: `src/lib/liveblocks.ts`

- [ ] **Step 1: Replace the file with the widened types**

Replace `/Users/drub/repos/Ensemble/src/lib/liveblocks.ts` with:

```ts
import type {
  LiveList,
  LiveMap,
  LiveObject,
  Lson,
} from "@liveblocks/client";
import type { CandidateType } from "./candidates";

// Re-export so consumers that work with storage shapes can import
// CandidateType from this module without reaching into ./candidates.
export type { CandidateType } from "./candidates";

export type Candidate = {
  id: string;
  title: string;
  type: CandidateType;
  year: number | null;
  addedBy: LiveList<string>;
  addedAt: number;
  // Widened from string | number to satisfy LsonObject now that the
  // type holds a Live* node (addedBy) and nullable primitives (year).
  // Mirrors the index signature on Consensus.
  [key: string]: Lson | undefined;
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
  candidatesPerPull: number;
  [key: string]: Lson | undefined;
};

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

- [ ] **Step 2: Verify typecheck (expected partial fail)**

Run: `pnpm typecheck`
Expected: FAIL at `src/routes/Session.tsx` (missing `candidatesPerPull` in initialStorage) and `src/components/SessionUI.tsx` (the existing `addCandidate` mutation writes `addedBy: user?.id ?? "unknown"`, which is a string, not a `LiveList<string>`). Both fixed in subsequent tasks.

`liveblocks.ts` itself should compile cleanly.

- [ ] **Step 3: Commit and push**

```bash
git add src/lib/liveblocks.ts
git commit -m "$(cat <<'EOF'
Widen Candidate with type and year, change addedBy to LiveList; add Consensus.candidatesPerPull

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 4: Initialize `candidatesPerPull` in `Session.tsx`

**Files:**

- Modify: `src/routes/Session.tsx`

- [ ] **Step 1: Add `candidatesPerPull: 5` to the consensus init**

In `/Users/drub/repos/Ensemble/src/routes/Session.tsx`, update the `consensus: new LiveObject({ ... })` block in `initialStorage` to add the new field:

```tsx
consensus: new LiveObject({
  hostId: user?.id ?? "",
  threshold: { kind: "unanimous" as const },
  phase: "voting" as const,
  winnerId: null,
  tiedIds: [],
  decidedAt: null,
  candidatesPerPull: 5,
}),
```

- [ ] **Step 2: Verify typecheck (still partial fail expected)**

Run: `pnpm typecheck`
Expected: FAIL only at `src/components/SessionUI.tsx` now (`addCandidate` still writes wrong shape). Session.tsx error from Task 3 is resolved. Continue to Task 5.

- [ ] **Step 3: Commit and push**

```bash
git add src/routes/Session.tsx
git commit -m "$(cat <<'EOF'
Initialize Consensus.candidatesPerPull to 5

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 5: Update `addCandidate` mutation for new shape and dedup

**Files:**

- Modify: `src/components/SessionUI.tsx`

- [ ] **Step 1: Add the dedup helper import**

At the top of `/Users/drub/repos/Ensemble/src/components/SessionUI.tsx`, change the existing `lib/candidates` and `lib/liveblocks` imports to include the new types:

```tsx
import type { Candidate, ConsensusPhase, ThresholdRule } from "../lib/liveblocks";
import { evaluate } from "../lib/consensus";
import { normalizeTitle, type PickedCandidate } from "../lib/candidates";
```

(Add `normalizeTitle` and `PickedCandidate` from `../lib/candidates`. The `evaluate` and existing imports stay.)

- [ ] **Step 2: Update `addCandidate` to use the new shape and dedup logic**

Find the existing `addCandidate` mutation. Replace its full body with:

```tsx
const addCandidate = useMutation(
  ({ storage, self }, title: string) => {
    if (storage.get("consensus").get("phase") !== "voting") return;
    const cleanedTitle = title.trim();
    if (!cleanedTitle) return;
    const list = storage.get("candidates");
    const normalized = normalizeTitle(cleanedTitle);
    // Dedup: append puller to addedBy if title already present.
    for (let i = 0; i < list.length; i++) {
      const existing = list.get(i);
      if (!existing) continue;
      if (normalizeTitle(existing.get("title")) !== normalized) continue;
      const addedBy = existing.get("addedBy");
      let alreadyAttributed = false;
      for (let j = 0; j < addedBy.length; j++) {
        if (addedBy.get(j) === self.id) {
          alreadyAttributed = true;
          break;
        }
      }
      if (!alreadyAttributed) addedBy.push(self.id);
      return;
    }
    list.push(
      new LiveObject<Candidate>({
        id: crypto.randomUUID(),
        title: cleanedTitle,
        type: "unknown",
        year: null,
        addedBy: new LiveList([self.id]),
        addedAt: Date.now(),
      }),
    );
  },
  [],
);
```

Note: removed the `[user?.id]` dep array because the mutation now uses `self.id` from Liveblocks's `useMutation` context, which is stable. The dependency removal is intentional.

- [ ] **Step 3: Verify typecheck**

Run: `pnpm typecheck`
Expected: PASS for the project. The remaining TS errors from Task 3 should be resolved.

If `pnpm typecheck` still flags errors related to `addedBy` or `candidate.addedBy` reads in `CandidateRow` or elsewhere, those are deferred to Task 9. Check the error locations: only `SessionUI.tsx` should still have errors at this point, and only in the `CandidateRow` rendering path that touches `voterIds` or similar (which uses `votes`, not `addedBy`). If `CandidateRow` doesn't read `addedBy` today, no Task 9 fix needed at the type level. Confirm by reading the file before assuming.

- [ ] **Step 4: Run existing tests**

Run: `pnpm test`
Expected: PASS, 54 tests still green. The shape change to `addCandidate` doesn't break any test surface today because no test uses `addCandidate` directly.

- [ ] **Step 5: Commit and push**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Update addCandidate to write new candidate shape with dedup

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 6: Add `pullCandidates` mutation

**Files:**

- Modify: `src/components/SessionUI.tsx`

- [ ] **Step 1: Add the pullCandidates mutation**

In `/Users/drub/repos/Ensemble/src/components/SessionUI.tsx`, find the existing `addCandidate` mutation. Add the new `pullCandidates` mutation immediately below it:

```tsx
const pullCandidates = useMutation(
  ({ storage, self }, picked: readonly PickedCandidate[]) => {
    if (storage.get("consensus").get("phase") !== "voting") return;
    const list = storage.get("candidates");
    for (const pick of picked) {
      const normalized = normalizeTitle(pick.title);
      let merged = false;
      for (let i = 0; i < list.length; i++) {
        const existing = list.get(i);
        if (!existing) continue;
        if (normalizeTitle(existing.get("title")) !== normalized) continue;
        const addedBy = existing.get("addedBy");
        let alreadyAttributed = false;
        for (let j = 0; j < addedBy.length; j++) {
          if (addedBy.get(j) === self.id) {
            alreadyAttributed = true;
            break;
          }
        }
        if (!alreadyAttributed) addedBy.push(self.id);
        merged = true;
        break;
      }
      if (merged) continue;
      list.push(
        new LiveObject<Candidate>({
          id: crypto.randomUUID(),
          title: pick.title,
          type: pick.type,
          year: pick.year,
          addedBy: new LiveList([self.id]),
          addedAt: Date.now(),
        }),
      );
    }
  },
  [],
);
```

- [ ] **Step 2: Verify typecheck and tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS, 54 tests still green.

- [ ] **Step 3: Commit and push**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Add pullCandidates mutation that dedups picks against existing list

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 7: Add `setCandidatesPerPull` mutation

**Files:**

- Modify: `src/components/SessionUI.tsx`

- [ ] **Step 1: Add the host-only mutation**

In `/Users/drub/repos/Ensemble/src/components/SessionUI.tsx`, find the `setThreshold` mutation. Add immediately below it:

```tsx
const setCandidatesPerPull = useMutation(({ storage, self }, n: number) => {
  const c = storage.get("consensus");
  if (self.id !== c.get("hostId")) return;
  if (c.get("phase") !== "voting") return;
  if (!Number.isFinite(n)) return;
  const clamped = Math.max(1, Math.min(20, Math.floor(n)));
  c.set("candidatesPerPull", clamped);
}, []);
```

- [ ] **Step 2: Verify typecheck and tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 3: Commit and push**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Add host-only setCandidatesPerPull mutation with 1-20 clamp

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 8: Extend `ThresholdPicker` with items-per-pull control

**Files:**

- Modify: `src/components/ThresholdPicker.tsx`
- Modify: `src/components/ThresholdPicker.test.tsx`

- [ ] **Step 1: Write failing tests for the new control**

In `/Users/drub/repos/Ensemble/src/components/ThresholdPicker.test.tsx`, append a new `describe` block at the bottom (do not modify existing tests):

```tsx
describe("ThresholdPicker items-per-pull", () => {
  it("renders the items-per-pull input only for the host", () => {
    const { rerender } = render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={false}
        presentCount={3}
        onChange={() => {}}
        candidatesPerPull={5}
        onCandidatesPerPullChange={() => {}}
      />,
    );
    expect(screen.queryByLabelText(/items per pull/i)).not.toBeInTheDocument();

    rerender(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={true}
        presentCount={3}
        onChange={() => {}}
        candidatesPerPull={5}
        onCandidatesPerPullChange={() => {}}
      />,
    );
    expect(screen.getByLabelText(/items per pull/i)).toBeInTheDocument();
  });

  it("emits onCandidatesPerPullChange with the new value", async () => {
    const onCandidatesPerPullChange = vi.fn<(n: number) => void>();
    render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={true}
        presentCount={3}
        onChange={() => {}}
        candidatesPerPull={5}
        onCandidatesPerPullChange={onCandidatesPerPullChange}
      />,
    );
    const input = screen.getByLabelText(/items per pull/i);
    await userEvent.clear(input);
    await userEvent.type(input, "8");
    // Final emission should have value 8 (each keystroke fires for controlled inputs).
    const lastCall =
      onCandidatesPerPullChange.mock.calls[
        onCandidatesPerPullChange.mock.calls.length - 1
      ];
    expect(lastCall?.[0]).toBe(8);
  });

  it("shows read-only items-per-pull text for non-hosts", () => {
    render(
      <ThresholdPicker
        threshold={{ kind: "unanimous" }}
        isHost={false}
        presentCount={3}
        onChange={() => {}}
        candidatesPerPull={7}
        onCandidatesPerPullChange={() => {}}
      />,
    );
    expect(screen.getByText(/items per pull: 7/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/components/ThresholdPicker.test.tsx`
Expected: FAIL, new props (`candidatesPerPull`, `onCandidatesPerPullChange`) don't exist on the component.

- [ ] **Step 3: Update `ThresholdPicker` to accept the new props**

Replace the contents of `/Users/drub/repos/Ensemble/src/components/ThresholdPicker.tsx` with:

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
  candidatesPerPull,
  onCandidatesPerPullChange,
}: {
  threshold: ThresholdRule;
  isHost: boolean;
  presentCount: number;
  onChange: (rule: ThresholdRule) => void;
  candidatesPerPull: number;
  onCandidatesPerPullChange: (n: number) => void;
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

  function handlePerPullChange(value: number) {
    if (Number.isFinite(value)) {
      onCandidatesPerPullChange(Math.floor(value));
    }
  }

  const showWarning =
    threshold.kind === "first-to-n" && threshold.n > presentCount;

  return (
    <Card>
      <Card.Eyebrow>Threshold</Card.Eyebrow>
      <Card.Body>
        <div className="space-y-3 text-sm text-text">
          <div className="flex flex-wrap items-center gap-3">
            {isHost ? (
              <>
                <select
                  aria-label="Threshold rule"
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
                N greater than present count: threshold cannot be reached yet.
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-text-muted">
            {isHost ? (
              <label className="flex items-center gap-2">
                Items per pull:
                <input
                  aria-label="Items per pull"
                  type="number"
                  min={1}
                  max={20}
                  value={candidatesPerPull}
                  onChange={(e) => handlePerPullChange(Number(e.target.value))}
                  className="w-16 rounded-md border border-border bg-transparent px-2 py-1 text-text focus:border-border-strong focus:outline-none"
                />
              </label>
            ) : (
              <span>Items per pull: {candidatesPerPull}</span>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
```

- [ ] **Step 4: Update the call site in `SessionUI.tsx`**

In `/Users/drub/repos/Ensemble/src/components/SessionUI.tsx`, find the existing `<ThresholdPicker ... />` render. Update its props to pass the new ones:

```tsx
<ThresholdPicker
  threshold={consensus.threshold as ThresholdRule}
  isHost={isHost}
  presentCount={presentMemberIds.size}
  onChange={setThreshold}
  candidatesPerPull={consensus.candidatesPerPull}
  onCandidatesPerPullChange={setCandidatesPerPull}
/>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/components/ThresholdPicker.test.tsx`
Expected: PASS, all 8 tests (5 original + 3 new).

Run: `pnpm typecheck && pnpm test`
Expected: PASS, full project green.

- [ ] **Step 6: Commit and push**

```bash
git add src/components/ThresholdPicker.tsx src/components/ThresholdPicker.test.tsx src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Extend ThresholdPicker with host-only items-per-pull control

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 9: Add Pull button and refresh CandidateRow

**Files:**

- Modify: `src/components/SessionUI.tsx`

This task is the largest single SessionUI edit. It touches three concerns: the Pull button (with profile-state-aware UI), the `CandidateRow` rendering (type · year suffix + pullers caption), and the `CandidatesPanel` plumbing for both.

- [ ] **Step 1: Add helper imports and the profile hook in SessionUI**

In `/Users/drub/repos/Ensemble/src/components/SessionUI.tsx`, ensure these imports are present:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useResonanceProfile } from "../hooks/useResonanceProfile";
import { pickCandidates } from "../lib/candidates";
```

(Add `useResonanceProfile` and `pickCandidates`. The other imports likely already exist.)

Inside the `SessionUI` component body, near the top with the other hooks, add:

```tsx
const profile = useResonanceProfile();
```

- [ ] **Step 2: Add a derived map of candidate pullers**

Below `userInfoById` (or wherever the existing memos live), add:

```tsx
const pullersByCandidateId = useMemo(() => {
  const map = new Map<string, readonly string[]>();
  for (const c of candidates) {
    const ids = c.addedBy as unknown as readonly string[];
    map.set(c.id, ids);
  }
  return map;
}, [candidates]);
```

The `as unknown as readonly string[]` cast is because Liveblocks' `useStorage` selector flattens `LiveList<string>` to a `readonly string[]` at read time, but the type signature of `Candidate` declares it as `LiveList<string>`. This is the same pattern Liveblocks recommends for read-side projections.

- [ ] **Step 3: Add the pull-action helper inside SessionUI**

Just below `pullCandidates` mutation (added in Task 6), add a state-aware wrapper that the button will call:

```tsx
const [pulling, setPulling] = useState(false);

const handlePull = async () => {
  if (profile.state !== "ready") return;
  if (consensus.phase !== "voting") return;
  setPulling(true);
  try {
    const picks = pickCandidates(profile.data, consensus.candidatesPerPull);
    if (picks.length > 0) pullCandidates(picks);
  } finally {
    setPulling(false);
  }
};
```

The wrapper handles the disabled gating in the UI; the mutation itself remains a pure storage write.

- [ ] **Step 4: Update `CandidatesPanel` to accept Pull props and render the button**

Find `CandidatesPanel`'s prop type and signature. Update:

```tsx
function CandidatesPanel({
  candidates,
  votes,
  userInfoById,
  votedCandidateIds,
  pullersByCandidateId,
  locked,
  pullState,
  onAdd,
  onRemove,
  onVote,
  onUnvote,
  onPull,
}: {
  candidates: readonly { readonly id: string; readonly title: string; readonly type: string; readonly year: number | null }[];
  votes: ReadonlyMap<string, readonly string[]>;
  userInfoById: ReadonlyMap<string, UserInfo>;
  votedCandidateIds: ReadonlySet<string>;
  pullersByCandidateId: ReadonlyMap<string, readonly string[]>;
  locked: boolean;
  pullState:
    | { kind: "ready"; pulling: boolean }
    | { kind: "no-profile" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "idle" };
  onAdd: (title: string) => void;
  onRemove: (id: string) => void;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  onPull: () => void;
}) {
  // ... existing useState for draft ...
  // ... existing submit handler ...
  return (
    <Card>
      <Card.Eyebrow count={candidates.length}>Candidates</Card.Eyebrow>
      <Card.Body>
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a title…"
            maxLength={120}
            disabled={locked}
            className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:border-border-strong focus:outline-none"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={locked || !draft.trim()}
          >
            Add
          </Button>
        </form>

        <PullControl locked={locked} pullState={pullState} onPull={onPull} />

        {candidates.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">
            No candidates yet. Add the first one or pull from your Resonance.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {candidates.map((c) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                voterIds={votes.get(c.id) ?? EMPTY_VOTER_LIST}
                pullerIds={pullersByCandidateId.get(c.id) ?? EMPTY_VOTER_LIST}
                userInfoById={userInfoById}
                voted={votedCandidateIds.has(c.id)}
                locked={locked}
                onVote={onVote}
                onUnvote={onUnvote}
                onRemove={onRemove}
              />
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}
```

The empty-state message gains "or pull from your Resonance" as a UI nudge.

- [ ] **Step 5: Add the `PullControl` subcomponent**

In the same file, just above or below `CandidatesPanel`, add:

```tsx
function PullControl({
  locked,
  pullState,
  onPull,
}: {
  locked: boolean;
  pullState:
    | { kind: "ready"; pulling: boolean }
    | { kind: "no-profile" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "idle" };
  onPull: () => void;
}) {
  const disabled = locked || pullState.kind !== "ready" || pullState.pulling;
  let helper: string | null = null;
  if (pullState.kind === "no-profile") helper = "Sign in to Resonance to pull suggestions.";
  if (pullState.kind === "error") helper = pullState.message;
  if (pullState.kind === "loading") helper = "Loading your Resonance profile…";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={onPull}
      >
        {pullState.kind === "ready" && pullState.pulling
          ? "Pulling…"
          : "Pull from my Resonance"}
      </Button>
      {helper ? <span className="text-xs text-text-muted">{helper}</span> : null}
    </div>
  );
}
```

- [ ] **Step 6: Update `CandidateRow` to render type/year and pullers caption**

Find `CandidateRow`. Update its prop type and body:

```tsx
function CandidateRow({
  candidate,
  voterIds,
  pullerIds,
  userInfoById,
  voted,
  locked,
  onVote,
  onUnvote,
  onRemove,
}: {
  candidate: {
    readonly id: string;
    readonly title: string;
    readonly type: string;
    readonly year: number | null;
  };
  voterIds: readonly string[];
  pullerIds: readonly string[];
  userInfoById: ReadonlyMap<string, UserInfo>;
  voted: boolean;
  locked: boolean;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const meta =
    candidate.type !== "unknown" || candidate.year !== null
      ? formatMeta(candidate.type, candidate.year)
      : null;

  const pullerCaption = formatPullers(pullerIds, userInfoById);

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg/40 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 truncate">{candidate.title}</span>
          {meta ? (
            <span className="shrink-0 text-xs text-text-muted">{meta}</span>
          ) : null}
        </div>
        {pullerCaption ? (
          <div className="mt-0.5 text-xs text-text-muted">{pullerCaption}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <AvatarStack
          userIds={voterIds}
          userInfoById={userInfoById}
          size="md"
          max={3}
          showCount
          highlight={voted}
        />
        <Button
          size="sm"
          variant={voted ? "primary" : "secondary"}
          disabled={locked}
          onClick={() =>
            voted ? onUnvote(candidate.id) : onVote(candidate.id)
          }
        >
          {voted ? "Voted" : "Vote"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={locked}
          onClick={() => onRemove(candidate.id)}
        >
          remove
        </Button>
      </div>
    </li>
  );
}

function formatMeta(type: string, year: number | null): string {
  const parts: string[] = [];
  if (type !== "unknown") parts.push(type);
  if (year !== null) parts.push(String(year));
  return parts.length > 0 ? `(${parts.join(" · ")})` : "";
}

function formatPullers(
  ids: readonly string[],
  userInfoById: ReadonlyMap<string, UserInfo>,
): string | null {
  if (ids.length === 0) return null;
  const names = ids.map(
    (id) => userInfoById.get(id)?.name ?? "Anonymous",
  );
  if (names.length === 1) return `added by ${names[0]}`;
  if (names.length === 2) return `added by ${names[0]} and ${names[1]}`;
  return `added by ${names[0]} and ${names.length - 1} others`;
}
```

The `formatMeta` returns `(movie · 2024)` when both fields are known, `(movie)` when only type, `(2024)` when only year, and an empty string when neither (the parent renders nothing in that case).

The `formatPullers` returns `null` for an empty list (which shouldn't happen, every candidate has at least one puller, but the guard is cheap).

- [ ] **Step 7: Update the `<CandidatesPanel ... />` call site to pass the new props**

In the same file, find where `<CandidatesPanel ... />` is rendered. Update to pass `pullersByCandidateId`, `pullState`, and `onPull`:

```tsx
const pullState: React.ComponentProps<typeof CandidatesPanel>["pullState"] =
  profile.state === "idle"
    ? { kind: "idle" }
    : profile.state === "loading"
      ? { kind: "loading" }
      : profile.state === "no-profile"
        ? { kind: "no-profile" }
        : profile.state === "error"
          ? { kind: "error", message: profile.message }
          : { kind: "ready", pulling };
```

(Place this derivation just above the JSX, after the other derived values.)

Then:

```tsx
<CandidatesPanel
  candidates={candidates}
  votes={votes}
  userInfoById={userInfoById}
  votedCandidateIds={votedCandidateIds}
  pullersByCandidateId={pullersByCandidateId}
  locked={consensus.phase === "decided"}
  pullState={pullState}
  onAdd={addCandidate}
  onRemove={removeCandidate}
  onVote={castVote}
  onUnvote={unvote}
  onPull={handlePull}
/>
```

- [ ] **Step 8: Verify typecheck and tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS, 57 tests now (54 prior + 3 new ThresholdPicker tests from Task 8).

If typecheck flags errors around the `candidate` prop on `CandidateRow` (because `useStorage` returns `candidates` with a different shape than the prop type expects), inspect the actual type returned by `useStorage((root) => root.candidates)` and adjust the `CandidatesPanel` and `CandidateRow` prop types to match. The Liveblocks-flattened shape of a candidate at read time is `{ id, title, type, year, addedBy: readonly string[], addedAt }`: we do not type the prop with `addedBy` since `pullerIds` is already passed separately via `pullersByCandidateId`.

- [ ] **Step 9: Commit and push**

```bash
git add src/components/SessionUI.tsx
git commit -m "$(cat <<'EOF'
Add Pull button, type/year suffix, and pullers caption to candidate rows

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Task 10: Verification, decisions log, CLAUDE.md update

**Files:**

- Modify: `decisions.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the full check pipeline**

Run: `pnpm check`
Expected: PASS (typecheck, lint, build, test all green).

If anything fails, STOP and report. Do not commit until everything is green.

- [ ] **Step 2: Append decisions to `decisions.md`**

Append four entries to `/Users/drub/repos/Ensemble/decisions.md`. Use the existing entry format. The entries should not contain em-dashes (drub project convention). Use colons, periods, or parentheses instead.

```markdown
---

## 2026-05-09, Candidate source: hybrid library + recommendations on the client

**Considered**: **Server-side slicing** (new Resonance endpoint that returns a pre-sliced candidate set), **client-side slicing** (widen `/profile/export` consumption, slice locally), **cached profile in Liveblocks** (persist the snapshot per user, slice from cache).

**Decision**: Client-side slicing. Widen the existing `/profile/export` consumer to include `library` and `recommendations`; slice via a pure `pickCandidates` function in `src/lib/candidates.ts`.

**Why**: Slicing policy is an Ensemble UX decision, not a Resonance concern. Resonance also serves Constellation, so adding feature-specific endpoints there should clear a higher bar. Widening an existing read is cheaper and faster than coordinating cross-repo changes. The pure function is fully testable. If profile-export ever becomes expensive enough to matter, server-side slicing is a graduation path.

**Tradeoff accepted**: Each pull re-fetches the entire profile-export payload, including themes and archetypes that the call site does not use. Acceptable because the endpoint is already tuned for export and Constellation reads it the same way.

**Would revisit if**: Profile-export response grows large enough that the per-pull bandwidth cost is observable, or Resonance gains a recommendation surface that we want server-mediated for personalization or rate-limiting reasons.

---

## 2026-05-09, Trigger: per-user pull button

**Considered**: **Host auto-pull on session create** (whoever opens the room contributes their slice automatically), **per-user pull button** (every member gets their own button to contribute their slice), **empty-by-default with on-demand host pull** (no auto-pull; host can press a button if they want).

**Decision**: Per-user pull button.

**Why**: Voting is fully symmetric (every member's vote weighs equally). The candidate pool should be too. Letting each member contribute their own slice gives every voter contribution agency and matches the egalitarian voting model. Host auto-pull would put one user's taste at the center and undercut the "shared decision" framing. Empty-by-default is too conservative for an MVP that needs to demonstrate the value prop.

**Tradeoff accepted**: More UI surface (a button per user instead of a single host gesture), and more dedup logic to handle overlap when two members both have the same title. The dedup logic doubles as a feature (multi-attribution agreement signal).

**Would revisit if**: Real-user testing shows members never press the button (the auto-pull would have been correct), or that the social pressure of seeing each other's library is uncomfortable enough to deter pulls.

---

## 2026-05-09, Candidate shape: title, type, year, multi-attribution addedBy

**Considered**: **Title only** (status quo), **title + minimal metadata** (type and year), **title + rich metadata** (cover art, blurb, deep links).

**Decision**: Title + minimal metadata. `Candidate` gains `type: CandidateType` and `year: number | null`. `addedBy` becomes `LiveList<string>` to support multi-attribution.

**Why**: Type and year disambiguate (two films named "Joker") at low cost: one closed-union type, one nullable number, no image loading. Rich metadata is appealing but doubles the rendering surface and storage payload, and "lo-fi clean" is closer to the Resonance/Constellation visual language than "rich card." Multi-attribution is a free agreement signal that emerges naturally from dedup.

**Tradeoff accepted**: A schema change to `Candidate` (storage shape break), but ephemeral sessions mean no migration is needed. Manual entries default to type "unknown" and no year, which is honest about the lo-fi nature of typed-by-hand data.

**Would revisit if**: Real-user testing shows users want covers and blurbs (and the cost of fetching them is acceptable), or if "unknown" type pollutes the UI in confusing ways.

---

## 2026-05-09, Items per pull: host-configurable, default 5

**Considered**: **Fixed 5**, **fixed 10**, **host-configurable per session**.

**Decision**: Host-configurable, default 5, range 1 to 20. Control sits inside the existing ThresholdPicker card body, host-only.

**Why**: Same asymmetry the consensus flow already accepted: hosts own "configure the room" gestures, members own "express my preference" gestures. Pull volume is a configuration decision, so attaching it to the host role is consistent. Host-configurable also covers small-room and large-room cases without separate logic. Default of 5 lands sessions around 8-15 candidates with overlap, which is the scannable range.

**Tradeoff accepted**: One more host control (alongside the threshold rule). Surface area in the host UI grows, but stays inside one card so the visual cost is small.

**Would revisit if**: Hosts always change the default (default is wrong) or never touch it (configuration was overengineered).
```

- [ ] **Step 3: Update `CLAUDE.md` build steps and locked decisions**

In `/Users/drub/repos/Ensemble/CLAUDE.md`, update:

1. **`## Current state`** "Phase" line: replace with:

```markdown
**Phase**: Resonance candidate population shipped. Per-user "Pull from my Resonance" button contributes a hybrid library + recommendations slice; multi-attribution dedup; type and year on candidates; host-configurable items-per-pull. Consensus flow and visual system live underneath.
```

2. **`## Current state`** "Next step" line: replace with:

```markdown
**Next step**: Mobile breakpoints and polish (build step 8). Responsive layout, empty states, edge cases.
```

3. **`## Current state`** "Architectural decisions locked" list: append four entries (current list ends at 17):

```markdown
18. Candidate source: hybrid library + recommendations on the client.
19. Trigger: per-user "Pull from my Resonance" button.
20. Candidate shape: title, type, year, multi-attribution addedBy.
21. Items per pull: host-configurable, default 5.
```

4. **`## Build steps`** section: add a new step 7.5 between 7 and 8:

```markdown
7. **Consensus flow**: ✅ configurable threshold, random tiebreaker, lock + reconsider, hero card reveal.
7.5. **Resonance candidate population**: ✅ per-user pull, hybrid mix, multi-attribution, host-configurable volume.
8. **Mobile breakpoints + polish**: ← here. Responsive layout, empty states, edge cases.
9. **Deploy + real-user test**: ship to Vercel, run it with a friend.
```

Verify there are no em-dashes in any of your additions. Run `rg "," decisions.md CLAUDE.md` after editing and replace any.

- [ ] **Step 4: Run the check pipeline once more**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add decisions.md CLAUDE.md
git commit -m "$(cat <<'EOF'
Log Resonance candidate population decisions and update build state

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 6: Manual verification (drub-driven, post-deploy)**

Vercel auto-deploys from main. Once deployed:

1. Open two browser windows in different profiles, both signed into Resonance.
2. Window A creates a session. Confirm a "Pull from my Resonance" button is visible in the candidates panel and an "Items per pull" control sits inside the threshold card (host-only).
3. Press Pull in Window A. Candidates appear with the type · year suffix on rows that have metadata. The added-by caption shows "added by [your name]" under each title.
4. Window B joins. Press Pull. Items overlap appropriately: a candidate Window A already pulled now shows "added by Alice and Bob" if both pulled it.
5. Cast votes from both windows. Hero card transitions correctly when threshold crosses (consensus flow regression check).
6. Reconsider, change items-per-pull to 1, pull again. Each member contributes 1 item this round.
7. As Window B (non-host), confirm the items-per-pull control is read-only.
8. Sign in as a user without a Resonance profile (or simulate by setting an invalid token). Confirm the Pull button is disabled with the "Sign in to Resonance" tooltip.

---

## Notes

- **No e2e tests:** Same constraint as the consensus flow plan. Liveblocks integration testing is out of scope. Real-user verification continues to be drub running multiple browser windows post-deploy.
- **`addedBy` cast in Task 9:** The `as unknown as readonly string[]` cast on `c.addedBy` is the documented Liveblocks pattern for read-side projection of `LiveList<string>`. If Liveblocks updates its types to flow this naturally, drop the cast.
- **Pulling state lives in SessionUI:** the `pulling` state is local component state, not Liveblocks storage. Concurrent pulls by multiple users are handled by the mutation's idempotent dedup logic; "pulling" is just the local "press feedback" affordance.
- **Mix ratio is `LIBRARY_SHARE = 0.6`:** if real-user testing shows the mix feels off (too much library, too few recs, or vice versa), this is a one-line tune in `src/lib/candidates.ts`.
- **Spec ambiguity flag (interpretation b):** as noted at the top of this plan, the row's pullers are shown as a small caption under the title; voters keep the AvatarStack on the right. Interpretation (a), pullers in the AvatarStack instead, is a one-task swap (Task 9, Step 6 change `userIds={voterIds}` to `userIds={pullerIds}`). Confirm with drub during plan review.
