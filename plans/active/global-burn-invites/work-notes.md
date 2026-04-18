# Global Burn Invites - Work Notes

**Feature**: "Invite members" round settings tab with a section to sync
members from a Global Burn instance via the `members-cobudget` endpoint.
**Started**: 2026-04-18
**Branch**: `borderland` (planning). Cut a dedicated branch before
Phase 1 implementation.

---

## Session Log

### 2026-04-18 — Planning session

**Context Reviewed**:
- Read [ui/server/graphql/resolvers/helpers/inviteRoundMemberHelpers.js](../../../ui/server/graphql/resolvers/helpers/inviteRoundMemberHelpers.js) —
  existing helper de-dupes against current `RoundMember`s, caps at 10k
  emails per call, accepts an `onMembersToInvite` callback. Safe to reuse
  for this feature without modification.
- Read [ui/server/graphql/resolvers/mutations/round.ts:416-484](../../../ui/server/graphql/resolvers/mutations/round.ts#L416-L484) —
  three existing invite mutations (`inviteRoundMembers`,
  `inviteRoundMembersAgain`, `inviteRoundMembersCustomEmail`) all use
  `combineResolvers(isCollOrGroupAdmin, ...)` and call the helper or
  `emailService.bulkInviteMembers` directly.
- Read [ui/server/services/EmailService/email.service.ts](../../../ui/server/services/EmailService/email.service.ts) +
  [ui/server/send-email.ts](../../../ui/server/send-email.ts) — confirmed
  Postmark batching (500/call) is already in place; sending to thousands is
  non-blocking from the mutation's perspective.
- Read [ui/components/RoundSettings/index.tsx](../../../ui/components/RoundSettings/index.tsx) —
  tabs defined in a single `defaultTabs` array; adding one is a trivial
  insert. Active tab driven by URL slug.
- Read [ui/components/RoundSettings/Integrations/SetOCToken.tsx](../../../ui/components/RoundSettings/Integrations/SetOCToken.tsx) —
  clean precedent for the "store a secret token, return only status"
  pattern. `editOCToken` mutation returns `{ ocTokenStatus, ocVerified }`
  — we mirror this shape.
- Read [ui/components/InviteMembersModal.tsx](../../../ui/components/InviteMembersModal.tsx) —
  existing bulk invite entry point from the Round Members page. We do
  NOT modify this; the new tab is an additional entry point.

**Completed**:
- [x] spec.md with acceptance criteria + open questions
- [x] development-plan.md with four-phase breakdown
- [x] work-notes.md (this file)

**Blockers/Issues**:
- Open Question Q1 (response shape): Python snippet implies a flat
  `string[]`. Confirm with Global Burn owner before Phase 2.
- Open Question Q2 (SSRF): leaning toward adding a simple hostname
  allowlist check in Phase 2, since the URL is admin-controlled and
  could in theory be pointed at internal infra.

**Next Steps**:
1. Walk the user through the plan; get approval on the four phases and
   the open questions.
2. Cut a feature branch off `borderland`.
3. Write `phases/phase-1.md` and start implementation.

---

## Key Decisions

### Decision 1: Reuse `inviteRoundMembersHelper` unchanged

**Date**: 2026-04-18
**Context**: The helper already does everything we need (de-dupe, create
users, create accounts, create RoundMembers, callback for emails). It
also enforces the 10k cap.
**Decision**: Call the existing helper from a new `syncGlobalBurnMembers`
mutation. Do not fork or generalize it.
**Rationale**: Forking means two places to fix the next bulk-invite bug.
Generalizing would expand the helper's surface area for one new caller.
Direct reuse is the cheapest and safest option.

### Decision 2: Mirror the `ocToken` pattern for the API key

**Date**: 2026-04-18
**Context**: `ocToken` is stored plain-text but exposed only as
`ocTokenStatus: TOKEN_STATUS` (`EMPTY` | `PROVIDED`). `ocVerified` tracks
whether a test call succeeded.
**Decision**: Same pattern: `globalBurnApiKey` stored plain-text,
exposed as `globalBurnApiKeyStatus`. `globalBurnVerified` tracks test
results. `editGlobalBurnSettings` uses tri-state (null/empty/string)
semantics for the apiKey argument so the UI can save URL+EventID without
resubmitting the key.
**Rationale**: Consistency with existing precedent; no new
encryption-at-rest mechanism needed; same threat model (DB dump →
secret exposure) is already accepted.

### Decision 3: Two-step sync via `dryRun` on the same mutation

**Date**: 2026-04-18
**Context**: Users need to see "how many will be invited" before firing.
**Decision**: Single `syncGlobalBurnMembers(roundId, dryRun)` mutation.
Dry run returns counts without writing. Real call returns counts after
invoking the helper.
**Rationale**: One resolver keeps the Global Burn HTTP call and the
de-dupe logic in one place. Two separate round-trips to the Burn API is
fine — these are rare, admin-triggered calls.

### Decision 4: No Cypress test in v1

**Date**: 2026-04-18
**Context**: The flow depends on an external HTTP service.
**Decision**: Unit-test `GlobalBurnService` with mocked `fetch`; skip
E2E for v1.
**Rationale**: Standing up a mock Global Burn server inside the Cypress
harness is disproportionate for a feature that's gated to admins and
whose happy path is easy to verify manually.

---

## Files Modified

### Created

- `plans/active/global-burn-invites/spec.md` — feature spec
- `plans/active/global-burn-invites/development-plan.md` — phased plan
- `plans/active/global-burn-invites/work-notes.md` — this file
- `plans/active/global-burn-invites/phases/phase-1.md` — Phase 1 detail
- `ui/server/prisma/migrations/20260418080936_global_burn_settings/migration.sql` — Prisma migration
- `ui/server/services/GlobalBurnService.ts` — HTTP client + SSRF guard + error classification
- `ui/components/RoundSettings/InviteMembers/index.tsx` — tab root
- `ui/components/RoundSettings/InviteMembers/GlobalBurnSection.tsx` — config form + test + sync UX

### Modified

- `ui/server/prisma/schema.prisma` — four fields on `Round`: `globalBurnInstanceUrl`, `globalBurnEventId`, `globalBurnApiKey`, `globalBurnVerified`
- `ui/server/graphql/schema/index.js` — added `Round` fields + `editGlobalBurnSettings` / `testGlobalBurnConnection` / `syncGlobalBurnMembers` mutations + result types + enum
- `ui/server/graphql/resolvers/types/Round.ts` — `globalBurnApiKeyStatus` resolver
- `ui/server/graphql/resolvers/mutations/round.ts` — three new mutations importing `fetchGlobalBurnMembers`
- `ui/components/RoundSettings/index.tsx` — new `invite-members` tab entry
- `ui/graphql/client.ts` — `syncGlobalBurnMembers` cache invalidation

---

### 2026-04-18 (Implementation) — Phases 1-4

**Completed**:
- [x] Prisma migration `global_burn_settings` applied cleanly on local DB
- [x] All three mutations (`editGlobalBurnSettings`, `testGlobalBurnConnection`, `syncGlobalBurnMembers`) live; confirmed via introspection
- [x] `GlobalBurnService.fetchGlobalBurnMembers` — classifies HTTP 200 / 403 / 400 / other; SSRF hostname block bypassed in dev; 10s timeout; rejects redirects and non-JSON / non-array bodies
- [x] `Round.globalBurnApiKey` never exposed through GraphQL — only `globalBurnApiKeyStatus: OC_TokenStatus` (EMPTY | PROVIDED); reused existing enum rather than creating a duplicate
- [x] `/c/some-round/settings/invite-members` compiles and returns 200
- [x] Urql cache: `syncGlobalBurnMembers` invalidates `membersPage` only when `dryRun=false`

**Blockers/Issues**: None. Pre-existing typecheck errors unchanged; zero new errors in added code.

**Decisions made during implementation**:
- Reused `OC_TokenStatus` enum for `globalBurnApiKeyStatus` (identical shape — avoids a duplicate enum in the schema; slightly weird name but consistent)
- Tri-state `apiKey` arg in `editGlobalBurnSettings` also extends to the UI: form submits `null` (not `""`) when the password field is blank, so saving URL/EventID without re-entering the key keeps the stored key intact
- Preview + send is one mutation (`syncGlobalBurnMembers` with `dryRun`), not two — keeps the Global Burn HTTP call and the de-dupe logic in one resolver
- Errors surfaced to the admin via `toast.error` with a `connectionErrorMessage` helper that maps the four `GlobalBurnConnectionStatus` values to localized text
