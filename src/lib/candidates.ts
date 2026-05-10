import type { ResonanceItem } from "../types/profile";

export type CandidateType =
  | "movie"
  | "show"
  | "anime"
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

// Watchable types only. Books, games, music, podcasts are filtered out
// of pulls because the product is "what should we watch tonight" and
// non-watchable media doesn't fit the group session shape. Manual entry
// (which writes type "unknown") still works through addCandidate.
const ALLOWED_TYPES = new Set<CandidateType>(["movie", "show", "anime"]);

// Slice a hybrid candidate set from a Resonance profile snapshot.
// Default split is library-weighted (LIBRARY_SHARE = 0.6); short sides
// backfill from the other to honor the requested count when possible.
// Non-watchable types are filtered before slicing so the count is
// honored against the allowed set.
//
// `excludedTitles` (normalized) lets callers filter out items already
// in the room so subsequent pulls return new picks instead of redoing
// the same head-of-list. Pass an empty set when this isn't relevant.
export function pickCandidates(
  profile: {
    readonly library: readonly ResonanceItem[];
    readonly recommendations: readonly ResonanceItem[];
  },
  count: number,
  excludedTitles: ReadonlySet<string> = new Set(),
): PickedCandidate[] {
  const target = Math.max(0, Math.min(count, MAX_COUNT));
  if (target === 0) return [];

  const isEligible = (item: ResonanceItem) =>
    isAllowed(item) && !excludedTitles.has(normalizeTitle(item.title));

  const allowedLibrary = profile.library.filter(isEligible);
  const allowedRecs = profile.recommendations.filter(isEligible);

  const libraryShare = Math.ceil(target * LIBRARY_SHARE);
  const recsShare = target - libraryShare;

  const libraryHead = allowedLibrary.slice(0, libraryShare);
  const recsHead = allowedRecs.slice(0, recsShare);

  const libraryShortBy = libraryShare - libraryHead.length;
  const recsBackfill =
    libraryShortBy > 0
      ? allowedRecs.slice(recsShare, recsShare + libraryShortBy)
      : [];

  const recsShortBy = recsShare - recsHead.length;
  const libraryBackfill =
    recsShortBy > 0
      ? allowedLibrary.slice(libraryShare, libraryShare + recsShortBy)
      : [];

  const merged = [
    ...libraryHead,
    ...recsBackfill,
    ...recsHead,
    ...libraryBackfill,
  ];
  return merged.map(normalize);
}

function isAllowed(item: ResonanceItem): boolean {
  return ALLOWED_TYPES.has(parseType(item.type));
}

// Detect whether a Resonance snapshot contains anything pickCandidates
// would return. Used to short-circuit the Pull button with a helper
// message when a Resonance user has only books/games/music/podcasts.
export function hasWatchableContent(profile: {
  readonly library: readonly ResonanceItem[];
  readonly recommendations: readonly ResonanceItem[];
}): boolean {
  for (const item of profile.library) if (isAllowed(item)) return true;
  for (const item of profile.recommendations) if (isAllowed(item)) return true;
  return false;
}

// Count watchable items in a profile that aren't already excluded.
// Drives the pool-exhausted Pull state so a user clicking Pull after
// they've already drained their Resonance gets feedback instead of a
// silent no-op.
export function countAvailableForPull(
  profile: {
    readonly library: readonly ResonanceItem[];
    readonly recommendations: readonly ResonanceItem[];
  },
  excludedTitles: ReadonlySet<string>,
): number {
  let count = 0;
  for (const item of profile.library) {
    if (isAllowed(item) && !excludedTitles.has(normalizeTitle(item.title))) {
      count += 1;
    }
  }
  for (const item of profile.recommendations) {
    if (isAllowed(item) && !excludedTitles.has(normalizeTitle(item.title))) {
      count += 1;
    }
  }
  return count;
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
    case "anime":
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
