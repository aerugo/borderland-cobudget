import { describe, it, expect } from "vitest";
import {
  FreudDream,
  initRedistribution,
  stepRedistribution,
  finishRedistribution,
  getNextBuckets,
} from "../utils/freud-redistribution";

function makeDream(
  id: string,
  goal: number,
  funded: number,
  funders: number,
  override?: FreudDream["override"],
  manualAmount?: number
): FreudDream {
  return {
    id,
    title: `Dream ${id}`,
    goal,
    stretch: goal,
    funded,
    funders,
    override,
    manualAmount,
  };
}

function goalsFromDreams(dreams: FreudDream[]): Record<string, number> {
  const g: Record<string, number> = {};
  for (const d of dreams) g[d.id] = d.goal;
  return g;
}

describe("freud-redistribution", () => {
  describe("initRedistribution", () => {
    it("seeds pot from totalBudget minus already-funded dreams", () => {
      const dreams = [
        makeDream("done", 100, 100, 5), // fully funded → locked at 100
        makeDream("a", 50, 0, 3),
        makeDream("b", 50, 0, 2),
      ];
      const state = initRedistribution(dreams, "funders", 250);
      expect(state.lockedAllocated).toBe(100);
      expect(state.pot).toBe(150);
      expect(state.sortedIds).toEqual(["a", "b"]);
      // Eligible dreams reset to 0 — algorithm distributes fresh
      expect(state.amounts["a"]).toBe(0);
      expect(state.amounts["b"]).toBe(0);
      expect(state.amounts["done"]).toBe(100);
      expect(state.fundedByRun).toEqual([]);
    });

    it("excludes dreams with skip override from sortedIds", () => {
      const dreams = [
        makeDream("a", 100, 50, 5, "skip"),
        makeDream("b", 100, 0, 3),
      ];
      const state = initRedistribution(dreams, "funders", 200);
      expect(state.sortedIds).toEqual(["b"]);
      // Skip is not counted toward lockedAllocated
      expect(state.lockedAllocated).toBe(0);
    });

    it("locks 'lock' override at goal and counts toward lockedAllocated", () => {
      const dreams = [
        makeDream("a", 100, 50, 5, "lock"),
        makeDream("b", 100, 0, 3),
      ];
      const state = initRedistribution(dreams, "funders", 250);
      expect(state.amounts["a"]).toBe(100);
      expect(state.lockedAllocated).toBe(100);
      expect(state.pot).toBe(150);
      expect(state.sortedIds).toEqual(["b"]);
    });

    it("respects manual override and counts toward lockedAllocated", () => {
      const dreams = [
        makeDream("a", 100, 50, 5, "manual", 75),
        makeDream("b", 100, 0, 3),
      ];
      const state = initRedistribution(dreams, "funders", 250);
      expect(state.amounts["a"]).toBe(75);
      expect(state.lockedAllocated).toBe(75);
      expect(state.pot).toBe(175);
      expect(state.sortedIds).toEqual(["b"]);
    });

    it("marks complete when nothing eligible", () => {
      const state = initRedistribution([], "combo", 100);
      expect(state.isComplete).toBe(true);
      expect(state.sortedIds).toEqual([]);
    });

    it("marks complete when pot can't fund cheapest eligible dream", () => {
      const dreams = [makeDream("a", 1000, 0, 5)];
      const state = initRedistribution(dreams, "funders", 100);
      expect(state.isComplete).toBe(true);
    });

    it("clamps pot to 0 if locked allocations exceed totalBudget", () => {
      const dreams = [makeDream("done", 1000, 1000, 5)];
      const state = initRedistribution(dreams, "funders", 500);
      expect(state.pot).toBe(0);
    });
  });

  describe("sorting methods", () => {
    const dreams = [
      makeDream("a", 1000, 200, 10),
      makeDream("b", 500, 400, 5),
      makeDream("c", 2000, 600, 20),
    ];

    it("funders: sorts by funder count descending", () => {
      const state = initRedistribution(dreams, "funders", 10000);
      expect(state.sortedIds).toEqual(["c", "a", "b"]);
    });

    it("sek: sorts by missing amount ascending", () => {
      const state = initRedistribution(dreams, "sek", 10000);
      expect(state.sortedIds).toEqual(["b", "a", "c"]);
    });

    it("percent: sorts by percent funded descending", () => {
      const state = initRedistribution(dreams, "percent", 10000);
      expect(state.sortedIds).toEqual(["b", "c", "a"]);
    });

    it("combo: sorts by aggregated rank", () => {
      const state = initRedistribution(dreams, "combo", 10000);
      expect(state.sortedIds).toEqual(["b", "c", "a"]);
    });
  });

  describe("stepRedistribution: first run after reset", () => {
    it("walks sortedIds funding each dream to goal until pot can't cover next", () => {
      const dreams = [
        makeDream("a", 100, 0, 10),
        makeDream("b", 100, 0, 8),
        makeDream("c", 100, 0, 5),
      ];
      const goals = goalsFromDreams(dreams);
      let state = initRedistribution(dreams, "funders", 250);
      // pot = 250, can fund a (100) + b (100), can't cover c (100), pot = 50
      state = stepRedistribution(state, goals);
      expect(state.amounts["a"]).toBe(100);
      expect(state.amounts["b"]).toBe(100);
      expect(state.amounts["c"]).toBe(0);
      expect(state.pot).toBe(50);
      expect(state.fundedByRun).toEqual(["a", "b"]);
    });

    it("funds nothing if pot can't cover top dream", () => {
      const dreams = [makeDream("a", 1000, 0, 10)];
      const goals = goalsFromDreams(dreams);
      let state = initRedistribution(dreams, "funders", 500);
      // initRedistribution should already mark complete
      expect(state.isComplete).toBe(true);
      // Stepping a complete state is a no-op
      const stepped = stepRedistribution(state, goals);
      expect(stepped.amounts["a"]).toBe(0);
    });
  });

  describe("stepRedistribution: subsequent runs defund last-funded and refill", () => {
    it("defunds last-funded dream, returns money to pot, attempts to fund next", () => {
      const dreams = [
        makeDream("a", 100, 0, 10),
        makeDream("b", 100, 0, 8),
        makeDream("c", 60, 0, 5), // cheaper than b, but lower priority
      ];
      const goals = goalsFromDreams(dreams);
      let state = initRedistribution(dreams, "funders", 200);
      // First run: pot=200 funds a(100), b(100). pot=0. fundedByRun=[a,b]. c unfunded.
      state = stepRedistribution(state, goals);
      expect(state.fundedByRun).toEqual(["a", "b"]);
      expect(state.pot).toBe(0);

      // Second run: defund b(100) → pot=100. c needs 60 → funds c. pot=40. fundedByRun=[a,c]
      state = stepRedistribution(state, goals);
      expect(state.amounts["b"]).toBe(0);
      expect(state.amounts["c"]).toBe(60);
      expect(state.fundedByRun).toEqual(["a", "c"]);
      expect(state.pot).toBe(40);
    });

    it("becomes complete when defunding can't open a fundable slot", () => {
      const dreams = [
        makeDream("a", 100, 0, 10),
        makeDream("b", 1000, 0, 8), // way too expensive
      ];
      const goals = goalsFromDreams(dreams);
      let state = initRedistribution(dreams, "funders", 150);
      // First run: pot=150 funds a(100). pot=50. b can't be funded (needs 1000).
      state = stepRedistribution(state, goals);
      expect(state.fundedByRun).toEqual(["a"]);
      // Defunding a (returns 100) → pot=150 still can't cover b's 1000.
      expect(state.isComplete).toBe(true);
    });

    it("just defunds when no fundable next dream exists", () => {
      const dreams = [
        makeDream("a", 100, 0, 10),
        makeDream("b", 100, 0, 8),
      ];
      const goals = goalsFromDreams(dreams);
      let state = initRedistribution(dreams, "funders", 200);
      // First run funds both
      state = stepRedistribution(state, goals);
      expect(state.fundedByRun).toEqual(["a", "b"]);
      expect(state.isComplete).toBe(true);
    });
  });

  describe("finishRedistribution (Loop ON)", () => {
    it("converges to same final state as iterative stepping", () => {
      const dreams = [
        makeDream("a", 100, 0, 10),
        makeDream("b", 100, 0, 8),
        makeDream("c", 60, 0, 5),
        makeDream("d", 40, 0, 3),
      ];
      const goals = goalsFromDreams(dreams);
      const totalBudget = 200;

      let stepped = initRedistribution(dreams, "funders", totalBudget);
      let safety = 50;
      while (!stepped.isComplete && safety-- > 0) {
        stepped = stepRedistribution(stepped, goals);
      }

      const finished = finishRedistribution(
        initRedistribution(dreams, "funders", totalBudget),
        goals
      );

      expect(finished.amounts).toEqual(stepped.amounts);
      expect(finished.fundedByRun).toEqual(stepped.fundedByRun);
      expect(finished.totalContributed).toEqual(stepped.totalContributed);
    });

    it("handles all dreams already funded", () => {
      const dreams = [
        makeDream("a", 100, 100, 5),
        makeDream("b", 100, 200, 10),
      ];
      const goals = goalsFromDreams(dreams);
      const state = finishRedistribution(
        initRedistribution(dreams, "combo", 1000),
        goals
      );
      expect(state.isComplete).toBe(true);
      expect(state.steps).toHaveLength(0);
    });

    it("does not exceed iteration cap on pathological input", () => {
      const dreams = Array.from({ length: 20 }, (_, i) =>
        makeDream(`d${i}`, 100, 0, 20 - i)
      );
      const goals = goalsFromDreams(dreams);
      const state = finishRedistribution(
        initRedistribution(dreams, "funders", 350),
        goals
      );
      expect(state.isComplete).toBe(true);
    });
  });

  describe("getNextBuckets", () => {
    it("returns next-to-fund and null defund before any run", () => {
      const dreams = [
        makeDream("a", 100, 0, 10),
        makeDream("b", 100, 0, 8),
      ];
      const goals = goalsFromDreams(dreams);
      const state = initRedistribution(dreams, "funders", 250);
      expect(getNextBuckets(state, goals)).toEqual({
        nextToFund: "a",
        nextToDefund: null,
      });
    });

    it("returns both sides after first run when pot can't cover next dream", () => {
      const dreams = [
        makeDream("a", 100, 0, 10),
        makeDream("b", 100, 0, 8),
        makeDream("c", 100, 0, 5),
      ];
      const goals = goalsFromDreams(dreams);
      let state = initRedistribution(dreams, "funders", 250);
      state = stepRedistribution(state, goals);
      expect(getNextBuckets(state, goals)).toEqual({
        nextToFund: "c",
        nextToDefund: "b",
      });
    });

    it("returns nulls when complete", () => {
      const dreams = [makeDream("a", 100, 100, 5)];
      const goals = goalsFromDreams(dreams);
      const state = initRedistribution(dreams, "funders", 100);
      expect(state.isComplete).toBe(true);
      expect(getNextBuckets(state, goals)).toEqual({
        nextToFund: null,
        nextToDefund: null,
      });
    });
  });

  describe("tie breaking", () => {
    it("breaks ties alphabetically by title", () => {
      const dreams = [
        { ...makeDream("b", 100, 0, 5), title: "Zebra" },
        { ...makeDream("a", 100, 0, 5), title: "Alpha" },
      ];
      const state = initRedistribution(dreams, "funders", 500);
      expect(state.sortedIds).toEqual(["a", "b"]);
    });
  });
});
