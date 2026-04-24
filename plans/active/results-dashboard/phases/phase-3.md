# Phase 3: Distribution charts

**Status**: Complete (pending browser confirmation)
**Started**: 2026-04-25
**Completed**: 2026-04-25
**Parent Plan**: [development-plan.md](../development-plan.md)

## Objective

All five distribution visualisations from the spec render, look
reasonable on real round data, and ship with hidden table
fallbacks for accessibility.

## What shipped

| File | Action | Purpose |
|------|--------|---------|
| `ui/package.json` | MODIFY | Added `recharts` (3.8.1) |
| [components/RoundResults/bins.ts](../../../../ui/components/RoundResults/bins.ts) | CREATE | Pure helpers — `buildIntegerBins` and `buildCurrencyBins` (log-spaced) |
| [components/RoundResults/DistributionChart.tsx](../../../../ui/components/RoundResults/DistributionChart.tsx) | CREATE | Generic bar histogram (used 3×: sum, count, contributors) |
| [components/RoundResults/GoalsChart.tsx](../../../../ui/components/RoundResults/GoalsChart.tsx) | CREATE | Paired min vs. stretch goal bar chart (#6) |
| [components/RoundResults/ContributionScatter.tsx](../../../../ui/components/RoundResults/ContributionScatter.tsx) | CREATE | 2-D scatter (count × sum) per dream, funded contributions only (#4) |
| [components/RoundResults/RoundResults.tsx](../../../../ui/components/RoundResults/RoundResults.tsx) | MODIFY | Wired all five charts into three sections per the spec UX plan |
| [components/RoundResults/index.ts](../../../../ui/components/RoundResults/index.ts) | MODIFY | Exported new components |
| [__tests__/roundResults.bins.test.ts](../../../../ui/__tests__/roundResults.bins.test.ts) | CREATE | 5 cases covering both bin builders, including empty input and edge values |

## Bin choices

- **Integer bins** (counts of contributions / contributors):
  `1, 2, 3–4, 5–8, 9–16, 17–32, 33–64, 65–128, 129+`. Doubling
  gives readable buckets without flattening high-engagement dreams
  into a single group.
- **Currency bins** (cents, log-spaced):
  `1¢–100, 100–500, 500–1k, 1k–5k, 5k–10k, 10k–50k, 50k–100k, 100k+`
  (in display units like SEK / USD). The long tail of small-vs-large
  dreams shows up cleanly on a log scale; linear bins would push
  everything into the bottom bucket.

Both functions are pure and unit-tested, so bin edges are easy to
tune later if the user pushes back on a specific cutoff.

## Section structure (matches spec UX plan)

1. **Hero strip** (4 tiles, unchanged from phase 2)
2. **"Where the money went"** — three side-by-side `DistributionChart`s
   (#7, #8, #9) for total received, # contributions, # contributors.
   Sub-title shows how many dreams qualified.
3. **"Dream sizes"** — `GoalsChart` (#6), full width.
4. **"Contribution patterns"** — `ContributionScatter` (#4),
   full width. Last because it's the densest chart.
5. **Footer** — freshness indicator (unchanged).

## Accessibility

Every chart includes:
- A wrapping `<div role="img" aria-label="...">` so screen readers
  announce what the visual represents.
- A hidden `<table class="sr-only">` rendering the same data as
  rows, so non-visual users get the actual numbers.

## Empty / partial states

- No qualifying dreams (e.g., a contribution exists but every bucket
  was unpublished) → `DistributionChart` simply renders an all-zero
  bar chart. `GoalsChart` and `ContributionScatter` switch to a
  text message so we don't render a blank chart frame.
- Round-level zero contributions still short-circuits to
  `EmptyResults` from phase 2 before any chart code runs.

## Verification

- [x] `yarn typecheck` — no new errors. Filtered output for the new
      files returns zero.
- [x] All unit tests pass: 8 service tests + 5 bin tests = 13/13.
- [ ] **Browser QA** — pending user confirmation. Backend SQL was
      already validated against Borderland Dreams 2024 (22,757
      contributions, 372 buckets) in 120 ms; the chart code consumes
      the same payload, so the only risk is layout / styling.

## Things deliberately not in this phase

- Cache invalidation hooks on Contribution / Allocation mutations
  (phase 4)
- History route migration to `/transactions` (phase 5)
- Per-bucket leaderboard table (out of scope)
- Time-series charts (out of scope)
