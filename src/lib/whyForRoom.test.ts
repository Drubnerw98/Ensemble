import { describe, expect, it } from "vitest";
import { whyForRoom } from "./whyForRoom";
import type { MemberProfileSnapshot } from "./liveblocks";

function snapshot(
  userId: string,
  themes: { label: string; weight: number }[],
  archetypes: { label: string }[] = [],
): MemberProfileSnapshot {
  return { userId, themes, archetypes, capturedAt: 0 };
}

function profiles(...entries: MemberProfileSnapshot[]) {
  const map = new Map<string, MemberProfileSnapshot>();
  for (const e of entries) map.set(e.userId, e);
  return map;
}

describe("whyForRoom", () => {
  it("matches a candidate against another member's theme", () => {
    const result = whyForRoom(
      { tasteTags: ["interior fracture"] },
      profiles(snapshot("alex", [{ label: "interior fracture", weight: 0.7 }])),
      ["puller"],
    );
    expect(result).toEqual([
      {
        userId: "alex",
        matchedLabel: "interior fracture",
        kind: "theme",
        weight: 0.7,
      },
    ]);
  });

  it("returns no chips when the candidate matches nothing in the room", () => {
    const result = whyForRoom(
      { tasteTags: ["space opera"] },
      profiles(snapshot("alex", [{ label: "interior fracture", weight: 0.7 }])),
      ["puller"],
    );
    expect(result).toEqual([]);
  });

  it("excludes the puller themselves even if their own profile matches", () => {
    const result = whyForRoom(
      { tasteTags: ["interior fracture"] },
      profiles(
        snapshot("alex", [{ label: "interior fracture", weight: 0.9 }]),
        snapshot("puller", [{ label: "interior fracture", weight: 0.9 }]),
      ),
      ["puller"],
    );
    // alex matches; puller is in addedBy and gets filtered out.
    expect(result.map((c) => c.userId)).toEqual(["alex"]);
  });

  it("returns one chip per matching member when a tag matches multiple members", () => {
    const result = whyForRoom(
      { tasteTags: ["burden carrying"] },
      profiles(
        snapshot("alex", [{ label: "burden carrying", weight: 0.6 }]),
        snapshot("sam", [{ label: "burden carrying", weight: 0.4 }]),
        snapshot("kim", [{ label: "space opera", weight: 0.5 }]),
      ),
      ["puller"],
    );
    expect(result.map((c) => c.userId).sort()).toEqual(["alex", "sam"]);
    // Highest weight first.
    expect(result[0].userId).toBe("alex");
  });

  it("returns no chips when the candidate has no tasteTags", () => {
    expect(
      whyForRoom(
        {},
        profiles(snapshot("alex", [{ label: "x", weight: 0.5 }])),
        [],
      ),
    ).toEqual([]);
    expect(
      whyForRoom(
        { tasteTags: [] },
        profiles(snapshot("alex", [{ label: "x", weight: 0.5 }])),
        [],
      ),
    ).toEqual([]);
  });

  it("excludes every puller when addedBy has multiple ids", () => {
    const result = whyForRoom(
      { tasteTags: ["interior fracture"] },
      profiles(
        snapshot("alex", [{ label: "interior fracture", weight: 0.7 }]),
        snapshot("sam", [{ label: "interior fracture", weight: 0.6 }]),
        snapshot("kim", [{ label: "interior fracture", weight: 0.5 }]),
      ),
      ["alex", "sam"],
    );
    expect(result.map((c) => c.userId)).toEqual(["kim"]);
  });

  it("matches archetypes too, distinct kind from themes", () => {
    const result = whyForRoom(
      { tasteTags: ["wanderer"] },
      profiles(snapshot("alex", [], [{ label: "wanderer" }])),
      [],
    );
    expect(result).toEqual([
      {
        userId: "alex",
        matchedLabel: "wanderer",
        kind: "archetype",
        weight: 0.5,
      },
    ]);
  });

  it("normalizes for case and whitespace", () => {
    const result = whyForRoom(
      { tasteTags: ["  Interior   FRACTURE  "] },
      profiles(snapshot("alex", [{ label: "interior fracture", weight: 0.7 }])),
      [],
    );
    expect(result).toHaveLength(1);
    expect(result[0].matchedLabel).toBe("interior fracture");
  });

  it("dedupes within a member when the same label is both theme and archetype", () => {
    const result = whyForRoom(
      { tasteTags: ["wanderer"] },
      profiles(
        snapshot(
          "alex",
          [{ label: "wanderer", weight: 0.9 }],
          [{ label: "wanderer" }],
        ),
      ),
      [],
    );
    // Archetype wins on internal dedup — see whyForRoom.ts.
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("archetype");
  });

  it("caps result at 6 chips, highest-weight first", () => {
    const themes = Array.from({ length: 10 }, (_, i) => ({
      label: `t${i}`,
      weight: i / 10,
    }));
    const tags = themes.map((t) => t.label);
    const result = whyForRoom(
      { tasteTags: tags },
      profiles(snapshot("alex", themes)),
      [],
    );
    expect(result).toHaveLength(6);
    expect(result[0].weight).toBe(0.9);
    expect(result[5].weight).toBe(0.4);
  });
});
