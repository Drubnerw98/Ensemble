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
