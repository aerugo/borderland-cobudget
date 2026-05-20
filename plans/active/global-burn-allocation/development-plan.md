# Global Burn Allocation — Development Plan

**Status**: In Progress
**Created**: 2026-04-19
**Branch**: `borderland` (cut a feature branch before Phase 1)
**Spec**: [spec.md](spec.md)

## Summary

Add a `bulkAllocateToGlobalBurnMembers(roundId, amount, type, dryRun)`
mutation and a second tab in `BulkAllocateModal` that uses it, so admins
can allocate funds to only the round members who appear on the connected
Global Burn event's member list.

## Current State Analysis

- [components/RoundMembers/BulkAllocateModal.tsx](../../../ui/components/RoundMembers/BulkAllocateModal.tsx)
  renders a single Add/Set switch + amount field and fires
  `bulkAllocate(roundId, amount, type)`.
- [server/controller/index.ts:93-169](../../../ui/server/controller/index.ts#L93-L169)
  `bulkAllocate` loads all `isApproved: true` members, computes
  `adjustedAmount` per member (respecting the ADD/SET semantics),
  and writes `Allocation` + `Transaction` rows in one `$transaction`.
- [server/services/GlobalBurnService.ts](../../../ui/server/services/GlobalBurnService.ts)
  `fetchGlobalBurnMembers(config)` returns
  `{ status: "OK" | "INVALID_KEY" | "EVENT_NOT_FOUND" | "UNREACHABLE", emails?, detail? }`.
- [graphql/client.ts](../../../ui/graphql/client.ts) already invalidates
  `membersPage` on `bulkAllocate` and on `syncGlobalBurnMembers (dryRun=false)`.

### Files to Modify

| File | Current State | Planned Changes |
|------|---------------|-----------------|
| `ui/server/controller/index.ts` | has `bulkAllocate` | extract member-list-to-allocation-rows into an internal helper that both `bulkAllocate` and the new resolver share |
| `ui/server/graphql/schema/index.js` | has `bulkAllocate`, GB types | add `bulkAllocateToGlobalBurnMembers` + `GlobalBurnAllocationResult` |
| `ui/server/graphql/resolvers/mutations/round.ts` | has `bulkAllocate`, `syncGlobalBurnMembers` | add `bulkAllocateToGlobalBurnMembers` resolver |
| `ui/components/RoundMembers/BulkAllocateModal.tsx` | one form | factor into two tab bodies; add Burn tab behind `globalBurnVerified` |
| caller of `BulkAllocateModal` | selects round fields | add `globalBurnVerified` to the selection |
| `ui/graphql/client.ts` | has updater for `bulkAllocate` & `syncGlobalBurnMembers` | add updater for new mutation |

### Files to Create

None. Feature is additive across existing files.

## Solution Design

### Key Design Decisions

1. **One mutation with `dryRun`, mirroring `syncGlobalBurnMembers`.** Two
   calls (preview + confirm) go through the same resolver so the Burn
   HTTP fetch and the matching logic live in one place. Rationale:
   consistency with the invite flow, which admins already know.
2. **Extract a shared `allocateToMembers(roundId, memberIds, amount, type, allocatedBy)` helper** in the controller. `bulkAllocate` keeps
   its "all approved" member lookup and calls the helper with the full
   list; the new mutation looks up only matched members and calls the
   same helper. Rationale: the allocation/transaction write, the ADD/SET
   math, and the event publish are non-trivial and must stay in lockstep
   across both paths.
3. **Match by lowercased email.** Global Burn service already lowercases
   on the way in; `User.email` is stored lowercased by
   `inviteRoundMembersHelper`. No further normalization needed.
4. **No DB changes.** All facts we need (`globalBurnVerified`, the Burn
   URL/key/event, `RoundMember.user.email`) are already in the schema.

## Phase Overview

| Phase | Description | Deliverables |
|-------|-------------|--------------|
| 1 | Backend: shared helper + new mutation | `allocateToMembers` helper; `bulkAllocateToGlobalBurnMembers` mutation with dry-run + real modes |
| 2 | Frontend: tabbed modal | `BulkAllocateModal` split into two tabs; Burn tab behind `globalBurnVerified`; preview → confirm UX |
| 3 | Cache + polish | Urql updater for new mutation; error messaging via existing `connectionErrorMessage`; manual verification |

## Phase 1: Backend

**Goal**: New mutation returns correct counts in dry-run mode and writes
only to matched members in real mode. Existing `bulkAllocate` behavior
unchanged.

### Deliverables

1. `allocateToMembers` helper in
   [server/controller/index.ts](../../../ui/server/controller/index.ts)
   that takes `{ roundId, memberIds, amount, type, allocatedBy }`,
   does the aggregate queries on that subset, and writes the two tables.
2. `bulkAllocate` refactored to delegate to the helper after resolving
   the "all approved" member list.
3. `bulkAllocateToGlobalBurnMembers` resolver in `mutations/round.ts`:
   - `isCollOrGroupAdmin` auth.
   - Load round; if `!globalBurnVerified`, return
     `{ status: "UNREACHABLE", detail: "Global Burn is not configured for this round" }`.
   - Call `fetchGlobalBurnMembers(round)`.
   - Propagate any non-OK status verbatim.
   - Load approved members with `user.email`; filter to those whose email
     is in the Burn set (`Set<string>` for O(1) lookup).
   - `dryRun=true`: return counts only (`matchedMembers`,
     `totalApproved`, `totalAmount`).
   - `dryRun=false`: call `allocateToMembers(...)` with matched IDs,
     return the same counts after the write.
4. GraphQL SDL: new mutation + `GlobalBurnAllocationResult`. Reuse
   existing `AllocationType` + `GlobalBurnConnectionStatus`.

### Success Criteria

- [ ] Dry-run against a round with a verified Burn instance returns
      non-zero `matchedMembers` and `totalApproved`.
- [ ] Real run writes exactly `matchedMembers` `Allocation` rows.
- [ ] Calling against a non-verified round returns `UNREACHABLE` with
      a helpful `detail`; no writes occur.
- [ ] `bulkAllocate` still works (no regression).
- [ ] `yarn typecheck` no new errors.

## Phase 2: Frontend

**Goal**: Admin can open the modal, switch to the Burn tab (only shown
when applicable), see a live count + total, and fire allocation with
one confirm click.

### Deliverables

1. Extend the caller's `round` query to include `globalBurnVerified`
   (grep for `BulkAllocateModal` usage — likely `RoundMembers/index`
   or the MembersTable page).
2. Refactor `BulkAllocateModal`:
   - Top-level MUI `Tabs` with "All members" + "Global Burn members".
   - Hide Burn tab when `!round.globalBurnVerified`.
   - Existing form becomes `AllMembersTab`. Behavior unchanged.
   - `GlobalBurnMembersTab`:
     - Add/Set switch + amount input (same components as existing).
     - "Preview" button → fires `bulkAllocateToGlobalBurnMembers` with
       `dryRun: true`.
     - Preview panel: count summary + total in round currency.
     - "Confirm" button → fires `dryRun: false`; on success, toast and
       close modal.
     - "Back" button clears preview.
     - Errors routed through `connectionErrorMessage` (imported from
       the existing `RoundSettings/InviteMembers/GlobalBurnSection`; if
       not exported, lift it to `utils/globalBurnStatus.ts`).

### Success Criteria

- [ ] Modal renders unchanged for rounds without a verified Burn.
- [ ] Burn tab opens, "Preview" shows accurate counts.
- [ ] "Confirm" allocates; success toast; modal closes; members list
      re-renders with updated balances.
- [ ] Burn-side errors (INVALID_KEY / EVENT_NOT_FOUND / UNREACHABLE)
      show a toast with the matching localized message.

## Phase 3: Cache + Verification

**Goal**: No stale balances after allocation; no regressions in other
mutations; manual happy-path + one error-path verified in dev.

### Deliverables

1. In [ui/graphql/client.ts](../../../ui/graphql/client.ts) next to the
   existing `bulkAllocate` updater:
   ```ts
   bulkAllocateToGlobalBurnMembers(_result, args, cache) {
     if (args?.dryRun) return;
     cache.inspectFields("Query")
       .filter((f) => f.fieldName === "membersPage")
       .forEach((f) => cache.invalidate("Query", "membersPage", f.arguments));
   }
   ```
2. Manual test matrix:
   - Verified Burn, Add $10 → preview shows N, confirm writes N rows,
     balances update.
   - Verified Burn, Set $0 → preview shows correct total (sum of negative
     deltas for members currently above 0), confirm matches.
   - Burn not verified → tab not shown.
   - Burn verified but API key revoked → toast with INVALID_KEY message.

### Success Criteria

- [ ] All matrix cases pass.
- [ ] `yarn typecheck` no new errors.
- [ ] No console errors during flow.

## Testing Strategy

### Unit Tests (Vitest)

- `ui/__tests__/allocateToMembers.test.ts`: tests the controller helper
  against a seeded in-memory DB (if existing test harness supports it;
  skip if not — matches invite flow decision).

### E2E Tests (Cypress)

None. Same rationale as the Burn invite flow: external HTTP dep.

## Progress Tracking

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 1 | Complete | 2026-04-19 | 2026-04-19 | `allocateToMembers` helper + new mutation; typecheck clean |
| Phase 2 | Complete | 2026-04-19 | 2026-04-19 | tabs in BulkAllocateModal; shared `globalBurnConnectionErrorMessage` helper extracted |
| Phase 3 | Complete | 2026-04-19 | 2026-04-19 | `bulkAllocateToGlobalBurnMembers` cache updater added |
