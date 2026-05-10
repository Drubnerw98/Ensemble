import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import {
  useMutation,
  useOthers,
  useSelf,
  useStorage,
} from "@liveblocks/react/suspense";
import { LiveList, LiveObject } from "@liveblocks/client";
import type { Candidate, ConsensusPhase, ThresholdRule } from "../lib/liveblocks";
import { evaluate } from "../lib/consensus";
import { normalizeTitle, pickCandidates, type PickedCandidate } from "../lib/candidates";
import { useResonanceProfile } from "../hooks/useResonanceProfile";
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
  const navigate = useNavigate();
  const profile = useResonanceProfile();

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

  // Track both the previous phase and whether this client observed the
  // voting->decided transition. Both are stored as state so we avoid reading
  // or writing refs during render (react-hooks/refs) and avoid synchronous
  // setState in effects (react-hooks/set-state-in-effect).
  //
  // The React docs' recommended pattern for "previous value" tracking is to
  // call setState during render when the relevant prop changes. React will
  // discard the current render output and immediately re-render with the new
  // state, making it effectively synchronous for the user.
  //
  // prevPhase starts null: a late joiner whose first render sees
  // phase === "decided" gets observedTransition === false (no animation gate),
  // which is the spec's late-joiner requirement.
  const [prevPhase, setPrevPhase] = useState<ConsensusPhase | null>(null);
  const [observedTransition, setObservedTransition] = useState(false);

  if (prevPhase !== consensus.phase) {
    // Phase changed: update prevPhase and adjust observedTransition in the
    // same aborted-render pass so the next committed render has both correct.
    setPrevPhase(consensus.phase);
    if (prevPhase === "voting" && consensus.phase === "decided") {
      setObservedTransition(true);
    } else if (consensus.phase === "voting") {
      // Reconsider returned to voting: clear the gate for the next round.
      setObservedTransition(false);
    }
  }

  const votesSnapshot = useMemo(() => {
    const map = new Map<string, readonly string[]>();
    for (const [id, voters] of votes) map.set(id, voters);
    return map;
  }, [votes]);

  const spinningTitles = useMemo(
    () =>
      (consensus.tiedIds as readonly string[]).map(
        (id) => candidates.find((c) => c.id === id)?.title ?? "(removed)",
      ),
    [consensus.tiedIds, candidates],
  );

  const votedCandidateIds = useMemo(() => {
    const set = new Set<string>();
    if (!self.id) return set;
    for (const [candidateId, voterIds] of votes) {
      if (voterIds.includes(self.id)) set.add(candidateId);
    }
    return set;
  }, [votes, self.id]);

  const pullersByCandidateId = useMemo(() => {
    const map = new Map<string, readonly string[]>();
    for (const c of candidates) {
      // Liveblocks flattens LiveList<string> to readonly string[] at read time;
      // the Candidate type still declares it as LiveList so we cast here.
      const ids = c.addedBy as unknown as readonly string[];
      map.set(c.id, ids);
    }
    return map;
  }, [candidates]);

  const addCandidate = useMutation(
    ({ storage, self }, title: string) => {
      if (storage.get("consensus").get("phase") !== "voting") return;
      const cleanedTitle = title.trim();
      if (!cleanedTitle) return;
      const list = storage.get("candidates");
      const normalized = normalizeTitle(cleanedTitle);
      // Dedup: append self to addedBy if the title is already in the list.
      // Covers sequential adds only. True simultaneous adds from two
      // clients both see an empty list and both push, producing a
      // duplicate row that the spec accepts as a CRDT race we don't
      // server-side merge.
      for (let i = 0; i < list.length; i++) {
        const existing = list.get(i);
        if (!existing) continue;
        if (normalizeTitle(existing.get("title")) !== normalized) continue;
        const addedBy = existing.get("addedBy");
        let alreadyAttributed = false;
        for (let j = 0; j < addedBy.length; j++) {
          if (addedBy.get(j) === self.id) {
            alreadyAttributed = true;
            break;
          }
        }
        if (!alreadyAttributed) addedBy.push(self.id);
        return;
      }
      list.push(
        new LiveObject<Candidate>({
          id: crypto.randomUUID(),
          title: cleanedTitle,
          type: "unknown",
          year: null,
          addedBy: new LiveList([self.id]),
          addedAt: Date.now(),
        }),
      );
    },
    [],
  );

  // Wired to the Pull button in Task 9. The void reference below
  // satisfies tsconfig's noUnusedLocals between this task and Task 9.
  const pullCandidates = useMutation(
    ({ storage, self }, picked: readonly PickedCandidate[]) => {
      if (storage.get("consensus").get("phase") !== "voting") return;
      const list = storage.get("candidates");
      for (const pick of picked) {
        const normalized = normalizeTitle(pick.title);
        let merged = false;
        for (let i = 0; i < list.length; i++) {
          const existing = list.get(i);
          if (!existing) continue;
          if (normalizeTitle(existing.get("title")) !== normalized) continue;
          const addedBy = existing.get("addedBy");
          let alreadyAttributed = false;
          for (let j = 0; j < addedBy.length; j++) {
            if (addedBy.get(j) === self.id) {
              alreadyAttributed = true;
              break;
            }
          }
          if (!alreadyAttributed) addedBy.push(self.id);
          merged = true;
          break;
        }
        if (merged) continue;
        list.push(
          new LiveObject<Candidate>({
            id: crypto.randomUUID(),
            title: pick.title,
            type: pick.type,
            year: pick.year,
            addedBy: new LiveList([self.id]),
            addedAt: Date.now(),
          }),
        );
      }
    },
    [],
  );
  const [pulling, setPulling] = useState(false);

  const handlePull = async () => {
    if (profile.state !== "ready") return;
    if (consensus.phase !== "voting") return;
    setPulling(true);
    try {
      const picks = pickCandidates(profile.data, consensus.candidatesPerPull);
      if (picks.length > 0) pullCandidates(picks);
    } finally {
      setPulling(false);
    }
  };

  const removeCandidate = useMutation(({ storage }, id: string) => {
    if (storage.get("consensus").get("phase") !== "voting") return;
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
    if (storage.get("consensus").get("phase") !== "voting") return;
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
    if (storage.get("consensus").get("phase") !== "voting") return;
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

  const setThreshold = useMutation(({ storage, self }, rule: ThresholdRule) => {
    const c = storage.get("consensus");
    if (self.id !== c.get("hostId")) return;
    if (c.get("phase") !== "voting") return;
    c.set("threshold", rule);
  }, []);

  const setCandidatesPerPull = useMutation(({ storage, self }, n: number) => {
    const c = storage.get("consensus");
    if (self.id !== c.get("hostId")) return;
    if (c.get("phase") !== "voting") return;
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(1, Math.min(20, Math.floor(n)));
    c.set("candidatesPerPull", clamped);
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
    if (c.get("phase") !== "decided") return; // only valid from decided phase
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

  const setHost = useMutation(({ storage }, newHostId: string) => {
    const c = storage.get("consensus");
    // Idempotent: only write when current host actually needs replacing.
    if (c.get("hostId") === newHostId) return;
    c.set("hostId", newHostId);
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

  useEffect(() => {
    if (!self.id) return;
    const hostId = consensus.hostId;
    const present: { id: string; connectionId: number }[] = [];
    present.push({ id: self.id, connectionId: self.connectionId });
    for (const o of others) {
      if (o.id) present.push({ id: o.id, connectionId: o.connectionId });
    }
    if (present.length === 0) return;

    const hostStillPresent = present.some((p) => p.id === hostId);
    if (hostStillPresent) return;

    // Pick the lowest connectionId in the present set. Liveblocks assigns
    // unique connectionIds per active connection in a room, so every client
    // computes the same successor independently. Reconnects assign new ids,
    // so this is "earliest unbroken connection," not "longest user history."
    // CRDT resolves the case where multiple clients write at once.
    const successor = present.reduce((min, p) =>
      p.connectionId < min.connectionId ? p : min,
    );
    if (successor.id === self.id) {
      setHost(self.id);
    }
  }, [self.id, self.connectionId, others, consensus.hostId, setHost]);

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
          threshold={consensus.threshold as ThresholdRule}
          isHost={isHost}
          presentCount={presentMemberIds.size}
          onChange={setThreshold}
          candidatesPerPull={consensus.candidatesPerPull}
          onCandidatesPerPullChange={setCandidatesPerPull}
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
            spinningTitles={spinningTitles}
            animateOnMount={observedTransition}
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
          pullersByCandidateId={pullersByCandidateId}
          locked={consensus.phase === "decided"}
          pullState={
            profile.state === "idle"
              ? { kind: "idle" }
              : profile.state === "loading"
                ? { kind: "loading" }
                : profile.state === "no-profile"
                  ? { kind: "no-profile" }
                  : profile.state === "error"
                    ? { kind: "error", message: profile.message }
                    : { kind: "ready", pulling }
          }
          onAdd={addCandidate}
          onRemove={removeCandidate}
          onVote={castVote}
          onUnvote={unvote}
          onPull={handlePull}
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

type PullState =
  | { kind: "ready"; pulling: boolean }
  | { kind: "no-profile" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "idle" };

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

function CandidatesPanel({
  candidates,
  votes,
  userInfoById,
  votedCandidateIds,
  pullersByCandidateId,
  locked,
  pullState,
  onAdd,
  onRemove,
  onVote,
  onUnvote,
  onPull,
}: {
  candidates: readonly { readonly id: string; readonly title: string; readonly type: string; readonly year: number | null }[];
  votes: ReadonlyMap<string, readonly string[]>;
  userInfoById: ReadonlyMap<string, UserInfo>;
  votedCandidateIds: ReadonlySet<string>;
  pullersByCandidateId: ReadonlyMap<string, readonly string[]>;
  locked: boolean;
  pullState: PullState;
  onAdd: (title: string) => void;
  onRemove: (id: string) => void;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  onPull: () => void;
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
            disabled={locked}
            className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:border-border-strong focus:outline-none"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={locked || !draft.trim()}
          >
            Add
          </Button>
        </form>

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
                userInfoById={userInfoById}
                voted={votedCandidateIds.has(c.id)}
                locked={locked}
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
  pullerIds,
  userInfoById,
  voted,
  locked,
  onVote,
  onUnvote,
  onRemove,
}: {
  candidate: {
    readonly id: string;
    readonly title: string;
    readonly type: string;
    readonly year: number | null;
  };
  voterIds: readonly string[];
  pullerIds: readonly string[];
  userInfoById: ReadonlyMap<string, UserInfo>;
  voted: boolean;
  locked: boolean;
  onVote: (id: string) => void;
  onUnvote: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const meta =
    candidate.type !== "unknown" || candidate.year !== null
      ? formatMeta(candidate.type, candidate.year)
      : null;

  const pullerCaption = formatPullers(pullerIds, userInfoById);

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg/40 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
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
    </li>
  );
}

function formatMeta(type: string, year: number | null): string {
  const parts: string[] = [];
  if (type !== "unknown") parts.push(type);
  if (year !== null) parts.push(String(year));
  return parts.length > 0 ? `(${parts.join(" · ")})` : "";
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
