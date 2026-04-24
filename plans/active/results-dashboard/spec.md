# Feature: Results Dashboard tab on Rounds

**Status**: Draft
**Created**: 2026-04-24

## Goal

Replace the admin-only "History" tab on rounds with a public-facing "Results" dashboard that gives every viewer of the round a clear, fast-loading visual summary of how the round actually played out.

## Background

Cobudget rounds end in a long tail of contributions, but today there is no
single place where a participant, organiser, or public observer can see
"what happened in this round?" The admin-only History tab shows raw
transactions — useful for audit, useless for storytelling. Round
results are currently spread across the Overview page totals, individual
bucket pages, and the admin transactions log.

A Results tab serves three audiences:

- **Participants** — "Did my round community fully use the budget?
  Which dreams got the most love?"
- **Organisers** — "How did our funding cycle go? What can I share with
  stakeholders?"
- **Public observers** (for `visibility = PUBLIC` rounds) — "What does
  participatory funding look like in practice here?"

Because the underlying queries fan out across `Bucket`, `Contribution`,
`Allocation`, and `RoundMember`, they are too expensive to compute on
every page load. A snapshot/cache layer is therefore part of the spec.

## Acceptance Criteria

- [ ] AC1: A "Results" tab appears in the round sub-menu, in place of
      "History", visible to anyone who can view the round (public
      rounds → everyone, hidden rounds → approved members only).
- [ ] AC2: The History page is preserved for admins at a renamed admin
      route (`/transactions`) so audit access is not lost. The label in
      the round nav is removed.
- [ ] AC3: The dashboard shows the following **headline tiles** at the top:
      total contributions count (#1), total amount contributed (#2),
      average contribution size (#3), and full participation rate (#5).
      All currency tiles use the round's currency formatter.
- [ ] AC4: The dashboard shows the following **distribution charts**:
      - Dreams by minGoal & maxGoal (#6) — paired histogram or 2-series
        bar chart.
      - Dreams by sum of contributions received (#8).
      - Dreams by number of contributions received (#7).
      - Dreams by number of unique contributors (#9).
      - Dreams by (count, size) of contributions from funded
        participants (#4) — 2-D scatter / heatmap.
- [ ] AC5: All distribution charts exclude unpublished, deleted, and
      cancelled buckets. Charts #4, #7, #8, #9 further restrict to
      buckets that received at least one qualifying contribution.
- [ ] AC6: "Funded participant" filter (used in #4 and #5) means
      `RoundMember` whose net allocation amount is `> 0`. Members who
      were never given budget are excluded from those metrics.
- [ ] AC7: First request after invalidation computes the snapshot from
      live data (≤ 1.5 s for a round with 1k buckets / 5k contributions);
      subsequent requests within the TTL return the cached snapshot in
      < 100 ms.
- [ ] AC8: When a `Contribution` is created or deleted, or an
      `Allocation` is written, the round's snapshot is invalidated so
      that the next view recomputes.
- [ ] AC9: The page surfaces snapshot freshness ("Updated 3 minutes
      ago") so viewers know the data is computed, not realtime.
- [ ] AC10: Empty state — for rounds with zero contributions, the
      dashboard renders an explanatory placeholder ("Results will appear
      here once funding begins") instead of a wall of zeros.
- [ ] AC11: Mobile layout — tiles stack to one column < 640 px; charts
      become full-width single column.
- [ ] AC12: All numbers and chart data come from a single GraphQL query
      `roundResults(roundId)`. The page does not issue a query per chart.

## Technical Requirements

### Database Changes

Add one model to `ui/server/prisma/schema.prisma`:

```prisma
model RoundResultsSnapshot {
  id         String   @id @default(cuid())
  round      Round    @relation(fields: [roundId], references: [id], onDelete: Cascade)
  roundId    String   @unique
  payload    Json     // serialized RoundResults shape (scalars + buckets[])
  computedAt DateTime @default(now())
  schemaVersion Int   @default(1)
}
```

`schemaVersion` lets us invalidate every snapshot when we change the
payload shape, without writing a migration script.

### GraphQL Changes

New query in `ui/server/graphql/schema/index.js`:

```graphql
type BucketResultRow {
  id: ID!
  title: String!
  minGoal: Int
  maxGoal: Int
  contributionsCount: Int!
  contributionsSum: Int!
  contributorsCount: Int!
  contributionsCountFundedOnly: Int!
  contributionsSumFundedOnly: Int!
}

type RoundResults {
  totalContributionsCount: Int!
  totalContributionsAmount: Int!
  averageContributionAmount: Float!
  fullParticipationRate: Float!
  fundedParticipantCount: Int!
  fullySpentParticipantCount: Int!
  buckets: [BucketResultRow!]!
  computedAt: DateTime!
  isStale: Boolean!
}

extend type Query {
  roundResults(roundId: ID!): RoundResults
}
```

Resolver in `ui/server/graphql/resolvers/queries/round.ts`:

- Auth: `canViewRound({ round, user })` (existing helper).
- Read snapshot if fresh, else compute → write snapshot → return.

Snapshot invalidation:

- `ui/server/graphql/resolvers/mutations/contribution/contribute.ts`
  (or whatever owns Contribution writes) — clear snapshot on
  create/delete.
- Allocation mutations — clear snapshot on write (this is rare and
  bursty so just clearing is fine).

### UI Changes

- New page: `ui/pages/[group]/[round]/results.tsx`.
- Renamed/moved page: `ui/pages/[group]/[round]/history.js` →
  `ui/pages/[group]/[round]/transactions.js`. SubMenu entry is removed
  from the public nav; admins reach it via the existing admin section
  (or via direct URL — to confirm in phase 5).
- New components in `ui/components/RoundResults/`:
  - `RoundResults.tsx` (page-level orchestrator)
  - `StatTile.tsx` (one of four headline tiles)
  - `DistributionChart.tsx` (generic bar histogram, used 3×)
  - `GoalsChart.tsx` (paired min/max chart)
  - `ContributionScatter.tsx` (2-D #4)
  - `EmptyResults.tsx`
  - `bins.ts` (pure helpers for currency log-bins and integer bins)
- New SubMenu entry in `ui/components/SubMenu.tsx` replacing the
  History row.
- Add `recharts` dependency.

### Cache Invalidation (Urql)

`ui/graphql/client.ts`:

- `roundResults` is a regular query — no special graphcache rules
  needed for read.
- After contribute/allocate mutations the server invalidates the
  snapshot; client-side, Urql's existing invalidation of `Round` /
  `Bucket` should be extended to also re-run `roundResults` when the
  user is currently on the Results page. Simplest: add `roundResults`
  to the `updates.Mutation.contribute` invalidation list.

## Dependencies

- No external services. Stays inside the existing Postgres + Prisma +
  Apollo stack.
- New runtime dep: `recharts` (~90 KB gzipped).

## Out of Scope

- Per-bucket leaderboards / rankings table (natural follow-up; not in
  v1).
- CSV export / PDF download.
- Time-series charts (e.g. "contributions over time"). The current data
  model would support it but the user did not ask for it.
- Comparison across rounds.
- Per-tag or per-category breakdowns.
- Real-time updates (websocket / polling). Snapshot + manual refresh
  via page reload is fine for v1.
- Internationalisation of new chart labels beyond what `react-intl`
  already covers (we'll wire the strings up but won't push to Crowdin
  until the design is settled).

## Security & Authorization

- Read access: `canViewRound` (existing helper at
  `ui/server/graphql/resolvers/helpers/index.ts:375-393`). Public
  rounds → anyone; hidden rounds → approved members.
- The dashboard exposes only **aggregate** numbers and bucket-level
  totals that are already visible on individual bucket pages. No new
  PII is surfaced; no per-contributor breakdown is shown.
- Snapshot data inherits round visibility; cached payloads are scoped
  by `roundId` and never served cross-round.

## UX & Design Notes

The dashboard is a story, not a data dump. Reading order matters:

1. **Hero strip — four big tiles**, left to right:
   *Contributions made* · *Total funded* · *Avg contribution* ·
   *Participation rate*.
   These answer "did anything happen, and was it healthy?" in one
   glance. Participation rate is deliberately last because it's the
   most editorial number — a high rate is a civic-engagement win,
   worth celebrating.

2. **Section: "Where the money went"** — the three single-axis
   distributions (#7, #8, #9) side by side (stacking on mobile).
   These three together answer "were a few dreams hoarding funding,
   or was it spread out?"

3. **Section: "Dream sizes"** — chart #6 (minGoal vs maxGoal). This
   gives context: small rounds with small dreams shouldn't be compared
   to big-budget rounds.

4. **Section: "Contribution patterns"** — chart #4 (the 2-D scatter).
   This is the densest chart and goes last because it rewards readers
   who've already absorbed the simpler ones.

5. **Footer**: "Updated X minutes ago · Refresh". Subtle, not a
   distraction, but present so power users trust the numbers.

Visual style: match the existing MUI + Tailwind look. Use the same
`Card`/border treatment as Overview tiles. Charts get neutral colours
by default (one accent colour from the round's theme); avoid red/green
binaries for accessibility.

Empty / partial states get equal design effort:

- **Round not started / no contributions yet** → friendly placeholder
  with a single line of copy and an icon. No charts, no zero-tiles.
- **Round in progress** → all charts render, snapshot freshness shows
  "Updated X minutes ago".
- **Round closed** → identical layout, but the freshness footer reads
  "Final results · Closed on DATE".

Bin choices for histograms (computed client-side from the bucket rows
returned by the API, so we can iterate without redeploying the API):

- Currency amounts (#8): log-spaced bins (e.g. 0, 1–10, 11–100,
  101–1k, 1k–10k, 10k+) — long-tailed distributions look terrible on
  linear axes.
- Counts (#7, #9): integer bins (0, 1, 2–3, 4–7, 8–15, 16–31, 32+).
- Goals (#6): linear bins scaled to the round's max bucket goal.

Accessibility: every chart gets an `aria-label` summarising its
content and a hidden `<table>` fallback derived from the same data.

## Resolved Decisions (was Open Questions)

All four questions confirmed by user on 2026-04-24.

- [x] **Q1 — Metric #4**: 2-D distribution per dream of `(count, sum)`
      of contributions from **funded participants only**. Filter is
      on contributions, not on dreams. Dreams whose creators had no
      budget still appear if they received qualifying contributions.
- [x] **Q2 — History label**: removed from the public SubMenu
      entirely. Admin access is preserved via the renamed
      `/transactions` route.
- [x] **Q3 — Snapshot freshness**: event-driven invalidation on every
      `Contribution` and `Allocation` write, plus a **1-hour hard
      TTL ceiling** as a safety net.
- [x] **Q4 — Overview CTA**: after `grantingCloses`, the round
      Overview page surfaces a "See final results →" link to the
      Results tab. Included in phase 5 deliverables.
