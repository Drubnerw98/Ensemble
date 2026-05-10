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
