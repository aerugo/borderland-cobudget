# Phase 4: Fix participation metric for multi-round funding cycles

**Status**: Planned
**Started**: 2026-04-25
**Parent Plan**: [development-plan.md](../development-plan.md)

## Problem

The dashboard's **Participation** and **Full participation** tiles
read wrong on Borderland Dreams 2026 (and any other round that uses
multiple funding cycles within a single Cobudget round).

Borderland's model: participants get a fresh budget at the start of
each of three "funding rounds". Between funding rounds, the round
admin resets every member's balance to 0 so unspent funds don't
roll over. A member who fully participated in all three rounds
ends up with `SUM(allocations) ≈ 0` because the resets cancel out
the grants.

## Root cause

In [sql.ts](../../../../ui/server/services/RoundResultsService/sql.ts)
the `member_budget` and `funded_members` CTEs sum **net**
allocations:

```sql
member_budget AS (
  SELECT rm_id, SUM(amount)::bigint AS budget
  FROM all_allocations
  GROUP BY rm_id
),
funded_members AS (
  SELECT rm_id, budget FROM member_budget WHERE budget > 0
)
```

Both `ADD` and `SET` allocations store the *delta* in
`Allocation.amount` (see
[controller/index.ts:48-55](../../../../ui/server/controller/index.ts#L48)):

- `SET 100` from balance 0 → row `amount = +100`
- `SET 0` from balance 40 (the round-end reset) → row `amount = -40`
- Net `SUM(amount)` after a complete round: `+100 + -40 = +60`
- Across three reset-to-zero cycles: `SUM = 0`

So a poster-child fully-participating member gets filtered out by
`HAVING budget > 0` and isn't counted in either the numerator or
denominator of either rate. The denominator on Borderland 2026
(5,431) only contains members whose net allocation is currently
positive — i.e., people who got an allocation but **haven't spent
it yet** in the current funding round. That's the opposite of what
the metric is supposed to highlight.

Real-data evidence:

```
SELECT "allocationType",
       COUNT(*),
       COUNT(*) FILTER (WHERE amount > 0) AS positive,
       COUNT(*) FILTER (WHERE amount < 0) AS negative,
       SUM(amount) AS net,
       SUM(amount) FILTER (WHERE amount > 0) AS gross_positive
FROM "Allocation"
WHERE "collectionId" = 'cmlo2cy5u0001qnosy70qk7ep'
  AND ("deleted" IS NULL OR "deleted" = false)
GROUP BY "allocationType";
```

| type | rows | positive | negative | net | gross_positive |
|---|---|---|---|---|---|
| SET | 16,395 | 10,858 | 4,026 | 395,983,968 | **651,520,000** |
| ADD | 1 | 1 | 0 | 70,000 | 70,000 |

The gross positive sum (~SEK 6.5M) is roughly 1.6× the net sum
(~SEK 4M). The 4,026 negative SET rows are the round-end resets.

## Correct definitions

Per the user's spec:

- **received** (per member) = sum of *positive* allocation deltas =
  `SUM(amount) WHERE amount > 0`
  — i.e. cumulative grants ever credited to that member, ignoring
  resets and clawbacks.
- **spent** (per member) = `SUM(contribution.amount)` (always positive
  by construction; deleted contributions still excluded).
- **funded** = `received > 0` — member was ever given budget.
- **any_spend** = `spent > 0` — member made at least one contribution.
- **fully_spent** = `spent >= received` — member has spent everything
  cumulatively granted to them.

Rates:
- **participationRate** = `count(funded ∧ any_spend) ÷ count(funded)`
- **fullParticipationRate** = `count(funded ∧ fully_spent) ÷ count(funded)`

Edge cases:
- Member with one positive SET then zero contributions → funded, not
  any_spend, not fully_spent. ✓
- Member with three rounds × `SET 100` and three resets and 300
  contributed → received 300, spent 300, fully_spent. ✓
- Member who only got resets / clawbacks (no positive grant ever) →
  not funded; excluded from denominator. ✓
- Member who overspent (negative resulting balance forced through, or
  deleted-contribution edge case) → fully_spent (`spent >= received`
  still holds). ✓

## Code changes

### 1. SQL ([sql.ts](../../../../ui/server/services/RoundResultsService/sql.ts))

Replace the two CTEs:

```sql
-- BEFORE
member_budget AS (
  SELECT rm_id, SUM(amount)::bigint AS budget
  FROM all_allocations
  GROUP BY rm_id
),
funded_members AS (
  SELECT rm_id, budget FROM member_budget WHERE budget > 0
),
```

```sql
-- AFTER
member_received AS (
  SELECT rm_id,
         COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)::bigint AS received
  FROM all_allocations
  GROUP BY rm_id
),
funded_members AS (
  SELECT rm_id, received FROM member_received WHERE received > 0
),
```

Then update `member_spend` and the final `fully_spent_count` /
`any_spend_count` selects to read from `funded_members.received`
instead of `funded_members.budget`. Variable rename is mechanical;
the join shape doesn't change.

The `bucket_stats` CTE (and its "funded only" filters) keeps the
current `c.rm_id IN (SELECT rm_id FROM funded_members)` membership
check — which is now correctly populated by the gross-received
filter.

### 2. Bump schema version
([index.ts](../../../../ui/server/services/RoundResultsService/index.ts))

```ts
export const ROUND_RESULTS_SCHEMA_VERSION = 3;
```

Reason: the meaning of `fundedParticipantCount`,
`participationRate`, and `fullParticipationRate` in cached payloads
changes. Bumping forces every snapshot to recompute on next read,
no migration needed.

### 3. Tests
([__tests__/server/roundResults.test.ts](../../../../ui/__tests__/server/roundResults.test.ts))

The current tests pass mock raw rows in directly, so they don't
exercise the SQL. Add a new test case using the actual `runRoundResultsQuery`
shape with a hand-crafted `$queryRaw` mock that verifies:

- A member with `[+100, -100, +100, -100, +100]` deltas and 250
  contributions is counted as `received=300, spent=250, funded=true,
  any_spend=true, fully_spent=false`.
- A member with `[+100, -100]` and zero contributions is counted as
  `funded=true, any_spend=false`.
- A member with only `[-50]` (reset of a deleted allocation, edge case)
  is `funded=false`.

These test assertions live at the **payload** level — we don't need
a real Postgres harness because the SQL → payload transformation
runs the math.

For the SQL itself, hand-verify against Borderland 2026 and at
least one other round in `borderland_dreams_prod` (one with no
mid-round resets, e.g. an old round) to make sure non-multi-round
behavior is unchanged.

## Expected impact on Borderland 2026 numbers

Pre-fix (current production):
- Funded participants: **5,431** (members with current positive net
  balance — i.e., people partway through a round)
- Participation: 1,053 / 5,431 = **19%**
- Full participation: 476 / 5,431 = **9%**

Post-fix (predicted):
- Funded participants: roughly **all members ever granted any budget**
  — likely several thousand more than 5,431, possibly the entire
  membership population
- Participation rate: more meaningful — % of funded members who have
  ever made a contribution
- Full participation rate: more meaningful — % of funded members who
  have spent every cent they were ever granted, including across
  prior funding rounds

I'll print the actual before/after numbers to the work-notes after
implementation so you can sanity-check before the deploy.

## Verification

```bash
cd ui
npx vitest roundResults
yarn typecheck
```

Then live SQL check on `borderland_dreams_prod`:

```sql
WITH all_allocations AS (
  SELECT "collectionMemberId" AS rm_id, amount FROM "Allocation"
  WHERE "collectionId" = 'cmlo2cy5u0001qnosy70qk7ep'
    AND ("deleted" IS NULL OR "deleted" = false)
),
member_received AS (
  SELECT rm_id, COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)::bigint AS received
  FROM all_allocations GROUP BY rm_id
),
funded AS (SELECT rm_id, received FROM member_received WHERE received > 0),
member_spend AS (
  SELECT "collectionMemberId" AS rm_id, COALESCE(SUM(amount), 0)::bigint AS spent
  FROM "Contribution"
  WHERE "collectionId" = 'cmlo2cy5u0001qnosy70qk7ep'
    AND ("deleted" IS NULL OR "deleted" = false)
  GROUP BY "collectionMemberId"
)
SELECT (SELECT COUNT(*) FROM funded)                      AS funded,
       (SELECT COUNT(*) FROM funded fm
          JOIN member_spend ms USING(rm_id)
          WHERE ms.spent > 0)                             AS any_spend,
       (SELECT COUNT(*) FROM funded fm
          LEFT JOIN member_spend ms USING(rm_id)
          WHERE COALESCE(ms.spent,0) >= fm.received)      AS fully_spent;
```

After confirming the numbers look sane, commit, push to borderland,
let Vercel redeploy, and visit the Results page — old snapshot
recomputes automatically on first read because the schema version
bumped from 2 to 3.

## Out of scope

- Surfacing per-funding-round stats (round 1 / round 2 / round 3
  breakdown). Cobudget doesn't currently model funding rounds as
  first-class entities — they're a Borderland convention enforced
  manually by admins. Building per-cycle metrics would require
  inferring cycle boundaries from allocation timestamps or adding a
  new model. Not addressed here.
- Refunds / deleted contributions are already excluded from `spent`
  via the existing `(deleted IS NULL OR deleted = false)` filter.
- The "Average contribution" tile is unaffected (it uses
  `totalContributionsAmount / totalContributionsCount` which doesn't
  depend on the funded-members denominator).
