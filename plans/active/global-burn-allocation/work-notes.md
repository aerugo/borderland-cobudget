# Global Burn Allocation — Work Notes

**Feature**: New tab in "Manage all members balance" modal that allocates
funds only to approved members who are on the connected Global Burn
event's member list.
**Started**: 2026-04-19
**Branch**: `borderland` (planning). Cut a feature branch before Phase 1.

---

## Session Log

### 2026-04-19 — Planning session

**Context Reviewed**:
- [components/RoundMembers/BulkAllocateModal.tsx](../../../ui/components/RoundMembers/BulkAllocateModal.tsx) —
  single-form modal; one mutation `bulkAllocate(roundId, amount, type)`.
- [server/controller/index.ts:93-169](../../../ui/server/controller/index.ts#L93-L169) —
  `bulkAllocate` loads all `isApproved: true` members, aggregates their
  allocations/contributions, computes ADD/SET deltas, writes
  `Allocation` + `Transaction` rows in a `$transaction`, publishes
  `bulk-allocate` event. This is the logic we need to share.
- [server/services/GlobalBurnService.ts](../../../ui/server/services/GlobalBurnService.ts) —
  already lowercases emails, already SSRF-guarded, already verified in
  the invite flow. Reuse unchanged.
- [graphql/client.ts:128-135](../../../ui/graphql/client.ts#L128-L135) —
  `bulkAllocate` invalidates `membersPage`. We'll mirror this pattern.

**Completed**:
- [x] spec.md
- [x] development-plan.md with three phases
- [x] work-notes.md (this file)

**Blockers/Issues**: None. Q1 resolved 2026-04-19 — only matched members
are touched on both ADD and SET.

**Next Steps**:
1. Cut a feature branch off `borderland`.
2. Write `phases/phase-1.md` and start on the shared
   `allocateToMembers` helper.

---

## Key Decisions

### Decision 1: Share an `allocateToMembers(memberIds, ...)` helper

**Date**: 2026-04-19
**Context**: The allocation math (ADD caps the delta so balance can't go
negative; SET computes delta from current balance) and the two-table
write need to stay in lockstep between the all-members path and the
Burn-only path.
**Decision**: Extract the logic after the `findMany` in `bulkAllocate`
into a helper that takes a pre-fetched list (or set of IDs) and does the
aggregate queries + writes. `bulkAllocate` becomes a thin wrapper;
`bulkAllocateToGlobalBurnMembers` uses the helper with a filtered ID
list.
**Rationale**: Forking the logic risks drift (e.g. a future change to
how balances are computed). Keeping one call site also keeps the
`bulk-allocate` event emission in one place.

### Decision 2: One mutation with `dryRun`, mirroring `syncGlobalBurnMembers`

**Date**: 2026-04-19
**Context**: Admins need "how many would get funds and how much total"
before firing.
**Decision**: Single `bulkAllocateToGlobalBurnMembers(dryRun)` resolver.
Dry-run returns counts; real run returns counts after writing.
**Rationale**: Same-shaped flow as the invite feature, so the UI pattern
(Preview/Confirm) is reusable and admins see a consistent experience.

### Decision 3: No DB changes

**Date**: 2026-04-19
**Context**: All the facts we need already exist.
**Decision**: No migration, no schema changes.
**Rationale**: Faster ship; no risk of env-drift like the last round
(migration applied to `cb`, dev pointed at `borderland_dreams_prod`).

---

## Files Modified

*To be filled in as implementation proceeds.*

### Created

- `plans/active/global-burn-allocation/spec.md`
- `plans/active/global-burn-allocation/development-plan.md`
- `plans/active/global-burn-allocation/work-notes.md`

### Modified

- `ui/server/controller/index.ts` — extracted `allocateToMembers(memberIds, amount, type, allocatedBy, dryRun)` helper, rewrote `bulkAllocate` to delegate
- `ui/server/graphql/schema/index.js` — `bulkAllocateToGlobalBurnMembers` mutation + `GlobalBurnAllocationResult` type
- `ui/server/graphql/resolvers/mutations/round.ts` — new resolver, matches on lowercased email, flips `globalBurnVerified` to false on fetch failure (mirrors `syncGlobalBurnMembers`)
- `ui/components/RoundMembers/BulkAllocateModal.tsx` — split into `AllMembersForm` and `GlobalBurnForm`, MUI `Tabs` shown only when `round.globalBurnVerified`
- `ui/components/RoundSettings/InviteMembers/GlobalBurnSection.tsx` — use shared `globalBurnConnectionErrorMessage`
- `ui/pages/_app.tsx` — added `globalBurnVerified` to `TOP_LEVEL_QUERY` so the modal receives it
- `ui/graphql/client.ts` — `bulkAllocateToGlobalBurnMembers` cache updater (invalidates `membersPage` only on `dryRun=false`)

### Created

- `ui/utils/globalBurnStatus.ts` — shared `globalBurnConnectionErrorMessage` helper (lifted from GlobalBurnSection)

---

### 2026-04-19 (Implementation) — Phases 1-3

**Completed**:
- [x] `allocateToMembers` extracted; `bulkAllocate` delegates to it with a `dryRun: false` call. Math and event publish unchanged.
- [x] `bulkAllocateToGlobalBurnMembers` resolver: guards `!globalBurnVerified`, propagates non-OK Global Burn status with `globalBurnVerified` flipped to false, otherwise runs the match + allocation.
- [x] `BulkAllocateModal` split into two tab bodies; Burn tab only rendered when `round.globalBurnVerified`. Preview → Confirm UX mirrors the invite flow. Error messaging via the shared helper.
- [x] Typecheck: zero new errors in changed files (pre-existing errors in Wysiwyg, react-hook-form consumers, stripe, etc. unchanged).

**Blockers/Issues**: None.

**Decisions made during implementation**:
- Kept `dryRun` as a param on the shared `allocateToMembers` helper rather than forking into a "preview" variant — one code path for the math, so `bulkAllocate` and the new mutation can never drift on ADD/SET semantics.
- Lifted `connectionErrorMessage` from `GlobalBurnSection` into `utils/globalBurnStatus.ts` (`globalBurnConnectionErrorMessage`) so both the settings page and the modal use one copy.
- Added `globalBurnVerified` to `TOP_LEVEL_QUERY` rather than to a narrower query near `MembersTable` — the round prop is already threaded through from `_app.tsx` and adding a local query would mean a second round fetch.
