import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, UserButton } from "@clerk/clerk-react";
import { useConsensusRoom, type UserInfo, type PullState } from "../hooks/useConsensusRoom";
import type { ReactionKind, ThresholdRule } from "../lib/liveblocks";
import { ReactionRow, type ReactionState } from "./ReactionRow";
import { searchTmdb, type TmdbResult } from "../lib/tmdb";
import { AvatarStack, Button, Card } from "./ui";
import { CandidateAutocomplete } from "./CandidateAutocomplete";
import { HeroCard } from "./HeroCard";
import { ReadyCard } from "./ReadyCard";
import { ThresholdPicker } from "./ThresholdPicker";

const EMPTY_VOTER_LIST: readonly string[] = [];

const EMPTY_REACTION_STATE: ReactionState = {
  thumbsUp: { count: 0, selfReacted: false },
  heart: { count: 0, selfReacted: false },
  thinking: { count: 0, selfReacted: false },
  yikes: { count: 0, selfReacted: false },
};

export function SessionUI({ code }: { code: string }) {
  const navigate = useNavigate();
  const room = useConsensusRoom();

  return (
    <main className="min-h-screen bg-bg p-6 text-text">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="cursor-pointer font-display text-[11px] tracking-[0.28em] text-text-muted uppercase transition-colors hover:text-text"
        >
          ← Ensemble
        </button>
        <UserButton
          appearance={{ elements: { userButtonAvatarBox: "h-8 w-8" } }}
        />
      </header>

      <section className="mx-auto mt-12 max-w-3xl space-y-8">
        <RoomCodeCard code={code} />

        <ThresholdPicker
          threshold={room.consensus.threshold as ThresholdRule}
          isHost={room.isHost}
          presentCount={room.presentMemberIds.size}
          onChange={room.setThreshold}
          candidatesPerPull={room.consensus.candidatesPerPull}
          onCandidatesPerPullChange={room.setCandidatesPerPull}
        />

        {room.consensus.phase === "decided" && room.consensus.winnerId ? (
          <HeroCard
            winnerTitle={
              room.candidates.find((c) => c.id === room.consensus.winnerId)?.title ??
              "(removed)"
            }
            winnerPosterUrl={
              room.candidates.find((c) => c.id === room.consensus.winnerId)?.posterUrl ??
              null
            }
            voterIds={room.votes.get(room.consensus.winnerId) ?? EMPTY_VOTER_LIST}
            userInfoById={room.userInfoById}
            isHost={room.isHost}
            onReconsider={room.reconsider}
            spinningTitles={room.spinningTitles}
            animateOnMount={room.observedTransition}
          />
        ) : null}

        <Card>
          <Card.Eyebrow count={1 + room.others.length}>In the room</Card.Eyebrow>
          <Card.Body>
            <ul className="flex flex-wrap gap-2">
              <MemberChip
                key={room.self.connectionId}
                name={room.self.info?.name}
                avatarUrl={room.self.info?.avatarUrl}
                isYou
                done={room.self.presence?.votingComplete ?? false}
              />
              {room.others.map((m) => (
                <MemberChip
                  key={m.connectionId}
                  name={m.info?.name}
                  avatarUrl={m.info?.avatarUrl}
                  done={m.presence?.votingComplete ?? false}
                />
              ))}
            </ul>
          </Card.Body>
        </Card>

        <CandidatesPanel
          candidates={room.candidates}
          votes={room.votes}
          userInfoById={room.userInfoById}
          votedCandidateIds={room.votedCandidateIds}
          pullersByCandidateId={room.pullersByCandidateId}
          reactionsByCandidateId={room.reactionsByCandidateId}
          locked={room.consensus.phase === "decided"}
          justDecidedId={
            room.observedTransition ? room.consensus.winnerId : null
          }
          pullState={room.pullState}
          onAdd={room.addCandidate}
          onRemove={room.removeCandidate}
          onVote={room.handleVote}
          onUnvote={room.handleUnvote}
          onPull={room.handlePull}
          onToggleReaction={room.toggleReaction}
          isSessionLocked={room.consensus.phase === "decided"}
        />

        {room.consensus.phase === "voting" ? (
          <ReadyCard
            selfReady={room.self.presence?.votingComplete ?? false}
            readyCount={room.readyCount}
            presentCount={room.presentMemberIds.size}
            isHost={room.isHost}
            noConsensusYet={room.noConsensusYet}
            finalizeDisabled={room.finalizeDisabled}
            onToggleReady={room.handleToggleReady}
            onFinalizeNow={room.handleFinalizeNow}
          />
        ) : null}
      </section>
    </main>
  );
}

function MemberChip({
  name,
  avatarUrl,
  isYou,
  done,
}: {
  name?: string;
  avatarUrl?: string;
  isYou?: boolean;
  done?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-text">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-5 w-5 rounded-full object-cover"
        />
      ) : (
        <span className="inline-block h-5 w-5 rounded-full bg-white/10" />
      )}
      <span>
        {name ?? "Anonymous"}
        {isYou && <span className="ml-1 text-text-muted">(you)</span>}
      </span>
      {done ? (
        <span
          aria-label="ready"
          title="Ready"
          className="inline-block h-2 w-2 rounded-full bg-accent"
        />
      ) : null}
    </li>
  );
}

function RoomCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const url = typeof window !== "undefined" ? window.location.href : "";

  async function copy(text: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard.writeText can reject in non-secure contexts.
    }
  }

  return (
    <Card>
      <Card.Eyebrow>Session code</Card.Eyebrow>
      <Card.Body>
        <div className="flex flex-wrap items-center gap-3">
          <span
            aria-label={`Session code ${code}`}
            className="rounded-md border border-border px-3 py-2 font-mono text-2xl tracking-[0.3em] text-text select-all"
          >
            {code}
          </span>
          <Button size="sm" onClick={() => copy(code, "code")}>
            {copied === "code" ? "Copied" : "Copy code"}
          </Button>
          <Button size="sm" onClick={() => copy(url, "link")}>
            {copied === "link" ? "Copied" : "Copy link"}
          </Button>
        </div>
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

type CandidateMeta = {
  tmdbId: number;
  posterUrl: string | null;
  type: import("../lib/candidates").CandidateType;
  year: number | null;
};

function CandidatesPanel({
  candidates,
  votes,
  userInfoById,
  votedCandidateIds,
  pullersByCandidateId,
  reactionsByCandidateId,
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
}: {
  candidates: readonly {
    readonly id: string;
    readonly title: string;
    readonly type: string;
    readonly year: number | null;
    readonly posterUrl?: string | null;
  }[];
  votes: ReadonlyMap<string, readonly string[]>;
  userInfoById: ReadonlyMap<string, UserInfo>;
  votedCandidateIds: ReadonlySet<string>;
  pullersByCandidateId: ReadonlyMap<string, readonly string[]>;
  reactionsByCandidateId: ReadonlyMap<string, ReactionState>;
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
}) {
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
        <div className="flex gap-2">
          <CandidateAutocomplete
            value={draft}
            onChange={setDraft}
            onSelectResult={handleSelectResult}
            onSubmitFreeform={handleFreeform}
            search={search}
            disabled={isSessionLocked}
          />
          <Button
            type="button"
            variant="primary"
            disabled={isSessionLocked || !draft.trim()}
            onClick={() => {
              const title = draft.trim();
              if (title) {
                onAdd(title);
                setDraft("");
              }
            }}
          >
            Add
          </Button>
        </div>

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
                reactions={reactionsByCandidateId.get(c.id) ?? EMPTY_REACTION_STATE}
                userInfoById={userInfoById}
                voted={votedCandidateIds.has(c.id)}
                locked={locked}
                justDecided={c.id === justDecidedId}
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

function CandidateRow({
  candidate,
  voterIds,
  pullerIds,
  reactions,
  userInfoById,
  voted,
  locked,
  justDecided,
  onVote,
  onUnvote,
  onRemove,
  onToggleReaction,
}: {
  candidate: {
    readonly id: string;
    readonly title: string;
    readonly type: string;
    readonly year: number | null;
    readonly posterUrl?: string | null;
  };
  voterIds: readonly string[];
  pullerIds: readonly string[];
  reactions: ReactionState;
  userInfoById: ReadonlyMap<string, UserInfo>;
  voted: boolean;
  locked: boolean;
  justDecided?: boolean;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleReaction: (candidateId: string, kind: ReactionKind) => void;
}) {
  const meta = formatMeta(candidate.type, candidate.year);
  const pullerCaption = formatPullers(pullerIds, userInfoById);

  return (
    <li
      className={`flex flex-col gap-2 rounded-md border border-border bg-bg/40 px-3 py-2 text-sm${
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
                <span className="shrink-0 text-xs text-text-muted">{meta}</span>
              ) : null}
            </div>
            {pullerCaption ? (
              <div className="mt-0.5 text-xs text-text-muted">{pullerCaption}</div>
            ) : null}
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:shrink-0 sm:justify-end">
          <AvatarStack
            userIds={voterIds}
            userInfoById={userInfoById}
            size="md"
            max={3}
            showCount
            highlight={voted}
          />
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
      <ReactionRow
        state={reactions}
        disabled={locked}
        onToggle={(kind) => onToggleReaction(candidate.id, kind)}
      />
    </li>
  );
}

function formatMeta(type: string, year: number | null): string | null {
  const parts: string[] = [];
  if (type !== "unknown") parts.push(type);
  if (year !== null) parts.push(String(year));
  return parts.length > 0 ? `(${parts.join(" · ")})` : null;
}

function formatPullers(
  ids: readonly string[],
  userInfoById: ReadonlyMap<string, UserInfo>,
): string | null {
  if (ids.length === 0) return null;
  const names = ids.map((id) => userInfoById.get(id)?.name ?? "Anonymous");
  if (names.length === 1) return `added by ${names[0]}`;
  if (names.length === 2) return `added by ${names[0]} and ${names[1]}`;
  return `added by ${names[0]} and ${names.length - 1} others`;
}
