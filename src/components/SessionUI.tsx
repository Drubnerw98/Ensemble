import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserButton, useUser } from "@clerk/clerk-react";
import {
  useMutation,
  useOthers,
  useSelf,
  useStorage,
} from "@liveblocks/react/suspense";
import { LiveList, LiveObject } from "@liveblocks/client";
import type { Candidate, ThresholdRule } from "../lib/liveblocks";
import { evaluate } from "../lib/consensus";
import { AvatarStack, Button, Card } from "./ui";
import { HeroCard } from "./HeroCard";
import { ThresholdPicker } from "./ThresholdPicker";

type UserInfo = { name?: string; avatarUrl?: string };

const EMPTY_VOTER_LIST: readonly string[] = [];

export function SessionUI({ code }: { code: string }) {
  const candidates = useStorage((root) => root.candidates);
  const votes = useStorage((root) => root.votes);
  const consensus = useStorage((root) => root.consensus);
  const others = useOthers();
  const self = useSelf();
  const { user } = useUser();
  const navigate = useNavigate();

  const userInfoById = useMemo(() => {
    const map = new Map<string, UserInfo>();
    if (self.id) {
      map.set(self.id, {
        name: self.info?.name,
        avatarUrl: self.info?.avatarUrl,
      });
    }
    for (const other of others) {
      if (other.id) {
        map.set(other.id, {
          name: other.info?.name,
          avatarUrl: other.info?.avatarUrl,
        });
      }
    }
    return map;
  }, [self.id, self.info, others]);

  const presentMemberIds = useMemo(() => {
    const set = new Set<string>();
    if (self.id) set.add(self.id);
    for (const other of others) if (other.id) set.add(other.id);
    return set;
  }, [self.id, others]);

  const isHost = self.id === consensus.hostId;

  const votesSnapshot = useMemo(() => {
    const map = new Map<string, readonly string[]>();
    for (const [id, voters] of votes) map.set(id, voters);
    return map;
  }, [votes]);

  const votedCandidateIds = useMemo(() => {
    const set = new Set<string>();
    if (!self.id) return set;
    for (const [candidateId, voterIds] of votes) {
      if (voterIds.includes(self.id)) set.add(candidateId);
    }
    return set;
  }, [votes, self.id]);

  const addCandidate = useMutation(
    ({ storage }, title: string) => {
      storage.get("candidates").push(
        new LiveObject<Candidate>({
          id: crypto.randomUUID(),
          title,
          addedBy: user?.id ?? "unknown",
          addedAt: Date.now(),
        }),
      );
    },
    [user?.id],
  );

  const removeCandidate = useMutation(({ storage }, id: string) => {
    const list = storage.get("candidates");
    const votesMap = storage.get("votes");
    for (let i = list.length - 1; i >= 0; i--) {
      if (list.get(i)?.get("id") === id) {
        list.delete(i);
        // Drop the candidate's vote entry too so the map doesn't accumulate
        // orphan keys over a session's lifetime.
        votesMap.delete(id);
        return;
      }
    }
  }, []);

  const castVote = useMutation(({ storage, self }, candidateId: string) => {
    const votesMap = storage.get("votes");
    const list = votesMap.get(candidateId);
    if (!list) {
      votesMap.set(candidateId, new LiveList([self.id]));
      return;
    }
    for (let i = 0; i < list.length; i++) {
      if (list.get(i) === self.id) return;
    }
    list.push(self.id);
  }, []);

  const unvote = useMutation(({ storage, self }, candidateId: string) => {
    const votesMap = storage.get("votes");
    const list = votesMap.get(candidateId);
    if (!list) return;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list.get(i) === self.id) {
        list.delete(i);
        return;
      }
    }
  }, []);

  const setThreshold = useMutation(({ storage }, rule: ThresholdRule) => {
    const c = storage.get("consensus");
    if (c.get("phase") !== "voting") return;
    c.set("threshold", rule);
  }, []);

  const lockConsensus = useMutation(
    (
      { storage },
      payload: { winnerId: string; tiedIds: string[] },
    ) => {
      const c = storage.get("consensus");
      // Idempotent: only the first detector locks.
      if (c.get("phase") !== "voting") return;
      // Belt-and-suspenders: today the schema writes phase + winnerId in the
      // same update(), so this is unreachable via normal flow. Defends against
      // a future change that splits them.
      if (c.get("winnerId") !== null) return;
      c.update({
        phase: "decided",
        winnerId: payload.winnerId,
        tiedIds: payload.tiedIds,
        decidedAt: Date.now(),
      });
    },
    [],
  );

  const reconsider = useMutation(({ storage, self }) => {
    const c = storage.get("consensus");
    if (self.id !== c.get("hostId")) return; // host-only
    if (c.get("phase") !== "decided") return; // already voting
    c.update({
      phase: "voting",
      winnerId: null,
      tiedIds: [],
      decidedAt: null,
    });
    // Full vote reset — see spec for rationale.
    const votesMap = storage.get("votes");
    for (const key of Array.from(votesMap.keys())) {
      votesMap.delete(key);
    }
  }, []);

  useEffect(() => {
    if (consensus.phase !== "voting") return;
    // Liveblocks widens nested LiveObject fields to Lson via the
    // [key: string]: Lson | undefined index signature on Consensus —
    // re-narrow to the original ThresholdRule shape.
    const result = evaluate(votesSnapshot, consensus.threshold as ThresholdRule, presentMemberIds);
    if (result.winnerId === null) return;
    lockConsensus({
      winnerId: result.winnerId,
      tiedIds: result.tiedIds,
    });
  }, [
    consensus.phase,
    consensus.threshold,
    votesSnapshot,
    presentMemberIds,
    lockConsensus,
  ]);

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
          threshold={consensus.threshold}
          isHost={isHost}
          presentCount={presentMemberIds.size}
          onChange={setThreshold}
        />

        {consensus.phase === "decided" && consensus.winnerId ? (
          <HeroCard
            winnerTitle={
              candidates.find((c) => c.id === consensus.winnerId)?.title ??
              "(removed)"
            }
            voterIds={votes.get(consensus.winnerId) ?? EMPTY_VOTER_LIST}
            userInfoById={userInfoById}
            isHost={isHost}
            onReconsider={reconsider}
          />
        ) : null}

        <Card>
          <Card.Eyebrow count={1 + others.length}>In the room</Card.Eyebrow>
          <Card.Body>
            <ul className="flex flex-wrap gap-2">
              <MemberChip
                key={self.connectionId}
                name={self.info?.name}
                avatarUrl={self.info?.avatarUrl}
                isYou
              />
              {others.map((m) => (
                <MemberChip
                  key={m.connectionId}
                  name={m.info?.name}
                  avatarUrl={m.info?.avatarUrl}
                />
              ))}
            </ul>
          </Card.Body>
        </Card>

        <CandidatesPanel
          candidates={candidates}
          votes={votes}
          userInfoById={userInfoById}
          votedCandidateIds={votedCandidateIds}
          onAdd={addCandidate}
          onRemove={removeCandidate}
          onVote={castVote}
          onUnvote={unvote}
        />
      </section>
    </main>
  );
}

function MemberChip({
  name,
  avatarUrl,
  isYou,
}: {
  name?: string;
  avatarUrl?: string;
  isYou?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-text">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-5 w-5 rounded-full"
        />
      ) : (
        <span className="inline-block h-5 w-5 rounded-full bg-white/10" />
      )}
      <span>
        {name ?? "Anonymous"}
        {isYou && <span className="ml-1 text-text-muted">(you)</span>}
      </span>
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

function CandidatesPanel({
  candidates,
  votes,
  userInfoById,
  votedCandidateIds,
  onAdd,
  onRemove,
  onVote,
  onUnvote,
}: {
  candidates: readonly { readonly id: string; readonly title: string }[];
  votes: ReadonlyMap<string, readonly string[]>;
  userInfoById: ReadonlyMap<string, UserInfo>;
  votedCandidateIds: ReadonlySet<string>;
  onAdd: (title: string) => void;
  onRemove: (id: string) => void;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    onAdd(title);
    setDraft("");
  }

  return (
    <Card>
      <Card.Eyebrow count={candidates.length}>Candidates</Card.Eyebrow>
      <Card.Body>
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a title…"
            maxLength={120}
            className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:border-border-strong focus:outline-none"
          />
          <Button type="submit" variant="primary" disabled={!draft.trim()}>
            Add
          </Button>
        </form>

        {candidates.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">
            No candidates yet. Add the first one.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {candidates.map((c) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                voterIds={votes.get(c.id) ?? EMPTY_VOTER_LIST}
                userInfoById={userInfoById}
                voted={votedCandidateIds.has(c.id)}
                onVote={onVote}
                onUnvote={onUnvote}
                onRemove={onRemove}
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
  userInfoById,
  voted,
  onVote,
  onUnvote,
  onRemove,
}: {
  candidate: { readonly id: string; readonly title: string };
  voterIds: readonly string[];
  userInfoById: ReadonlyMap<string, UserInfo>;
  voted: boolean;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg/40 px-3 py-2 text-sm">
      <span className="min-w-0 truncate">{candidate.title}</span>
      <div className="flex shrink-0 items-center gap-3">
        <AvatarStack
          userIds={voterIds}
          userInfoById={userInfoById}
          size="md"
          max={3}
          showCount
          highlight={voted}
        />
        <Button
          size="sm"
          variant={voted ? "primary" : "secondary"}
          onClick={() =>
            voted ? onUnvote(candidate.id) : onVote(candidate.id)
          }
        >
          {voted ? "Voted" : "Vote"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRemove(candidate.id)}
        >
          remove
        </Button>
      </div>
    </li>
  );
}
