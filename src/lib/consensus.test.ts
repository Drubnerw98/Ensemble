import { describe, expect, it, vi } from "vitest";
import { evaluate } from "./consensus";
import type { ThresholdRule } from "./liveblocks";

function rule(kind: ThresholdRule["kind"], n?: number): ThresholdRule {
  if (kind === "first-to-n") return { kind, n: n ?? 0 };
  return { kind } as ThresholdRule;
}

describe("evaluate", () => {
  describe("unanimous", () => {
    it("returns no winner when no one has voted", () => {
      const result = evaluate(
        new Map(),
        rule("unanimous"),
        new Set(["u1", "u2"]),
      );
      expect(result).toEqual({ winnerId: null, tiedIds: [] });
    });

    it("returns no winner when only some present members voted", () => {
      const result = evaluate(
        new Map([["c1", ["u1"]]]),
        rule("unanimous"),
        new Set(["u1", "u2", "u3"]),
      );
      expect(result).toEqual({ winnerId: null, tiedIds: [] });
    });

    it("returns winner when all present members voted for one candidate", () => {
      const result = evaluate(
        new Map([["c1", ["u1", "u2", "u3"]]]),
        rule("unanimous"),
        new Set(["u1", "u2", "u3"]),
      );
      expect(result).toEqual({ winnerId: "c1", tiedIds: ["c1"] });
    });

    it("ignores votes from non-present members in the denominator", () => {
      const result = evaluate(
        new Map([["c1", ["u1", "u2"]]]),
        rule("unanimous"),
        new Set(["u1", "u2"]),
      );
      expect(result).toEqual({ winnerId: "c1", tiedIds: ["c1"] });
    });
  });

  describe("majority", () => {
    it("returns no winner at exactly 50%", () => {
      const result = evaluate(
        new Map([["c1", ["u1", "u2"]]]),
        rule("majority"),
        new Set(["u1", "u2", "u3", "u4"]),
      );
      expect(result).toEqual({ winnerId: null, tiedIds: [] });
    });

    it("returns winner when strict majority is reached", () => {
      const result = evaluate(
        new Map([["c1", ["u1", "u2", "u3"]]]),
        rule("majority"),
        new Set(["u1", "u2", "u3", "u4"]),
      );
      expect(result).toEqual({ winnerId: "c1", tiedIds: ["c1"] });
    });

    it("returns no winner when nobody has crossed", () => {
      const result = evaluate(
        new Map([
          ["c1", ["u1"]],
          ["c2", ["u2"]],
        ]),
        rule("majority"),
        new Set(["u1", "u2", "u3"]),
      );
      expect(result).toEqual({ winnerId: null, tiedIds: [] });
    });
  });

  describe("first-to-n", () => {
    it("returns no winner below n", () => {
      const result = evaluate(
        new Map([["c1", ["u1"]]]),
        rule("first-to-n", 2),
        new Set(["u1", "u2", "u3"]),
      );
      expect(result).toEqual({ winnerId: null, tiedIds: [] });
    });

    it("returns winner at n", () => {
      const result = evaluate(
        new Map([["c1", ["u1", "u2"]]]),
        rule("first-to-n", 2),
        new Set(["u1", "u2", "u3"]),
      );
      expect(result).toEqual({ winnerId: "c1", tiedIds: ["c1"] });
    });

    it("returns winner above n", () => {
      const result = evaluate(
        new Map([["c1", ["u1", "u2", "u3"]]]),
        rule("first-to-n", 2),
        new Set(["u1", "u2", "u3"]),
      );
      expect(result).toEqual({ winnerId: "c1", tiedIds: ["c1"] });
    });
  });

  describe("ties", () => {
    it("returns all tied candidates and a randomly chosen winner under unanimous", () => {
      const spy = vi.spyOn(Math, "random").mockReturnValue(0); // picks index 0
      try {
        const result = evaluate(
          new Map([
            ["c1", ["u1", "u2"]],
            ["c2", ["u1", "u2"]],
          ]),
          rule("unanimous"),
          new Set(["u1", "u2"]),
        );
        expect(result.tiedIds.sort()).toEqual(["c1", "c2"]);
        expect(result.tiedIds).toContain(result.winnerId);
      } finally {
        spy.mockRestore();
      }
    });

    it("picks deterministically when Math.random is stubbed", () => {
      const spy = vi.spyOn(Math, "random").mockReturnValue(0.99); // picks last index
      try {
        const result = evaluate(
          new Map([
            ["c1", ["u1", "u2"]],
            ["c2", ["u1", "u2"]],
          ]),
          rule("unanimous"),
          new Set(["u1", "u2"]),
        );
        const sorted = [...result.tiedIds].sort();
        expect(result.winnerId).toBe(sorted[sorted.length - 1]);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe("edge cases", () => {
    it("handles empty members and empty votes", () => {
      const result = evaluate(new Map(), rule("unanimous"), new Set());
      expect(result).toEqual({ winnerId: null, tiedIds: [] });
    });

    it("handles empty members under majority without dividing by zero", () => {
      const result = evaluate(new Map(), rule("majority"), new Set());
      expect(result).toEqual({ winnerId: null, tiedIds: [] });
    });

    it("ignores candidates with zero votes", () => {
      const result = evaluate(
        new Map([
          ["c1", []],
          ["c2", ["u1", "u2"]],
        ]),
        rule("unanimous"),
        new Set(["u1", "u2"]),
      );
      expect(result).toEqual({ winnerId: "c2", tiedIds: ["c2"] });
    });
  });
});
