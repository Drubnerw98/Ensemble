import type {
  LiveList,
  LiveMap,
  LiveObject,
  Lson,
} from "@liveblocks/client";
import type { CandidateType } from "./candidates";

export type ReactionKind = "thumbsUp" | "heart" | "thinking" | "yikes";

export type Reactions = {
  thumbsUp: LiveList<string>;
  heart: LiveList<string>;
  thinking: LiveList<string>;
  yikes: LiveList<string>;
};

// Re-export so consumers that work with storage shapes can import
// CandidateType from this module without reaching into ./candidates.
export type { CandidateType } from "./candidates";

export type Candidate = {
  id: string;
  title: string;
  type: CandidateType;
  year: number | null;
  addedBy: LiveList<string>;
  addedAt: number;
  // Optional — added in the TMDB enrichment pass. Absent on candidates
  // created before that change; render as a placeholder when null/missing.
  posterUrl?: string | null;
  tmdbId?: number | null;
  // Carried from Resonance items at pull-time so the cross-attribution
  // matcher can score against each member's profile snapshot. Stored as
  // a plain array of strings (not a LiveList) since tags are immutable
  // once a candidate is created.
  tasteTags?: string[];
  // Widened from string | number to satisfy LsonObject now that the
  // type holds a Live* node (addedBy) and nullable primitives (year).
  // Mirrors the index signature on Consensus.
  [key: string]: Lson | undefined;
};

// Per-member profile snapshot stored in Liveblocks Storage so cross-
// attribution survives a member dropping mid-session. Frozen at first
// pull (or session join) — a member's Resonance profile may evolve
// after they pull, but the room's view of their themes/archetypes
// stays stable to keep the merged-profile artifact deterministic.
//
// Minimum-viable shape: themes (label + weight) and archetypes (label).
// Library, favorites, avoidances are NOT mirrored here — the cross-
// attribution matcher only needs theme/archetype labels.
export type MemberProfileSnapshot = {
  userId: string;
  themes: { label: string; weight: number }[];
  archetypes: { label: string }[];
  capturedAt: number;
  [key: string]: Lson | undefined;
};

export type ThresholdRule =
  | { kind: "unanimous" }
  | { kind: "majority" }
  | { kind: "first-to-n"; n: number };

export type ConsensusPhase = "voting" | "decided";

export type Consensus = {
  hostId: string;
  threshold: ThresholdRule;
  phase: ConsensusPhase;
  winnerId: string | null;
  tiedIds: string[];
  decidedAt: number | null;
  candidatesPerPull: number;
  [key: string]: Lson | undefined;
};

// Module augmentation tells Liveblocks' hooks (useStorage, useSelf, etc.)
// what shape our room data has so they're typed end-to-end.
declare global {
  interface Liveblocks {
    Presence: { votingComplete: boolean };
    Storage: {
      candidates: LiveList<LiveObject<Candidate>>;
      votes: LiveMap<string, LiveList<string>>;
      consensus: LiveObject<Consensus>;
      reactions: LiveMap<string, LiveObject<Reactions>>;
      // Cross-attribution source-of-truth: themes + archetypes per
      // present (or previously-present) member. Written on first pull
      // by each member; read by every client to render "this candidate
      // also matches Alex's interior-fracture theme" chips.
      memberProfiles: LiveMap<string, LiveObject<MemberProfileSnapshot>>;
    };
    UserMeta: {
      id: string;
      info: {
        name: string;
        avatarUrl?: string;
      };
    };
  }
}
