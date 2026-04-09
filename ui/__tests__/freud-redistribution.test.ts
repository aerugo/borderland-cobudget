import { describe, it, expect } from "vitest";
import {
  FreudDream,
  initRedistribution,
  stepRedistribution,
  finishRedistribution,
  getNextBucket,
} from "../utils/freud-redistribution";

function makeDream(
  id: string,
  goal: number,
  funded: number,
  funders: number,
  override?: FreudDream["override"],
  manualAmount?: number
): FreudDream {
  return { id, title: `Dream ${id}`, goal, stretch: goal, funded, funders, override, manualAmount };
}

function goalsFromDreams(dreams: FreudDream[]): Record<string, number> {
  const g: Record<string, number> = {};
  for (const d of dreams) g[d.id] = d.goal;
  return g;
}

describe("freud-redistribution", () => {
  describe("initRedistribution", () => {
    it("excludes fully funded dreams", () => {
      const dreams = [
        makeDream("a", 100, 100, 5),
        makeDream("b", 100, 50, 3),
      ];
      const state = initRedistribution(dreams, "funders");
      // Only "b" should be in sorted list (underfunded)
      expect(state.sortedIds).toEqual(["b"]);
    });

    it("excludes dreams with skip override", () => {
      const dreams = [
        makeDream("a", 100, 50, 5, "skip"),
        makeDream("b", 100, 50, 3),
      ];
      const state = initRedistribution(dreams, "funders");
      expect(state.sortedIds).toEqual(["b"]);
    });

    it("handles lock override by setting funded to goal", () => {
      const dreams = [
        makeDream("a", 100, 50, 5, "lock"),
        makeDream("b", 100, 50, 3),
      ];
      const state = initRedistribution(dreams, "funders");
      expect(state.amounts["a"]).toBe(100); // locked at goal
    });

    it("handles manual override", () => {
      const dreams = [
        makeDream("a", 100, 50, 5, "manual", 75),
        makeDream("b", 100, 50, 3),
      ];
      const state = initRedistribution(dreams, "funders");
      expect(state.amounts["a"]).toBe(75);
    });

    it("handles empty input", () => {
      const state = initRedistribution([], "combo");
      expect(state.isComplete).toBe(true);
      expect(state.sortedIds).toEqual([]);
    });

    it("handles single underfunded dream", () => {
      const dreams = [makeDream("a", 100, 50, 5)];
      const state = initRedistribution(dreams, "funders");
      expect(state.isComplete).toBe(true); // nothing to redistribute with 1 dream
    });
  });

  describe("sorting methods", () => {
    const dreams = [
      makeDream("a", 1000, 200, 10), // 20%, missing 800
      makeDream("b", 500, 400, 5),   // 80%, missing 100
      makeDream("c", 2000, 600, 20), // 30%, missing 1400
    ];

    it("funders: sorts by funder count descending", () => {
      const state = initRedistribution(dreams, "funders");
      // c=20 funders first, a=10 second, b=5 last
      expect(state.sortedIds).toEqual(["c", "a", "b"]);
    });

    it("sek: sorts by missing amount ascending", () => {
      const state = initRedistribution(dreams, "sek");
      // b=100 missing first, a=800 second, c=1400 last
      expect(state.sortedIds).toEqual(["b", "a", "c"]);
    });

    it("percent: sorts by percent funded descending", () => {
      const state = initRedistribution(dreams, "percent");
      // b=80% first, c=30% second, a=20% last
      expect(state.sortedIds).toEqual(["b", "c", "a"]);
    });

    it("combo: sorts by aggregated rank", () => {
      const state = initRedistribution(dreams, "combo");
      // b: funders=3, sek=1, percent=1 → rank 5
      // c: funders=1, sek=3, percent=2 → rank 6
      // a: funders=2, sek=2, percent=3 → rank 7
      expect(state.sortedIds).toEqual(["b", "c", "a"]);
    });
  });

  describe("stepRedistribution", () => {
    it("defunds bottom dream and funds top dream", () => {
      const dreams = [
        makeDream("top", 100, 80, 10),    // needs 20 more
        makeDream("bottom", 100, 30, 2),  // will be defunded
      ];
      const goals = goalsFromDreams(dreams);
      let state = initRedistribution(dreams, "funders");
      state = stepRedistribution(state, goals);

      expect(state.amounts["bottom"]).toBe(0);  // defunded
      expect(state.amounts["top"]).toBe(100);    // fully funded (80 + 20 from pot, pot had 30)
      expect(state.pot).toBe(10);                // 30 - 20 = 10 remaining
    });

    it("marks complete when only one dream remains", () => {
      const dreams = [
        makeDream("a", 100, 80, 10),
        makeDream("b", 100, 30, 2),
      ];
      const goals = goalsFromDreams(dreams);
      let state = initRedistribution(dreams, "funders");
      state = stepRedistribution(state, goals);
      expect(state.isComplete).toBe(true);
    });
  });

  describe("finishRedistribution", () => {
    it("produces same result as stepping through", () => {
      const dreams = [
        makeDream("a", 100, 80, 10),
        makeDream("b", 200, 50, 5),
        makeDream("c", 150, 30, 2),
      ];
      const goals = goalsFromDreams(dreams);

      // Step through
      let stepped = initRedistribution(dreams, "funders");
      while (!stepped.isComplete) {
        stepped = stepRedistribution(stepped, goals);
      }

      // Finish at once
      const finished = finishRedistribution(
        initRedistribution(dreams, "funders"),
        goals
      );

      expect(finished.amounts).toEqual(stepped.amounts);
      expect(finished.totalFunded).toEqual(stepped.totalFunded);
      expect(finished.totalContributed).toEqual(stepped.totalContributed);
    });

    it("handles all dreams already funded", () => {
      const dreams = [
        makeDream("a", 100, 100, 5),
        makeDream("b", 100, 200, 10),
      ];
      const goals = goalsFromDreams(dreams);
      const state = finishRedistribution(
        initRedistribution(dreams, "combo"),
        goals
      );
      expect(state.isComplete).toBe(true);
      expect(state.steps).toHaveLength(0);
    });
  });

  describe("getNextBucket", () => {
    it("returns the bottom dream as next to defund", () => {
      const dreams = [
        makeDream("top", 100, 80, 10),
        makeDream("bottom", 100, 30, 2),
      ];
      const goals = goalsFromDreams(dreams);
      const state = initRedistribution(dreams, "funders");
      const next = getNextBucket(state, goals);
      expect(next).toEqual({ bucketId: "bottom", action: "defund" });
    });

    it("returns null when complete", () => {
      const dreams = [makeDream("a", 100, 100, 5)];
      const goals = goalsFromDreams(dreams);
      const state = initRedistribution(dreams, "funders");
      expect(getNextBucket(state, goals)).toBeNull();
    });
  });

  describe("tie breaking", () => {
    it("breaks ties alphabetically by title", () => {
      const dreams = [
        { ...makeDream("b", 100, 50, 5), title: "Zebra" },
        { ...makeDream("a", 100, 50, 5), title: "Alpha" },
      ];
      const state = initRedistribution(dreams, "funders");
      // Same funders, so alphabetical: Alpha first
      expect(state.sortedIds).toEqual(["a", "b"]);
    });
  });
});
