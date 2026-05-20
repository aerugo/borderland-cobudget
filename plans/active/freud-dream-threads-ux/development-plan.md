# Dream-scoped Private Thread Tab - Development Plan

**Status**: Draft
**Created**: 2026-04-10
**Branch**: `freud` (continuing on the existing FREUD branch)
**Spec**: [spec.md](spec.md)

## Summary

Promote FREUD private conversations from an auxiliary blue panel above the dream page tabs to a first-class, clearly-labelled "Dream Team" tab inside the dream page tab bar. The channel is **symmetrical**: both cocreators and the Dream Team can start topics, read topics, and reply — from the same place. Admin/mod hub behaviour is unchanged. The `createConversation` backend mutation is relaxed to allow cocreators to start topics on their own dreams.

## Current State Analysis

### What exists

- **Data**: `Conversation` ⇄ `Bucket` many-to-many via `_ConversationBuckets` (see [freud migration](../../../ui/server/prisma/migrations/20260409225552_freud_features/migration.sql)).
- **Backend**:
  - [`bucketConversations(bucketId)`](../../../ui/server/graphql/resolvers/queries/freud.ts) query already implements the correct read scoping (admin/mod OR cocreator of the bucket OR super admin session). This is where we will extract the helper.
  - `createConversation` currently gates on `assertAdminOrMod(roundId, user.id, ss)` — **must be relaxed** in this plan.
  - `addConversationMessage` already permits cocreators in existing topics (so replying already works; only topic creation needs unlocking).
  - `createConversation` already sends notification emails to "cocreators of linked dreams + other admins/mods of the round, minus the sender", which is the correct behaviour for both cocreator-initiated and admin-initiated topics with no further changes.
- **Frontend**:
  - [`ConversationList`](../../../ui/components/Freud/Conversations/ConversationList.tsx) + inline new-topic form — lives in the admin hub, round-scoped.
  - [`ConversationThread`](../../../ui/components/Freud/Conversations/ConversationThread.tsx) — hub thread, hard-codes a "← Back to Conversations" link pointing at the hub.
  - [`BucketConversationIndicator`](../../../ui/components/Freud/BucketConversationIndicator.tsx) — the blue panel above the tabs on the dream page, rendered from [ui/pages/[group]/[round]/[bucket]/index.tsx](../../../ui/pages/[group]/[round]/[bucket]/index.tsx).
  - The dream page uses `@headlessui/react` `Tab.Group` with `tabsList = ["bucket", "comments", "funders", "expenses"]` and a `?tab=` query-param sync pattern we will extend.

### What's missing

- No way for a co-creator to read or reply to a thread inline with the dream.
- **No way for a co-creator to start a topic at all** — the mutation is admin/mod-only.
- No viewer-scoped per-bucket conversation **count** field, so the dream page query can't cheaply decide what to show in the tab badge without a secondary round-trip.
- No single field that says "is the viewer a participant of this dream's private channel", needed for tab visibility.
- `ConversationThread` is not parameterizable for back navigation or private-channel styling.

### Files to Modify

| File | Current State | Planned Changes |
|------|---------------|-----------------|
| [ui/server/graphql/schema/index.js](../../../ui/server/graphql/schema/index.js) | Bucket type SDL | Add 4 new Bucket fields: `privateConversations`, `noOfPrivateConversations`, `canAccessPrivateConversations`, `canStartPrivateConversation` |
| [ui/server/graphql/resolvers/queries/freud.ts](../../../ui/server/graphql/resolvers/queries/freud.ts) | Has `bucketConversations` | Extract scoping to `getViewerScopedBucketConversations(bucketId, ctx)` helper used by both the existing query and the new type resolver |
| [ui/server/graphql/resolvers/mutations/freud.ts](../../../ui/server/graphql/resolvers/mutations/freud.ts) | `createConversation` gates on `assertAdminOrMod` | Relax to allow cocreators of all listed buckets; keep admin/mod and super admin paths; extract gate into `assertCanCreateConversation(roundId, bucketIds, ctx)` helper |
| `ui/server/graphql/resolvers/types/Bucket.ts` (or wherever Bucket type resolvers live) | Existing Bucket type resolver | Add field resolvers for the 4 new fields |
| [ui/pages/[group]/[round]/[bucket]/index.tsx](../../../ui/pages/[group]/[round]/[bucket]/index.tsx) | Renders `BucketConversationIndicator` above tabs; 4 tabs | Remove indicator; fetch new fields; conditionally add "dreamteam" tab driven by `canAccessPrivateConversations` |
| [ui/components/Freud/Conversations/ConversationThread.tsx](../../../ui/components/Freud/Conversations/ConversationThread.tsx) | Hard-coded back link; single styling | Accept optional `backHref`/`onBack`/`backLabel`/`privateChannel` props |
| [ui/graphql/client.ts](../../../ui/graphql/client.ts) | Cache invalidation for existing FREUD mutations | Also invalidate new `Bucket.privateConversations` / `noOfPrivateConversations` on `createConversation` and `addConversationMessage` |

### Files to Create

| File | Purpose |
|------|---------|
| `ui/components/Bucket/PrivateThreadsTab/index.tsx` | Tab panel container; switches between list & thread view via `?thread=` query param; renders the private-channel header banner |
| `ui/components/Bucket/PrivateThreadsTab/TopicList.tsx` | Dream-scoped topic list rows + "New topic" trigger (admin/mod) |
| `ui/components/Bucket/PrivateThreadsTab/NewTopicForm.tsx` | Inline form with `bucketId` pre-selected; adapted from the form inside `ConversationList` |

### Files to Delete

| File | Reason |
|------|--------|
| [ui/components/Freud/BucketConversationIndicator.tsx](../../../ui/components/Freud/BucketConversationIndicator.tsx) | Replaced by the new tab; no other call sites |

## Solution Design

### Key Design Decisions

1. **Symmetrical channel** — both cocreators and the Dream Team can start topics on this dream. This means the tab is a real two-way communication channel (like a DM), not just a notification outbox. It also gives cocreators their first formal way to reach the Dream Team from within Cobudget. The `createConversation` mutation is relaxed to allow cocreator-of-bucket authorization.

2. **Scope via per-bucket fields, not a round query**. Adding `Bucket.privateConversations` (and its siblings) lets us piggyback on the existing bucket query, avoids a second network round-trip, and keeps authorization naturally per-bucket. A co-creator of dream A cannot accidentally see dream B's scoped list because the field is resolved per-bucket.

3. **Single source of truth for scoping**. Extract `getViewerScopedBucketConversations` as a helper so the existing `bucketConversations` query and the new type resolver share one implementation. Any future policy change (e.g. "observers can read but not reply") lands in one place. Symmetrically, extract `assertCanCreateConversation(roundId, bucketIds, ctx)` as the single gate the `createConversation` mutation uses — with the same policy as the `canStartPrivateConversation` field resolver.

4. **Two separate role fields on Bucket**: `canAccessPrivateConversations` (drives tab visibility) and `canStartPrivateConversation` (drives "+ New topic" button visibility). In this release they evaluate identically ("viewer is a participant"), but keeping them separate now costs nothing and lets us restrict topic-starting in the future (e.g. freeze topic creation during a round close-out) without breaking read access.

5. **Tab visibility driven by `canAccessPrivateConversations` alone**, not by topic count. The tab is always visible to participants (cocreators of this dream + admins/mods + super admin), with an empty state when there are no topics. This makes the feature discoverable — cocreators know they can reach the Dream Team, admins can start topics from the dream itself.

6. **Reuse `ConversationThread` verbatim for the message body**. Parameterize only what must differ (back navigation + private-channel styling). A fork would double maintenance cost on the feature that is most likely to evolve (mentions, attachments, read receipts).

7. **Query-param routing inside the tab** (`?tab=dreamteam&thread=<id>`). This keeps the page static (no new Next.js route), lets users deep-link to a thread from email, and works with the existing tab-sync effect in the bucket page. Clearing `thread` returns to the list. "Back" from a thread always returns to the **current dream's** tab list, never the admin hub — even for multi-dream topics (see decision #10).

8. **Cocreator-authored topics may span multiple dreams the cocreator owns**. If a single user cocreates dreams A and B, they can start a topic linked to both. They cannot drag in dreams they don't cocreate. This is enforced server-side in `assertCanCreateConversation`: every bucket in `bucketIds` must be one the caller is a cocreator of (or the caller is admin/mod/super admin). In Phase 3, the UI starts simple: cocreators only see the current dream pre-selected and locked. A follow-up can expose a "link more of my dreams" picker if demand emerges.

9. **Delete `BucketConversationIndicator` rather than keep both surfaces**. Two entry points to the same feature would be confusing and the indicator's "floating panel above tabs" placement breaks the visual grammar of the page.

10. **"Back" always returns to the current dream's tab list, never the admin hub**. When an admin opens a multi-dream topic from dream A's tab and clicks back, they land on dream A's Dream Team tab list — not on `/freud/conversations`. Rationale: the user's mental model when they entered the thread was "I'm on dream A reading its messages". Context-switching them to the round-wide admin hub would be surprising. Implementation is trivial — "back" just clears the `?thread=` query param on the current URL; it never computes a destination outside the current page. The admin hub remains reachable via the round's FREUD submenu for round-wide overviews.

### Empty state copy

- **Cocreator, zero topics**: "No conversations yet. Start one to reach the Dream Team privately about this dream."
- **Admin/mod, zero topics**: "No conversations yet. Start one to reach this dream's cocreators privately."

## Phase Overview

| Phase | Description | Deliverables |
|-------|-------------|--------------|
| 1 | Backend: relax `createConversation`, extract scoping + creation gates, add 4 Bucket fields, wire type resolvers, extend cache | Backend supports cocreator-initiated topics; bucket query returns new fields; existing hub unaffected |
| 2 | Frontend: tab integration and component extraction | New tab renders list + thread inline for all participants; `BucketConversationIndicator` removed |
| 3 | Frontend: new-topic creation from the dream tab (both roles) | Admins and cocreators can both create a dream-scoped topic without leaving the dream page; cocreator form has the dream pre-selected and locked |
| 4 | Polish: private-channel affordances, empty states (cocreator vs admin copy), routing, cache refresh UX | Visual lock/banner treatment; `?thread=` deep-linking; tab badge updates on send |

## Phase 1: Backend — Viewer-scoped Bucket Fields + Relaxed Create

**Goal**: Add 4 new Bucket fields the dream page can consume in one round-trip, backed by a shared scoping helper, and relax `createConversation` so cocreators can start topics on their own dreams.
**Detailed plan**: [phases/phase-1.md](phases/phase-1.md)

### Deliverables

1. Two shared helpers (in `ui/server/graphql/resolvers/queries/freud.ts` or a sibling `helpers/freud.ts`):
   - `getViewerScopedBucketConversations(bucketId, ctx)` — returns scoped conversation list for read access.
   - `assertCanCreateConversation(roundId, bucketIds, ctx)` — throws if the viewer may not create. Policy: super admin session OR round admin/mod OR cocreator of **every** bucket in `bucketIds`. Also validates `bucketIds` is non-empty and all buckets belong to `roundId`.
2. Existing `bucketConversations` query refactored to call `getViewerScopedBucketConversations` (no behaviour change).
3. `createConversation` mutation refactored to call `assertCanCreateConversation` instead of `assertAdminOrMod`. The notification email path is unchanged.
4. Four new Bucket fields in the SDL:
   - `privateConversations: [Conversation!]!`
   - `noOfPrivateConversations: Int!`
   - `canAccessPrivateConversations: Boolean!`
   - `canStartPrivateConversation: Boolean!`
5. Type resolver entries for the 4 new fields, colocated with the existing Bucket type resolver. `canAccessPrivateConversations` and `canStartPrivateConversation` share a single inline helper that evaluates "viewer is participant of this bucket" — see decision #4.
6. Manual GraphiQL verification of read fields for all 4 viewer classes below.
7. Manual GraphiQL verification of `createConversation` for:
   - Admin/mod creating a multi-dream topic → succeeds.
   - Cocreator of dream X creating a topic on dream X → succeeds.
   - Cocreator of dream X trying to create a topic linking dreams X and Y (not their dream) → fails with clear error.
   - Cocreator of dream X trying to create a topic on dream Y only → fails.
   - Non-cocreator signed-in user trying to create → fails.
   - Signed-out → fails.

### Viewer classes for read-field testing

| Viewer | Expected `privateConversations` | Expected `canAccessPrivateConversations` | Expected `canStartPrivateConversation` |
|---|---|---|---|
| Round admin | Full scoped list | `true` | `true` |
| Round moderator | Full scoped list | `true` | `true` |
| Cocreator of this bucket | Full scoped list | `true` | `true` |
| Other round member | `[]` | `false` | `false` |
| Signed-out | `[]` | `false` | `false` |

### Implementation Approach

1. Extract `getViewerScopedBucketConversations` from the existing `bucketConversations` query body.
2. Create `assertCanCreateConversation` alongside it. Reuse the round-member lookup pattern used elsewhere (`prisma.roundMember.findUnique({ where: { userId_roundId } })` plus `isAdmin || isModerator`). For the cocreator check, query `prisma.bucket.findMany({ where: { id: { in: bucketIds } }, include: { cocreators: true } })` in one round-trip, verify every bucket's `cocreators` includes the caller's `roundMember.id`.
3. Refactor `createConversation` to call the new gate. Remove its `assertAdminOrMod` call. Keep the rest of the mutation body (data write + notification emails) unchanged.
4. Find the existing Bucket type resolver file and add the 4 field resolvers, in terms of the helper where applicable.
5. Update `ui/server/graphql/schema/index.js` SDL.
6. Update [`ui/graphql/client.ts`](../../../ui/graphql/client.ts) cache config: on `createConversation` and `addConversationMessage`, invalidate `Bucket.privateConversations` and `Bucket.noOfPrivateConversations` for every bucket in the mutation result (walk the returned `conversation.buckets` list).

### Success Criteria

- [ ] `yarn typecheck` passes.
- [ ] Existing `bucketConversations` query returns the same shape as before (spot-check from the admin hub).
- [ ] Admin hub `createConversation` still works.
- [ ] Cocreator `createConversation` on their own dream succeeds; cocreator attempt to link other dreams fails with clear error.
- [ ] New read fields return correct scoped values for each of the five viewer classes above.
- [ ] `yarn test:run` passes (no existing tests should regress).

## Phase 2: Frontend — Tab Integration

**Goal**: The dream page has a new "Dream Team" tab that renders the list of topics linked to this dream and can open a thread inline.
**Detailed plan**: [phases/phase-2.md](phases/phase-2.md)

### Deliverables

1. `BUCKET_QUERY` in [ui/pages/[group]/[round]/[bucket]/index.tsx](../../../ui/pages/[group]/[round]/[bucket]/index.tsx) includes `noOfPrivateConversations`, `canAccessPrivateConversations`, `canStartPrivateConversation`.
2. `BucketConversationIndicator` render removed and file deleted.
3. `tabsList` extended with `"dreamteam"` when `canAccessPrivateConversations` is true.
4. New `<Tab>` + `<Tab.Panel>` wired up conditionally. Tab label: "Dream Team" + lock icon + `(N)` suffix when `noOfPrivateConversations > 0`.
5. New `ui/components/Bucket/PrivateThreadsTab/index.tsx` that:
   - Reads `?thread=<id>` from the router.
   - When no `thread`, renders `TopicList`.
   - When `thread` is set, renders `ConversationThread` with an `onBack` handler that clears **only** the `thread` query param (preserving `tab=dreamteam` and every other query param) via `router.push({ pathname, query: { ...router.query, thread: undefined } }, undefined, { scroll: false })`. This keeps the user on the current dream's tab list, regardless of whether the topic also spans other dreams.
   - Renders a top-of-panel banner: lock icon + "Private channel — visible only to this dream's cocreators and the Dream Team."
6. New `ui/components/Bucket/PrivateThreadsTab/TopicList.tsx` that queries the bucket's `privateConversations` (through a tightly-scoped GraphQL query that takes `bucketId`, or extends `BUCKET_QUERY` — see phase plan for trade-off) and renders one row per topic. Clicking a row sets `?thread=<id>`. Empty list renders the empty state (see Phase 4) — but the "+ New topic" button is wired in Phase 3.
7. `ConversationThread` accepts new optional props `backHref`, `onBack`, `backLabel`, `privateChannel` without breaking its current call site in `pages/[group]/[round]/freud/conversations/[id].tsx`.

### Implementation Approach

1. Add the query fields and use `showDreamTeamTab = !!bucket?.canAccessPrivateConversations` in the page component.
2. Extend `tabsList` conditionally (`useMemo` with `showDreamTeamTab` in deps). Ensure the `?tab=` sync effect handles the new value correctly (existing `findIndex` logic naturally works).
3. Build `PrivateThreadsTab` and `TopicList` as thin, functional components. `TopicList` executes a dedicated GraphQL query for `privateConversations` via `bucket(id)` so data stays fresh on re-render without re-fetching the entire bucket.
4. Extend `ConversationThread` props with the 4 optional fields. Replace the hard-coded back link with `backHref ?? defaultHubHref`. Wrap the header in an optional "private channel" class when `privateChannel === true`.
5. Delete `ui/components/Freud/BucketConversationIndicator.tsx` and remove its import + render block from the bucket page.

### Success Criteria

- [ ] Cocreator of a dream sees the tab regardless of topic count and can open/read/reply to existing topics.
- [ ] Admin/mod of the round sees the tab on every dream.
- [ ] Non-cocreator signed-in user does **not** see the tab.
- [ ] Signed-out visitor does **not** see the tab.
- [ ] `?tab=dreamteam&thread=<id>` deep-links to a thread inside the dream page.
- [ ] The admin hub route `/freud/conversations/<id>` continues to work and renders its "← Back to Conversations" link.
- [ ] `yarn typecheck` passes.

## Phase 3: Frontend — New Topic From Dream Context (both roles)

**Goal**: Both cocreators and admins/mods can create a new private topic from directly within a dream's tab, with the current dream pre-selected.
**Detailed plan**: [phases/phase-3.md](phases/phase-3.md)

### Deliverables

1. `ui/components/Bucket/PrivateThreadsTab/NewTopicForm.tsx` — inline form with:
   - Title input.
   - Initial message textarea (plain text; reuse the same plain-text compose box the hub uses for now — rich text is out of scope).
   - Pre-selected current dream.
   - **Admin/mod variant**: dream picker fully editable — the current dream is pre-selected but can be deselected, and other dreams in the round can be added. Reuses the dream-picker sub-tree from [`ConversationList`](../../../ui/components/Freud/Conversations/ConversationList.tsx).
   - **Cocreator variant**: current dream locked (read-only chip, not editable). No "add more dreams" disclosure. Keeps the UX simple for the first release; multi-own-dream topics can be added later if demand emerges. See decision #8 in Solution Design.
2. `TopicList` shows a "+ New topic" button when `canStartPrivateConversation` is true (which is true for both admins/mods and cocreators of this dream); clicking toggles the form.
3. On successful create, form closes, the newly created topic is opened in-place (`?thread=<id>` is set), and the tab badge increments via cache invalidation.
4. The form's role variant is selected by a `canEditBucketSelection` prop, which the tab passes based on whether the viewer is admin/mod. The viewer's role is inferred from `currentUser.currentCollMember.isAdmin || isModerator` (already available in the bucket page) — not from the new `canStartPrivateConversation` flag alone, because that flag is symmetric.

### Implementation Approach

1. Copy the form + dream-picker sub-tree from `ConversationList` into `NewTopicForm`, stripping the round-level list responsibilities. Minimize duplication by keeping the shape of `createConversation` mutation call identical.
2. Pre-populate `selectedBucketIds` with `new Set([bucket.id])`.
3. For cocreators: render the dream as a read-only chip instead of the picker; do not render the "add more dreams" disclosure.
4. On successful mutation, push router query `{ tab: "dreamteam", thread: newConvId }`.
5. Rely on cache invalidation rules added in Phase 1 so that `noOfPrivateConversations` and the `TopicList` query both refresh automatically.

### Success Criteria

- [ ] Admin/mod sees "+ New topic" inside `TopicList` and the form's dream picker is editable (can add/remove dreams).
- [ ] Cocreator of this dream sees "+ New topic" and the form's dream is pre-selected and locked.
- [ ] Non-participant never sees the tab at all (covered in Phase 2).
- [ ] Submitting the form creates a topic linked to the current dream and opens its thread inline — for both roles.
- [ ] Tab badge updates without reload for both roles.
- [ ] `yarn typecheck` passes.

## Phase 4: Polish — Private Channel Affordances

**Goal**: The tab feels unmistakably like a private channel, not like the public Comments tab, and all empty / edge states are handled.
**Detailed plan**: [phases/phase-4.md](phases/phase-4.md)

### Deliverables

1. **Tab label and icon**: "Dream Team" with a lock icon from `@mui/icons-material` (we already use MUI icons elsewhere). Append `(N)` suffix when `noOfPrivateConversations > 0`.
2. **Panel header banner**: muted background, lock icon, copy: "Private channel — visible only to this dream's cocreators and the Dream Team. Public comments are in the **Comments** tab." (with the "Comments" word linking to the Comments tab via `?tab=comments`).
3. **Thread private styling**: subtle background tint on the thread container, lock icon in the thread title header, "Private" chip next to the title.
4. **Empty state — admin/mod**: Centered icon + "No conversations yet. Start one to reach this dream's cocreators privately." + the "+ New topic" button.
5. **Empty state — cocreator**: Same layout, copy: "No conversations yet. Start one to reach the Dream Team privately about this dream." + the "+ New topic" button. Empty state copy is selected based on `currentUser.currentCollMember.isAdmin || isModerator`.
6. **Loading skeletons**: Use `CardListSkeleton` from [`Freud/LoadingSkeleton`](../../../ui/components/Freud/LoadingSkeleton.tsx) for the topic list while fetching, matching the hub.
7. **Routing robustness**: Hitting `?tab=dreamteam` when the tab is hidden silently falls back to the default `bucket` tab (don't throw, don't flash the tab). Hitting `?tab=dreamteam&thread=<id>` when the viewer does not have access shows the same "Conversation not found or you don't have access" state that `ConversationThread` already renders.
8. **Cache UX**: Verify that after sending a message, the topic list row's "last message" preview updates without reload. If not, add a targeted `reexecuteQuery` inside the thread's send handler (pattern already used in `ReviewNotesPopover`).

### Implementation Approach

1. Style pass across `PrivateThreadsTab/index.tsx`, `TopicList.tsx`, and `ConversationThread.tsx` (under the `privateChannel` flag).
2. Add the lock icon import and tab-count rendering in the bucket page's existing Tab header — following the same `({ selected }) =>` className pattern as the other tabs.
3. Add a guard in the bucket page effect that normalizes `?tab=dreamteam` → `bucket` when the tab isn't visible.
4. Test the 4 viewer classes × (zero topics, 1 topic, 2+ topics) matrix manually.

### Success Criteria

- [ ] Spec AC1-AC12 all pass via manual test.
- [ ] The tab and panel are visually distinct from Comments (clear private-channel signalling).
- [ ] All empty states render cleanly without layout shifts.
- [ ] `yarn typecheck` passes.
- [ ] No regressions in the admin FREUD hub at `/freud/conversations`.

## Testing Strategy

### Unit Tests (Vitest)

- `ui/__tests__/freud-bucket-private-conversations.test.ts` — tests the `getViewerScopedBucketConversations` helper across the four viewer classes (admin, mod, cocreator, outsider, signed-out). Mock Prisma and round membership lookups.

### E2E Tests (Cypress) — optional, deferred

- `cypress/e2e/bucket-private-threads.cy.js` — if time permits, assert the tab visibility and happy-path send flow. Listed as deferred to keep scope tight; the existing FREUD e2e coverage gap is already tracked in [plans/active/freud/phases/phase-7.md](../freud/phases/phase-7.md).

### Manual Test Matrix

| Viewer | Topics linked to dream | Tab visible? | List contents | Can create? | Dream picker in create form |
|--------|------------------------|:-:|---|:-:|---|
| Admin | 0 | ✓ | Empty state (admin copy) | ✓ | Editable |
| Admin | 2 | ✓ | 2 rows | ✓ | Editable |
| Mod | 1 | ✓ | 1 row | ✓ | Editable |
| Cocreator | 0 | ✓ | Empty state (cocreator copy) | ✓ | Locked to this dream |
| Cocreator | 1 | ✓ | 1 row | ✓ | Locked to this dream |
| Non-cocreator signed-in user | any | ✗ | — | — | — |
| Signed-out visitor | any | ✗ | — | — | — |

### Backend Mutation Test Matrix

| Caller | `bucketIds` | Expected |
|---|---|---|
| Admin/mod | any set of buckets in the round | Success |
| Super admin session | any set | Success |
| Cocreator of A only | `[A]` | Success |
| Cocreator of A only | `[A, B]` where B is not theirs | Reject: "You are not authorized to link bucket <B>" |
| Cocreator of A and B | `[A, B]` | Success |
| Non-cocreator signed-in | `[A]` | Reject: "You are not a participant of any listed dream" |
| Signed-out | any | Reject: "You need to be logged in" |
| Any authorized caller | `[]` | Reject: "At least one dream must be linked" |
| Any authorized caller | `[X]` where X is not in this round | Reject: "All dreams must belong to the same round" |

## Progress Tracking

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 1 | Pending | | | Backend fields |
| Phase 2 | Pending | | | Tab integration |
| Phase 3 | Pending | | | New-topic form |
| Phase 4 | Pending | | | Polish |

## Risks & Mitigations

- **Risk**: The existing FREUD feature branch already touches the bucket page (to render `BucketConversationIndicator`). Merging in this plan means both changes are in flight together; if FREUD is still being iterated, conflicts are likely. **Mitigation**: Land this plan as the final UX polish inside the FREUD branch, after Phase 7 completes or as part of it. Do not branch separately.
- **Risk**: Adding fields to the Bucket type affects the cached bucket query for every dream page; if the field is computed inefficiently it could regress dream page load times. **Mitigation**: `noOfPrivateConversations` should be a cheap `count` query with the same `where` filter as `privateConversations`, or — even cheaper — compute it from the in-memory `privateConversations` array if we fetch the list anyway. Phase 1 plan makes this explicit.
- **Risk**: Co-creators may find the lock/banner patronizing or confusing. **Mitigation**: Keep copy short and single-sentence. Open question Q1 captured in spec.
- **Risk**: Deep-linking to `?thread=<id>` could leak topic existence to users who have no access. **Mitigation**: Thread resolver already returns `null` for viewers without access; UI shows the existing "Conversation not found or you don't have access" message. No new leak surface.
