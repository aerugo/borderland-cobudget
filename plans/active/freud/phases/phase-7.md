# Phase 7: Polish & Testing

**Status**: Pending
**Started**: —
**Parent Plan**: [development-plan.md](../development-plan.md)

## Objective

Final polish pass across all FREUD features: loading/error states, responsive design, edge cases, accessibility, performance profiling, and E2E test coverage.

## Implementation Steps

### Step 7.1: Loading & Error States

Review all FREUD pages and add:
- **Loading skeletons**: Show table skeleton (gray pulsing rows) while queries load
- **Error states**: Show error message with retry button if query fails
- **Empty states**: Contextual empty state messages:
  - Dream Review: "No dreams in this round yet"
  - Redistribution: "No underfunded dreams to redistribute"
  - Emails: "No emails sent yet" (for history)
  - Conversations: "No conversations yet. Start one to reach out to dreamers."

### Step 7.2: Responsive Design

FREUD tables are data-dense and primarily desktop tools. For mobile/tablet:
- Tables should scroll horizontally (wrap in `overflow-x-auto` container)
- Budget summary panels should stack vertically on narrow screens
- Model controls should remain usable but may need compact layout
- Conversation thread should be fully responsive (messages are already linear)
- Email composer should stack vertically

### Step 7.3: Edge Case Hardening

Test and fix these scenarios:
- Round with 0 dreams → graceful empty state
- Dream with 0 budget items (goal = 0) → excluded from redistribution, shown in review
- Dream with 0 cocreators → shown in review table, cannot be selected for batch email
- Very long dream title (100+ chars) → truncate with ellipsis + tooltip
- Unicode/emoji in dream titles and comments → render correctly
- Admin who is also a cocreator → shown correctly in both roles
- Concurrent edits by two admins → last write wins (acceptable for v1)
- Session expiry during long FREUD session → redirect to login with return URL

### Step 7.4: Accessibility

- All tables must have proper `<th>` headers with `scope="col"`
- Interactive cells (tag dropdown, reviewer selector) must be keyboard-navigable
- Popovers must trap focus and close on Escape
- Color-coded cells must also have text/icon indicators (not color-only)
- Heart button must have aria-label ("Heart this dream" / "Remove heart")
- Form inputs must have labels
- Screen reader announcements for mutations (toast notifications are sufficient)

### Step 7.5: Performance Profiling

For rounds with 200+ dreams:
- Profile `dreamReviewTable` query execution time (target: <500ms)
- Profile `freudData` query execution time (target: <500ms)
- Profile client-side redistribution algorithm (target: <100ms for finish)
- Profile initial page render with all data (target: <2s TTI)
- If needed: add pagination to review table (but probably unnecessary for <500 dreams)

### Step 7.6: E2E Tests

Create Cypress tests:

**`cypress/e2e/freud-review.cy.js`**:
```javascript
describe('FREUD Dream Review', () => {
  it('should show FREUD tab for admin users', () => { ... });
  it('should hide FREUD tab for non-admin users', () => { ... });
  it('should display dream review table with correct data', () => { ... });
  it('should create and assign a tag', () => { ... });
  it('should assign a reviewer', () => { ... });
  it('should add a review comment', () => { ... });
  it('should toggle dream approval', () => { ... });
  it('should filter by tag', () => { ... });
  it('should filter by unreviewed', () => { ... });
});
```

**`cypress/e2e/freud-redistribution.cy.js`**:
```javascript
describe('FREUD Redistribution', () => {
  it('should run combo model to completion', () => { ... });
  it('should step through with loop mode', () => { ... });
  it('should reset a model', () => { ... });
  it('should heart a dream', () => { ... });
  it('should save a snapshot', () => { ... });
  it('should export CSV', () => { ... });
});
```

**`cypress/e2e/freud-emails.cy.js`**:
```javascript
describe('FREUD Batch Emails', () => {
  it('should compose and preview an email', () => { ... });
  it('should select dream recipients', () => { ... });
  it('should send batch email with confirmation', () => { ... });
  it('should show email in history after sending', () => { ... });
});
```

**`cypress/e2e/freud-conversations.cy.js`**:
```javascript
describe('FREUD Conversations', () => {
  it('should create a conversation linked to dreams', () => { ... });
  it('should allow cocreator to view and reply', () => { ... });
  it('should prevent non-participant from accessing', () => { ... });
  it('should show conversation on bucket page', () => { ... });
});
```

### Step 7.7: Visual Polish

Final visual review against Coda screenshots:
- Row coloring intensity and color choices
- Tag chip styling consistency
- Avatar sizing in table cells
- Font sizes for dense table data
- Spacing between budget summary items
- Model controls button styling
- Popover shadow and border radius
- Overall visual cohesion with existing Cobudget pages

### Step 7.8: Documentation

No external documentation files needed (per guidelines). But verify:
- All new GraphQL types/queries/mutations have descriptions in SDL
- Key components have JSDoc comments explaining their purpose
- `freud-redistribution.ts` algorithm has inline comments explaining the logic

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/components/Freud/**/*.tsx` | MODIFY | Loading states, error states, a11y |
| `ui/pages/[group]/[round]/freud/**/*.tsx` | MODIFY | Loading/error handling |
| `cypress/e2e/freud-review.cy.js` | CREATE | Review table E2E tests |
| `cypress/e2e/freud-redistribution.cy.js` | CREATE | Redistribution E2E tests |
| `cypress/e2e/freud-emails.cy.js` | CREATE | Batch email E2E tests |
| `cypress/e2e/freud-conversations.cy.js` | CREATE | Conversations E2E tests |

## Verification

```bash
cd ui

# Type check
yarn typecheck

# Unit tests
yarn test:run

# E2E tests
yarn test:e2e

# Manual full walkthrough:
# 1. Log in as admin
# 2. Navigate to FREUD for a round with 10+ dreams
# 3. Review table: create tag, assign to dream, assign reviewer, add comment, approve
# 4. Redistribution: run all 4 models, step through one, save snapshot, export CSV
# 5. Emails: compose, select dreams, preview, send
# 6. Conversations: create, reply, check cocreator access
# 7. Verify no console errors throughout
# 8. Test on mobile viewport — horizontal scroll works
# 9. Log in as regular member — verify FREUD tab is hidden
# 10. Log in as cocreator — verify conversation access works
```

## Completion Criteria

- [ ] All E2E tests pass
- [ ] No console errors on any FREUD page
- [ ] Loading skeletons show on initial load
- [ ] Error states show on query failure
- [ ] Empty states show meaningful messages
- [ ] Tables scroll horizontally on mobile
- [ ] Keyboard navigation works for interactive elements
- [ ] Color-coded cells have text/icon fallbacks
- [ ] Performance acceptable for 200+ dreams
- [ ] Full manual walkthrough succeeds
- [ ] Type check passes
- [ ] Unit tests pass
