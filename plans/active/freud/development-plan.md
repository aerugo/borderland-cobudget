# FREUD - Development Plan

**Status**: In Progress
**Created**: 2026-04-09
**Branch**: `freud`
**Spec**: [spec.md](spec.md)

## Summary

Implement FREUD (Fantastic RE-distribution Utility Datasheet) as a native feature set in Cobudget, replacing the current Coda.io integration. FREUD provides the Dream Team (round admins/moderators) with tools for dream review coordination, redistribution modeling, batch communication, and private conversations with dreamers.

## Current State Analysis

The Dream Team currently uses a Coda.io document with a Coda Pack integration to Cobudget for reviewing dreams, running redistribution algorithms, and communicating with dreamers. This creates a fragmented workflow split across two platforms with manual data syncing.

The Cobudget platform already has the foundational data model (Rounds, Buckets, RoundMembers with admin/mod roles, Tags, Contributions) and existing admin tools (MembersTable, RoundSettings tabs, SubMenu navigation) that FREUD builds upon.

### Files to Modify

| File | Current State | Planned Changes |
|------|---------------|-----------------|
| `ui/server/prisma/schema.prisma` | Core models for Bucket, Round, RoundMember | Add 7 new models + relations + freudTotalBudget field |
| `ui/server/graphql/schema/index.js` | Existing types, queries, mutations | Add ~12 new types, 7 queries, 14 mutations |
| `ui/server/graphql/resolvers/index.ts` | Wires queries/mutations/types | Add freud query/mutation/type imports |
| `ui/server/graphql/resolvers/queries/index.ts` | Exports query modules | Add freud queries export |
| `ui/server/graphql/resolvers/mutations/index.ts` | Exports mutation modules | Add freud mutations export |
| `ui/components/SubMenu.tsx` | Round nav tabs (admin-gated) | Add FREUD tab for admin/mod |
| `ui/graphql/client.ts` | Urql cache config | Add cache invalidation for FREUD mutations |

### Files to Create

| File | Purpose |
|------|---------|
| `ui/pages/[group]/[round]/freud/index.tsx` | Dream Review page |
| `ui/pages/[group]/[round]/freud/redistribution.tsx` | Redistribution page |
| `ui/pages/[group]/[round]/freud/emails.tsx` | Batch emails page |
| `ui/pages/[group]/[round]/freud/conversations/index.tsx` | Conversation list |
| `ui/pages/[group]/[round]/freud/conversations/[conversationId].tsx` | Single conversation |
| `ui/components/Freud/FreudLayout.tsx` | Shared layout with sub-tabs |
| `ui/components/Freud/DreamReview/*.tsx` | ~6 components for review table |
| `ui/components/Freud/Redistribution/*.tsx` | ~6 components for redistribution |
| `ui/components/Freud/Emails/*.tsx` | ~4 components for batch emails |
| `ui/components/Freud/Conversations/*.tsx` | ~4 components for conversations |
| `ui/utils/freud-redistribution.ts` | Redistribution algorithm (stateful stepper) |
| `ui/server/graphql/resolvers/queries/freud.ts` | All FREUD queries |
| `ui/server/graphql/resolvers/mutations/freud.ts` | All FREUD mutations |
| `ui/server/graphql/resolvers/types/Conversation.ts` | Conversation type resolver |
| `ui/server/graphql/resolvers/types/DreamReviewTag.ts` | DreamReviewTag type resolver |
| `ui/server/graphql/resolvers/types/ConversationMessage.ts` | ConversationMessage type resolver |

## Solution Design

### Key Design Decisions

1. **Single FREUD resolver file per concern**: Rather than one file per mutation (which would create ~14 small files), group all FREUD queries into one file and all mutations into one file, following the existing pattern where `round.ts` contains all round-related mutations.

2. **Client-side redistribution algorithm**: The algorithm runs in the browser as React state (via `useReducer` or `useState`). No server round-trips needed during modeling. Only snapshots are persisted server-side.

3. **Stateful stepper for Loop mode**: The redistribution engine exposes `init`, `step`, `finish`, `reset` functions so each model can be advanced one iteration at a time.

4. **Shared FreudLayout component**: All FREUD sub-pages share a layout that includes the sub-tab navigation and admin/mod gate check.

5. **Approval integration**: The Dream Review Table integrates with the existing `approveBucket` mutation — the Approved column is an actionable toggle.

6. **Notes as popovers**: Internal review comments use lightweight popovers anchored to table rows (not full side drawers), matching the Coda UX.

## Phase Overview

| Phase | Description | Deliverables |
|-------|-------------|--------------|
| 1 | Foundation: Schema, migrations, navigation, layout | Database models, GraphQL types, FREUD tab + sub-tabs, empty pages |
| 2 | Dream Review Table | Full review table with budget summary, tags, reviewer assignment, approval toggle |
| 3 | Dream Review Comments | Internal notes/comments system with @-mentions and popovers |
| 4 | Redistribution Engine | Algorithm implementation, model controls, redistribution table with Loop/Run |
| 5 | Batch Email Tool | Email composer, dream-based recipient picker, email history |
| 6 | Dream Conversations | Conversation CRUD, threaded messages, email notifications, dreamer access |
| 7 | Polish & Testing | CSV export, visual polish, edge cases, E2E tests |

---

## Phase 1: Foundation

**Goal**: Set up all database models, GraphQL schema, navigation, and page shell so subsequent phases can work independently.
**Detailed Plan**: [phases/phase-1.md](phases/phase-1.md)

### Deliverables

1. Prisma schema with all 7 new models + `freudTotalBudget` on Round
2. Database migration applied
3. GraphQL SDL types for all FREUD entities
4. GraphQL queries and mutations declared (resolvers return stubs/empty arrays)
5. FREUD tab in SubMenu (admin/mod only)
6. FreudLayout component with sub-tab navigation
7. Empty page shells for all 5 FREUD routes
8. Cache invalidation rules in `graphql/client.ts`

### Implementation Approach

1. Add all Prisma models to `schema.prisma`, run migration
2. Add all GraphQL SDL types/queries/mutations to `schema/index.js`
3. Create stub resolvers in `resolvers/queries/freud.ts` and `resolvers/mutations/freud.ts`
4. Wire into `resolvers/index.ts`
5. Add FREUD tab to SubMenu with admin/mod gate
6. Create `FreudLayout.tsx` with sub-tab navigation
7. Create page shells that render FreudLayout
8. Add cache invalidation rules

### Success Criteria

- [ ] Migration runs cleanly
- [ ] Dev server starts without errors
- [ ] Type check passes (`yarn typecheck`)
- [ ] FREUD tab visible to admin/mod users, hidden for others
- [ ] Sub-tab navigation works between all FREUD pages
- [ ] GraphQL playground shows all new types/queries/mutations

---

## Phase 2: Dream Review Table

**Goal**: Build the core Dream Review Table with budget summary, tag management, reviewer assignment, and approval toggle.
**Detailed Plan**: [phases/phase-2.md](phases/phase-2.md)

### Deliverables

1. `dreamReviewTable` query resolver — efficient single query for all bucket data
2. `dreamReviewTags` query resolver
3. Tag CRUD mutations (`createDreamReviewTag`, `deleteDreamReviewTag`, `addDreamReviewTag`, `removeDreamReviewTag`)
4. Reviewer mutations (`addDreamReviewer`, `removeDreamReviewer`)
5. `DreamReviewTable` component with all columns
6. `BudgetSummaryPanel` component with total budget, min budgets, distributed, remaining
7. `DreamReviewTagCell` — inline tag editor with colored chips
8. `DreamReviewTagManager` — modal for tag CRUD
9. `ReviewerCell` — reviewer assignment dropdown
10. `DreamReviewFilters` — column filter chips + search
11. `setFreudTotalBudget` mutation + inline editable field
12. Approval toggle calling existing `approveBucket` mutation

### Implementation Approach

1. Implement `dreamReviewTable` query with efficient joins
2. Implement tag CRUD resolvers
3. Implement reviewer assignment resolvers
4. Build `DreamReviewTable` component top-down: summary → filters → table → cells
5. Wire up mutations from cells

### Success Criteria

- [ ] Table loads all dreams with correct data
- [ ] Tags can be created, assigned, removed, deleted
- [ ] Reviewers can be assigned and removed
- [ ] Filters work (tag, search, unreviewed)
- [ ] Approval toggle works
- [ ] Budget summary shows correct calculations
- [ ] Type check passes

---

## Phase 3: Dream Review Comments

**Goal**: Add the internal notes/comments system to the Dream Review Table.
**Detailed Plan**: [phases/phase-3.md](phases/phase-3.md)

### Deliverables

1. `dreamReviewComments` query resolver
2. Comment CRUD mutations (`createDreamReviewComment`, `editDreamReviewComment`, `deleteDreamReviewComment`)
3. `ReviewNotesPopover` component — anchored to table row badge
4. Comment input with @-mention autocomplete for admins/mods
5. Email notifications for @-mentioned users
6. Comment count badge on each table row

### Implementation Approach

1. Implement comment query and mutations
2. Build popover component with comment stream
3. Add @-mention autocomplete (list of admin/mod members)
4. Wire email notifications for mentions
5. Add count badge to table rows

### Success Criteria

- [ ] Comments can be created, edited, deleted
- [ ] Popover opens anchored to the correct row
- [ ] @-mentions autocomplete from admin/mod list
- [ ] @-mentioned users receive email notification
- [ ] Comment count badge updates correctly
- [ ] Type check passes

---

## Phase 4: Redistribution Engine

**Goal**: Implement the FREUD redistribution algorithm with step-through capability, model controls, and the full redistribution table.
**Detailed Plan**: [phases/phase-4.md](phases/phase-4.md)

### Deliverables

1. `freud-redistribution.ts` utility — `init`, `step`, `finish`, `reset`, `getNextBucket` functions with all 4 sort methods
2. Unit tests for redistribution algorithm (Vitest)
3. `freudData` query resolver — bucket data for redistribution
4. `toggleFreudHeart` mutation
5. `saveFreudSnapshot` mutation + `freudSnapshots` query
6. `BudgetSummary` component (Total budget / decided / difference / asked for)
7. `ModelControlsTable` + `ModelControlRow` — 4 independent model control rows with Reset/Run/Loop/Next Bucket/Funded/Contributed
8. `RedistributionTable` — Dream, Tag, Goal, Stretch, Funded, Missing, Funders, Progress, Fund, Final, M:Combo, M:Funders, M:SEK, M:Percent, Heart, Reviewed By
9. `FundOverrideCell` — model/manual/skip/lock dropdown
10. `HeartButton` — toggle with who-hearted list
11. Row coloring logic (green/yellow/no-color for M: columns, green for funded dreams)
12. "Show Dreams that reached goal" toggle
13. CSV export button

### Implementation Approach

1. Build and test the redistribution algorithm in isolation (pure functions, no React)
2. Build the budget summary panel
3. Build model controls with local React state for each model's `RedistributionState`
4. Build the redistribution table consuming the 4 model states
5. Wire heart/snapshot mutations
6. Add visual indicators and row coloring
7. Add CSV export

### Success Criteria

- [ ] All 4 algorithms produce correct redistribution results
- [ ] Loop mode steps through one iteration at a time with correct Next Bucket display
- [ ] Finish Run completes the algorithm in one click
- [ ] Reset restores original values
- [ ] All 4 models can run independently and display side-by-side
- [ ] Fund column overrides (model/manual/skip/lock) work correctly
- [ ] Hearts can be toggled and persist across page loads
- [ ] Snapshots can be saved and listed
- [ ] Row coloring matches the Coda pattern
- [ ] CSV export works
- [ ] Unit tests pass for algorithm
- [ ] Type check passes

---

## Phase 5: Batch Email Tool

**Goal**: Build the batch email composer with dream-based recipient selection and email history.
**Detailed Plan**: [phases/phase-5.md](phases/phase-5.md)

### Deliverables

1. `sendBatchEmail` mutation resolver (Postmark integration)
2. `batchEmails` query resolver (history)
3. `EmailComposer` component — subject, summary, rich text body
4. `DreamRecipientPicker` — dream checkboxes with co-creator counts, Add All, deduplication
5. `EmailPreviewModal` — rendered email preview
6. `EmailHistory` — past emails table with expand to see details
7. Confirmation dialog before sending
8. Rate limiting (1 batch per 5 minutes per round)

### Implementation Approach

1. Create Postmark template for batch emails (or use existing inline send pattern)
2. Implement mutation: resolve co-creators, deduplicate, send batch, log record
3. Implement history query
4. Build composer UI with existing Wysiwyg component for message body
5. Build recipient picker with dream search/filter
6. Add preview and confirmation modals

### Success Criteria

- [ ] Emails send to correct recipients (deduplicated across dreams)
- [ ] Email content renders correctly (HTML)
- [ ] History shows all past batch emails
- [ ] Rate limiting prevents rapid re-sends
- [ ] Confirmation dialog appears before send
- [ ] Preview renders the email template
- [ ] Type check passes

---

## Phase 6: Dream Conversations

**Goal**: Build the private conversation system between Dream Team and dreamers.
**Detailed Plan**: [phases/phase-6.md](phases/phase-6.md)

### Deliverables

1. `conversations` and `conversation` query resolvers (with authorization)
2. `createConversation`, `addConversationMessage`, `addBucketsToConversation` mutations
3. Conversation email notifications via Postmark
4. `ConversationList` component — list of conversations with last message, dream links
5. `ConversationForm` — new conversation modal with dream picker + initial message
6. `ConversationThread` — message stream with author role badges (admin/co-creator)
7. `MessageInput` — reply input
8. Authorization: admin/mod can see all; co-creators can only see conversations linked to their dreams
9. Dreamer-facing: "Dream Team Conversation" section on bucket page

### Implementation Approach

1. Implement query resolvers with authorization checks
2. Implement mutations with email notification triggers
3. Build conversation list page
4. Build single conversation page with thread and reply
5. Build new conversation form with dream picker
6. Add conversation indicator on bucket page for co-creators

### Success Criteria

- [ ] Admins/mods can create conversations linked to dreams
- [ ] Co-creators of linked dreams receive email notification
- [ ] Co-creators can view and reply to conversations they're part of
- [ ] Co-creators cannot see conversations for other dreams
- [ ] Non-members cannot access conversations
- [ ] Conversation appears on bucket page for linked co-creators
- [ ] New messages trigger email notifications
- [ ] Type check passes

---

## Phase 7: Polish & Testing

**Goal**: Visual polish, edge cases, E2E testing, and final verification.
**Detailed Plan**: [phases/phase-7.md](phases/phase-7.md)

### Deliverables

1. E2E tests (Cypress) for critical flows: review table, redistribution, send email, conversations
2. Edge case handling (empty rounds, zero-budget dreams, large dream counts)
3. Loading states and error handling across all FREUD pages
4. Responsive design review (FREUD tables on mobile — likely horizontal scroll)
5. Accessibility review (keyboard navigation, screen reader support for tables)
6. Performance profiling for large rounds (200+ dreams)

### Success Criteria

- [ ] E2E tests pass
- [ ] No console errors on any FREUD page
- [ ] Graceful handling of empty state
- [ ] Tables scroll horizontally on mobile
- [ ] Type check passes
- [ ] Full manual test walkthrough succeeds

---

## Testing Strategy

### Unit Tests (Vitest)

- `ui/__tests__/freud-redistribution.test.ts`: All 4 sort methods, step/finish/reset, edge cases (empty input, all funded, single dream), override logic (skip/lock/manual)
- `ui/__tests__/freud-authorization.test.ts`: Authorization checks for queries/mutations

### E2E Tests (Cypress)

- `cypress/e2e/freud-review.cy.js`: Navigate to FREUD, view table, assign tag, assign reviewer, add comment
- `cypress/e2e/freud-redistribution.cy.js`: Run a model, step through with Loop, check results, save snapshot
- `cypress/e2e/freud-emails.cy.js`: Compose email, select dreams, preview, send
- `cypress/e2e/freud-conversations.cy.js`: Create conversation, send message, verify co-creator access

## Progress Tracking

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 1 | Complete | 2026-04-09 | 2026-04-09 | Migration pending (no DB). Type resolvers deferred to P6. |
| Phase 2 | Complete | 2026-04-09 | 2026-04-09 | Dream Review Table done. Notes popover deferred to P3. |
| Phase 3 | Complete | 2026-04-09 | 2026-04-09 | Comments popover done. @-mention autocomplete deferred to P7. |
| Phase 4 | Complete | 2026-04-09 | 2026-04-09 | Algorithm + UI done. Fund overrides & CSV export deferred to P7. |
| Phase 5 | Complete | 2026-04-09 | 2026-04-10 | Batch emails done. Postmark dispatch TODO. |
| Phase 6 | Complete | 2026-04-10 | 2026-04-10 | Conversations done. Email notifs & bucket indicator deferred to P7. |
| Phase 7 | In Progress | 2026-04-10 | | All deferrals resolved. Remaining: Remirror, loading skeletons, a11y, E2E, visual polish. |
