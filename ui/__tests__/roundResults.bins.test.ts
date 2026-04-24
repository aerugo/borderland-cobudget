import { describe, it, expect } from "vitest";
import { buildIntegerBins, buildCurrencyBins } from "../components/RoundResults/bins";

describe("buildIntegerBins", () => {
  it("returns zero counts when input is empty", () => {
    const bins = buildIntegerBins([]);
    expect(bins.every((b) => b.count === 0)).toBe(true);
    expect(bins.length).toBeGreaterThan(0);
  });

  it("ignores values < 1", () => {
    const bins = buildIntegerBins([0, -1, 0.5]);
    expect(bins.every((b) => b.count === 0)).toBe(true);
  });

  it("places values in the correct bin", () => {
    const bins = buildIntegerBins([1, 2, 3, 100, 200]);
    const byLabel = Object.fromEntries(bins.map((b) => [b.label, b.count]));
    expect(byLabel["1"]).toBe(1);
    expect(byLabel["2"]).toBe(1);
    expect(byLabel["3–4"]).toBe(1);
    expect(byLabel["65–128"]).toBe(1);
    expect(byLabel["129+"]).toBe(1);
  });
});

describe("buildCurrencyBins", () => {
  it("returns zero counts when input is empty", () => {
    const bins = buildCurrencyBins([]);
    expect(bins.every((b) => b.count === 0)).toBe(true);
  });

  it("places values across log-spaced bins", () => {
    const bins = buildCurrencyBins([
      5_000,
      30_000,
      80_000,
      300_000,
      900_000,
      3_000_000,
      8_000_000,
      20_000_000,
    ]);
    const totals = bins.reduce((s, b) => s + b.count, 0);
    expect(totals).toBe(8);
    expect(bins[bins.length - 1].count).toBe(1);
  });
});
