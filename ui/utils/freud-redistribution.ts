export interface FreudDream {
  id: string;
  title: string;
  goal: number;
  stretch: number;
  funded: number;
  funders: number;
  override?: "model" | "manual" | "skip" | "lock";
  manualAmount?: number;
}

export type SortMethod = "combo" | "funders" | "sek" | "percent";

export interface RedistributionStep {
  defundedBucketId: string | null;
  fundedBucketIds: string[];
  amountReturnedToPot: number;
  amountFunded: number;
  pot: number;
}

export interface RedistributionState {
  method: SortMethod;
  /** Allocation per bucket as the algorithm sees it */
  amounts: Record<string, number>;
  /** Eligible bucket IDs (underfunded, non-skip), sorted by method (top = highest priority) */
  sortedIds: string[];
  /** Buckets funded by this run, in priority order */
  fundedByRun: string[];
  /** Index into sortedIds: next dream the algorithm will try to fund */
  frontierIndex: number;
  /** Money still available to allocate */
  pot: number;
  /** Round budget used to seed pot */
  totalBudget: number;
  /** Sum of allocations on dreams not eligible for redistribution (already at goal, lock, manual) */
  lockedAllocated: number;
  /** Step history */
  steps: RedistributionStep[];
  /** True when no further runStep can change the state */
  isComplete: boolean;
  /** Number of dreams whose `amounts` >= goal */
  totalFunded: number;
  /** Sum of `amounts` */
  totalContributed: number;
}

function tieBreak(a: FreudDream, b: FreudDream): number {
  return a.title.localeCompare(b.title);
}

function sortByMethod(dreams: FreudDream[], method: SortMethod): FreudDream[] {
  const sorted = [...dreams];
  switch (method) {
    case "funders":
      sorted.sort((a, b) => b.funders - a.funders || tieBreak(a, b));
      break;
    case "sek":
      sorted.sort(
        (a, b) => a.goal - a.funded - (b.goal - b.funded) || tieBreak(a, b)
      );
      break;
    case "percent":
      sorted.sort(
        (a, b) =>
          (b.goal > 0 ? b.funded / b.goal : 0) -
            (a.goal > 0 ? a.funded / a.goal : 0) || tieBreak(a, b)
      );
      break;
    case "combo":
      sorted.sort((a, b) => {
        const rankA = comboRank(a, dreams);
        const rankB = comboRank(b, dreams);
        return rankA - rankB || tieBreak(a, b);
      });
      break;
  }
  return sorted;
}

function comboRank(dream: FreudDream, allDreams: FreudDream[]): number {
  const byFunders = [...allDreams].sort(
    (a, b) => b.funders - a.funders || tieBreak(a, b)
  );
  const bySek = [...allDreams].sort(
    (a, b) => a.goal - a.funded - (b.goal - b.funded) || tieBreak(a, b)
  );
  const byPercent = [...allDreams].sort(
    (a, b) =>
      (b.goal > 0 ? b.funded / b.goal : 0) -
        (a.goal > 0 ? a.funded / a.goal : 0) || tieBreak(a, b)
  );

  const fRank = byFunders.findIndex((d) => d.id === dream.id) + 1;
  const sRank = bySek.findIndex((d) => d.id === dream.id) + 1;
  const pRank = byPercent.findIndex((d) => d.id === dream.id) + 1;
  return fRank + sRank + pRank;
}

function computeSummary(
  amounts: Record<string, number>,
  goals: Record<string, number>
): { totalFunded: number; totalContributed: number } {
  let totalFunded = 0;
  let totalContributed = 0;
  for (const id of Object.keys(amounts)) {
    totalContributed += amounts[id];
    if (goals[id] > 0 && amounts[id] >= goals[id]) totalFunded++;
  }
  return { totalFunded, totalContributed };
}

function computeIsComplete(
  frontierIndex: number,
  sortedIds: string[],
  amounts: Record<string, number>,
  fundedByRun: string[],
  pot: number,
  goals: Record<string, number>
): boolean {
  if (frontierIndex >= sortedIds.length) return true;
  const frontierId = sortedIds[frontierIndex];
  const need = goals[frontierId] - amounts[frontierId];
  const totalDefundable = fundedByRun.reduce((s, id) => s + amounts[id], 0);
  return pot + totalDefundable < need;
}

export function initRedistribution(
  dreams: FreudDream[],
  method: SortMethod,
  totalBudget: number
): RedistributionState {
  const amounts: Record<string, number> = {};
  const goals: Record<string, number> = {};
  const eligible: FreudDream[] = [];
  let lockedAllocated = 0;

  for (const d of dreams) {
    goals[d.id] = d.goal;

    if (d.goal > 0 && d.funded >= d.goal) {
      amounts[d.id] = d.funded;
      lockedAllocated += d.funded;
      continue;
    }

    if (d.override === "lock") {
      amounts[d.id] = d.goal;
      lockedAllocated += d.goal;
      continue;
    }

    if (d.override === "manual") {
      const amt = d.manualAmount ?? 0;
      amounts[d.id] = amt;
      lockedAllocated += amt;
      continue;
    }

    if (d.override === "skip") {
      amounts[d.id] = 0;
      continue;
    }

    if (d.goal <= 0) {
      amounts[d.id] = d.funded;
      continue;
    }

    amounts[d.id] = 0;
    eligible.push(d);
  }

  const pot = Math.max(0, totalBudget - lockedAllocated);
  const sortedIds = sortByMethod(eligible, method).map((d) => d.id);

  const summary = computeSummary(amounts, goals);

  const isComplete = computeIsComplete(
    0,
    sortedIds,
    amounts,
    [],
    pot,
    goals
  );

  return {
    method,
    amounts,
    sortedIds,
    fundedByRun: [],
    frontierIndex: 0,
    pot,
    totalBudget,
    lockedAllocated,
    steps: [],
    isComplete,
    ...summary,
  };
}

/**
 * Walk sortedIds from `frontierIndex` onward, funding each dream whose remaining need
 * fits in the running pot. Stops at the first dream that doesn't fit.
 */
function fundForward(
  sortedIds: string[],
  startIndex: number,
  amounts: Record<string, number>,
  fundedByRun: string[],
  pot: number,
  goals: Record<string, number>
): {
  amounts: Record<string, number>;
  fundedByRun: string[];
  pot: number;
  newlyFunded: string[];
  frontierIndex: number;
} {
  const newlyFunded: string[] = [];
  let frontierIndex = startIndex;
  while (frontierIndex < sortedIds.length) {
    const id = sortedIds[frontierIndex];
    const need = goals[id] - amounts[id];
    if (need <= 0) {
      // already funded by some override path — advance
      frontierIndex++;
      continue;
    }
    if (pot >= need) {
      amounts[id] = goals[id];
      pot -= need;
      fundedByRun.push(id);
      newlyFunded.push(id);
      frontierIndex++;
    } else {
      break;
    }
  }
  return { amounts, fundedByRun, pot, newlyFunded, frontierIndex };
}

export function stepRedistribution(
  state: RedistributionState,
  goals: Record<string, number>
): RedistributionState {
  if (state.isComplete) return state;

  const amounts = { ...state.amounts };
  let fundedByRun = [...state.fundedByRun];
  let pot = state.pot;
  let frontierIndex = state.frontierIndex;

  let defundedId: string | null = null;
  let amountReturnedToPot = 0;
  const isFirstRun = state.steps.length === 0 && fundedByRun.length === 0;

  if (!isFirstRun) {
    if (fundedByRun.length === 0) {
      // No fundedByRun to defund and not first run: nothing to do.
      return { ...state, isComplete: true };
    }
    defundedId = fundedByRun[fundedByRun.length - 1];
    amountReturnedToPot = amounts[defundedId];
    amounts[defundedId] = 0;
    pot += amountReturnedToPot;
    fundedByRun = fundedByRun.slice(0, -1);
    // frontierIndex stays where it is — we're retrying that frontier dream
  }

  const result = fundForward(
    state.sortedIds,
    frontierIndex,
    amounts,
    fundedByRun,
    pot,
    goals
  );
  fundedByRun = result.fundedByRun;
  pot = result.pot;
  frontierIndex = result.frontierIndex;

  const summary = computeSummary(amounts, goals);
  const step: RedistributionStep = {
    defundedBucketId: defundedId,
    fundedBucketIds: result.newlyFunded,
    amountReturnedToPot,
    amountFunded: result.newlyFunded.reduce(
      (s, id) => s + (amounts[id] - (state.amounts[id] ?? 0)),
      0
    ),
    pot,
  };

  const isComplete = computeIsComplete(
    frontierIndex,
    state.sortedIds,
    amounts,
    fundedByRun,
    pot,
    goals
  );

  return {
    ...state,
    amounts,
    fundedByRun,
    frontierIndex,
    pot,
    steps: [...state.steps, step],
    isComplete,
    ...summary,
  };
}

export function finishRedistribution(
  state: RedistributionState,
  goals: Record<string, number>
): RedistributionState {
  let current = state;
  let iterations = 0;
  const maxIterations = state.sortedIds.length * 2 + 2;
  while (!current.isComplete && iterations < maxIterations) {
    const next = stepRedistribution(current, goals);
    if (next === current) break;
    current = next;
    iterations++;
  }
  return current;
}

export function getNextBuckets(
  state: RedistributionState,
  goals: Record<string, number>
): {
  nextToFund: string | null;
  nextToDefund: string | null;
} {
  if (state.isComplete) {
    return { nextToFund: null, nextToDefund: null };
  }
  const nextToFund =
    state.frontierIndex < state.sortedIds.length
      ? state.sortedIds[state.frontierIndex]
      : null;
  const nextToDefund =
    state.fundedByRun.length > 0
      ? state.fundedByRun[state.fundedByRun.length - 1]
      : null;
  return { nextToFund, nextToDefund };
}

/**
 * @deprecated Use getNextBuckets instead. Kept for source compatibility.
 */
export function getNextBucket(
  state: RedistributionState,
  goals: Record<string, number>
): { bucketId: string; action: "defund" | "fund" } | null {
  const { nextToFund, nextToDefund } = getNextBuckets(state, goals);
  if (nextToDefund) return { bucketId: nextToDefund, action: "defund" };
  if (nextToFund) return { bucketId: nextToFund, action: "fund" };
  return null;
}

export function resetRedistribution(
  dreams: FreudDream[],
  method: SortMethod,
  totalBudget: number
): RedistributionState {
  return initRedistribution(dreams, method, totalBudget);
}
