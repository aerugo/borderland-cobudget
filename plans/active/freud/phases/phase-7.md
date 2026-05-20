# Phase 7: Polish & Testing

**Status**: Pending
**Started**: —
**Parent Plan**: [development-plan.md](../development-plan.md)

## Objective

Address all items deferred from Phases 1-6, plus original Phase 7 scope: loading/error states, responsive design, edge cases, accessibility, performance, and E2E tests.

## Deferred Items from Earlier Phases

### From Phase 1
- [ ] Run database migration (`cd ui && yarn migrate`) — blocked on running DB

### From Phase 2: Dream Review Table
- [ ] Add Approved filter dropdown (yes/no/all) to DreamReviewTable toolbar
- [ ] Add Published filter dropdown (yes/no/all) to DreamReviewTable toolbar
- [ ] Add Refresh button (re-execute query) to DreamReviewTable toolbar
- [ ] Add Clear all filters button (✕) to DreamReviewTable toolbar

### From Phase 3: Dream Review Comments
- [ ] Implement `parseMentions()` regex function to extract @-mentions from comment content
- [ ] Send email notifications to @-mentioned users when comment is created
- [ ] Add @-mention autocomplete UI in ReviewNotesPopover input (detect "@", show admin/mod dropdown, insert username)
- [ ] Add edit button to own comments in ReviewNotesPopover (mutation exists, UI does not)

### From Phase 4: Redistribution Engine
- [ ] Write unit tests for redistribution algorithm (`ui/__tests__/freud-redistribution.test.ts`)
  - All 4 sort methods produce correct orderings
  - Step-by-step matches finish result
  - Override logic (skip, lock, manual)
  - Edge cases: empty input, all funded, single dream, zero goal
- [ ] Create `FundOverrideCell.tsx` — dropdown (model/manual/skip/lock) + manual amount input
  - Wire override state into `RedistributionPage` and pass to `initRedistribution`
  - Re-run active models when overrides change
- [ ] Add CSV export button to redistribution page toolbar

### From Phase 5: Batch Email Tool
- [ ] Replace message textarea with Remirror/Wysiwyg rich text editor (reuse existing component)
- [ ] Create `EmailPreviewModal.tsx` — render email HTML in modal before sending
- [ ] Wire Postmark email dispatch in `sendBatchEmail` mutation via EmailService
  - Use existing `send-email.ts` pattern
  - Send to each recipient with subject, HTML body, and round branding footer

### From Phase 6: Dream Conversations
- [ ] Create `types/Conversation.ts` type resolver for `messageCount` and `lastMessageAt` computed fields
  - Wire into `resolvers/index.ts` resolver map as `FreudConversation`
  - Remove inline computation from query resolvers
- [ ] Add email notifications on conversation creation (notify all co-creators of linked dreams)
- [ ] Add email notifications on new messages (notify all participants except author)
- [ ] Add dreamer-facing conversation indicator on bucket page:
  - Add `bucketConversations(bucketId: ID!)` query to GraphQL schema
  - Implement query resolver (return conversations linked to bucket, auth: admin/mod or cocreator)
  - Add "Dream Team Conversation" section to bucket page (`ui/pages/[group]/[round]/[bucket]/index.tsx`)
  - Show conversation title, last message excerpt, "View Conversation" link
  - Only visible to cocreators + admins/mods
- [ ] Add participant summary line to ConversationThread header ("Lovisa, Martin (Dream Team) + 5 co-creators")

## Original Phase 7 Scope

### Step 7.1: Loading & Error States

- [ ] Add loading skeletons (gray pulsing rows) while queries load on all FREUD pages
- [ ] Add error states with retry button if query fails
- [ ] Verify empty state messages are correct:
  - Dream Review: "No dreams in this round yet" (already implemented)
  - Redistribution: "No underfunded dreams to redistribute"
  - Emails: "No emails sent yet" (already implemented)
  - Conversations: "No conversations yet. Start one to reach out to dreamers." (already implemented)

### Step 7.2: Responsive Design

- [ ] Verify tables scroll horizontally on mobile (already using `overflow-x-auto`)
- [ ] Budget summary panels stack vertically on narrow screens
- [ ] Model controls remain usable on tablet
- [ ] Email composer stacks vertically on mobile

### Step 7.3: Edge Case Hardening

- [ ] Round with 0 dreams → graceful empty state
- [ ] Dream with 0 budget items (goal = 0) → excluded from redistribution, shown in review
- [ ] Dream with 0 cocreators → shown in review, skipped in batch email
- [ ] Very long dream title (100+ chars) → truncate with ellipsis + tooltip
- [ ] Unicode/emoji in dream titles and comments → render correctly
- [ ] Admin who is also cocreator → shown correctly in both roles
- [ ] Session expiry during long FREUD session → redirect to login with return URL

### Step 7.4: Accessibility

- [ ] Tables have proper `<th>` headers with `scope="col"`
- [ ] Tag dropdown, reviewer selector, notes popover are keyboard-navigable
- [ ] Popovers trap focus and close on Escape
- [ ] Color-coded redistribution cells also have text indicators (not color-only)
- [ ] Heart button has `aria-label`
- [ ] Form inputs have labels

### Step 7.5: Performance Profiling

- [ ] Profile `dreamReviewTable` query for 200+ dreams (target: <500ms)
- [ ] Profile `freudData` query for 200+ dreams (target: <500ms)
- [ ] Profile client-side redistribution algorithm for 200+ dreams (target: <100ms)

### Step 7.6: E2E Tests

- [ ] `cypress/e2e/freud-review.cy.js` — FREUD tab visibility, table data, tag CRUD, reviewer, comments, approval, filters
- [ ] `cypress/e2e/freud-redistribution.cy.js` — run models, loop mode, reset, hearts, snapshots, CSV export
- [ ] `cypress/e2e/freud-emails.cy.js` — compose, select recipients, preview, send, history
- [ ] `cypress/e2e/freud-conversations.cy.js` — create, reply, cocreator access, bucket page indicator

### Step 7.7: Visual Polish

- [ ] Review row coloring against Coda screenshots
- [ ] Tag chip styling consistency
- [ ] Avatar sizing in table cells
- [ ] Model controls button styling
- [ ] Popover shadow and border radius

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/components/Freud/DreamReview/DreamReviewTable.tsx` | MODIFY | Add Approved/Published/Refresh/Clear filters |
| `ui/components/Freud/DreamReview/ReviewNotesPopover.tsx` | MODIFY | Add @-mention autocomplete, edit button |
| `ui/components/Freud/Redistribution/FundOverrideCell.tsx` | CREATE | Override dropdown for Fund column |
| `ui/components/Freud/Redistribution/RedistributionPage.tsx` | MODIFY | Wire fund overrides, add CSV export |
| `ui/components/Freud/Emails/EmailsPage.tsx` | MODIFY | Swap textarea for Wysiwyg, add preview modal |
| `ui/components/Freud/Emails/EmailPreviewModal.tsx` | CREATE | Email preview modal |
| `ui/components/Freud/Conversations/ConversationThread.tsx` | MODIFY | Add participant summary |
| `ui/server/graphql/resolvers/types/Conversation.ts` | CREATE | FreudConversation type resolver |
| `ui/server/graphql/resolvers/index.ts` | MODIFY | Wire FreudConversation type |
| `ui/server/graphql/resolvers/mutations/freud.ts` | MODIFY | Wire Postmark dispatch, conversation emails |
| `ui/server/graphql/schema/index.js` | MODIFY | Add bucketConversations query |
| `ui/pages/[group]/[round]/[bucket]/index.tsx` | MODIFY | Add conversation indicator |
| `ui/__tests__/freud-redistribution.test.ts` | CREATE | Algorithm unit tests |
| `cypress/e2e/freud-review.cy.js` | CREATE | Review E2E tests |
| `cypress/e2e/freud-redistribution.cy.js` | CREATE | Redistribution E2E tests |
| `cypress/e2e/freud-emails.cy.js` | CREATE | Email E2E tests |
| `cypress/e2e/freud-conversations.cy.js` | CREATE | Conversations E2E tests |
| `ui/components/Freud/**/*.tsx` | MODIFY | Loading/error states, a11y, responsive |

## Verification

```bash
cd ui

# Run migration (requires running DB)
yarn migrate

# Type check
yarn typecheck

# Unit tests
npx vitest __tests__/freud-redistribution.test.ts

# E2E tests
yarn test:e2e

# Manual full walkthrough (see development-plan.md Phase 7 section)
```

## Completion Criteria

- [ ] All deferred items from Phases 1-6 addressed
- [ ] All E2E tests pass
- [ ] No console errors on any FREUD page
- [ ] Loading skeletons show on initial load
- [ ] Error states show on query failure
- [ ] Tables scroll horizontally on mobile
- [ ] Keyboard navigation works for interactive elements
- [ ] Color-coded cells have text fallbacks
- [ ] Performance acceptable for 200+ dreams
- [ ] Full manual walkthrough succeeds
- [ ] Type check passes
- [ ] Unit tests pass
- [ ] Postmark email dispatch works for batch emails and conversation notifications
