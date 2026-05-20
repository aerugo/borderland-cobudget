# Phase 1: Backend foundation

**Status**: Complete
**Started**: 2026-04-24
**Completed**: 2026-04-24
**Parent Plan**: [development-plan.md](../development-plan.md)

## Important corrections discovered during implementation

The pre-implementation plan had three wrong assumptions; all are
corrected in the shipped code:

1. **Legacy DB column names**. The Postgres tables use `Collection`
   (not `Round`), `CollectionMember` (not `RoundMember`),
   `Organization` (not `Group`). FK columns are `collectionId` /
   `collectionMemberId`. Raw SQL must use these legacy names; the
   Prisma client API uses the model names from `schema.prisma`.
2. **`Bucket` has no `minGoal` / `maxGoal` columns**. They're
   computed from `BudgetItem` rows: `minGoal = SUM(min) FILTER (type='EXPENSE')`,
   `maxGoal = SUM(COALESCE(max, min)) FILTER (type='EXPENSE')`.
   See `bucketMinGoal` / `bucketMaxGoal` in
   [helpers/index.ts:250-271](../../../../ui/server/graphql/resolvers/helpers/index.ts#L250).
   The `bucket_goals` CTE in `sql.ts` does this aggregation.
3. **No test-DB harness exists** — server tests in this codebase
   mock Prisma. Tests now follow that convention; SQL was instead
   verified by running it against a synthetic fixture in a
   rolled-back `psql` transaction.

## Objective

Land a working `roundResults(roundId)` GraphQL query that returns
correct numbers for any round, backed by a `RoundResultsSnapshot`
table for caching. Validate against a seeded fixture round in
Vitest. No frontend work yet.

After this phase, an engineer can hit the GraphQL endpoint with
`{ roundResults(roundId: "...") { ... } }` and get back every number
the dashboard needs, with the snapshot row populated on first read.

## Implementation Steps

### Step 1.1: Database schema

Modify [ui/server/prisma/schema.prisma](../../../../ui/server/prisma/schema.prisma):

Add the snapshot model:

```prisma
model RoundResultsSnapshot {
  id            String   @id @default(cuid())
  round         Round    @relation(fields: [roundId], references: [id], onDelete: Cascade)
  roundId       String   @unique
  payload       Json
  schemaVersion Int      @default(1)
  computedAt    DateTime @default(now())

  @@index([computedAt])
}
```

Add the back-relation on `Round`:

```prisma
model Round {
  // ... existing fields ...
  resultsSnapshot RoundResultsSnapshot?
}
```

Run migration:

```bash
cd ui && yarn migrate
```

### Step 1.2: Service layer

Create `ui/server/services/RoundResultsService/index.ts`:

```ts
const SCHEMA_VERSION = 1;
const TTL_MS = 60 * 60 * 1000; // 1h safety-net ceiling

export async function getRoundResults(roundId: string) {
  const snapshot = await prisma.roundResultsSnapshot.findUnique({
    where: { roundId },
  });

  const fresh =
    snapshot &&
    snapshot.schemaVersion === SCHEMA_VERSION &&
    Date.now() - snapshot.computedAt.getTime() < TTL_MS;

  if (fresh) {
    return { ...(snapshot.payload as RoundResultsPayload), computedAt: snapshot.computedAt, isStale: false };
  }

  const payload = await computeRoundResults(roundId);
  const written = await prisma.roundResultsSnapshot.upsert({
    where: { roundId },
    update: { payload, schemaVersion: SCHEMA_VERSION, computedAt: new Date() },
    create: { roundId, payload, schemaVersion: SCHEMA_VERSION },
  });
  return { ...payload, computedAt: written.computedAt, isStale: false };
}

export async function invalidateRoundResultsSnapshot(roundId: string) {
  await prisma.roundResultsSnapshot.deleteMany({ where: { roundId } });
}

export async function computeRoundResults(roundId: string): Promise<RoundResultsPayload> {
  // Single $queryRaw with CTEs — see sql.ts
  // Returns scalars + buckets[].
}
```

Create `ui/server/services/RoundResultsService/sql.ts` with a single
parametrised query along these lines:

```sql
WITH funded_members AS (
  SELECT rm.id
  FROM "RoundMember" rm
  JOIN "Allocation" a ON a."roundMemberId" = rm.id
  WHERE rm."roundId" = $1
  GROUP BY rm.id
  HAVING SUM(a.amount) > 0
),
member_spend AS (
  SELECT rm.id AS round_member_id,
         COALESCE(SUM(c.amount), 0) AS spent
  FROM "RoundMember" rm
  LEFT JOIN "Contribution" c
    ON c."roundMemberId" = rm.id
   AND c."roundId" = $1
  WHERE rm.id IN (SELECT id FROM funded_members)
  GROUP BY rm.id
),
member_budget AS (
  SELECT rm.id AS round_member_id,
         COALESCE(SUM(a.amount), 0) AS budget
  FROM "RoundMember" rm
  JOIN "Allocation" a ON a."roundMemberId" = rm.id
  WHERE rm.id IN (SELECT id FROM funded_members)
  GROUP BY rm.id
),
bucket_stats AS (
  SELECT b.id,
         b.title,
         b."minGoal",
         b."maxGoal",
         COUNT(c.id) AS contributions_count,
         COALESCE(SUM(c.amount), 0) AS contributions_sum,
         COUNT(DISTINCT c."roundMemberId") AS contributors_count,
         COUNT(c.id) FILTER (WHERE c."roundMemberId" IN (SELECT id FROM funded_members)) AS contributions_count_funded,
         COALESCE(SUM(c.amount) FILTER (WHERE c."roundMemberId" IN (SELECT id FROM funded_members)), 0) AS contributions_sum_funded
  FROM "Bucket" b
  LEFT JOIN "Contribution" c ON c."bucketId" = b.id
  WHERE b."roundId" = $1
    AND b."deleted" = false
    AND b."publishedAt" IS NOT NULL
    AND b."canceledAt" IS NULL
  GROUP BY b.id
),
totals AS (
  SELECT COUNT(*)::int AS total_contrib_count,
         COALESCE(SUM(amount), 0)::int AS total_contrib_amount
  FROM "Contribution"
  WHERE "roundId" = $1
)
SELECT
  (SELECT row_to_json(totals.*) FROM totals) AS totals,
  (SELECT COUNT(*)::int FROM funded_members) AS funded_member_count,
  (SELECT COUNT(*)::int FROM member_spend ms JOIN member_budget mb USING (round_member_id) WHERE ms.spent >= mb.budget) AS fully_spent_count,
  (SELECT json_agg(bucket_stats.*) FROM bucket_stats) AS buckets;
```

The TS layer reshapes this into the `RoundResultsPayload` (camelCase,
computed `averageContributionAmount` and `fullParticipationRate`).

### Step 1.3: GraphQL schema

Add to [ui/server/graphql/schema/index.js](../../../../ui/server/graphql/schema/index.js):

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

### Step 1.4: Resolver

Add to [ui/server/graphql/resolvers/queries/round.ts](../../../../ui/server/graphql/resolvers/queries/round.ts):

```ts
export const roundResults = async (_p, { roundId }, { user }) => {
  const round = await prisma.round.findUnique({ where: { id: roundId } });
  if (!round) throw new Error("Round not found");
  if (!(await canViewRound({ round, user }))) {
    throw new Error("Not authorized");
  }
  return getRoundResults(roundId);
};
```

Wire it into the query map alongside `round`, `roundTransactions`,
etc.

### Step 1.5: Tests

Create `ui/__tests__/roundResults.test.ts` covering:

- **Empty round**: zero contributions → all scalars 0, buckets array
  empty
- **Round with contributions but no allocations**: total counts /
  amounts populated, `fundedParticipantCount === 0`,
  `fullParticipationRate` defined as 0 (not NaN)
- **Round with one funded member who spent everything**: rate = 1.0
- **Round with one funded member who spent half**: rate = 0.0
  (we count *fully* spent)
- **Funded-participant filter**: a contribution from a member with
  no allocation should *not* count in
  `contributionsCountFundedOnly` but *should* count in
  `contributionsCount`
- **Snapshot round-trip**: first call writes snapshot, second call
  reads it (verify `computedAt` unchanged)
- **Schema-version bump**: bumping `SCHEMA_VERSION` constant in test
  forces a recompute even if the row exists

Use the existing test DB harness pattern from other Vitest files in
`ui/__tests__/`.

## Edge Cases to Handle

- Round with zero `RoundMember`s (new round, never invited):
  `fundedParticipantCount === 0`, `fullParticipationRate === 0` (not
  divide-by-zero).
- Round with `RoundMember`s but no allocations: same.
- Round with negative-amount allocations (refunds): the
  `HAVING SUM(a.amount) > 0` filter handles it correctly — a member
  who was given budget then had it taken back is not "funded".
- Buckets with `publishedAt IS NULL` (drafts): excluded from the
  `bucket_stats` CTE entirely.
- Cancelled buckets: excluded — they may have had contributions
  refunded; including them would distort distributions.
- Deleted buckets (`deleted = true`): excluded.
- Very large rounds (10k+ buckets, 100k+ contributions): the SQL
  should still complete in < 1.5 s on Postgres — verify on the
  largest staging round before merging. If it doesn't, add an
  index on `Contribution(roundId, roundMemberId)` (likely already
  exists; verify).
- Concurrent writes during compute: the snapshot is `upsert`ed at
  the end, so a stale read between compute-start and write doesn't
  corrupt anything; worst case is the next reader recomputes again
  on a snapshot already a few seconds old, which is fine.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/server/prisma/schema.prisma` | MODIFY | Add `RoundResultsSnapshot` model and back-relation on `Round` |
| `ui/server/prisma/migrations/<ts>_add_round_results_snapshot/` | CREATE | Generated by `yarn migrate` |
| `ui/server/services/RoundResultsService/index.ts` | CREATE | `getRoundResults`, `computeRoundResults`, `invalidateRoundResultsSnapshot` |
| `ui/server/services/RoundResultsService/sql.ts` | CREATE | The CTE-heavy raw SQL query |
| `ui/server/services/RoundResultsService/types.ts` | CREATE | `RoundResultsPayload`, `BucketResultRow` TS types shared with the resolver |
| `ui/server/graphql/schema/index.js` | MODIFY | Add `RoundResults`, `BucketResultRow` types and `roundResults` query |
| `ui/server/graphql/resolvers/queries/round.ts` | MODIFY | Add `roundResults` resolver delegating to the service |
| `ui/server/graphql/resolvers/queries/index.ts` (or wherever queries are wired) | MODIFY | Register `roundResults` in the query map |
| `ui/__tests__/roundResults.test.ts` | CREATE | Vitest coverage of the service |

## Verification

```bash
cd ui

# Apply migration
yarn migrate

# Type check
yarn typecheck

# Unit tests
npx vitest roundResults

# Manual sanity check via GraphQL playground at http://localhost:3000/api
# Query:
#   query { roundResults(roundId: "<a real round id>") {
#     totalContributionsCount totalContributionsAmount
#     averageContributionAmount fullParticipationRate
#     fundedParticipantCount fullySpentParticipantCount
#     computedAt isStale
#     buckets { id title minGoal maxGoal
#               contributionsCount contributionsSum contributorsCount
#               contributionsCountFundedOnly contributionsSumFundedOnly }
#   } }
```

## Completion Criteria

- [ ] Migration applied cleanly
- [ ] `yarn typecheck` passes
- [ ] All Vitest cases pass
- [ ] Hand-spot-check on a real round: numbers match a CSV computed
      directly from the DB (pick one round and verify by hand)
- [ ] Snapshot row exists after first call; `computedAt` unchanged
      after second call within TTL
- [ ] No new resolver leaks data to unauthorised users (verified
      by trying the query as an anonymous user against a hidden round
      — should error)
