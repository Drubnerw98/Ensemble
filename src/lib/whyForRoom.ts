import type { MemberProfileSnapshot } from "./liveblocks";

// Cross-attribution chip: "this candidate also matches Alex's
// interior-fracture theme." `kind` lets the renderer style theme vs
// archetype distinctly (filled vs outlined).
export type WhyChip = {
  userId: string;
  matchedLabel: string;
  kind: "theme" | "archetype";
  // Surface theme weight so callers can sort by signal strength when
  // multiple chips would otherwise collide on the cap. Archetypes
  // carry no weight; default to a fixed "matched" score.
  weight: number;
};

export type CandidateForMatch = {
  readonly tasteTags?: readonly string[] | null;
};

const ARCHETYPE_BASE_WEIGHT = 0.5;
const MAX_CHIPS = 6;

// Pure: matches a candidate's tasteTags against each member's profile
// themes and archetypes. Returns a deduped, capped, weight-sorted list
// of chips identifying which OTHER members' profiles also describe
// this candidate (i.e., the cross-attribution that the addedBy
// avatars don't already convey).
//
// Matching is case-insensitive label equality on normalized labels.
// Paraphrased / fuzzy matching is a known gap (see decisions.md
// 2026-05-10 entry); v1 ships exact-label so behavior is predictable
// and the matcher can be tightened later without a UI change.
export function whyForRoom(
  candidate: CandidateForMatch,
  profilesByUserId: ReadonlyMap<string, MemberProfileSnapshot>,
  addedBy: readonly string[],
): WhyChip[] {
  const tags = candidate.tasteTags;
  if (!tags || tags.length === 0) return [];

  const normalizedTags = new Set(
    tags
      .map((t) => normalizeLabel(t))
      .filter((t): t is string => t.length > 0),
  );
  if (normalizedTags.size === 0) return [];

  const excluded = new Set(addedBy);
  const chips: WhyChip[] = [];

  for (const [userId, snapshot] of profilesByUserId) {
    // Cross-attribution is about OTHER members. Skip anyone already
    // shown as a puller — those avatars are above the chip row.
    if (excluded.has(userId)) continue;

    // One chip per (userId, label, kind). Within a single member we
    // dedup so the same matched label doesn't render twice when both
    // a theme and an archetype carry it (the archetype chip wins
    // because themes are usually more numerous and would otherwise
    // crowd the row).
    const seenForUser = new Set<string>();

    for (const archetype of snapshot.archetypes) {
      const norm = normalizeLabel(archetype.label);
      if (!norm) continue;
      if (!normalizedTags.has(norm)) continue;
      if (seenForUser.has(norm)) continue;
      seenForUser.add(norm);
      chips.push({
        userId,
        matchedLabel: archetype.label,
        kind: "archetype",
        weight: ARCHETYPE_BASE_WEIGHT,
      });
    }

    for (const theme of snapshot.themes) {
      const norm = normalizeLabel(theme.label);
      if (!norm) continue;
      if (!normalizedTags.has(norm)) continue;
      if (seenForUser.has(norm)) continue;
      seenForUser.add(norm);
      chips.push({
        userId,
        matchedLabel: theme.label,
        kind: "theme",
        weight: typeof theme.weight === "number" ? theme.weight : 0,
      });
    }
  }

  // Highest-weight chips first, archetype before theme on a tie so
  // the rarer signal lands earlier in the visible cap.
  chips.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (a.kind !== b.kind) return a.kind === "archetype" ? -1 : 1;
    return 0;
  });

  return chips.slice(0, MAX_CHIPS);
}

function normalizeLabel(s: string | undefined): string {
  if (typeof s !== "string") return "";
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}
