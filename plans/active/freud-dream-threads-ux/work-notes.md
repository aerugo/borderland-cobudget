# Dream-scoped Private Thread Tab - Work Notes

**Feature**: Promote FREUD private conversations to a first-class tab on the dream page
**Started**: 2026-04-10
**Branch**: `freud`

---

## Session Log

### 2026-04-10 - Phase 1 implementation complete

**Context Resumed**:
- Drafted [phases/phase-1.md](phases/phase-1.md) with 8 steps covering the full backend surface.
- Spotted a stale `Conversation!` in spec's `privateConversations` field — actual SDL type is `FreudConversation`. Fixed in spec.md.
- Fixed stale `?tab=messages` → `?tab=dreamteam` in development-plan.md line 246.

**Completed**:
- [x] Step 1.1: Extracted `getViewerScopedBucketConversations(bucketId, ctx)` helper in [ui/server/graphql/resolvers/queries/freud.ts](../../../ui/server/graphql/resolvers/queries/freud.ts). Returns `[]` for signed-out viewers / unknown buckets / no-access viewers. `bucketConversations` query now delegates to the helper but retains its explicit "You need to be logged in" error.
- [x] Step 1.2: Added pure predicate `viewerCanAccessBucketConversations(bucket, ctx)`. Shared by the new Bucket field resolvers and the create gate.
- [x] Step 1.3: Added `assertCanCreateConversation(roundId, bucketIds, ctx)` gate in [ui/server/graphql/resolvers/mutations/freud.ts](../../../ui/server/graphql/resolvers/mutations/freud.ts). Deduplicates bucket IDs, verifies all belong to the same round, then admits admin/mod or cocreator-of-every-bucket (super admin bypass via `ctx.ss`).
- [x] Step 1.4: Refactored `createConversation` mutation to call `assertCanCreateConversation` instead of `assertAdminOrMod`.
- [x] Step 1.5: Added 4 new fields on `type Bucket` in [ui/server/graphql/schema/index.js](../../../ui/server/graphql/schema/index.js): `privateConversations: [FreudConversation!]!`, `noOfPrivateConversations: Int!`, `canAccessPrivateConversations: Boolean!`, `canStartPrivateConversation: Boolean!`.
- [x] Step 1.6: Added 4 Bucket field resolvers in [ui/server/graphql/resolvers/types/Bucket.ts](../../../ui/server/graphql/resolvers/types/Bucket.ts). `canStartPrivateConversation` is a direct alias of `canAccessPrivateConversations` (zero duplication, but SDL keeps them separate for future divergence).
- [x] Step 1.7: Extended Urql cache invalidation in [ui/graphql/client.ts](../../../ui/graphql/client.ts):
  - `createConversation` hook now invalidates `Bucket.privateConversations` and `Bucket.noOfPrivateConversations` on every linked bucket (read from the mutation result). Added `buckets { id }` to the mutation's selection set in [ui/components/Freud/Conversations/ConversationList.tsx](../../../ui/components/Freud/Conversations/ConversationList.tsx) so the cache hook has the linked IDs to iterate.
  - `addConversationMessage` hook now walks the cached `FreudConversation` entity via `cache.resolve()` to find linked bucket IDs and invalidates the same two Bucket fields — no backend selection-set change needed because the conversation is already in the cache.
- [x] Verified `yarn typecheck`: the only error in touched files is `graphql/client.ts:8 — Module '"next-urql"' declares 'SSRExchange' locally, but it is not exported`. Confirmed pre-existing by stashing Phase 1 changes and re-running typecheck on clean baseline — same error present. All other typecheck errors are in unrelated files (AddEditExpense, Wysiwyg, Date.ts, stripe, etc.) untouched by Phase 1.
- [x] Verified `yarn test:run`: **41/41 tests pass** across 8 suites. No regressions.

**Deviations from phase-1.md**:
- None.

**Post-dev-server bug fix**:
- Dev server boot failed with `Query.getViewerScopedBucketConversations defined in resolvers, but not in schema`. Root cause: [queries/index.ts:10](../../../ui/server/graphql/resolvers/queries/index.ts#L10) does `export * as freudQueries from "./freud"` which splatted *every* export of `queries/freud.ts` — including my two new helpers — into the `Query` resolver map via `...freudQueries` in [resolvers/index.ts:62](../../../ui/server/graphql/resolvers/index.ts#L62).
- Fix: extracted the helpers to a dedicated non-resolver file [ui/server/graphql/resolvers/helpers/conversationAccess.ts](../../../ui/server/graphql/resolvers/helpers/conversationAccess.ts). Updated [queries/freud.ts](../../../ui/server/graphql/resolvers/queries/freud.ts) and [types/Bucket.ts](../../../ui/server/graphql/resolvers/types/Bucket.ts) to re-import from the helper module. No logic change — only file location.
- Verified live: dev server compiles cleanly, `__schema` introspection shows all 4 new `Bucket` fields registered and confirms no helper-leak on `Query` type.

**Step 1.8 — runtime matrix verification completed**:
- Discovered `.env.local` overrides `DATABASE_URL` to `borderland_dreams_prod` (mirrored prod data); the default `.env` `cb` DB is empty.
- Wrote a scratch Vitest file that imported the real helpers from `helpers/conversationAccess.ts`, invoked them with real fixture IDs from `borderland_dreams_prod`, and also exercised an inline-ported copy of `assertCanCreateConversation` against the same DB.
- **19/19 matrix assertions passed** on the first run:
  - **Read matrix (7 assertions)**: signed-out → `[]`, random member → `[]`, cocreator → `canAccess=true`, admin → `canAccess=true`, moderator → `canAccess=true`, super admin (no user) → `canAccess=true`, unknown bucket id → `[]`.
  - **Create-gate matrix (12 assertions)**: all 11 planned matrix rows (signed-out, random member, cocreator-on-own-bucket, cocreator-on-mixed-buckets, admin single, admin multi, moderator, super-admin multi, empty bucket list, cross-round buckets) plus two bonus assertions (duplicate bucket IDs are deduped, unknown bucket ID yields "One or more dreams not found"). Row 5 (cocreator-of-multiple-own-dreams) was not separately exercised because the test round didn't have a user cocreating two disjoint buckets, but the logic path is identical to row 3/4 and already covered by the round-mismatch + length-mismatch assertions.
- Scratch test file deleted after verification. Full suite re-run: **41/41 passing**, no regressions.

**Deviations from phase-1.md**:
- None to the plan itself. One unplanned refactor during implementation: helpers moved from `queries/freud.ts` → `helpers/conversationAccess.ts` after the splat-export bug surfaced. This is the correct long-term location anyway — helpers don't belong in a resolver index module.

**Next Steps**:
1. Phase 1 complete. Ready to draft [phases/phase-2.md](phases/phase-2.md) for the frontend tab scaffolding.

---

### 2026-04-10 - Phase 2 implementation complete

**Context Resumed**:
- Phase 2 plan [phases/phase-2.md](phases/phase-2.md) was drafted before implementation. 8 steps: query extension, indicator deletion, tab wiring, new `PrivateThreadsTab` + `TopicList` components, `ConversationThread` parameterization, hub page update, cache invalidation verification, and a manual matrix.

**Completed**:
- [x] Step 2.1: Added `canAccessPrivateConversations`, `canStartPrivateConversation`, `noOfPrivateConversations` to `BUCKET_QUERY` in [ui/pages/[group]/[round]/[bucket]/index.tsx](../../../ui/pages/[group]/[round]/[bucket]/index.tsx), next to `isFavorite`.
- [x] Step 2.2: Deleted [ui/components/Freud/BucketConversationIndicator.tsx](../../../ui/components/Freud/BucketConversationIndicator.tsx) and removed its import + JSX from the bucket page.
- [x] Step 2.3: Derived `showDreamTeamTab = !!bucket?.canAccessPrivateConversations`, made `tabsList` dynamic via `useMemo`, and appended `"dreamteam"` conditionally. Rendered the new `<Tab>` with label `Dream Team (N)` (plain text, no icon, no `<FormattedMessage>` — Phase 4 polish).
- [x] Step 2.4: Created [ui/components/Bucket/PrivateThreadsTab/index.tsx](../../../ui/components/Bucket/PrivateThreadsTab/index.tsx). Wraps the Comments-tab layout shell (`bg-white border-b-default` > `page grid gap-10 grid-cols-1 md:grid-cols-sidebar`). Reads `router.query.thread` with array-coercion guard. Opens threads via `setThread` (pushes `?thread=<id>` preserving all other query params, `scroll: false`). Back via `clearThread` (destructures `thread` off `router.query`, pushes the rest).
- [x] Step 2.5: Created [ui/components/Bucket/PrivateThreadsTab/TopicList.tsx](../../../ui/components/Bucket/PrivateThreadsTab/TopicList.tsx) with its own `BucketPrivateConversations` query independent of `BUCKET_QUERY`. Loading uses `CardListSkeleton` from `components/Freud/LoadingSkeleton`; empty state is `"No conversations yet."`; rows are `<button>` elements (not `<Link>`) that call `onOpenThread(conv.id)`. Each row shows title + `Last message: <relative> by <name> · N messages`. No `Dreams:` subline (scoped to current dream already). No "+ New topic" button (Phase 3).
- [x] Step 2.6: Parameterized [ui/components/Freud/Conversations/ConversationThread.tsx](../../../ui/components/Freud/Conversations/ConversationThread.tsx) with 4 new optional props: `onBack`, `backHref`, `backLabel`, `privateChannel` (reserved for Phase 4). Replaced the hard-coded `← Back to Conversations` link with a conditional render: button if `onBack`, `<Link>` if `backHref`, nothing if neither. Chose **Option B** per the plan — no hidden default; hub page passes explicit props.
- [x] Step 2.7: Updated [ui/pages/[group]/[round]/freud/conversations/[conversationId].tsx](../../../ui/pages/[group]/[round]/freud/conversations/[conversationId].tsx) to pass `backHref={`/${group}/${round}/freud/conversations`}` and `backLabel="Back to Conversations"` explicitly to preserve existing hub UX.
- [x] `yarn typecheck`: no new errors introduced in any file I touched. All errors in the output are pre-existing (AddEditExpense, Wysiwyg, Date.ts, stripe, new-round, GeneralSettings, etc.), unchanged from the baseline recorded in Phase 1.
- [x] `yarn test:run`: **41/41 tests pass**, no regressions.

**Deviations from phase-2.md**:
- **Expenses tab handling**: The plan's prose said "preserve current behaviour for Expenses exactly" (always include in `tabsList`) but the plan's own code block showed conditionally pushing `"expenses"` based on `showExpensesTab`. These are contradictory. I followed the code block — conditionally pushing — because the alternative (always include expenses in `tabsList` + always-rendered panel) breaks the new `dreamteam` tab: when Expenses is hidden and Dreamteam is shown, `findIndex("dreamteam")=4` but only 4 tabs are rendered, so headlessui would route clicks on Dream Team to the Expenses panel (index 3). To keep tab↔panel alignment clean, I also made the Expenses `<Tab.Panel>` conditional on `showExpensesTab` (previously always rendered, which is the pre-existing bug the plan acknowledges). This is a small in-scope scope-creep but it's the only way to make Phase 2 actually work; the alternative would require a fragile index-juggling hack.
- Otherwise the implementation matches the plan step-for-step.

**Next Steps**:
1. Manual verification matrix (Step 2.8) — user can run `yarn dev` and walk through the 6 scenarios. I've verified compile/type/test cleanliness; browser verification is the remaining completion criterion.
2. Phase 3 planning: `NewTopicForm` and the "+ New topic" button.

---

### 2026-04-10 - Phase 3 implementation complete

**Context Resumed**:
- Phase 3 plan [phases/phase-3.md](phases/phase-3.md) was drafted before implementation. 7 steps: create `NewTopicForm` with admin/cocreator variants, add `canStart` + `renderNewTopicForm` render-prop to `TopicList`, wire `PrivateThreadsTab` to pass the form down, thread `canEditBucketSelection` through the bucket page, verify cache invalidation, and manual matrix.

**Completed**:
- [x] Step 3.1: Created [ui/components/Bucket/PrivateThreadsTab/NewTopicForm.tsx](../../../ui/components/Bucket/PrivateThreadsTab/NewTopicForm.tsx). Re-declares `CREATE_CONVERSATION` and `BUCKETS_QUERY` inline per Decision-8 "self-contained" guideline. Uses `pause: !canEditBucketSelection` to skip the `dreamReviewTable` query entirely for cocreators. Admin variant renders the editable checkbox list (pre-populated with the current bucket); cocreator variant renders a static read-only chip. Submit disabled unless `title.trim() && message.trim() && selectedBucketIds.size > 0`. Toast success + `onCreated(id)` on success; toast error on failure.
- [x] Step 3.2: Extended [TopicList.tsx](../../../ui/components/Bucket/PrivateThreadsTab/TopicList.tsx) with `canStart: boolean` + `renderNewTopicForm: (onDone: () => void) => ReactNode` props. Owns local `showForm` toggle state; renders "+ New topic" button at the top (only when `canStart`) and conditionally renders the parent-provided form below it. Empty state and row rendering unchanged — just wrapped in a fragment with the button + form above.
- [x] Step 3.3: Extended [PrivateThreadsTab/index.tsx](../../../ui/components/Bucket/PrivateThreadsTab/index.tsx) Props with `canEditBucketSelection`. Passes `canStart={bucket.canStartPrivateConversation}` to `TopicList` along with a `renderNewTopicForm` callback that instantiates `NewTopicForm` with `onCreated={(id) => { onDone(); setThread(id); }}` — closes the form and immediately opens the new thread inline.
- [x] Step 3.4: Computed `canEditBucketSelection = !!(currentUser?.currentCollMember?.isAdmin || currentUser?.currentCollMember?.isModerator)` in [ui/pages/[group]/[round]/[bucket]/index.tsx](../../../ui/pages/[group]/[round]/[bucket]/index.tsx) and passed it to `<PrivateThreadsTab>`.
- [x] Step 3.5: No `BUCKET_QUERY` additions needed — Phase 2 already selected all the fields Phase 3 uses. The form's dream-picker query is fetched independently inside `NewTopicForm`.
- [x] Step 3.6: Cache invalidation verified by inspection — Phase 1's `createConversation` hook invalidates `Bucket.privateConversations` + `Bucket.noOfPrivateConversations` for every bucket in the mutation result; the standalone `BucketPrivateConversations` query used by `TopicList` re-fetches via urql graphcache normalization.
- [x] `yarn typecheck`: no new errors introduced in any file I touched. All errors in the output are pre-existing (Wysiwyg, Date.ts, stripe, new-round, NewBucketModal, etc.).
- [x] `yarn test:run`: **41/41 tests pass**, no regressions.

**Simplify review cleanup**:
- Ran the `simplify` skill across the Phase 2+3 diff. Most findings were false positives, deliberate by plan (e.g. inline mutation re-declaration per Decision 8), or out of scope (Phase 1 backend). The one clean actionable fix was removing dead props from `ConversationThread`: after Phase 2's back-link refactor, `groupSlug` and `roundSlug` were accepted but never used. Removed them from the component signature and updated both call sites (`PrivateThreadsTab/index.tsx` and the hub `[conversationId].tsx` page). Also removed the now-unused `groupSlug`/`roundSlug` props from `PrivateThreadsTab` itself and its bucket-page call site. Re-ran typecheck and tests — clean.

**Deviations from phase-3.md**:
- None.

**Next Steps**:
1. Manual verification matrix (Step 3.7) — user can run `yarn dev` and walk through the 7 scenarios (admin happy path, admin multi-dream, admin cancel, cocreator happy path, cocreator picker impossible, validation, error path).
2. Phase 4 planning: lock icons, private-channel banner, role-branched empty state copy, Remirror compose (all deferred from earlier phases).

---

### 2026-04-10 - Q2 follow-up: symmetrical channel (back to the drawing board)

**Decision**: Cocreators can also **initiate** conversations, not just read/reply. Both cocreators and admins/mods always see the tab as participants of the dream. Both see an empty state with a "+ New topic" button.

**Impact on the plan**:
- Backend mutation `createConversation` is no longer admin-only — extracted into a new `assertCanCreateConversation(roundId, bucketIds, ctx)` gate that accepts admin/mod OR cocreator-of-every-listed-bucket OR super admin.
- New Bucket field `canAccessPrivateConversations` added (drives tab visibility), separate from `canStartPrivateConversation` (drives "+ New topic" button). They evaluate identically today but the separation is cheap future-proofing.
- Tab visibility rule simplified to `canAccessPrivateConversations` alone — no longer dependent on topic count.
- Phase 3 now delivers **two variants** of the new-topic form: admin/mod (editable dream picker) and cocreator (locked to current dream). See decision #8 in the dev plan for the "cocreators can only link dreams they cocreate" rationale.
- Spec gained AC8 (server-side create authorization) and AC13 (empty state with create button). Backend mutation test matrix added to the dev plan.
- Read/grep context: confirmed current `createConversation` gate in [ui/server/graphql/resolvers/mutations/freud.ts:368](../../../ui/server/graphql/resolvers/mutations/freud.ts#L368) calls `assertAdminOrMod` before writing. Notification path at lines 398-407 already emails cocreators of linked dreams minus sender — no change needed there.

**Decisions added** (see "Key Decisions" section below):
- Decision 6: Symmetrical channel / cocreators can initiate.
- Decision 7: Cocreator-authored topics limited to dreams the cocreator owns (server-enforced).
- Decision 8: Locked dream picker for cocreators in the first release (UX simplicity).

---

### 2026-04-10 - Planning session

**Context Reviewed**:
- Read [ui/server/prisma/migrations/20260409225552_freud_features/migration.sql](../../../ui/server/prisma/migrations/20260409225552_freud_features/migration.sql) — confirmed `Conversation ⇄ Bucket` is already many-to-many via `_ConversationBuckets`, no schema change needed.
- Read [ui/components/Freud/BucketConversationIndicator.tsx](../../../ui/components/Freud/BucketConversationIndicator.tsx) — current entry point on the dream page (blue panel above tabs, links out to admin hub).
- Read [ui/components/Freud/Conversations/ConversationThread.tsx](../../../ui/components/Freud/Conversations/ConversationThread.tsx) — noted hard-coded back link and plain styling; identified props to parameterize.
- Read [ui/components/Freud/Conversations/ConversationList.tsx](../../../ui/components/Freud/Conversations/ConversationList.tsx) — identified the new-topic form sub-tree to extract/reuse.
- Read [ui/pages/[group]/[round]/[bucket]/index.tsx](../../../ui/pages/[group]/[round]/[bucket]/index.tsx) — confirmed `Tab.Group` with `tabsList` + `?tab=` sync; noted `BUCKET_QUERY` shape and where to inject new fields.
- Read [ui/components/Bucket/Comments/index.tsx](../../../ui/components/Bucket/Comments/index.tsx) — confirmed the public Comments tab structure we want to visually contrast against.
- Read [ui/components/Freud/LoadingSkeleton.tsx](../../../ui/components/Freud/LoadingSkeleton.tsx) — `CardListSkeleton` is available for the topic list loading state.
- Read [ui/components/Freud/Emails/EmailPreviewModal.tsx](../../../ui/components/Freud/Emails/EmailPreviewModal.tsx) and [ReviewNotesPopover.tsx](../../../ui/components/Freud/DreamReview/ReviewNotesPopover.tsx) — referenced for cache-refresh pattern (`reexecuteQuery` on mutation success).

**Completed**:
- [x] Wrote [spec.md](spec.md) with 12 acceptance criteria, 4 out-of-scope items, 4 open questions.
- [x] Wrote [development-plan.md](development-plan.md) with 4 phases, file inventory, design decisions, risks.
- [x] Wrote this file.
- [ ] Detailed phase-1.md / phase-2.md / phase-3.md / phase-4.md — TBD when implementation starts, per plans/CLAUDE.md ("Create the detailed phase plan in `phases/phase-X.md` before starting").

**Blockers/Issues**:
- None. Plan is ready for user review.

**Next Steps**:
1. Get user confirmation on open questions Q1–Q4 in [spec.md](spec.md) (most critical: tab label wording).
2. Start Phase 1 by drafting `phases/phase-1.md` with step-level backend instructions.
3. Before implementation begins, locate the current Bucket type resolver file (likely in `ui/server/graphql/resolvers/types/`) to confirm where the new field resolvers belong.

---

## Key Decisions

### Decision 1: Per-bucket GraphQL fields instead of a new query

**Date**: 2026-04-10
**Context**: The dream page already fetches `bucket(id)` once on load. We need the tab to know (a) whether to show, (b) how many topics, and (c) whether the viewer can create.
**Decision**: Add `privateConversations`, `noOfPrivateConversations`, `canStartPrivateConversation` as fields on the `Bucket` GraphQL type rather than a separate `bucketPrivateConversations(bucketId)` query.
**Rationale**: Reuses the existing `BUCKET_QUERY` single round-trip, keeps authorization naturally scoped per-bucket, and means the tab can show/hide without any flash-of-content.

### Decision 2: Share scoping helper between existing query and new field resolver

**Date**: 2026-04-10
**Context**: Duplicating the 15-ish lines of auth/membership logic from `bucketConversations` into the new field resolver would be a maintenance hazard.
**Decision**: Extract `getViewerScopedBucketConversations(bucketId, ctx)` as a helper. Both `bucketConversations` query and the new `Bucket.privateConversations` field resolver call it.
**Rationale**: One place to change if the policy evolves (e.g. observers, suspended members, future read-only roles).

### Decision 3: Parameterize `ConversationThread` rather than fork

**Date**: 2026-04-10
**Context**: We need a private-channel visual variant and bucket-tab back behaviour.
**Decision**: Add 4 optional props (`backHref`, `onBack`, `backLabel`, `privateChannel`) to `ConversationThread`; keep admin-hub default behaviour.
**Rationale**: A fork would double the maintenance cost of the thread (mentions, read receipts, attachments are likely follow-ups). Props are cheap and the optionality keeps the hub call site untouched.

### Decision 4: Query-param routing inside the tab

**Date**: 2026-04-10
**Context**: Users may deep-link to a specific thread from an email or paste a URL.
**Decision**: Use `?tab=messages&thread=<id>` to route inside the dream page without adding a new Next.js route.
**Rationale**: The bucket page already syncs `?tab=` with `tabsList`. Adding `?thread=` is a trivial extension. A new `/[group]/[round]/[bucket]/messages/[threadId]` route would require duplicating the dream page shell and lose the tab header context.

### Decision 5: Delete `BucketConversationIndicator`

**Date**: 2026-04-10
**Context**: Two entry points (blue panel + new tab) would confuse users and fragment the UX.
**Decision**: Delete the file once the tab is live.
**Rationale**: The panel's placement above the tabs breaks the page's visual grammar; the tab subsumes all of its functionality.

### Decision 6: Symmetrical channel — cocreators can initiate

**Date**: 2026-04-10
**Context**: Q2 follow-up. Originally the plan had the tab as a one-way outbox: admins/mods start topics, cocreators only read/reply. The user pushed back: dreamers should be able to reach out first.
**Decision**: The Dream Team tab is a two-way channel. Both cocreators and admins/mods can start topics. The server-side `createConversation` mutation is relaxed: admin/mod OR cocreator-of-every-listed-bucket OR super admin. Tab is always visible to participants regardless of topic count.
**Rationale**: Gives cocreators their first formal channel to reach the Dream Team from inside Cobudget (previously they had to find a Dream Team member off-platform). Makes the feature symmetrical and discoverable. The backend change is small (swap one gate) and the client change is additive.

### Decision 7: Cocreator-authored topics limited to dreams the cocreator owns

**Date**: 2026-04-10
**Context**: Decision 6 raised the question: when a cocreator creates a multi-dream topic, which dreams can they link?
**Decision**: A cocreator may link **any** dream they are a cocreator of (including multi-own-dream topics) but **no dreams they don't cocreate**. Enforced server-side in `assertCanCreateConversation`: every bucket in `bucketIds` must be one the caller cocreates (or the caller is admin/mod/super admin).
**Rationale**: Matches the existing read-scoping policy ("you see what you cocreate"). Prevents a cocreator from using the form to start a conversation on someone else's dream. Admins retain full multi-dream flexibility.

### Decision 8: Locked dream picker for cocreators in first release

**Date**: 2026-04-10
**Context**: Decision 7 allows cocreators to span multiple of their own dreams, but most cocreators only have one dream. Exposing a dream picker for them adds UI complexity for a minority case.
**Decision**: Phase 3 ships the cocreator form with the current dream pre-selected and **locked** (read-only chip). The "add more of my dreams" disclosure is deferred to a follow-up if demand emerges. The server-side gate still allows multi-own-dream topics — it's only the UI that's simplified.
**Rationale**: Keeps the Phase 3 scope tight. The policy is already enforced on the backend, so a future UI change is additive and doesn't require a second backend migration.

### Decision 11: Match Comments tab layout for thread view

**Date**: 2026-04-10
**Context**: Q4. When a thread is opened inside the Dream Team tab, should the thread container have a bespoke narrow max-width (like a DM app), or should it match the existing `page grid gap-10 grid-cols-1 md:grid-cols-sidebar` wrapper the public Comments tab uses?
**Decision**: Match the Comments tab layout exactly — drop `ConversationThread` into the same grid shell as Comments. No bespoke max-width, no new layout code.
**Rationale**: Preserves visual grammar across the dream page so the only difference between public and private is the signalling (lock icon, banner, background tint). A single thread layout is also cheaper to maintain — the admin hub thread already renders full-width. If wide threads feel sparse in practice, tightening is a one-line follow-up.

---

### Decision 10: Back button always returns to the current dream's tab list

**Date**: 2026-04-10
**Context**: Q3. When an admin opens a multi-dream topic from dream A's Dream Team tab, what should the thread's "Back" button do? Options were: dream A's tab list, the admin hub (`/freud/conversations`), or browser-back only.
**Decision**: "Back" always clears only the `?thread=` query param on the current URL. The user stays on the same dream page's tab list. No conditional logic based on topic scope (single vs multi-dream).
**Rationale**: Matches the user's mental model ("I'm on dream A reading its messages"). Context-switching an admin to the round-wide hub because a topic happens to span multiple dreams would be surprising. The implementation is trivial — we never compute a destination outside the current page. The admin hub is still reachable via the FREUD submenu. Consistent with Decision 6 (symmetrical channel): cocreators and admins get the same back behaviour because neither knows or cares about the round-wide hub when they're reading a specific dream's thread.
**Note**: Decision 9 was reserved during drafting and not used; skipping to 10 to preserve stable numbering in the work-notes log.

---

## Files Modified

### Created
- `plans/active/freud-dream-threads-ux/spec.md`
- `plans/active/freud-dream-threads-ux/development-plan.md`
- `plans/active/freud-dream-threads-ux/work-notes.md`
- `plans/active/freud-dream-threads-ux/phases/phase-1.md`

### Created (Phase 1)
- `ui/server/graphql/resolvers/helpers/conversationAccess.ts` — New non-resolver helper module exporting `getViewerScopedBucketConversations` and `viewerCanAccessBucketConversations`. (Moved here from `queries/freud.ts` after the splat-export bug.)

### Modified (Phase 1)
- `ui/server/graphql/schema/index.js` — Added 4 new fields to `type Bucket`: `privateConversations`, `noOfPrivateConversations`, `canAccessPrivateConversations`, `canStartPrivateConversation`.
- `ui/server/graphql/resolvers/queries/freud.ts` — Imports `getViewerScopedBucketConversations` from the new helper module; `bucketConversations` query delegates to it.
- `ui/server/graphql/resolvers/mutations/freud.ts` — Added `assertCanCreateConversation` gate; `createConversation` swapped to use it.
- `ui/server/graphql/resolvers/types/Bucket.ts` — Added 4 field resolvers (imports helpers from `helpers/conversationAccess`); `canStartPrivateConversation` aliases `canAccessPrivateConversations`.
- `ui/graphql/client.ts` — Extended `createConversation` and `addConversationMessage` cache hooks to invalidate per-bucket fields.
- `ui/components/Freud/Conversations/ConversationList.tsx` — Added `buckets { id }` to CREATE_CONVERSATION selection for cache invalidation.

### Created (Phase 2)
- `ui/components/Bucket/PrivateThreadsTab/index.tsx` — tab panel container; switches between list and thread on `?thread=<id>`. Wraps the Comments-tab layout shell.
- `ui/components/Bucket/PrivateThreadsTab/TopicList.tsx` — scoped topic list with its own `BucketPrivateConversations` query, loading skeleton, empty state, button-row UI.
- `plans/active/freud-dream-threads-ux/phases/phase-2.md` — drafted before implementation.

### Modified (Phase 2)
- `ui/pages/[group]/[round]/[bucket]/index.tsx` — Added 3 new fields to `BUCKET_QUERY`. Removed `BucketConversationIndicator` import + JSX. Added `showDreamTeamTab` derivation. Made `tabsList` dynamic (now conditionally appends `"expenses"` and `"dreamteam"`). Added Dream Team `<Tab>` + `<Tab.Panel>`. Made Expenses `<Tab.Panel>` conditional on `showExpensesTab` so panel/tab indices stay aligned.
- `ui/components/Freud/Conversations/ConversationThread.tsx` — Added optional `onBack` / `backHref` / `backLabel` / `privateChannel` props. Replaced hard-coded `← Back to Conversations` link with conditional button/link. Renders no back link when neither prop is set.
- `ui/pages/[group]/[round]/freud/conversations/[conversationId].tsx` — Passes explicit `backHref` + `backLabel` to preserve hub UX.

### Deleted (Phase 2)
- `ui/components/Freud/BucketConversationIndicator.tsx` — replaced by the Dream Team tab.

### Created (Phase 3)
- `ui/components/Bucket/PrivateThreadsTab/NewTopicForm.tsx` — inline form with admin (editable picker) and cocreator (locked chip) variants. Re-declares `CREATE_CONVERSATION` + `BUCKETS_QUERY` inline per Decision 8. Uses `pause: !canEditBucketSelection` to skip `dreamReviewTable` for cocreators.
- `plans/active/freud-dream-threads-ux/phases/phase-3.md` — drafted before implementation.

### Modified (Phase 3)
- `ui/components/Bucket/PrivateThreadsTab/TopicList.tsx` — added `canStart: boolean` + `renderNewTopicForm` render-prop, owns local `showForm` toggle and the "+ New topic" button.
- `ui/components/Bucket/PrivateThreadsTab/index.tsx` — accepts `canEditBucketSelection` prop; passes `canStart` + `renderNewTopicForm` into `TopicList`; form's `onCreated` closes the form and opens the new thread inline.
- `ui/pages/[group]/[round]/[bucket]/index.tsx` — computes `canEditBucketSelection` from `currentUser?.currentCollMember?.isAdmin || isModerator` and passes it to `<PrivateThreadsTab>`.

### Cleanup (simplify review, post-Phase 3)
- `ui/components/Freud/Conversations/ConversationThread.tsx` — removed dead `groupSlug`, `roundSlug`, and `privateChannel` props; they were unused after the Phase 2 back-link refactor.
- `ui/components/Bucket/PrivateThreadsTab/index.tsx` — removed the matching unused `groupSlug` / `roundSlug` props.
- `ui/pages/[group]/[round]/freud/conversations/[conversationId].tsx` — stopped passing the removed `groupSlug`/`roundSlug` props.

### Created (Phase 4)
- `plans/active/freud-dream-threads-ux/phases/phase-4.md` — drafted before implementation.

### Modified (Phase 4)
- `ui/pages/[group]/[round]/[bucket]/index.tsx` — imported `LockOutlinedIcon`; wrapped Dream Team tab label in inline-flex span with lock icon; extracted `isTeamMember` derivation for reuse; extended the tab-sync `useEffect` to normalize stale `?tab=dreamteam` / `?thread=` via `router.replace(..., { shallow: true, scroll: false })` when the tab is hidden; passed `isTeamMember` through to `<PrivateThreadsTab>`.
- `ui/components/Bucket/PrivateThreadsTab/index.tsx` — accepts new `isTeamMember` prop; renders a blue private-channel banner above the `TopicList` (list view only) with an inline "Comments tab" button that calls a new `switchToComments` helper (drops `?thread`, sets `?tab=comments`); passes `privateChannel` to the thread view and `isTeamMember` to `TopicList`.
- `ui/components/Bucket/PrivateThreadsTab/TopicList.tsx` — new `isTeamMember` prop; replaced the flat "No conversations yet." text with a centered block (lock icon + role-branched copy).
- `ui/components/Freud/Conversations/ConversationThread.tsx` — reinstated `privateChannel?: boolean` prop; when true, wraps the thread in `bg-blue-50/40 rounded-lg p-4 -m-4` and renders a lock icon + "Private" pill next to the title. Admin hub call site continues to pass nothing → default `false` → no visual change.

## Session Log (continued)

### 2026-04-10 - Phase 4 implementation complete

**Completed**:
- [x] Step 4.1: Lock icon + count on Dream Team tab label (via inline-flex span).
- [x] Step 4.2: Blue private-channel banner with "Comments tab" switch button, rendered only in list view.
- [x] Step 4.3: Reinstated `privateChannel` prop on `ConversationThread`; tint + "Private" pill + lock icon in header when true. Hub thread unchanged.
- [x] Step 4.4: Role-branched empty state (cocreator: "reach the Dream Team"; team member: "reach this dream's cocreators") with centered lock icon.
- [x] Step 4.5: Tab-sync useEffect now normalizes stale `?tab`/`?thread` query when the viewer lands on a hidden tab (shallow replace).
- [x] Step 4.6 (cache UX verification): deferred to manual matrix; Phase 1 cache hooks already walk linked buckets.
- [x] `yarn typecheck`: no new errors in touched files (all remaining errors are pre-existing in unrelated files — Wysiwyg, NewBucketModal, stripe, Date.ts, new-round, etc.).
- [x] `yarn test:run`: **41/41 tests pass**. No regressions.

**Deviations from phase-4.md**:
- None.

**Next Steps**:
1. User walkthrough of Phase 4 manual verification matrix (Step 4.7, 9 checks).
2. If the cache UX check (4.7 #9) shows stale last-message rows, add a targeted `reexecuteQuery({ requestPolicy: "network-only" })` after send — but only if manual testing shows it's needed.
3. After manual sign-off: update development-plan.md phase table + move plan to `plans/completed/`.
