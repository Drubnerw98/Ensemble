# Resonance candidate population design

**Date:** 2026-05-09
**Status:** Drafted, awaiting drub review
**Scope:** Build step 7.5 (between consensus flow and mobile polish). Per-user "Pull from my Resonance" button that contributes a hybrid (library + recommendations) slice to the shared candidate pool. Candidate shape gains `type` and `year`; `addedBy` becomes a list to support multi-attribution. Mobile breakpoints, cover art, and cross-reference algorithm remain out of scope.

## Why now

Per the decisions log, manual title-only was an explicit first cut to prove the sync layer end-to-end. That layer is proven. The lobby still requires every member to type titles by hand, which fights the value prop ("we use your Resonance taste profile to find what your group will agree on"). Resonance integration on the candidate side is the next sequenced checkpoint and the lever that turns Ensemble from "shared list with voting" into the actual product.

Landing this before mobile polish (build step 8) is also tactical: the candidate row's content gets richer with `type` and `year`, so the responsive layout pass should design against the final shape instead of the title-only stub.

## Locked design decisions

These were settled during brainstorming and are not in scope to revisit during implementation.

1. **Source: hybrid (library + recommendations).** Pulled from Resonance's existing `/profile/export` endpoint, which already returns both per the comment in `src/types/profile.ts`. No new Resonance endpoint.
2. **Trigger: per-user pull button.** Each member sees their own "Pull from my Resonance" affordance. Pressing it contributes that user's slice to the shared pool. Manual entry still works alongside.
3. **Shape: title + type + year.** Candidates gain `type` (e.g., movie / book / show / game) and `year` (number, optional). Manual entries default to type `"unknown"` and no year.
4. **Multi-attribution dedup.** Same normalized title from two pullers merges into one candidate row, with `addedBy` becoming a list of user IDs. Manual entries that match an existing title also append to `addedBy` rather than creating a duplicate row.
5. **Volume: host-configurable per session.** A small "Items per pull" control sits next to the threshold picker (host-only, default 5, range 1-20). Each press of any user's pull button contributes up to that many items.

## Open assumption (verify during review)

The spec assumes Resonance's `/profile/export` returns:

```ts
{
  profile: {
    themes: { label: string; weight: number }[],          // existing, consumed today
    archetypes: { label: string }[],                       // existing, consumed today
    library: { title: string; type?: string; year?: number }[],     // ASSUMED, not yet consumed
    recommendations: { title: string; type?: string; year?: number }[], // ASSUMED, not yet consumed
  }
}
```

The narrowing comment in `src/types/profile.ts` states "Resonance returns more (library, recommendations, mediaAffinities, etc.); we widen this type as later steps actually need them." This spec assumes those fields exist with `title` + `type` + `year` per item, ranked best-first by Resonance.

If Resonance returns these fields under different names or in a different shape, the implementation widens `RawProfileExport` accordingly and adds a small adapter inside `fetchMyProfile` to normalize. If Resonance does NOT yet return `library` and `recommendations` in this shape, that's a Resonance-side additive change that blocks this spec. Drub: confirm shape during review or flag the Resonance work needed.

## Architecture

### Approach: client-side slicing on top of widened `/profile/export`

`fetchMyProfile` widens to return `library` and `recommendations` arrays in addition to themes and archetypes. A new pure function `pickCandidates(profile, count)` in `src/lib/candidates.ts` slices a hybrid set: roughly `ceil(count * 0.6)` from library + `floor(count * 0.4)` from recommendations, taking the head of each list (Resonance pre-sorts best-first). Short-side fallback: if library has fewer than the library share, fill from recs and vice versa.

Pull button triggers a fresh `/profile/export` fetch on every press (simple, no caching), runs `pickCandidates`, and pushes via a new `pullCandidates` mutation. The mutation iterates the picked items, normalizes each title (lowercase, trim, collapse whitespace), and either appends `self.id` to an existing candidate's `addedBy` list or creates a new candidate.

### Why this shape

- **Resonance API stays unchanged.** The slicing policy is an Ensemble UX decision; widening an existing read is cheaper than adding a feature-specific endpoint.
- **Same pattern Constellation uses.** Consume `/profile/export` and render. Cross-app consistency.
- **Pure slicing function isolates policy from infrastructure.** `pickCandidates` is fully unit-testable; tuning the mix ratio is a one-file change.
- **Refetch on every press is the simplest correct thing.** Resonance updates between sessions matter; caching invites stale-data bugs without observable speedup at this scale.

### Tradeoff accepted

Each pull re-fetches the entire `/profile/export` payload, including themes, archetypes, library, and recs, even though only library + recs are used at the call site. Acceptable because (a) the endpoint is already tuned for export, (b) Constellation reads it the same way at the same volume, and (c) it preserves a single source of truth for the user's profile snapshot, with no per-feature fetch shape divergence.

### Alternatives considered

- **Server-side slicing via new Resonance endpoint** (`/api/candidates?count=N`): ruled out because it couples Resonance's API surface to Ensemble's UX policy. Resonance also serves Constellation, so a feature-specific endpoint there should clear a higher bar than a new client adapter here. Defensible later if profile-export grows expensive.
- **Cache profile in Liveblocks Storage**: ruled out because stale-data is the failure mode of caching, profiles update between sessions, and the per-user storage shape adds surface area we don't need.

## Data model

### Widened candidate

In `src/lib/liveblocks.ts`:

```ts
export type CandidateType =
  | "movie"
  | "show"
  | "book"
  | "game"
  | "music"
  | "podcast"
  | "unknown";

export type Candidate = {
  id: string;
  title: string;
  type: CandidateType;          // NEW
  year: number | null;          // NEW (null when unknown)
  addedBy: LiveList<string>;    // CHANGED from string to LiveList<string>
  addedAt: number;
  // Widened from `string | number` to satisfy LsonObject now that the
  // type holds a Live* node (`addedBy`) and nullable primitives (`year`).
  // Same shape as Consensus's index signature.
  [key: string]: Lson | undefined;
};
```

Why `LiveList<string>` for `addedBy`: appending a puller's id needs CRDT-safe concurrent semantics. Two clients pulling the same title at the same instant should both end up in the list, not one overwriting the other. `LiveList<string>` matches the existing `LiveMap<string, LiveList<string>>` pattern used for votes.

Why `CandidateType` as a closed union: ranks of "show me a movie row" UX live in this set. Resonance items that don't match any of these (or are missing type entirely) become `"unknown"` at the adapter boundary.

### Migration of existing rows

This is technically a breaking change to the storage schema. Liveblocks stores ephemeral session data, so existing live rooms are not a concern (they vanish when participants leave). New rooms initialize with the new shape from day one. No data migration needed.

If Liveblocks reports a schema mismatch warning on rooms that survive the deploy window, the room is short-lived enough to recover by reconnecting.

### Consensus shape addition

In `src/lib/liveblocks.ts`, add to `Consensus`:

```ts
candidatesPerPull: number;  // host-controlled, default 5, range 1-20 enforced client-side
```

Initialize to `5` in `src/routes/Session.tsx` alongside the other consensus defaults.

## Slicing policy

In a new file `src/lib/candidates.ts`:

```ts
export type ResonanceItem = {
  title: string;
  type?: string;
  year?: number;
};

export type PickedCandidate = {
  title: string;
  type: CandidateType;
  year: number | null;
};

const LIBRARY_SHARE = 0.6;

export function pickCandidates(
  profile: { library: readonly ResonanceItem[]; recommendations: readonly ResonanceItem[] },
  count: number,
): PickedCandidate[] {
  const target = Math.max(0, Math.min(count, 20));
  if (target === 0) return [];

  const libraryShare = Math.ceil(target * LIBRARY_SHARE);
  const recsShare = target - libraryShare;

  const libraryHead = profile.library.slice(0, libraryShare);
  const recsHead = profile.recommendations.slice(0, recsShare);

  // Backfill from the other slice if either side is short.
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

  const merged = [...libraryHead, ...recsBackfill, ...recsHead, ...libraryBackfill];
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
```

Mix ratio is a constant (`LIBRARY_SHARE = 0.6`), exposed at module level for easy tuning. Not yet user-configurable.

## State transitions

### `pullCandidates` mutation

In `SessionUI.tsx`, alongside the existing mutations:

```ts
const pullCandidates = useMutation(
  ({ storage, self }, picked: PickedCandidate[]) => {
    if (storage.get("consensus").get("phase") !== "voting") return;
    const list = storage.get("candidates");
    for (const pick of picked) {
      const normalizedTitle = normalizeTitle(pick.title);
      let merged = false;
      for (let i = 0; i < list.length; i++) {
        const existing = list.get(i);
        if (!existing) continue;
        if (normalizeTitle(existing.get("title")) !== normalizedTitle) continue;
        const addedBy = existing.get("addedBy");
        // Append self only if not already attributed.
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

Where `normalizeTitle(s)` is `s.toLowerCase().trim().replace(/\s+/g, " ")`. Same helper lives in `src/lib/candidates.ts`.

### `addCandidate` (existing) updated for dedup

The existing manual-entry mutation gets the same dedup logic so a manual "Dune Part Two" added after a Resonance pull merges into the existing row instead of creating a duplicate. It also writes the new shape (`type: "unknown"`, `year: null`, `addedBy: new LiveList([user.id])`).

### Phase guards (no change to pattern)

`pullCandidates` is gated by `phase === "voting"` like every other mutation that touches candidates or votes. Defense-in-depth identical to Task 9 of the consensus flow.

### `setCandidatesPerPull` mutation (host-only)

```ts
const setCandidatesPerPull = useMutation(({ storage, self }, n: number) => {
  const c = storage.get("consensus");
  if (self.id !== c.get("hostId")) return;
  if (c.get("phase") !== "voting") return;
  const clamped = Math.max(1, Math.min(20, Math.floor(n)));
  c.set("candidatesPerPull", clamped);
}, []);
```

## UX

### Pull button

Lives near the manual-entry input on the candidates panel. Shows one of these states:

- **Default**: `Pull from my Resonance` (button text)
- **Loading**: `Pulling…` (disabled while the fetch + mutation run)
- **No profile**: button disabled with tooltip `Sign in to Resonance to pull suggestions`
- **Error**: button disabled with small inline error `Resonance is unreachable; manual entry still works`
- **Locked (decided phase)**: disabled, same as the rest of the candidates panel

Single button per user (rendered inside `CandidatesPanel` for the local `self`, using the existing `useResonanceProfile` hook for state).

### Items-per-pull control

Sits inside the `ThresholdPicker` card body, below the threshold rule, host-only. A small number input labeled `Items per pull` (range 1-20, default 5). Non-hosts see a read-only line: `Items per pull: 5`. Same host-gating pattern as the threshold rule.

### Candidate row (refresh)

Each row shows the title with optional `(type · year)` suffix when known:

```
Dune Part Two (movie · 2024)         [avatars] [Vote] [remove]
Some Manual Title                    [avatars] [Vote] [remove]
```

The avatars now reflect ALL pullers/adders (the new `addedBy` list). The visual treatment is the existing `AvatarStack`. Multi-attribution is the agreement-signal pre-vote nudge: "two of you already had this saved" is implied without needing a separate label.

### Empty profile fallback

If `useResonanceProfile()` returns `no-profile` for the local user: the pull button renders disabled with the tooltip noted above. The user can still type titles manually. No banner, no modal. The disabled button is the affordance.

## Edge cases

- **Pull during host-only events** (threshold rule changes, reconsider): not blocked. The `voting` phase is the only gate. Multiple users pulling simultaneously is fine; CRDT handles concurrent appends.
- **Two pulls by the same user**: the second pull's items dedup against the user's own already-attributed candidates and become no-ops. New items in the user's profile (e.g., they saved something between pulls) get added.
- **Resonance profile updates mid-session**: each pull is a fresh fetch, so changes are picked up next press. No stale-cache concerns.
- **Empty library + recs**: `pickCandidates` returns `[]`. The mutation iterates zero items; nothing happens. Optionally surface a toast `Your Resonance profile is empty`. Skipping toast for MVP; disabled state is enough.
- **Items per pull set to 1, multiple pullers**: each user contributes 1, totaling N items. Works fine.
- **Items per pull changed mid-session by host**: only affects future pulls; existing candidates stay.
- **Existing candidate manually removed by host (pre-pull)**: pull may re-add it. Acceptable. Manual remove is a "not this round" gesture, not a "never show again" gesture. Persistent suppression is out of scope.

## Testing

### Unit tests for `pickCandidates`

In `src/lib/candidates.test.ts`:

- Default split: 5 items → 3 from library + 2 from recs.
- Short library (1 item, 5 requested): returns 1 library + 4 recs (backfill).
- Short recs (5 library, 0 recs, 5 requested): returns 5 library + 0 recs (backfill from library beyond the share).
- Both short (1 library, 1 recs, 5 requested): returns 2 items total.
- Empty profile: returns `[]`.
- Count clamping: `count: 0` → `[]`; `count: 100` → at most 20.
- Type parsing: known types preserved, unknown / missing → `"unknown"`.
- Year parsing: number kept; missing or non-number → `null`.

### Unit tests for `normalizeTitle`

In `src/lib/candidates.test.ts`:

- Lowercases.
- Trims leading/trailing whitespace.
- Collapses internal whitespace runs.
- Same string with different casing/spacing produces the same output.

### Component tests

`pullCandidates` mutation is exercised through the `CandidatesPanel` test surface:

- Pull button disabled when profile state is `no-profile` or `error`.
- Pull button shows "Pulling…" during the fetch (simulated via timing).
- Items-per-pull input visible only for the host (similar to `ThresholdPicker.test.tsx` pattern).
- `CandidateRow` renders the type · year suffix when present, no suffix when type is `unknown` and year is `null`.
- `CandidateRow` renders multi-attribution avatar stack from a multi-element `addedBy` list (verify via prop, not via Liveblocks).

### No e2e

Same constraint as the consensus flow: no Liveblocks integration test infra. Verification continues to be drub running two browser windows post-deploy.

## Decisions to log to `decisions.md`

After spec approval, append entries for:

1. **Candidate source: hybrid (library + recommendations) on client.** Considered server-side slicing, client-side slicing, cached-profile. Chose client-side because Ensemble owns the UX policy and Resonance API stays unchanged.
2. **Trigger: per-user pull button.** Considered host auto-pull on session create, per-user button, empty-by-default with on-demand pull. Chose per-user button because it matches the egalitarian voting model and gives every member contribution agency.
3. **Candidate shape: title + type + year, multi-attribution `addedBy`.** Considered title-only, title + minimal metadata, title + rich metadata. Chose minimal metadata for the type · year disambiguation without the cost of cover art / blurbs.
4. **Items per pull: host-configurable, default 5.** Considered fixed 5, fixed 10, host-configurable. Chose host-configurable to match the existing threshold-rule asymmetry (host owns "configure the room" gestures).

## Out of scope

- **Mobile breakpoints / responsive layout**: build step 8.
- **Cross-reference algorithm**: pulling the intersection or weighted blend of all members' profiles, rather than each user contributing their own slice. Distinct future checkpoint per `CLAUDE.md`.
- **Cover art, blurbs, deep links**: rich-metadata candidate shape. Future polish pass after the type · year shape proves itself.
- **Persistent removal of a candidate from future pulls**: out of scope; manual remove is "not this round," not "never show again."
- **Resonance API changes**: this spec assumes the existing endpoint shape can be widened on the client. If Resonance needs new fields, that's a separate Resonance PR with its own spec.
- **Caching the profile across pulls**: refetch every press is the explicit policy.
- **Toast notifications for empty profile / pull errors**: surfaced via disabled button + tooltip / inline error only.
- **Candidate-row pulse on consensus transition**: tracked separately in `docs/followups.md`.
- **Voter avatar crush bug**: tracked separately in `docs/followups.md`.
