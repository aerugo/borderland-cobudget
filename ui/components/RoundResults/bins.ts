export type Bin = {
  label: string;
  min: number;
  max: number;
  count: number;
};

const COUNT_BIN_EDGES = [1, 2, 4, 8, 16, 32, 64, 128];

export function buildIntegerBins(values: number[]): Bin[] {
  const bins: Bin[] = [];
  let prev = 0;
  for (const edge of COUNT_BIN_EDGES) {
    bins.push({
      label: prev + 1 === edge ? `${edge}` : `${prev + 1}–${edge}`,
      min: prev + 1,
      max: edge,
      count: 0,
    });
    prev = edge;
  }
  bins.push({
    label: `${prev + 1}+`,
    min: prev + 1,
    max: Number.POSITIVE_INFINITY,
    count: 0,
  });

  for (const v of values) {
    if (v < 1) continue;
    for (const bin of bins) {
      if (v >= bin.min && v <= bin.max) {
        bin.count++;
        break;
      }
    }
  }
  return bins;
}

const CURRENCY_BIN_EDGES_CENTS = [
  10_000, 50_000, 100_000, 500_000, 1_000_000, 5_000_000, 10_000_000,
];

function fmtShort(cents: number): string {
  const units = cents / 100;
  if (units >= 1_000_000) return `${Math.round(units / 1_000_000)}M`;
  if (units >= 1_000) return `${Math.round(units / 1_000)}k`;
  return `${units}`;
}

export function buildCurrencyBins(valuesCents: number[]): Bin[] {
  const bins: Bin[] = [];
  let prev = 1;
  for (const edge of CURRENCY_BIN_EDGES_CENTS) {
    bins.push({
      label: `${fmtShort(prev)}–${fmtShort(edge)}`,
      min: prev,
      max: edge,
      count: 0,
    });
    prev = edge + 1;
  }
  bins.push({
    label: `${fmtShort(prev)}+`,
    min: prev,
    max: Number.POSITIVE_INFINITY,
    count: 0,
  });

  for (const v of valuesCents) {
    if (v < 1) continue;
    for (const bin of bins) {
      if (v >= bin.min && v <= bin.max) {
        bin.count++;
        break;
      }
    }
  }
  return bins;
}
