import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useOthers,
  useSelf,
  useStorage,
  useUpdateMyPresence,
} from "@liveblocks/react/suspense";
import { LiveList, LiveObject } from "@liveblocks/client";
import { useAuth } from "@clerk/clerk-react";
import type { Candidate, ConsensusPhase, ThresholdRule } from "../lib/liveblocks";
import { evaluate } from "../lib/consensus";
import { normalizeTitle, pickCandidates, type PickedCandidate } from "../lib/candidates";
import { searchTmdb, pickBestMatch } from "../lib/tmdb";
import { useResonanceProfile } from "./useResonanceProfile";

export type UserInfo = { name?: string; avatarUrl?: string };

export type PullState =
  | { kind: "ready"; pulling: boolean }
  | { kind: "no-profile" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "idle" };

export function useConsensusRoom() {
  const candidates = useStorage((root) => root.candidates);
  const votes = useStorage((root) => root.votes);
  const consensus = useStorage((root) => root.consensus);
  const others = useOthers();
  const self = useSelf();
  const profile = useResonanceProfile();
  const { getToken } = useAuth();

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

  const updateMyPresence = useUpdateMyPresence();

  // Phase-transition handler. Three concerns interleaved on the same trigger
  // (consensus.phase changed since last render): track prevPhase, set the
  // animation gate observedTransition, and reset this client's own Done flag
  // when the room reverts from decided to voting.
  if (prevPhase !== consensus.phase) {
    setPrevPhase(consensus.phase);
    if (prevPhase === "voting" && consensus.phase === "decided") {
      setObservedTransition(true);
    } else if (consensus.phase === "voting") {
      setObservedTransition(false);
      updateMyPresence({ votingComplete: false });
    }
  }

  const votesSnapshot = useMemo(() => {
    const map = new Map<string, readonly string[]>();
    for (const [id, voters] of votes) map.set(id, voters);
    return map;
  }, [votes]);

  const allPresentDone = useMemo(() => {
    if (!self.presence?.votingComplete) return false;
    for (const other of others) {
      if (!other.id) continue;
      if (!other.presence?.votingComplete) return false;
    }
    return true;
  }, [self.presence?.votingComplete, others]);

  const currentEvaluation = useMemo(
    () =>
      evaluate(
        votesSnapshot,
        consensus.threshold as ThresholdRule,
        presentMemberIds,
      ),
    [votesSnapshot, consensus.threshold, presentMemberIds],
  );

  const noConsensusYet =
    consensus.phase === "voting" &&
    allPresentDone &&
    currentEvaluation.winnerId === null;

  const finalizeDisabled = currentEvaluation.winnerId === null;

  const readyCount = useMemo(() => {
    let count = self.presence?.votingComplete ? 1 : 0;
    for (const other of others) {
      if (!other.id) continue;
      if (other.presence?.votingComplete) count += 1;
    }
    return count;
  }, [self.presence?.votingComplete, others]);

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
    (
      { storage, self },
      title: string,
      meta?: {
        tmdbId: number;
        posterUrl: string | null;
        type: import("../lib/candidates").CandidateType;
        year: number | null;
      },
    ) => {
      if (storage.get("consensus").get("phase") !== "voting") return;
      const cleanedTitle = title.trim();
      if (!cleanedTitle) return;
      const list = storage.get("candidates");
      const normalized = normalizeTitle(cleanedTitle);
      // Dedup: append self to addedBy if the title is already in the list.
      // Covers sequential adds only. True simultaneous adds from two
      // clients both see an empty list and both push, producing a
      // duplicate row that the spec accepts as a CRDT race we don't
      // server-side merge. Don't overwrite existing TMDB metadata on a
      // duplicate add — first writer wins on posterUrl/tmdbId.
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
          type: meta?.type ?? "unknown",
          year: meta?.year ?? null,
          posterUrl: meta?.posterUrl ?? null,
          tmdbId: meta?.tmdbId ?? null,
          addedBy: new LiveList([self.id]),
          addedAt: Date.now(),
        }),
      );
    },
    [],
  );

  type EnrichedCandidate = PickedCandidate & {
    posterUrl: string | null;
    tmdbId: number | null;
  };

  const pullCandidates = useMutation(
    ({ storage, self }, picked: readonly EnrichedCandidate[]) => {
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
            posterUrl: pick.posterUrl,
            tmdbId: pick.tmdbId,
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
      if (picks.length === 0) return;

      const token = await getToken();

      // Run all TMDB lookups in parallel. One failed lookup shouldn't
      // block the rest — Promise.allSettled gives each pick its own
      // outcome and we fall back to posterUrl=null on failure.
      const settled = await Promise.allSettled(
        picks.map(async (pick): Promise<EnrichedCandidate> => {
          if (!token) return { ...pick, posterUrl: null, tmdbId: null };
          // Map candidate type to TMDB mediaType filter.
          const tmdbType: "movie" | "tv" | null =
            pick.type === "movie"
              ? "movie"
              : pick.type === "show" || pick.type === "anime"
                ? "tv"
                : null;
          const results = await searchTmdb(pick.title, token);
          const best = pickBestMatch(results, tmdbType, pick.year);
          return {
            ...pick,
            posterUrl: best?.posterUrl ?? null,
            tmdbId: best?.tmdbId ?? null,
          };
        }),
      );

      const enriched: EnrichedCandidate[] = settled.map((result, i) =>
        result.status === "fulfilled"
          ? result.value
          : { ...picks[i], posterUrl: null, tmdbId: null },
      );

      pullCandidates(enriched);
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

  const handleVote = (candidateId: string) => {
    castVote(candidateId);
    updateMyPresence({ votingComplete: false });
  };

  const handleUnvote = (candidateId: string) => {
    unvote(candidateId);
    updateMyPresence({ votingComplete: false });
  };

  const handleToggleReady = (ready: boolean) => {
    updateMyPresence({ votingComplete: ready });
  };

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

  const handleFinalizeNow = () => {
    if (!isHost) return;
    if (consensus.phase !== "voting") return;
    if (currentEvaluation.winnerId === null) return;
    lockConsensus({
      winnerId: currentEvaluation.winnerId,
      tiedIds: currentEvaluation.tiedIds,
    });
  };

  useEffect(() => {
    if (consensus.phase !== "voting") return;
    if (!allPresentDone) return;
    // Liveblocks widens nested LiveObject fields to Lson via the
    // [key: string]: Lson | undefined index signature on Consensus,
    // re-narrow to the original ThresholdRule shape.
    const result = evaluate(
      votesSnapshot,
      consensus.threshold as ThresholdRule,
      presentMemberIds,
    );
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
    allPresentDone,
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

  const pullState: PullState = useMemo(
    () =>
      profile.state === "idle"
        ? { kind: "idle" }
        : profile.state === "loading"
          ? { kind: "loading" }
          : profile.state === "no-profile"
            ? { kind: "no-profile" }
            : profile.state === "error"
              ? { kind: "error", message: profile.message }
              : { kind: "ready", pulling },
    [profile, pulling],
  );

  return {
    // identity
    self,
    others,
    isHost,
    // raw storage
    candidates,
    votes,
    consensus,
    // derived
    presentMemberIds,
    userInfoById,
    votesSnapshot,
    votedCandidateIds,
    pullersByCandidateId,
    spinningTitles,
    // finalize-voting
    allPresentDone,
    currentEvaluation,
    noConsensusYet,
    finalizeDisabled,
    readyCount,
    // animation gate
    observedTransition,
    // pull state
    pullState,
    // handlers
    addCandidate,
    removeCandidate,
    handleVote,
    handleUnvote,
    handlePull,
    handleToggleReady,
    handleFinalizeNow,
    reconsider,
    setThreshold,
    setCandidatesPerPull,
  } as const;
}
