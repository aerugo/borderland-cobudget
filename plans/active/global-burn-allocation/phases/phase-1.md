# Phase 1: Backend — Shared Helper + New Mutation

**Status**: In Progress
**Started**: 2026-04-19
**Parent Plan**: [../development-plan.md](../development-plan.md)

## Objective

Add a `bulkAllocateToGlobalBurnMembers(roundId, amount, type, dryRun)`
mutation that (1) fetches the live Global Burn member list, (2) filters
the round's approved members down to that email set, and (3) either
returns preview counts (dry-run) or allocates funds via the existing
bulk-allocate write path. Refactor the existing `bulkAllocate` to share
its allocation math with the new mutation so the two stay in lockstep.

## Implementation Steps

### Step 1.1: Extract `allocateToMembers` helper

In [server/controller/index.ts](../../../../ui/server/controller/index.ts):

- Add `allocateToMembers({ roundId, members, amount, type, allocatedBy, dryRun })`.
- Takes a pre-fetched member list (with `user.emailSettings`,
  `statusAccountId`, `incomingAccountId` — same `include` as `bulkAllocate`).
- Guards `SET` with negative amount.
- Runs the two aggregate queries on `memberIds = members.map(m => m.id)`.
- Computes `adjustedAmount` + `balance` per member (same math as today).
- Computes `totalAmount = Σ adjustedAmount`.
- If `dryRun`: returns `{ totalAmount, memberCount: members.length }` only,
  no writes, no event.
- Otherwise: runs the `$transaction` with `createMany` on both tables and
  publishes `bulk-allocate` on `eventHub`, then returns the same counts.

### Step 1.2: Refactor `bulkAllocate` to delegate

Same file: the existing `bulkAllocate` becomes a thin wrapper that loads
`isApproved: true` members and calls `allocateToMembers` with
`dryRun: false`. Behavior unchanged.

### Step 1.3: New mutation resolver

In [server/graphql/resolvers/mutations/round.ts](../../../../ui/server/graphql/resolvers/mutations/round.ts):

```ts
export const bulkAllocateToGlobalBurnMembers = combineResolvers(
  isCollOrGroupAdmin,
  async (_, { roundId, amount, type, dryRun }, { user }) => {
    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round) throw new Error("Round not found");

    if (!round.globalBurnVerified) {
      return {
        status: "UNREACHABLE",
        matchedMembers: null,
        totalApproved: null,
        totalAmount: null,
        detail: "Global Burn is not configured for this round",
        round,
      };
    }

    const result = await fetchGlobalBurnMembers({ ...round });
    if (result.status !== "OK") {
      await prisma.round.update({
        where: { id: roundId },
        data: { globalBurnVerified: false },
      });
      return { status: result.status, /* nulls + detail */ };
    }

    const burnEmails = new Set(result.emails.map((e) => e.toLowerCase()));

    const approvedMembers = await prisma.roundMember.findMany({
      where: { roundId, isApproved: true },
      include: { user: { include: { emailSettings: true } } },
    });
    const matched = approvedMembers.filter((m) =>
      burnEmails.has(m.user.email.toLowerCase())
    );

    const currentAdminRM = await prisma.roundMember.findUnique({
      where: { userId_roundId: { userId: user.id, roundId } },
    });

    const { totalAmount } = await allocateToMembers({
      roundId,
      members: matched,
      amount,
      type,
      allocatedBy: currentAdminRM.id,
      dryRun,
    });

    return {
      status: "OK",
      matchedMembers: matched.length,
      totalApproved: approvedMembers.length,
      totalAmount,
      detail: null,
      round,
    };
  }
);
```

### Step 1.4: GraphQL SDL

In [server/graphql/schema/index.js](../../../../ui/server/graphql/schema/index.js):

- Add mutation next to `bulkAllocate`:
  ```graphql
  bulkAllocateToGlobalBurnMembers(
    roundId: ID!
    amount: Int!
    type: AllocationType!
    dryRun: Boolean!
  ): GlobalBurnAllocationResult!
  ```
- Add result type next to `GlobalBurnSyncResult`:
  ```graphql
  type GlobalBurnAllocationResult {
    status: GlobalBurnConnectionStatus!
    matchedMembers: Int
    totalApproved: Int
    totalAmount: Int
    detail: String
    round: Round
  }
  ```

## Edge Cases to Handle

- `matched.length === 0`: allocator returns `totalAmount: 0`; UI shows
  "0 members match — nothing to allocate" and disables Confirm.
- `type === "SET"` with amount < 0: allocator throws (existing guard).
- Global Burn fetch fails (INVALID_KEY / EVENT_NOT_FOUND / UNREACHABLE):
  flip `globalBurnVerified` to `false`, return status verbatim so the UI
  can toast via `connectionErrorMessage`.
- Admin isn't a `RoundMember` of their own round (shouldn't happen —
  creating a round makes the creator a RoundMember): the lookup will
  return null. Throw "Not a round member" rather than crash at `.id`.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/server/controller/index.ts` | MODIFY | extract `allocateToMembers`, rewrite `bulkAllocate` as wrapper |
| `ui/server/graphql/schema/index.js` | MODIFY | new mutation + result type |
| `ui/server/graphql/resolvers/mutations/round.ts` | MODIFY | new resolver, import `allocateToMembers` |

## Verification

```bash
cd ui
yarn typecheck
yarn dev
```

Manual (via GraphQL playground or modal UI in Phase 2):

- Dry-run against a round with verified Burn returns non-zero counts.
- Real run writes `matched.length` Allocation rows.
- Running against a non-verified round returns `UNREACHABLE`.

## Completion Criteria

- [ ] `allocateToMembers` extracted; `bulkAllocate` delegates.
- [ ] New mutation introspects in the GraphQL schema.
- [ ] Typecheck passes with no new errors.
- [ ] Dry-run and real run produce correct results against a local Burn
      mock or real instance.
