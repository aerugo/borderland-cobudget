# Results Dashboard — Work Notes

**Feature**: Public-facing Results dashboard tab on rounds, replacing
the admin-only History tab. Backed by a per-round snapshot table.
**Started**: 2026-04-24
**Branch**: `results-dashboard` (to be created from `borderland`)

---

## Session Log

### 2026-04-24 — Planning session

**Context Reviewed**:
- Read `ui/components/SubMenu.tsx` — confirmed History is registered
  as `{ admin: true }` in the `roundItems` factory
- Read `ui/pages/[group]/[round]/history.js` — thin wrapper around
  the `Transactions` component
- Read Round-type resolvers in
  `ui/server/graphql/resolvers/types/Round.ts` — confirmed pattern of
  on-demand `prisma.aggregate` calls; nothing currently cached at
  this granularity
- Read `ui/server/graphql/resolvers/queries/round.ts` — confirmed
  `roundTransactions` already uses `prisma.$queryRaw`, which is the
  pattern we'll follow for the heavy aggregation
- Read `ui/server/prisma/schema.prisma` — relevant models: `Round`,
  `Bucket`, `Contribution`, `Allocation`, `RoundMember`. All required
  fields exist (no schema changes for the metrics themselves)
- Read `ui/server/graphql/resolvers/helpers/index.ts` — confirmed
  `canViewRound` is the right auth gate
- Verified `package.json` has no charting library yet — `recharts`
  will be a new dependency

**Completed**:
- [x] Spec drafted with 12 acceptance criteria, four open questions,
      and a detailed UX section
- [x] Development plan with 5 phases drafted
- [x] Phase 1 plan drafted in detail
- [x] Working assumptions documented for the four open questions

**Blockers/Issues**:
- None — but four questions are flagged in the spec for the user to
  confirm before phase 5 (UI strings depend on Q2 wording, scope of
  phase 5 depends on Q4)

**Next Steps**:
1. Create the feature branch `results-dashboard` from `borderland`
2. Start phase 1: add the Prisma model and run migrations

### 2026-04-24 — Open questions resolved

User confirmed "yes to all" four open questions. Spec, development
plan, and this file updated. Feature is fully specced; ready to
implement phase 1.

### 2026-04-24 — Phase 1 implemented

**Context Reviewed (corrections to the plan)**:
- DB tables use legacy names: `Round` → `Collection`, `RoundMember`
  → `CollectionMember`, `Group` → `Organization`. FK columns are
  `collectionId` / `collectionMemberId`. Verified via `@@map` /
  `@map` directives in `schema.prisma`. Raw SQL uses these legacy
  names; Prisma client API uses the model names.
- `Bucket` does **not** have `minGoal` / `maxGoal` columns. They are
  computed from `BudgetItem` rows: minGoal = `SUM(min) FILTER (type='EXPENSE')`,
  maxGoal = `SUM(COALESCE(max, min)) FILTER (type='EXPENSE')`.
  See `bucketMinGoal` / `bucketMaxGoal` in
  `server/graphql/resolvers/helpers/index.ts:250-271`.
- Tests in this codebase mock Prisma (`vi.mock("server/prisma", ...)`)
  rather than hitting a test DB. Adjusted phase 1 testing to follow
  this convention; SQL itself verified by hand against a synthetic
  fixture in a rolled-back psql transaction.
- `Contribution.deleted` and `Allocation.deleted` are nullable
  `Boolean?`; filter pattern is `("deleted" IS NULL OR "deleted" = false)`.
  `Bucket.deleted` is `Boolean @default(false)` (not nullable);
  filter pattern is `b.deleted = false`.

**Completed**:
- [x] Branch `results-dashboard` created from `borderland`
- [x] `RoundResultsSnapshot` model added; migration
      `20260424214433_add_round_results_snapshot` applied
- [x] `RoundResultsService` (`index.ts`, `sql.ts`, `types.ts`) created
      under `server/services/RoundResultsService/`
- [x] GraphQL types `BucketResultRow`, `RoundResults` added to
      `schema/index.js`; `roundResults(roundId): RoundResults` query
      registered
- [x] Resolver `roundResults` added to `resolvers/queries/round.ts`,
      gated by `canViewRound` (super-admin session bypasses)
- [x] 8 Vitest cases passing in
      `__tests__/server/roundResults.test.ts` covering the SQL → payload
      transformation, snapshot read-through, schema-version
      invalidation, TTL expiry, and `invalidate` deletion
- [x] Manual SQL sanity check against a synthetic fixture round
      (rolled back) — every aggregate matched expected values:
      `total_contrib_count=5`, `total_contrib_amount=300`,
      `funded_member_count=3`, `fully_spent_count=2`, b1 minGoal=300
      maxGoal=500, b1 contributions_sum_funded=280 (excluding
      unfunded participant's contribution), and excluded buckets
      (deleted/unpublished/canceled) correctly omitted.

**Blockers/Issues**:
- Pre-existing typecheck errors in `Wysiwyg`, `new-round`, `Date`
  scalar, `stripe`, `next-urql`. None caused by phase-1 changes; no
  new errors were introduced. Filtered output for
  `RoundResults|RoundResultsService` returned zero matches.

**Next Steps**:
1. Phase 2 — Frontend skeleton: `pages/[group]/[round]/results.tsx`,
   `RoundResults` / `StatTile` / `EmptyResults` components, SubMenu
   swap.

### 2026-04-25 — Phase 2 implemented

**Completed**:
- [x] `RoundResults`, `StatTile`, `EmptyResults` components +
      barrel export at `components/RoundResults/`
- [x] Page route `pages/[group]/[round]/results.tsx`
- [x] SubMenu swap: removed `History` entry, added `Results` entry
      with no admin gate
- [x] Typecheck passes; phase-1 unit tests still pass

**Manual QA deferred** (documented in phase-2.md): a pre-existing
dev server (PID 54477) was already running on port 3000 in an error
state (HTTP 500 on every request, "missing required error components"
template). I did not kill it without permission. The local Postgres
database is also empty, so even with a healthy server there is no
fixture round to load. Browser QA should happen against staging or
after seeding a round.

**Next Steps**:
1. Phase 3 — Charts: install `recharts`, build `bins.ts` helpers,
   `DistributionChart`, `GoalsChart`, `ContributionScatter`.

### 2026-04-25 — Phase 2 confirmed in browser; phase 3 implemented

**Phase 2 confirmation**: User's screenshot at
`localhost:3000/borderland/dreams-2026/results` shows the four hero
tiles rendering correctly. Numbers match the SQL: 6,507 contributions,
SEK 544,264.00 total, SEK 83.64 avg, 9% participation (476/5431).
Phase 2 acceptance criteria 3 and 11 (hero tiles, mobile/desktop
layout) are verified.

**Other discovery**: User's local DB is `borderland_dreams_prod`,
not `cb`. The `.env` file points Prisma at `cb` but the dev server
loads `.env.local` which points at `borderland_dreams_prod`. I ran
`DATABASE_URL=… npx prisma migrate deploy` to apply the new
snapshot migration to that DB too — only the new migration applied,
no data was touched. Updated [reference memory](../../../.claude/projects/-Users-hugi-GitRepos-cobudget/memory/cobudget_local_databases.md)
to capture this for future sessions.

**Phase 3 completed**:
- [x] Installed `recharts` (3.8.1)
- [x] `bins.ts` with two pure binning helpers (integer + log-spaced
      currency), 5 unit tests
- [x] `DistributionChart` (used 3× for #7 / #8 / #9)
- [x] `GoalsChart` (#6, paired min vs stretch goal bars)
- [x] `ContributionScatter` (#4, 2-D funded contributions)
- [x] All five charts wired into `RoundResults.tsx` per the spec
      UX plan (hero strip → "Where the money went" →
      "Dream sizes" → "Contribution patterns" → footer)
- [x] Hidden table fallbacks for accessibility on every chart
- [x] Typecheck clean; 13/13 tests pass

**Next Steps**:
1. Wait for user's browser screenshot of the full Results page to
   confirm chart layout.
2. Phase 4 — Cache invalidation hooks on Contribution / Allocation
   mutations.

---

## Key Decisions

### Decision 1: Snapshot table over `memory-cache`

**Date**: 2026-04-24
**Context**: Need to cache expensive per-round aggregates on a
serverless deploy (Vercel), where in-memory caches don't persist
across function invocations.
**Decision**: Add `RoundResultsSnapshot` model in Postgres with a
JSON `payload` column.
**Rationale**: Survives cold starts, is debuggable (you can read the
cached payload from `psql`), and only one write per invalidation.
`memory-cache` would pretend to work in dev and fail in prod.

### Decision 2: Per-bucket rows + client-side binning

**Date**: 2026-04-24
**Context**: Charts need histograms; the API could either return
pre-binned data or raw per-bucket rows.
**Decision**: Return raw per-bucket rows; bin client-side.
**Rationale**: Round bucket counts are bounded (typically ≤ a few
thousand), so payload is fine. Lets us iterate on chart bin choices
without touching the API.

### Decision 3: Replace History rather than co-existing

**Date**: 2026-04-24
**Context**: Should the new public Results tab co-exist with the
admin History tab in the SubMenu, or replace it?
**Decision**: Remove the History entry from the SubMenu; move the
underlying admin page to `/transactions` so admins still have it via
direct link / admin areas.
**Rationale**: The user explicitly asked for replacement. Two tabs
that look similar but serve different audiences would be confusing.
Audit access is preserved.

### Decision 4: `recharts` for charts

**Date**: 2026-04-24
**Context**: No charting library currently installed.
**Decision**: Add `recharts`.
**Rationale**: Lightest React-native option (~90 KB gzipped),
declarative API matches Cobudget's React style, responsive
containers built-in, no theming work required to look reasonable
next to MUI.

### Decision 5: Event-driven invalidation + 1-hour TTL ceiling

**Date**: 2026-04-24
**Context**: Snapshot freshness vs. risk of missed invalidations.
**Decision**: Invalidate on every Contribution / Allocation write;
also recompute if snapshot is older than 1 hour.
**Rationale**: Belt and suspenders. The TTL catches any
mutation we forgot to wire, without making cold reads slow on a
quiet round.

---

## Files Modified

### Created (planning only — no code changes yet)
- `plans/active/results-dashboard/spec.md` — feature spec
- `plans/active/results-dashboard/development-plan.md` — 5-phase plan
- `plans/active/results-dashboard/work-notes.md` — this file
- `plans/active/results-dashboard/phases/phase-1.md` — phase 1 detail

### Modified
- (none yet)

---

## Resolved Decisions

All four open questions confirmed by user on 2026-04-24 ("yes to all"):

1. **Metric #4**: 2-D per-dream (count, sum) of contributions from
   funded participants only. Filter contributions, not dreams.
2. **History label** removed from the public SubMenu; admins use the
   `/transactions` route.
3. **Snapshot freshness**: event-driven invalidation + 1-hour hard
   TTL ceiling as a safety net.
4. **Overview → Results CTA** after `grantingCloses` is in scope for
   phase 5.
