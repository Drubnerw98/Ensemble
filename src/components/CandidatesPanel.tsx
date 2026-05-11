import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Button, Card } from "./ui";
import { CandidateAutocomplete } from "./CandidateAutocomplete";
import { CandidateRow } from "./CandidateRow";
import { ConvergenceGlyph } from "./ConvergenceGlyph";
import { type ReactionState } from "./ReactionRow";
import { searchTmdb, type TmdbResult } from "../lib/tmdb";
import type { ReactionKind } from "../lib/liveblocks";
import type { UserInfo } from "../lib/types";
import type { PullSource, PullState } from "../hooks/useConsensusRoom";
import { useResonanceBatches } from "../hooks/useResonanceBatches";
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
  onPull: (source?: PullSource) => void;
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
            <span className="text-accent/70">
              <ConvergenceGlyph size={32} />
            </span>
            <p className="mt-4 font-display text-lg font-light tracking-tight text-text">
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

/** Source value encoded for the <select>. "blend" | "watchlist" |
 * "random-batch" are literals; specific batches are encoded as
 * "batch:<id>". Kept stringly-typed so the option list is trivially
 * mappable from the batches array. */
type SourceValue = "blend" | "watchlist" | "random-batch" | `batch:${string}`;

function decodeSource(
  value: SourceValue,
  batchIds: readonly string[],
): PullSource {
  if (value === "blend") return { kind: "blend" };
  if (value === "watchlist") return { kind: "watchlist" };
  if (value === "random-batch") return { kind: "random-batch", batchIds };
  return { kind: "batch", batchId: value.slice("batch:".length) };
}

function PullControl({
  locked,
  pullState,
  onPull,
}: {
  locked: boolean;
  pullState: PullState;
  onPull: (source: PullSource) => void;
}) {
  const disabled = locked || pullState.kind !== "ready" || pullState.pulling;
  const batches = useResonanceBatches();
  const [source, setSource] = useState<SourceValue>("blend");

  // Lazy-load batches the first time the user expands the picker. We can't
  // hook the <select>'s open event reliably, so we trigger on focus.
  const handlePickerFocus = useCallback(() => batches.load(), [batches]);

  // If the user picked a specific batch and it disappears from the list on
  // reload (e.g. they deleted it from Resonance in another tab), snap back
  // to "blend" so we don't fire an orphaned batch pull.
  useEffect(() => {
    if (batches.state.kind !== "ready") return;
    if (source.startsWith("batch:")) {
      const id = source.slice("batch:".length);
      const exists = batches.state.batches.some((b) => b.id === id);
      if (!exists) setSource("blend");
    } else if (
      source === "random-batch" &&
      batches.state.batches.length === 0
    ) {
      setSource("blend");
    }
  }, [batches.state, source]);

  const batchIds =
    batches.state.kind === "ready"
      ? batches.state.batches.map((b) => b.id)
      : [];

  function handlePull() {
    onPull(decodeSource(source, batchIds));
  }

  let helper: string | null = null;
  if (pullState.kind === "no-profile") helper = "Sign in to Resonance to pull suggestions.";
  if (pullState.kind === "no-watchable")
    helper = "Your Resonance has no movies, shows, or anime yet, add some to use this.";
  if (pullState.kind === "pool-exhausted")
    helper = "You've pulled everything in your Resonance. Have someone else pull, or add more there.";
  if (pullState.kind === "error") helper = pullState.message;
  if (pullState.kind === "loading") helper = "Loading your Resonance profile…";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={handlePull}
      >
        {pullState.kind === "ready" && pullState.pulling
          ? "Pulling…"
          : "Pull from my Resonance"}
      </Button>
      <label className="flex items-center gap-1.5 text-xs text-text-muted">
        <span className="font-display uppercase">From</span>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as SourceValue)}
          onFocus={handlePickerFocus}
          disabled={disabled}
          className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text focus:border-accent focus:outline-none disabled:opacity-50"
        >
          <option value="blend">Blend (library + recs)</option>
          <option value="watchlist">My watchlist</option>
          <option
            value="random-batch"
            disabled={
              batches.state.kind === "ready" &&
              batches.state.batches.length === 0
            }
          >
            Random batch
            {batches.state.kind === "loading" ? " (loading…)" : ""}
          </option>
          {batches.state.kind === "ready" &&
            batches.state.batches.length > 0 && (
              <optgroup label="Specific batch">
                {batches.state.batches.map((b) => (
                  <option key={b.id} value={`batch:${b.id}`}>
                    {labelForBatch(b)}
                  </option>
                ))}
              </optgroup>
            )}
          {batches.state.kind === "error" && (
            <option disabled value="__err">
              {batches.state.message}
            </option>
          )}
        </select>
      </label>
      {helper ? <span className="text-xs text-text-muted">{helper}</span> : null}
    </div>
  );
}

function labelForBatch(b: {
  name: string | null;
  prompt: string | null;
  createdAt: string;
  count: number;
}): string {
  const stem =
    b.name ??
    (b.prompt ? `"${truncate(b.prompt, 40)}"` : new Date(b.createdAt).toLocaleDateString());
  return `${stem} (${b.count})`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}
