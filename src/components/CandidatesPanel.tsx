import { useCallback, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Button, Card } from "./ui";
import { CandidateAutocomplete } from "./CandidateAutocomplete";
import { CandidateRow } from "./CandidateRow";
import { type ReactionState } from "./ReactionRow";
import { searchTmdb, type TmdbResult } from "../lib/tmdb";
import type { ReactionKind } from "../lib/liveblocks";
import type { UserInfo } from "../lib/types";
import type { PullState } from "../hooks/useConsensusRoom";
import type { WhyChip } from "../lib/whyForRoom";

const EMPTY_VOTER_LIST: readonly string[] = [];

const EMPTY_REACTION_STATE: ReactionState = {
  thumbsUp: { count: 0, selfReacted: false },
  heart: { count: 0, selfReacted: false },
  thinking: { count: 0, selfReacted: false },
  yikes: { count: 0, selfReacted: false },
};

const EMPTY_WHY_CHIPS: readonly WhyChip[] = [];

type CandidateView = {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly year: number | null;
  readonly posterUrl?: string | null;
};

type CandidateMeta = {
  tmdbId: number;
  posterUrl: string | null;
  type: import("../lib/candidates").CandidateType;
  year: number | null;
};

type Props = {
  candidates: readonly CandidateView[];
  votes: ReadonlyMap<string, readonly string[]>;
  userInfoById: ReadonlyMap<string, UserInfo>;
  votedCandidateIds: ReadonlySet<string>;
  pullersByCandidateId: ReadonlyMap<string, readonly string[]>;
  reactionsByCandidateId: ReadonlyMap<string, ReactionState>;
  whyChipsByCandidateId: ReadonlyMap<string, readonly WhyChip[]>;
  votesNeeded: number;
  showThresholdMeter: boolean;
  locked: boolean;
  justDecidedId: string | null;
  pullState: PullState;
  onAdd: (title: string, meta?: CandidateMeta) => void;
  onRemove: (id: string) => void;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  onPull: () => void;
  onToggleReaction: (candidateId: string, kind: ReactionKind) => void;
  isSessionLocked: boolean;
};

export function CandidatesPanel({
  candidates,
  votes,
  userInfoById,
  votedCandidateIds,
  pullersByCandidateId,
  reactionsByCandidateId,
  whyChipsByCandidateId,
  votesNeeded,
  showThresholdMeter,
  locked,
  justDecidedId,
  pullState,
  onAdd,
  onRemove,
  onVote,
  onUnvote,
  onPull,
  onToggleReaction,
  isSessionLocked,
}: Props) {
  const { getToken } = useAuth();
  const [draft, setDraft] = useState("");

  // Build the search function with a fresh token on each call. Memoized
  // so CandidateAutocomplete's effect deps stay stable across renders.
  const search = useCallback(
    async (query: string) => {
      const token = await getToken();
      if (!token) return [];
      return searchTmdb(query, token);
    },
    [getToken],
  );

  const handleSelectResult = (result: TmdbResult) => {
    const meta: CandidateMeta = {
      tmdbId: result.tmdbId,
      posterUrl: result.posterUrl,
      type: result.mediaType === "movie" ? "movie" : "show",
      year: result.year,
    };
    onAdd(result.title, meta);
    setDraft("");
  };

  const handleFreeform = (title: string) => {
    onAdd(title);
    setDraft("");
  };

  return (
    <Card>
      <Card.Eyebrow count={candidates.length}>Candidates</Card.Eyebrow>
      <Card.Body>
        <CandidateAutocomplete
          value={draft}
          onChange={setDraft}
          onSelectResult={handleSelectResult}
          onSubmitFreeform={handleFreeform}
          search={search}
          disabled={isSessionLocked}
        />

        <PullControl locked={locked} pullState={pullState} onPull={onPull} />

        {candidates.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center rounded-md border border-border/60 bg-bg/30 px-6 py-10 text-center">
            <p className="font-display text-lg font-light tracking-tight text-text">
              What are we watching tonight?
            </p>
            <p className="mt-2 max-w-sm text-sm text-text-muted">
              Type a title above to search, or pull picks from your Resonance to start a list.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {candidates.map((c) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                voterIds={votes.get(c.id) ?? EMPTY_VOTER_LIST}
                pullerIds={pullersByCandidateId.get(c.id) ?? EMPTY_VOTER_LIST}
                reactions={reactionsByCandidateId.get(c.id) ?? EMPTY_REACTION_STATE}
                whyChips={whyChipsByCandidateId.get(c.id) ?? EMPTY_WHY_CHIPS}
                userInfoById={userInfoById}
                voted={votedCandidateIds.has(c.id)}
                locked={locked}
                justDecided={c.id === justDecidedId}
                votesNeeded={votesNeeded}
                showThresholdMeter={showThresholdMeter}
                onVote={onVote}
                onUnvote={onUnvote}
                onRemove={onRemove}
                onToggleReaction={onToggleReaction}
              />
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}

function PullControl({
  locked,
  pullState,
  onPull,
}: {
  locked: boolean;
  pullState: PullState;
  onPull: () => void;
}) {
  const disabled = locked || pullState.kind !== "ready" || pullState.pulling;
  let helper: string | null = null;
  if (pullState.kind === "no-profile") helper = "Sign in to Resonance to pull suggestions.";
  if (pullState.kind === "no-watchable")
    helper = "Your Resonance has no movies, shows, or anime yet, add some to use this.";
  if (pullState.kind === "pool-exhausted")
    helper = "You've pulled everything in your Resonance. Have someone else pull, or add more there.";
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
