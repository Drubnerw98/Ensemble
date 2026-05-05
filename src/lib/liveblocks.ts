import type { LiveList, LiveMap, LiveObject } from "@liveblocks/client";

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

// Module augmentation tells Liveblocks' hooks (useStorage, useSelf, etc.)
// what shape our room data has so they're typed end-to-end.
declare global {
  interface Liveblocks {
    Presence: Record<string, never>;
    Storage: {
      candidates: LiveList<LiveObject<Candidate>>;
      votes: LiveMap<string, LiveList<string>>;
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
