import { describe, expect, it } from "vitest";
import { parseProfileExport } from "./api";

// Fixture matches the real shape Resonance's /api/profile/export
// returns. library and recommendations are TOP-LEVEL alongside profile.
// Each item uses `mediaType` (Resonance's field name), not `type`.
function exampleRawExport() {
  return {
    profile: {
      themes: [{ label: "epic", weight: 0.8 }],
      archetypes: [{ label: "wanderer" }],
      mediaAffinities: [],
    },
    library: [
      {
        id: "L1",
        title: "Dune Part Two",
        mediaType: "movie",
        year: 2024,
        rating: null,
        source: "library",
        status: "want_to_consume",
        fitNote: null,
        tasteTags: [],
      },
      {
        id: "L2",
        title: "The Three-Body Problem",
        mediaType: "book",
        year: 2008,
        rating: 5,
        source: "library",
        status: "consumed",
        fitNote: "evidence-anchored mystery",
        tasteTags: ["sci-fi"],
      },
    ],
    recommendations: [
      {
        id: "R1",
        title: "Severance",
        mediaType: "show",
        year: 2022,
        matchScore: 0.91,
        tasteTags: ["mystery"],
        status: "pending",
        rating: null,
        explanation: "fits your taste for slow-burn corporate dread",
      },
    ],
    favorites: [],
    avoidances: [],
  };
}

describe("parseProfileExport", () => {
  it("extracts library from the top level (not inside profile)", () => {
    const snapshot = parseProfileExport(exampleRawExport());
    expect(snapshot.library).toHaveLength(2);
    expect(snapshot.library[0].title).toBe("Dune Part Two");
  });

  it("extracts recommendations from the top level", () => {
    const snapshot = parseProfileExport(exampleRawExport());
    expect(snapshot.recommendations).toHaveLength(1);
    expect(snapshot.recommendations[0].title).toBe("Severance");
  });

  it("maps mediaType to type", () => {
    const snapshot = parseProfileExport(exampleRawExport());
    expect(snapshot.library[0].type).toBe("movie");
    expect(snapshot.library[1].type).toBe("book");
    expect(snapshot.recommendations[0].type).toBe("show");
  });

  it("preserves year", () => {
    const snapshot = parseProfileExport(exampleRawExport());
    expect(snapshot.library[0].year).toBe(2024);
    expect(snapshot.recommendations[0].year).toBe(2022);
  });

  it("preserves themes and archetypes", () => {
    const snapshot = parseProfileExport(exampleRawExport());
    expect(snapshot.themes).toEqual([{ label: "epic", weight: 0.8 }]);
    expect(snapshot.archetypes).toEqual([{ label: "wanderer" }]);
  });

  it("returns empty library/recommendations when fields are absent", () => {
    const raw = {
      profile: { themes: [], archetypes: [], mediaAffinities: [] },
    };
    const snapshot = parseProfileExport(raw);
    expect(snapshot.library).toEqual([]);
    expect(snapshot.recommendations).toEqual([]);
  });

  it("drops items without a string title", () => {
    const raw = {
      profile: { themes: [], archetypes: [], mediaAffinities: [] },
      library: [
        { mediaType: "movie", year: 2024 },
        { title: "Valid", mediaType: "movie", year: 2024 },
      ],
      recommendations: [],
    };
    const snapshot = parseProfileExport(raw);
    expect(snapshot.library).toEqual([
      { title: "Valid", type: "movie", year: 2024 },
    ]);
  });

  it("treats non-string mediaType as undefined type", () => {
    const raw = {
      profile: { themes: [], archetypes: [], mediaAffinities: [] },
      library: [{ title: "X", mediaType: 42, year: 2024 }],
      recommendations: [],
    };
    const snapshot = parseProfileExport(raw);
    expect(snapshot.library[0].type).toBeUndefined();
  });

  it("treats non-number year as undefined", () => {
    const raw = {
      profile: { themes: [], archetypes: [], mediaAffinities: [] },
      library: [{ title: "X", mediaType: "movie", year: "2024" }],
      recommendations: [],
    };
    const snapshot = parseProfileExport(raw);
    expect(snapshot.library[0].year).toBeUndefined();
  });
});
