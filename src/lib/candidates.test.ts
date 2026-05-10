import { describe, expect, it } from "vitest";
import { pickCandidates, normalizeTitle } from "./candidates";
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
    expect(result[0]).toEqual({ title: "Dune", type: "movie", year: 2024 });
  });

  it("normalizes unknown type to 'unknown'", () => {
    const result = pickCandidates(
      {
        library: [{ title: "Mystery", type: "videogame", year: 2024 }],
        recommendations: [],
      },
      1,
    );
    expect(result[0].type).toBe("unknown");
  });

  it("missing type or year produces 'unknown' / null", () => {
    const result = pickCandidates(
      {
        library: [{ title: "Bare" }],
        recommendations: [],
      },
      1,
    );
    expect(result[0]).toEqual({ title: "Bare", type: "unknown", year: null });
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
