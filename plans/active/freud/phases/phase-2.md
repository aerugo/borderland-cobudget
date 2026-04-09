# Phase 2: Dream Review Table

**Status**: Pending
**Started**: —
**Parent Plan**: [development-plan.md](../development-plan.md)

## Objective

Build the full Dream Review Table with budget summary panel, tag management, reviewer assignment, filtering, and approval toggle. This is the primary daily-use tool for the Dream Team during the review period.

## Implementation Steps

### Step 2.1: Query Resolver — `dreamReviewTable`

Replace the stub in `ui/server/graphql/resolvers/queries/freud.ts`.

This is the most performance-critical query — it needs to return all bucket data for the review table in a single efficient query.

```typescript
export const dreamReviewTable = async (_, { roundId }, { user, ss }) => {
  // 1. Auth: verify admin/mod
  // 2. Query all buckets for the round with includes:
  //    - dreamReviewTags (the internal tags)
  //    - dreamReviews → reviewer → user (for reviewer avatars)
  //    - dreamReviewComments (just _count for badge)
  //    - cocreators → user (for cocreator chips)
  //    - tags (public tags — may be useful for cross-reference)
  //    - _count contributions (for noOfFunders — or use existing resolver)
  //    - budgetItems (for goal/stretch calculation)
  //
  // 3. Calculate derived fields:
  //    - totalContributions (sum of contributions)
  //    - minGoal (sum of EXPENSE budget items)
  //    - maxGoal (minGoal + sum of INCOME budget items, or if allowStretchGoals)
  //    - progress (totalContributions / minGoal)
  //    - noOfFunders (distinct contributor count)
  //
  // 4. Return as FreudBucketData array

  const buckets = await prisma.bucket.findMany({
    where: { roundId, deleted: { not: true } },
    include: {
      dreamReviewTags: true,
      dreamReviews: { include: { reviewer: { include: { user: true } } } },
      _count: { select: { dreamReviewComments: true } },
      cocreators: { include: { user: true } },
      tags: true,
      budgetItems: true,
      contributions: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return buckets.map(bucket => ({
    bucket,
    // ... map to FreudBucketData shape
  }));
};
```

**Key consideration**: The existing `Bucket` type resolver already computes `totalContributions`, `minGoal`, `maxGoal`, `noOfFunders`, `percentageFunded`. Since we're returning `bucket` as part of `FreudBucketData`, the client can access these through the nested `bucket` field. The `goal`, `stretch`, `funded`, `missing`, `funders`, `progress` fields on `FreudBucketData` provide pre-computed values for sorting/filtering efficiency.

### Step 2.2: Query Resolver — `dreamReviewTags`

```typescript
export const dreamReviewTags = async (_, { roundId }, { user, ss }) => {
  // Auth: admin/mod check
  return prisma.dreamReviewTag.findMany({
    where: { roundId },
    orderBy: { value: 'asc' },
  });
};
```

### Step 2.3: Tag Mutations

Implement in `ui/server/graphql/resolvers/mutations/freud.ts`:

**`createDreamReviewTag`**: Create a new tag for the round (admin/mod auth, unique value per round)
**`deleteDreamReviewTag`**: Delete tag and remove from all buckets (cascade disconnect)
**`addDreamReviewTag`**: Connect tag to bucket (many-to-many)
**`removeDreamReviewTag`**: Disconnect tag from bucket

### Step 2.4: Reviewer Mutations

**`addDreamReviewer`**: Create DreamReview record (bucketId + reviewerId, unique constraint)
**`removeDreamReviewer`**: Delete DreamReview record

### Step 2.5: `setFreudTotalBudget` Mutation

```typescript
export const setFreudTotalBudget = async (_, { roundId, amount }, { user, ss }) => {
  // Auth: admin/mod check
  return prisma.round.update({
    where: { id: roundId },
    data: { freudTotalBudget: amount },
  });
};
```

Add to GraphQL schema:
```graphql
setFreudTotalBudget(roundId: ID!, amount: Int): Round!
```

### Step 2.6: Budget Summary Panel Component

Create `ui/components/Freud/DreamReview/BudgetSummaryPanel.tsx`:

Displays:
- "Review TODO" button (filters to unreviewed dreams)
- "Set total budget" — editable inline field, saves via `setFreudTotalBudget`
- Total budget (from `round.freudTotalBudget`)
- Total min budget of published dreams (sum of minGoal where publishedAt is set)
- Total min budget of all dreams including drafts
- Distributed (sum of all contributions to all buckets in round)
- Budget remaining (total budget - distributed)

Data comes from the `dreamReviewTable` query results — compute these aggregates on the client from the returned bucket data.

### Step 2.7: Dream Review Table Component

Create `ui/components/Freud/DreamReview/DreamReviewTable.tsx`:

MUI Table following `MembersTable.tsx` pattern:
- `TableContainer`, `Table`, `TableHead`, `TableRow`, `TableCell`, `TableBody`
- Columns: #, Dream, Tag, Progress, Cobudget Funders, Funded, Goal, Stretch, Reviewed By, Cocreators, Notes badge, Approved toggle
- Sortable columns: click header to sort
- Default sort: by row number (creation order)

### Step 2.8: Tag Cell Component

Create `ui/components/Freud/DreamReview/DreamReviewTagCell.tsx`:

- Renders colored chips for assigned tags
- Click opens Popover (MUI Popover or Tippy) with:
  - List of all available tags with checkboxes
  - Colored chip preview per tag
  - Click to toggle assignment (calls `addDreamReviewTag` / `removeDreamReviewTag`)

### Step 2.9: Tag Manager Modal

Create `ui/components/Freud/DreamReview/DreamReviewTagManager.tsx`:

- Accessible via gear icon in filter toolbar
- Modal with:
  - List of existing tags with color swatch + delete button
  - "Add tag" form: text input + color picker
  - Creates via `createDreamReviewTag`, deletes via `deleteDreamReviewTag`

### Step 2.10: Reviewer Cell Component

Create `ui/components/Freud/DreamReview/ReviewerCell.tsx`:

- Shows avatar + name of assigned reviewer (or empty if unreviewed)
- Dropdown chevron
- Click opens dropdown with:
  - "Add me" at top (uses current user's RoundMember ID)
  - List of all admin/mod members
  - Currently assigned reviewer highlighted
  - Click to assign (calls `addDreamReviewer` / `removeDreamReviewer`)

### Step 2.11: Filter Toolbar

Create `ui/components/Freud/DreamReview/DreamReviewFilters.tsx`:

- Filter chip row above table headers
- Filters (all client-side filtering of the query results):
  - Dream name (text search)
  - Tag (multi-select of DreamReviewTags)
  - Approved (yes/no/all)
  - Reviewer (specific reviewer / unreviewed only)
  - Published (yes/no/all)
- Clear all button (✕)
- Refresh button (re-executes query)
- Search icon (toggles search input)

### Step 2.12: Approval Toggle

In the table, add an "Approved" column with a toggle/checkbox.

- Displays current `bucket.approved` state
- Click calls existing `approveBucket` mutation (already exists in the codebase)
- Optimistic update in UI

### Step 2.13: Wire into Page

Update `ui/pages/[group]/[round]/freud/index.tsx`:
- Execute `dreamReviewTable` and `dreamReviewTags` queries
- Pass data to `BudgetSummaryPanel` and `DreamReviewTable`
- Handle loading/error states

## Edge Cases to Handle

- Bucket with no budget items (goal = 0) — show 0, don't divide by zero in progress
- Bucket with no cocreators — show empty cocreator cell
- Very long dream names — truncate with ellipsis, show full on hover
- Many tags on one dream — chips should wrap or scroll horizontally
- Unreviewed filter + reviewer assignment — should update filter results after assignment

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/server/graphql/resolvers/queries/freud.ts` | MODIFY | Implement dreamReviewTable, dreamReviewTags |
| `ui/server/graphql/resolvers/mutations/freud.ts` | MODIFY | Implement tag/reviewer/budget mutations |
| `ui/server/graphql/schema/index.js` | MODIFY | Add setFreudTotalBudget mutation |
| `ui/components/Freud/DreamReview/BudgetSummaryPanel.tsx` | CREATE | Budget stats above table |
| `ui/components/Freud/DreamReview/DreamReviewTable.tsx` | CREATE | Main table component |
| `ui/components/Freud/DreamReview/DreamReviewTagCell.tsx` | CREATE | Inline tag editor |
| `ui/components/Freud/DreamReview/DreamReviewTagManager.tsx` | CREATE | Tag CRUD modal |
| `ui/components/Freud/DreamReview/ReviewerCell.tsx` | CREATE | Reviewer assignment |
| `ui/components/Freud/DreamReview/DreamReviewFilters.tsx` | CREATE | Filter toolbar |
| `ui/pages/[group]/[round]/freud/index.tsx` | MODIFY | Wire up components |

## Verification

```bash
cd ui
yarn typecheck
yarn dev

# Manual:
# 1. Navigate to FREUD → Dream Review
# 2. Verify all dreams appear with correct data
# 3. Create a tag, assign to dream, remove
# 4. Assign self as reviewer, then remove
# 5. Set total budget, verify summary updates
# 6. Toggle approval on a dream
# 7. Test filters: search, tag, unreviewed
# 8. Verify non-admin cannot access
```

## Completion Criteria

- [ ] Table loads with all dream data
- [ ] Budget summary shows correct aggregates
- [ ] Tags CRUD works end-to-end
- [ ] Reviewer assignment works
- [ ] Filters work correctly
- [ ] Approval toggle calls approveBucket
- [ ] Type check passes
- [ ] No N+1 queries (verify with query logging)
