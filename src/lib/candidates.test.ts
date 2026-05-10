import { describe, expect, it } from "vitest";
import {
  pickCandidates,
  normalizeTitle,
  hasWatchableContent,
  countAvailableForPull,
} from "./candidates";
import type { ResonanceItem } from "../types/profile";

function lib(...titles: string[]): ResonanceItem[] {
  return titles.map((t) => ({ title: t, type: "movie", year: 2024 }));
}

function recs(...titles: string[]): ResonanceItem[] {
  return titles.map((t) => ({ title: t, type: "show", year: 2023 }));
}

describe("pickCandidates", () => {
  it("returns empty when count is 0", () => {
    expect(pickCandidates({ library: lib("a"), recommendations: recs("b") }, 0)).toEqual([]);
  });

  it("returns empty when both slices are empty", () => {
    expect(pickCandidates({ library: [], recommendations: [] }, 5)).toEqual([]);
  });

  it("clamps count above 20 to 20", () => {
    const big = lib(...Array.from({ length: 30 }, (_, i) => `lib${i}`));
    const result = pickCandidates({ library: big, recommendations: [] }, 100);
    expect(result.length).toBe(20);
  });

  it("default split: 5 items = 3 library + 2 recs", () => {
    const result = pickCandidates(
      {
        library: lib("L1", "L2", "L3", "L4", "L5"),
        recommendations: recs("R1", "R2", "R3", "R4", "R5"),
      },
      5,
    );
    expect(result.map((p) => p.title)).toEqual(["L1", "L2", "L3", "R1", "R2"]);
  });

  it("backfills from recs when library is short", () => {
    const result = pickCandidates(
      {
        library: lib("L1"),
        recommendations: recs("R1", "R2", "R3", "R4", "R5"),
      },
      5,
    );
    // count=5: libraryShare=3, recsShare=2. Library has only 1, so
    // libraryShortBy=2 → recsBackfill=recs.slice(2,4)=["R3","R4"].
    // Merged order: libraryHead, recsBackfill, recsHead, libraryBackfill.
    expect(result.map((p) => p.title)).toEqual(["L1", "R3", "R4", "R1", "R2"]);
  });

  it("backfills from library when recs is short", () => {
    const result = pickCandidates(
      {
        library: lib("L1", "L2", "L3", "L4", "L5"),
        recommendations: recs("R1"),
      },
      5,
    );
    // count=5: libraryShare=3, recsShare=2. Recs has only 1, so
    // recsShortBy=1 → libraryBackfill=library.slice(3,4)=["L4"].
    // Merged order: libraryHead, recsBackfill (empty), recsHead, libraryBackfill.
    expect(result.map((p) => p.title)).toEqual(["L1", "L2", "L3", "R1", "L4"]);
  });

  it("returns total available when both sides cannot meet count", () => {
    const result = pickCandidates(
      { library: lib("L1"), recommendations: recs("R1") },
      5,
    );
    expect(result.length).toBe(2);
  });

  it("preserves type when known", () => {
    const result = pickCandidates(
      {
        library: [{ title: "Dune", type: "movie", year: 2024 }],
        recommendations: [],
      },
      1,
    );
    expect(result[0]).toEqual({
      title: "Dune",
      type: "movie",
      year: 2024,
      tasteTags: [],
    });
  });

  it("filters out items with unrecognized types (e.g. videogame)", () => {
    const result = pickCandidates(
      {
        library: [{ title: "Mystery", type: "videogame", year: 2024 }],
        recommendations: [],
      },
      5,
    );
    expect(result).toEqual([]);
  });

  it("filters out items with missing type", () => {
    const result = pickCandidates(
      {
        library: [{ title: "Bare" }],
        recommendations: [],
      },
      5,
    );
    expect(result).toEqual([]);
  });

  it("includes anime items", () => {
    const result = pickCandidates(
      {
        library: [{ title: "Frieren", type: "anime", year: 2023 }],
        recommendations: [],
      },
      1,
    );
    expect(result).toEqual([
      { title: "Frieren", type: "anime", year: 2023, tasteTags: [] },
    ]);
  });

  it("filters out books, games, music, podcasts", () => {
    const result = pickCandidates(
      {
        library: [
          { title: "B", type: "book", year: 2020 },
          { title: "G", type: "game", year: 2020 },
          { title: "M", type: "music", year: 2020 },
          { title: "P", type: "podcast", year: 2020 },
        ],
        recommendations: [],
      },
      10,
    );
    expect(result).toEqual([]);
  });

  it("year is null when missing on an allowed-type item", () => {
    const result = pickCandidates(
      {
        library: [{ title: "Yearless", type: "movie" }],
        recommendations: [],
      },
      1,
    );
    expect(result[0]).toEqual({
      title: "Yearless",
      type: "movie",
      year: null,
      tasteTags: [],
    });
  });

  it("type comparison is case-insensitive", () => {
    const result = pickCandidates(
      {
        library: [{ title: "X", type: "MOVIE", year: 2024 }],
        recommendations: [],
      },
      1,
    );
    expect(result[0].type).toBe("movie");
  });

  it("excludes titles already in the room", () => {
    const result = pickCandidates(
      {
        library: lib("Dune", "Arrival", "Inception"),
        recommendations: recs("Sicario", "Tenet"),
      },
      5,
      new Set(["dune", "sicario"]),
    );
    expect(result.map((p) => p.title)).toEqual([
      "Arrival",
      "Inception",
      "Tenet",
    ]);
  });

  it("normalizes excluded titles for case and whitespace match", () => {
    const result = pickCandidates(
      {
        library: lib("Dune Part Two", "Arrival"),
        recommendations: [],
      },
      2,
      new Set([normalizeTitle("DUNE  Part   Two")]),
    );
    expect(result.map((p) => p.title)).toEqual(["Arrival"]);
  });

  it("returns fewer than count when exclusions deplete the pool", () => {
    const result = pickCandidates(
      {
        library: lib("A", "B"),
        recommendations: recs("C", "D"),
      },
      10,
      new Set(["a", "c"]),
    );
    expect(result.map((p) => p.title).sort()).toEqual(["B", "D"]);
  });
});

describe("hasWatchableContent", () => {
  it("returns true when library has a movie", () => {
    expect(
      hasWatchableContent({
        library: [{ title: "X", type: "movie", year: 2024 }],
        recommendations: [],
      }),
    ).toBe(true);
  });

  it("returns true when only recommendations have a show", () => {
    expect(
      hasWatchableContent({
        library: [],
        recommendations: [{ title: "X", type: "show", year: 2024 }],
      }),
    ).toBe(true);
  });

  it("returns true when only anime is present", () => {
    expect(
      hasWatchableContent({
        library: [{ title: "Frieren", type: "anime", year: 2023 }],
        recommendations: [],
      }),
    ).toBe(true);
  });

  it("returns false when only books, games, music, podcasts are present", () => {
    expect(
      hasWatchableContent({
        library: [
          { title: "B", type: "book", year: 2020 },
          { title: "G", type: "game", year: 2020 },
        ],
        recommendations: [
          { title: "M", type: "music", year: 2020 },
          { title: "P", type: "podcast", year: 2020 },
        ],
      }),
    ).toBe(false);
  });

  it("returns false when both slices are empty", () => {
    expect(hasWatchableContent({ library: [], recommendations: [] })).toBe(
      false,
    );
  });
});

describe("countAvailableForPull", () => {
  it("returns total watchable count when excluded is empty", () => {
    expect(
      countAvailableForPull(
        { library: lib("A", "B", "C"), recommendations: recs("D") },
        new Set(),
      ),
    ).toBe(4);
  });

  it("subtracts excluded titles", () => {
    expect(
      countAvailableForPull(
        { library: lib("A", "B"), recommendations: recs("C") },
        new Set(["a"]),
      ),
    ).toBe(2);
  });

  it("ignores non-watchable types when counting", () => {
    expect(
      countAvailableForPull(
        {
          library: [
            { title: "B", type: "book", year: 2020 },
            { title: "A", type: "movie", year: 2024 },
          ],
          recommendations: [],
        },
        new Set(),
      ),
    ).toBe(1);
  });

  it("returns 0 when everything is excluded", () => {
    expect(
      countAvailableForPull(
        { library: lib("A"), recommendations: recs("B") },
        new Set(["a", "b"]),
      ),
    ).toBe(0);
  });
});

describe("normalizeTitle", () => {
  it("lowercases", () => {
    expect(normalizeTitle("Dune Part Two")).toBe("dune part two");
  });

  it("trims", () => {
    expect(normalizeTitle("  Dune  ")).toBe("dune");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeTitle("Dune   Part    Two")).toBe("dune part two");
  });

  it("treats different casings and spacings as the same", () => {
    expect(normalizeTitle("DUNE Part   Two ")).toBe(normalizeTitle("dune part two"));
  });
});
