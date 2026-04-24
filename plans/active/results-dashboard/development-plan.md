# Results Dashboard — Development Plan

**Status**: In Progress
**Created**: 2026-04-24
**Branch**: `results-dashboard` (to be created from `borderland`)
**Spec**: [spec.md](spec.md)

## Summary

Replace the admin-only "History" tab with a public-facing "Results"
dashboard that visualises round outcomes (totals, distributions,
participation). Backed by a per-round JSON snapshot table to keep
heavy aggregation off the hot path.

## Current State Analysis

- The History tab today lives at
  [ui/pages/[group]/[round]/history.js](../../../ui/pages/[group]/[round]/history.js)
  and is registered in
  [ui/components/SubMenu.tsx:51-106](../../../ui/components/SubMenu.tsx#L51)
  as `{ admin: true }`. It renders the `Transactions` component which
  paginates raw `roundTransactions` for audit.
- Round-level aggregates are computed on demand by Round-type
  resolvers ([Round.ts:39-74](../../../ui/server/graphql/resolvers/types/Round.ts#L39))
  using `prisma.aggregate`. Per-bucket aggregates exist but are
  scattered.
- No charting library is installed — verified via `package.json`.
- No materialised view / cache table exists for round aggregates.
- Edge HTTP cache for anonymous GraphQL is configured at
  [ui/pages/api/index.ts:79-88](../../../ui/pages/api/index.ts#L79).
- Round visibility helper:
  [helpers/index.ts:375-393](../../../ui/server/graphql/resolvers/helpers/index.ts#L375)
  (`canViewRound`).

What we're solving: there is no surface, anywhere in the product, that
tells a participant or visitor what happened in a round at a glance.
History is for auditors. Overview shows live state, not retrospective
analysis. The new tab fills that gap and intentionally shifts the
audience from "admin" to "everyone with view access".

### Files to Modify

| File | Current State | Planned Changes |
|------|---------------|-----------------|
| [ui/server/prisma/schema.prisma](../../../ui/server/prisma/schema.prisma) | No snapshot table | Add `RoundResultsSnapshot` model and back-relation on `Round` |
| [ui/server/graphql/schema/index.js](../../../ui/server/graphql/schema/index.js) | No `roundResults` query | Add `RoundResults`, `BucketResultRow` types and `roundResults(roundId)` query |
| [ui/server/graphql/resolvers/queries/round.ts](../../../ui/server/graphql/resolvers/queries/round.ts) | Has `round`, `roundTransactions` etc. | Add `roundResults` resolver with snapshot read/write |
| [ui/server/graphql/resolvers/mutations/contribution/contribute.ts](../../../ui/server/graphql/resolvers/mutations/contribution) (or current Contribution mutation file) | Writes Contribution rows | After write, call `invalidateRoundResultsSnapshot(roundId)` |
| Allocation mutation file (e.g. `mutations/allocation.ts` or similar) | Writes Allocation rows | Same: invalidate snapshot |
| [ui/components/SubMenu.tsx](../../../ui/components/SubMenu.tsx) | History entry, admin-only | Remove History entry, add Results entry (no admin gate) |
| [ui/pages/[group]/[round]/history.js](../../../ui/pages/[group]/[round]/history.js) | Public route under round | Rename file → `transactions.js`; admin guard preserved inside the page |
| [ui/graphql/client.ts](../../../ui/graphql/client.ts) | Urql cache config | Add `roundResults` to invalidation list of `contribute` and bulk allocation mutations |
| `ui/package.json` | No charting lib | Add `recharts` |

### Files to Create

| File | Purpose |
|------|---------|
| `ui/pages/[group]/[round]/results.tsx` | Page entry — auth check, loads `roundResults`, renders `<RoundResults>` |
| `ui/components/RoundResults/index.ts` | Barrel export |
| `ui/components/RoundResults/RoundResults.tsx` | Top-level layout: hero strip, sections, footer |
| `ui/components/RoundResults/StatTile.tsx` | One headline number + label + helper text |
| `ui/components/RoundResults/DistributionChart.tsx` | Generic bar histogram (used 3×) |
| `ui/components/RoundResults/GoalsChart.tsx` | Paired min/max goal chart |
| `ui/components/RoundResults/ContributionScatter.tsx` | 2-D dream count × sum chart |
| `ui/components/RoundResults/EmptyResults.tsx` | Empty state placeholder |
| `ui/components/RoundResults/bins.ts` | Pure helpers: log-spaced currency bins, integer bins |
| `ui/server/services/RoundResultsService/index.ts` | `computeRoundResults`, `getRoundResults`, `invalidateRoundResultsSnapshot` |
| `ui/server/services/RoundResultsService/sql.ts` | The raw SQL CTE used by `computeRoundResults` |
| `ui/__tests__/roundResults.test.ts` | Unit tests for the service against a seeded fixture |

## Solution Design

The dashboard is fed by a single GraphQL query, `roundResults`, that
returns everything needed: four scalar summary numbers plus an array
of per-bucket rows. All histogram binning happens client-side from
that array, so chart bins can be tuned without touching the API.

The resolver is a thin wrapper around a service:

```
roundResults(roundId) →
  RoundResultsService.getRoundResults(roundId) →
    if snapshot fresh → return snapshot.payload
    else compute (one CTE-heavy SQL query)
         write snapshot
         return payload
```

Mutations that move money invalidate the snapshot (set `computedAt =
NULL` or delete the row). The next read recomputes.

### Key Design Decisions

1. **Single query, client-side binning.** Returning per-bucket rows
   instead of pre-binned histograms keeps the server simple and lets
   us iterate on chart design without redeploying the API. Per-round
   bucket counts are bounded (typically ≤ a few thousand), so payload
   size is fine.

2. **Snapshot table over `memory-cache`.** `memory-cache` is
   per-instance and Vercel's serverless functions don't share memory.
   A `RoundResultsSnapshot` row in Postgres survives cold starts and
   doubles as a debugging aid (you can read the cached payload).

3. **Event-driven invalidation + safety-net TTL.** The cache is
   cleared whenever a Contribution or Allocation is written; we also
   recompute if the snapshot is older than 1 hour, in case we ever
   miss an invalidation hook. This gives "fresh-feeling" results with
   bounded staleness.

4. **`schemaVersion` column on the snapshot.** When we change the
   `RoundResults` payload shape, bumping `schemaVersion` in code
   causes every read to recompute — no migration needed.

5. **Replace, don't dual-display, History.** The History tab today is
   admin-only and not very loved. Keeping it in the public sub-menu
   alongside Results would be confusing. We move its page to
   `/transactions` (admin-only) and direct admins there from the
   admin areas. No data is lost.

6. **Use `recharts`.** It is the lightest React-native option, has
   built-in responsive containers, and matches the shadcn/MUI
   aesthetic without theming gymnastics. Alternatives considered:
   `chart.js + react-chartjs-2` (more imperative, larger), `visx`
   (lower-level, more code), `nivo` (heavy).

7. **Funded-participant filter computed in SQL, not in JS.** The
   "members with `SUM(allocations) > 0`" CTE is reused by both the
   participation rate and the funded-only contribution columns. Doing
   it in one query avoids re-walking the allocations table.

## Phase Overview

| Phase | Description | Deliverables |
|-------|-------------|--------------|
| 1 | Backend foundation: snapshot model, service, resolver, GraphQL schema, basic test | Working `roundResults` query returning real data, validated against a seeded round |
| 2 | Frontend skeleton: page, route, SubMenu swap, hero tiles | New tab visible to all viewers, headline numbers correct, no charts yet |
| 3 | Distribution charts: install recharts, build all 5 charts with bin helpers and a11y fallbacks | Full visual dashboard, mobile responsive |
| 4 | Cache invalidation hooks on Contribution + Allocation mutations | Snapshot stays fresh; freshness footer reflects actual `computedAt` |
| 5 | Polish: empty/partial states, History → /transactions migration, copy review, i18n strings | Production-ready feature, History admin route preserved, copy reviewed |

## Phase 1: Backend foundation

**Goal**: A working `roundResults(roundId)` GraphQL query that returns
correct numbers, backed by a snapshot table, validated against a
seeded fixture.

**Detailed Plan**: [phases/phase-1.md](phases/phase-1.md)

### Deliverables

1. `RoundResultsSnapshot` Prisma model + migration
2. `ui/server/services/RoundResultsService/` with `computeRoundResults`, `getRoundResults`, `invalidateRoundResultsSnapshot`
3. `RoundResults` and `BucketResultRow` GraphQL types
4. `roundResults` query resolver wired into the schema
5. Unit tests covering: empty round, contributions-only round, fully-funded round, funded-participant filter

### Implementation Approach

1. Add the Prisma model; run `yarn migrate`.
2. Write the SQL CTE (start by hand in `psql` against a real round).
3. Wrap it in `RoundResultsService.computeRoundResults` returning the
   typed payload.
4. Add `getRoundResults` with snapshot read-through + write-back +
   1 h TTL ceiling + `schemaVersion` check.
5. Add GraphQL types and the resolver.
6. Write Vitest tests using the existing test DB harness.

### Success Criteria

- [ ] Query returns the same numbers as a hand-computed CSV from a
      seeded round
- [ ] Second call to the same `roundId` reads from snapshot
      (`computedAt` unchanged)
- [ ] `yarn typecheck` passes
- [ ] Vitest suite for the service passes

## Phase 2: Frontend skeleton

**Goal**: Results tab visible in the round nav, page renders the four
hero tiles with real numbers from the API. No charts yet.

### Deliverables

1. `ui/pages/[group]/[round]/results.tsx` with auth guard via
   `canViewRound`
2. `RoundResults`, `StatTile`, `EmptyResults` components
3. SubMenu swap (History entry removed, Results entry added — no admin
   flag)
4. Loading + error states
5. Snapshot freshness footer

### Implementation Approach

1. Create the page with an Urql query for `roundResults`.
2. Build `StatTile` matching existing Overview-tile styling.
3. Compute the four headline numbers, formatting currency through the
   round's existing currency helper.
4. Wire `EmptyResults` for the zero-contributions case.
5. Update SubMenu: remove the `history` entry, add `results` (no
   `admin: true`).
6. Manually QA against staging data on at least one public round and
   one hidden round.

### Success Criteria

- [ ] Tab appears for all viewers of a public round
- [ ] Tab requires membership for a hidden round
- [ ] Headline numbers match what `roundResults` returns
- [ ] Empty state renders for a round with no contributions
- [ ] No regressions in other tabs
- [ ] `yarn typecheck` passes

## Phase 3: Distribution charts

**Goal**: All five distribution visualisations render, look good on
desktop and mobile, and are accessible.

### Deliverables

1. `recharts` installed and added to `package.json`
2. `bins.ts` with currency log-bins and integer bins, unit tested
3. `DistributionChart` component (used for #7, #8, #9)
4. `GoalsChart` (#6)
5. `ContributionScatter` (#4)
6. Hidden `<table>` accessibility fallback for each chart
7. Mobile breakpoints

### Implementation Approach

1. Install `recharts`. Confirm bundle impact on the results page only
   (lazy-import).
2. Write `bins.ts` with two pure functions; cover with unit tests.
3. Build `DistributionChart` as a generic bar chart taking
   `{ data, xLabel, yLabel, formatter }` props.
4. Build the two specialised charts (`GoalsChart`, `ContributionScatter`).
5. Section the page per the UX plan in the spec.
6. Manually verify on at least three real rounds (small, medium, large
   bucket counts).

### Success Criteria

- [ ] All five charts render with sensible bins on a real round
- [ ] Charts are usable at 375 px width
- [ ] Each chart has an `aria-label` and hidden table fallback
- [ ] No layout shift between snapshot read and render
- [ ] Bundle size for the results page is acceptable
      (< 250 KB gzipped JS for the route)

## Phase 4: Cache invalidation

**Goal**: Snapshots actually invalidate on writes, freshness footer
reflects reality.

### Deliverables

1. `invalidateRoundResultsSnapshot(roundId)` called from Contribution
   create/delete mutations
2. Same for Allocation mutations (`allocate`, `bulkAllocate`,
   `bulkAllocateToGlobalBurnMembers`, etc.)
3. Urql client update so the page re-fetches after a mutation if the
   user is on the Results tab
4. Manual verification: contribute on one tab, refresh Results, see
   updated numbers without a stale `computedAt`

### Implementation Approach

1. Grep for every Contribution/Allocation write site in
   `ui/server/graphql/resolvers/mutations/`. Add a single helper call
   after each successful write.
2. Add `roundResults` to the relevant `updates.Mutation.*` entries in
   `ui/graphql/client.ts`.
3. Add a small integration test that performs a contribute and
   asserts the snapshot row was deleted.

### Success Criteria

- [ ] Snapshot row disappears after every relevant mutation
- [ ] Freshness footer never shows a `computedAt` from before the
      most recent contribution
- [ ] No double-recompute storms during bulk operations (the snapshot
      is just deleted; recompute happens on next read, not per write)

## Phase 5: Polish

**Goal**: Production-ready feature.

### Deliverables

1. Empty / in-progress / closed-round footer copy variants
2. History → `/transactions` route migration (admin-only guard
   preserved inside the page)
3. Round Overview "See final results →" link to Results, shown after
   `grantingCloses` (Q4 confirmed)
4. i18n strings extracted via `react-intl`
5. README / inline comment for snapshot invariants in the service

### Success Criteria

- [ ] All copy reviewed by stakeholder (typically the user)
- [ ] No missing i18n IDs
- [ ] Admin can still reach the transactions page directly
- [ ] No console warnings on the Results page

## Testing Strategy

### Unit Tests (Vitest)

- `ui/__tests__/roundResults.test.ts`: covers `computeRoundResults`
  for the empty, partial, and fully-funded fixture rounds; verifies
  the funded-participant filter
- `ui/__tests__/roundResults.bins.test.ts`: verifies the two binning
  functions on edge cases (single bucket, all zeros, very long tail)
- `ui/__tests__/roundResults.invalidation.test.ts`: verifies that a
  contribute mutation deletes the snapshot row

### E2E Tests (Cypress) — optional, if time permits in phase 5

- `cypress/e2e/round-results.cy.js`: visit a seeded round's Results
  tab, assert tiles render, assert one chart is visible

### Manual QA Checklist (every phase)

- Public round: anonymous user, logged-in non-member
- Hidden round: non-member (denied), approved member, admin
- Round with zero contributions
- Round in progress
- Round closed (past `grantingCloses`)
- Mobile (375 px) and desktop (1440 px)

## Progress Tracking

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 1 | Complete | 2026-04-24 | 2026-04-24 | Backend done; SQL verified against synthetic fixture; 8 unit tests passing. See [phases/phase-1.md](phases/phase-1.md) and work-notes for the legacy-column-name corrections. |
| Phase 2 | Complete | 2026-04-25 | 2026-04-25 | Frontend skeleton: page, components, SubMenu swap. Confirmed in browser on Borderland Dreams 2026 — all four hero tiles show correct numbers. See [phases/phase-2.md](phases/phase-2.md). |
| Phase 3 | Complete | 2026-04-25 | 2026-04-25 | Charts: recharts installed, 5 charts built, 13/13 tests pass, typecheck clean. Browser QA pending screenshot. See [phases/phase-3.md](phases/phase-3.md). |
| Phase 4 | Pending | | | |
| Phase 5 | Pending | | | |
