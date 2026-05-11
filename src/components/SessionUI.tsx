import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { useConsensusRoom } from "../hooks/useConsensusRoom";
import type { ThresholdRule } from "../lib/liveblocks";
import { Button, Card } from "./ui";
import { CandidatesPanel } from "./CandidatesPanel";
import { EcosystemSwitcher } from "./EcosystemSwitcher";
import { HeroCard } from "./HeroCard";
import { ReadyCard } from "./ReadyCard";
import { SiteFooter } from "./SiteFooter";
import { ThresholdPicker } from "./ThresholdPicker";

const EMPTY_VOTER_LIST: readonly string[] = [];

export function SessionUI({ code }: { code: string }) {
  const navigate = useNavigate();
  const room = useConsensusRoom();

  return (
    <main className="min-h-screen bg-bg p-6 text-text">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="cursor-pointer font-display text-[11px] tracking-[0.28em] text-text-muted uppercase transition-colors hover:text-text"
        >
          ← Ensemble
        </button>
        <div className="flex items-center gap-5">
          <div className="hidden sm:block">
            <EcosystemSwitcher current="ensemble" />
          </div>
          <UserButton
            appearance={{ elements: { userButtonAvatarBox: "h-8 w-8" } }}
          />
        </div>
      </header>

      <section className="mx-auto mt-12 max-w-3xl space-y-8">
        <ConnectionBanner status={room.connectionStatus} />
        <RoomCodeCard code={code} />

        <ThresholdPicker
          threshold={room.consensus.threshold as ThresholdRule}
          isHost={room.isHost}
          presentCount={room.presentMemberIds.size}
          onChange={room.setThreshold}
          candidatesPerPull={room.consensus.candidatesPerPull}
          onCandidatesPerPullChange={room.setCandidatesPerPull}
        />

        {room.consensus.phase === "decided" && room.consensus.winnerId ? (() => {
          const winner = room.candidates.find(
            (c) => c.id === room.consensus.winnerId,
          );
          return (
            <HeroCard
              winnerTitle={winner?.title ?? "(removed)"}
              winnerPosterUrl={winner?.posterUrl ?? null}
              winnerType={winner?.type ?? null}
              winnerYear={winner?.year ?? null}
              voterIds={room.votes.get(room.consensus.winnerId) ?? EMPTY_VOTER_LIST}
              userInfoById={room.userInfoById}
              isHost={room.isHost}
              onReconsider={room.reconsider}
              spinningTitles={room.spinningTitles}
              animateOnMount={room.observedTransition}
            />
          );
        })() : null}

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
          whyChipsByCandidateId={room.whyChipsByCandidateId}
          votesNeeded={room.thresholdVotesNeeded}
          showThresholdMeter={room.consensus.phase === "voting"}
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

      <SiteFooter />
    </main>
  );
}

type ConnectionStatus =
  | "initial"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status === "connected") return null;

  // "initial" / "connecting" happen behind the ClientSideSuspense fallback
  // in Session.tsx. By the time SessionUI is mounted, status is generally
  // "connected" or transitioning. Surface only the user-visible variants.
  const label =
    status === "disconnected"
      ? "Disconnected. Trying again."
      : "Reconnecting...";

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border border-warn/40 bg-warn/[0.08] px-3 py-2 text-xs text-warn"
    >
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 animate-pulse rounded-full bg-warn"
      />
      <span className="font-display font-medium tracking-[0.2em] uppercase">
        {label}
      </span>
    </div>
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
