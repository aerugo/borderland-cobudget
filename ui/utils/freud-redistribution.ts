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
  fundedBucketId: string | null;
  amountMoved: number;
  pot: number;
}

export interface RedistributionState {
  method: SortMethod;
  /** Current funded amount per bucket */
  amounts: Record<string, number>;
  /** Sorted bucket IDs (top = highest priority) */
  sortedIds: string[];
  currentStep: number;
  steps: RedistributionStep[];
  pot: number;
  isComplete: boolean;
  totalFunded: number;
  totalContributed: number;
}

function tieBreak(a: FreudDream, b: FreudDream): number {
  return a.title.localeCompare(b.title);
}

function sortByMethod(
  dreams: FreudDream[],
  method: SortMethod
): FreudDream[] {
  const sorted = [...dreams];
  switch (method) {
    case "funders":
      sorted.sort((a, b) => b.funders - a.funders || tieBreak(a, b));
      break;
    case "sek":
      sorted.sort(
        (a, b) =>
          (a.goal - a.funded) - (b.goal - b.funded) || tieBreak(a, b)
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
    (a, b) =>
      (a.goal - a.funded) - (b.goal - b.funded) || tieBreak(a, b)
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
    if (amounts[id] >= goals[id]) totalFunded++;
  }
  return { totalFunded, totalContributed };
}

export function initRedistribution(
  dreams: FreudDream[],
  method: SortMethod
): RedistributionState {
  // Filter to underfunded dreams, excluding skipped
  const eligible = dreams.filter(
    (d) => d.goal > 0 && d.funded < d.goal && d.override !== "skip"
  );

  const amounts: Record<string, number> = {};
  const goals: Record<string, number> = {};

  for (const d of eligible) {
    if (d.override === "lock") {
      amounts[d.id] = d.goal;
    } else if (d.override === "manual" && d.manualAmount !== undefined) {
      amounts[d.id] = d.manualAmount;
    } else {
      amounts[d.id] = d.funded;
    }
    goals[d.id] = d.goal;
  }

  // Also include already-funded dreams for total count
  for (const d of dreams) {
    if (!amounts.hasOwnProperty(d.id)) {
      amounts[d.id] = d.funded;
      goals[d.id] = d.goal;
    }
  }

  const sorted = sortByMethod(eligible, method);
  const sortedIds = sorted.map((d) => d.id);

  const summary = computeSummary(amounts, goals);

  return {
    method,
    amounts,
    sortedIds,
    currentStep: 0,
    steps: [],
    pot: 0,
    isComplete: sortedIds.length <= 1,
    ...summary,
  };
}

export function stepRedistribution(
  state: RedistributionState,
  goals: Record<string, number>
): RedistributionState {
  if (state.isComplete) return state;

  const amounts = { ...state.amounts };
  let pot = state.pot;
  const remaining = state.sortedIds.filter(
    (id) => amounts[id] < goals[id] && amounts[id] > 0
  );

  if (remaining.length <= 1) {
    return { ...state, isComplete: true };
  }

  // Defund the bottom dream
  const bottomId = remaining[remaining.length - 1];
  const defundAmount = amounts[bottomId];
  pot += defundAmount;
  amounts[bottomId] = 0;

  // Fund the top dream
  const topId = remaining[0];
  const needed = goals[topId] - amounts[topId];
  const toAdd = Math.min(needed, pot);
  amounts[topId] += toAdd;
  pot -= toAdd;

  const step: RedistributionStep = {
    defundedBucketId: bottomId,
    fundedBucketId: topId,
    amountMoved: toAdd,
    pot,
  };

  // Check if we should continue
  const newRemaining = state.sortedIds.filter(
    (id) => amounts[id] < goals[id] && amounts[id] > 0
  );
  const isComplete = newRemaining.length <= 1 && pot === 0;

  const summary = computeSummary(amounts, goals);

  return {
    ...state,
    amounts,
    pot,
    currentStep: state.currentStep + 1,
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
  const maxIterations = Object.keys(goals).length * 2;
  while (!current.isComplete && iterations < maxIterations) {
    current = stepRedistribution(current, goals);
    iterations++;
  }
  return { ...current, isComplete: true };
}

export function getNextBucket(
  state: RedistributionState,
  goals: Record<string, number>
): { bucketId: string; action: "defund" | "fund" } | null {
  if (state.isComplete) return null;
  const remaining = state.sortedIds.filter(
    (id) => state.amounts[id] < goals[id] && state.amounts[id] > 0
  );
  if (remaining.length <= 1) return null;
  return { bucketId: remaining[remaining.length - 1], action: "defund" };
}

export function resetRedistribution(
  dreams: FreudDream[],
  method: SortMethod
): RedistributionState {
  return initRedistribution(dreams, method);
}
