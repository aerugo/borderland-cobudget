# Feature: Allocate funds to Global Burn participants only

**Status**: Draft
**Created**: 2026-04-19
**Depends on**: `plans/completed/global-burn-invites/` (ships the instance config + `fetchGlobalBurnMembers`)

## Goal

Let round admins bulk-allocate funds to only the subset of approved round
members whose emails appear on the connected Global Burn event's member
list — from a new tab in the existing "Manage all members balance" modal.

## Background

Rounds integrated with a Global Burn instance already use membership there
as the source of truth for who should participate (invite flow shipped
last week). Between invite runs, people leave the Burn — removing them
from Cobudget outright is not desirable (they may have buckets, history,
pending expenses), but admins do want to *stop funding* non-participants.
Today the "Manage all members balance" modal only offers "Add" / "Set"
across **all approved members**; there is no way to target the Burn
subset.

## Acceptance Criteria

- [ ] AC1: If `round.globalBurnVerified === true`, the "Manage all members
      balance" modal shows a second tab labelled "Global Burn members".
      If false/unset, the modal is unchanged.
- [ ] AC2: Selecting the Global Burn tab fetches the live member list
      from the Global Burn instance via the existing
      `GlobalBurnService.fetchGlobalBurnMembers`. Errors from that call
      are surfaced with the same `connectionErrorMessage` helper already
      used in `GlobalBurnSection`.
- [ ] AC3: Before confirming, the admin sees a preview: *"X of Y approved
      members match the Global Burn list. Adding/Setting $N each —
      $TOTAL will be allocated in total."*
- [ ] AC4: Admin confirms → only matched members receive `Allocation` +
      `Transaction` rows; non-matched approved members are untouched.
      Success toast reports the count actually allocated.
- [ ] AC5: Matching is by lowercased email (the Global Burn service
      already lowercases; `User.email` is stored lowercase via existing
      invite flow).
- [ ] AC6: Urql cache invalidates `membersPage` on successful allocation,
      mirroring `bulkAllocate`.
- [ ] AC7: Auth: same as `bulkAllocate` — `isCollOrGroupAdmin`.

## Technical Requirements

### Database Changes

None. Writes existing `Allocation` + `Transaction` rows.

### GraphQL Changes

New mutation:

```graphql
bulkAllocateToGlobalBurnMembers(
  roundId: ID!
  amount: Int!
  type: AllocationType!
  dryRun: Boolean!
): GlobalBurnAllocationResult!

type GlobalBurnAllocationResult {
  status: GlobalBurnConnectionStatus!   # reuse existing enum
  matchedMembers: Int                    # approved members on the Burn list
  totalApproved: Int                     # approved members total
  totalAmount: Int                       # amount * matchedMembers (ADD) or sum of deltas (SET)
  detail: String
  round: Round
}
```

### UI Changes

- [components/RoundMembers/BulkAllocateModal.tsx](../../../ui/components/RoundMembers/BulkAllocateModal.tsx):
  add a top-level tab switcher ("All members" | "Global Burn members")
  that only renders the Burn tab when `round.globalBurnVerified`. Factor
  existing content into an `AllMembersTab`; add a new
  `GlobalBurnMembersTab` with Add/Set + amount + two-step preview/confirm.
- The `round` prop passed in needs `globalBurnVerified` added to the
  selection set. Find the caller of `BulkAllocateModal` and extend the
  query.

### Cache Invalidation

Add `bulkAllocateToGlobalBurnMembers` updater in
[ui/graphql/client.ts](../../../ui/graphql/client.ts) that invalidates
`membersPage` on `dryRun=false` (same pattern as
`syncGlobalBurnMembers`).

## Dependencies

- `GlobalBurnService.fetchGlobalBurnMembers` (already shipped)
- `round.globalBurnVerified` exposed on GraphQL `Round` (already shipped)
- Existing `bulkAllocate` controller logic — will share the core
  allocation/transaction write via a small refactor.

## Out of Scope

- Scheduled / periodic sync of balances.
- Zeroing / clawing back balances from non-participants (future feature).
- E2E test (same rationale as invite flow: external HTTP dep).
- Showing a member-by-member breakdown in the modal. Counts only.

## Security & Authorization

- Mutation gated by `isCollOrGroupAdmin` (matches `bulkAllocate`).
- API key still never leaves the server; UI only consumes the result.
- Reuses the SSRF-guarded `fetchGlobalBurnMembers`, so no new network
  surface area.

## Resolved Questions

- [x] Q1 (2026-04-19): SET on the Burn tab only touches matched members.
      Non-matched approved members are untouched on both ADD and SET.
      Zeroing non-matched is a separate, future feature.
