import type { LiveList, LiveMap, LiveObject, Lson } from "@liveblocks/client";

// Index signature satisfies Liveblocks' LsonObject constraint — values
// stored in Liveblocks Storage must be primitives, Live* nodes, or plain
// objects that allow string-keyed access.
export type Candidate = {
  id: string;
  title: string;
  addedBy: string;
  addedAt: number;
  [key: string]: string | number;
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
  // Wider index signature than Candidate's — Consensus holds nested
  // objects (threshold), arrays (tiedIds), and nullable primitives.
  [key: string]: Lson | undefined;
};

// Module augmentation tells Liveblocks' hooks (useStorage, useSelf, etc.)
// what shape our room data has so they're typed end-to-end.
declare global {
  interface Liveblocks {
    Presence: Record<string, never>;
    Storage: {
      candidates: LiveList<LiveObject<Candidate>>;
      votes: LiveMap<string, LiveList<string>>;
      consensus: LiveObject<Consensus>;
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
