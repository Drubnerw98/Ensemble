import { AvatarStack, Button } from "./ui";
import { ReactionRow, type ReactionState } from "./ReactionRow";
import { RoomFitChips } from "./RoomFitChips";
import { ThresholdMeter } from "./ThresholdMeter";
import type { ReactionKind } from "../lib/liveblocks";
import type { UserInfo } from "../lib/types";
import type { WhyChip } from "../lib/whyForRoom";
import { formatMeta, formatPullers } from "../lib/format";

type CandidateView = {
  readonly id: string;
  readonly title: string;
  readonly type: string;
  readonly year: number | null;
  readonly posterUrl?: string | null;
};

type Props = {
  candidate: CandidateView;
  voterIds: readonly string[];
  pullerIds: readonly string[];
  reactions: ReactionState;
  whyChips: readonly WhyChip[];
  userInfoById: ReadonlyMap<string, UserInfo>;
  voted: boolean;
  locked: boolean;
  justDecided?: boolean;
  votesNeeded: number;
  showThresholdMeter: boolean;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleReaction: (candidateId: string, kind: ReactionKind) => void;
};

export function CandidateRow({
  candidate,
  voterIds,
  pullerIds,
  reactions,
  whyChips,
  userInfoById,
  voted,
  locked,
  justDecided,
  votesNeeded,
  showThresholdMeter,
  onVote,
  onUnvote,
  onRemove,
  onToggleReaction,
}: Props) {
  const meta = formatMeta(candidate.type, candidate.year);
  const pullerCaption = formatPullers(pullerIds, userInfoById);

  return (
    <li
      className={`flex flex-col gap-2 rounded-md border border-border bg-bg/40 px-3 py-2 text-sm transition-colors hover:border-border-strong${
        justDecided ? " animate-row-pulse" : ""
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {candidate.posterUrl ? (
            <img
              src={candidate.posterUrl}
              alt=""
              className="h-[72px] w-12 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="h-[72px] w-12 shrink-0 rounded-md bg-white/10" />
          )}
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 truncate">{candidate.title}</span>
              {meta ? (
                <span className="shrink-0 font-display text-[10px] font-medium tracking-[0.2em] text-text-muted uppercase">
                  {meta}
                </span>
              ) : null}
            </div>
            {pullerCaption ? (
              <div className="mt-0.5 text-xs text-text-muted">{pullerCaption}</div>
            ) : null}
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:shrink-0 sm:justify-end">
          <div className="flex items-center gap-2">
            <AvatarStack
              userIds={voterIds}
              userInfoById={userInfoById}
              size="md"
              max={3}
              showCount={false}
              highlight={voted}
            />
            {showThresholdMeter ? (
              <ThresholdMeter
                current={voterIds.length}
                needed={votesNeeded}
                justDecided={justDecided ?? false}
              />
            ) : voterIds.length > 3 ? (
              <span className="text-xs text-text-muted">{voterIds.length}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
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
        </div>
      </div>
      <RoomFitChips chips={whyChips} userInfoById={userInfoById} />
      <ReactionRow
        state={reactions}
        disabled={locked}
        onToggle={(kind) => onToggleReaction(candidate.id, kind)}
      />
    </li>
  );
}
