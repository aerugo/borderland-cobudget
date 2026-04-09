# Phase 4: Redistribution Engine

**Status**: Pending
**Started**: —
**Parent Plan**: [development-plan.md](../development-plan.md)

## Objective

Implement the FREUD redistribution algorithm with all 4 sorting methods, step-through (Loop) capability, 4 independent model controls, the full redistribution table with color coding, hearts, fund overrides, and CSV export.

## Implementation Steps

### Step 4.1: Redistribution Algorithm

Create `ui/utils/freud-redistribution.ts`:

This is a pure TypeScript module with no React or database dependencies. It implements:

**Types:**
```typescript
interface FreudDream {
  id: string;
  title: string;
  goal: number;
  stretch: number;
  funded: number;
  funders: number;
  override?: "model" | "manual" | "skip" | "lock";
  manualAmount?: number;
}

type SortMethod = "combo" | "funders" | "sek" | "percent";

interface RedistributionStep { ... }
interface RedistributionState { ... }
```

**Functions:**

1. **`sortDreams(dreams, method)`** — Sort underfunded dreams by the specified method:
   - `funders`: descending by funder count (most funders = highest priority)
   - `sek`: ascending by (goal - funded) — smallest gap first
   - `percent`: descending by (funded / goal) — closest to full first
   - `combo`: rank in each of the 3 sortings, sum ranks, sort ascending

2. **`initRedistribution(dreams, method)`** — Create initial state:
   - Filter to underfunded dreams (funded < goal), exclude "skip" overrides
   - Handle "lock" overrides: set funded = goal, put difference in pot (if any) or take from pot
   - Handle "manual" overrides: set to manualAmount
   - Sort remaining by method
   - Return initial `RedistributionState`

3. **`stepRedistribution(state)`** — Execute one iteration:
   - Take funding from the dream at the bottom of sorted list
   - Put it in the pot
   - Add pot money to dream at top of list (up to its goal)
   - If pot > what top dream needs, keep remainder
   - Remove fully-funded dreams from the sorted list
   - Remove defunded (0) dreams from the sorted list
   - Return new state

4. **`finishRedistribution(state)`** — Loop `stepRedistribution` until `isComplete`

5. **`getNextBucket(state)`** — Return info about next step for "Next Bucket" display

6. **`resetRedistribution(dreams, method)`** — Fresh init

**Tie-breaking**: When dreams have equal sort values, break ties alphabetically by title.

### Step 4.2: Unit Tests

Create `ui/__tests__/freud-redistribution.test.ts`:

Test cases:
- Basic redistribution with 3 dreams (one underfunded gets defunded, top gets funded)
- All 4 sort methods produce different orderings
- Combo aggregation ranks correctly
- Step-by-step matches finish result
- Skip override excludes dream from redistribution
- Lock override fixes dream at goal
- Manual override sets exact amount
- Empty input (no underfunded dreams) returns immediately
- Single dream — nothing to redistribute
- All dreams fully funded — no changes
- Dream with 0 goal — excluded
- Large dataset (200 dreams) completes in <100ms

```bash
cd ui && npx vitest __tests__/freud-redistribution.test.ts
```

### Step 4.3: Query Resolver — `freudData`

Implement in `queries/freud.ts`. Similar to `dreamReviewTable` but focused on redistribution data:
- Returns all buckets with: contributions, funders count, goals, public tags, hearts, review status
- Include `freudHearts` with member info
- Include `dreamReviews` for "Reviewed By" column

### Step 4.4: Heart Mutation — `toggleFreudHeart`

```typescript
export const toggleFreudHeart = async (_, { bucketId }, ctx) => {
  // Auth: admin/mod
  const existing = await prisma.freudHeart.findUnique({
    where: { bucketId_memberId: { bucketId, memberId: roundMember.id } },
  });
  if (existing) {
    await prisma.freudHeart.delete({ where: { id: existing.id } });
    return false; // unhearted
  } else {
    await prisma.freudHeart.create({ data: { bucketId, memberId: roundMember.id } });
    return true; // hearted
  }
};
```

### Step 4.5: Snapshot Mutations

**`saveFreudSnapshot`**: Save redistribution results as JSON
**`freudSnapshots`** query: List saved snapshots for the round

### Step 4.6: Budget Summary Component

Create `ui/components/Freud/Redistribution/BudgetSummary.tsx`:

Two-column layout:
- Left: Total budget, Total decided, Difference (with sign), Total asked for, Total asked for (stretch)
- Right: Quick info (dreams missing Final value, total missing), Funds spent info

Data sources:
- Total budget: `round.freudTotalBudget`
- Total decided: sum of all Final column values
- Difference: total budget - total decided
- Total asked for: sum of all minGoals
- Total asked for (stretch): sum of all maxGoals
- Quick info: count of dreams with no Final value set

### Step 4.7: Model Controls Table

Create `ui/components/Freud/Redistribution/ModelControlsTable.tsx` and `ModelControlRow.tsx`:

Each `ModelControlRow` manages its own `RedistributionState` via `useState`:

```tsx
const ModelControlRow = ({ method, dreams, onModelResult }) => {
  const [state, setState] = useState<RedistributionState | null>(null);
  const [loopMode, setLoopMode] = useState(false);

  const handleRun = () => {
    if (!state) {
      const initial = initRedistribution(dreams, method);
      if (loopMode) {
        setState(stepRedistribution(initial));
      } else {
        setState(finishRedistribution(initial));
      }
    } else if (loopMode) {
      setState(stepRedistribution(state));
    } else {
      setState(finishRedistribution(state));
    }
    onModelResult(method, state); // propagate to parent for M: columns
  };

  const handleReset = () => {
    setState(null);
    onModelResult(method, null);
  };

  // Render: Model name | Description | Reset | Run/Finish | Loop toggle | Next Bucket | Funded | Contributed
};
```

The `ModelControlsTable` renders 4 `ModelControlRow`s and collects their results.

### Step 4.8: Redistribution Table

Create `ui/components/Freud/Redistribution/RedistributionTable.tsx`:

Columns: Dream, Tag, Goal, Stretch, Funded, Missing, Funders, Progress, Fund, Final, M:Combo, M:Funders, M:SEK, M:Percent, Heart, Reviewed By

**Row coloring logic:**
```typescript
const getCellColor = (modelValue: number, goal: number) => {
  if (modelValue >= goal) return 'bg-green-100'; // fully funded
  if (modelValue > 0) return 'bg-yellow-50';     // partially funded
  return '';                                       // defunded (no color)
};

const getRowColor = (dream) => {
  if (dream.funded >= dream.goal) return 'bg-green-50'; // already funded
  return '';
};
```

**"Show Dreams that reached goal" toggle**: Filter state that hides/shows dreams where `funded >= goal`.

### Step 4.9: Fund Override Cell

Create `ui/components/Freud/Redistribution/FundOverrideCell.tsx`:

- Dropdown with options: model (default), manual, skip, lock
- When "manual" selected, show inline number input
- Override state is stored in parent component state (not persisted — it's session-local for modeling)
- When override changes, re-run any active models with updated overrides

### Step 4.10: Heart Button

Create `ui/components/Freud/Redistribution/HeartButton.tsx`:

- Heart icon (filled if hearted by current user, outline if not)
- Click calls `toggleFreudHeart` mutation
- Shows count badge + tooltip with names of who hearted

### Step 4.11: CSV Export

Add export button to toolbar:
```typescript
const exportCSV = () => {
  const headers = ['Dream', 'Tag', 'Goal', 'Stretch', 'Funded', 'Missing', 'Funders',
                    'Progress', 'Fund', 'Final', 'M:Combo', 'M:Funders', 'M:SEK', 'M:Percent'];
  const rows = tableData.map(row => [
    row.dream.title, row.tag, row.goal, /* ... */
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  // Trigger download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  // ... create temp link and click
};
```

### Step 4.12: Wire into Page

Update `ui/pages/[group]/[round]/freud/redistribution.tsx`:
- Query `freudData` for bucket data
- Render BudgetSummary, ModelControlsTable, toggle, RedistributionTable
- Manage model states and override states at page level

## Edge Cases to Handle

- Dream with funded > goal (overfunded) — show in green, exclude from redistribution
- Dream with goal = 0 — exclude from redistribution, show progress as "∞" or "N/A"
- All dreams funded — models produce no changes, show message
- Very long model run (200+ dreams) — should still be <1s client-side
- Loop mode with pot empty — step returns isComplete, disable Run button
- Concurrent hearts from multiple mods — optimistic UI with refetch

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/utils/freud-redistribution.ts` | CREATE | Redistribution algorithm |
| `ui/__tests__/freud-redistribution.test.ts` | CREATE | Algorithm unit tests |
| `ui/server/graphql/resolvers/queries/freud.ts` | MODIFY | Implement freudData, freudSnapshots |
| `ui/server/graphql/resolvers/mutations/freud.ts` | MODIFY | Implement heart, snapshot mutations |
| `ui/components/Freud/Redistribution/BudgetSummary.tsx` | CREATE | Budget stats panel |
| `ui/components/Freud/Redistribution/ModelControlRow.tsx` | CREATE | Single model controls |
| `ui/components/Freud/Redistribution/ModelControlsTable.tsx` | CREATE | All 4 model rows |
| `ui/components/Freud/Redistribution/RedistributionTable.tsx` | CREATE | Main results table |
| `ui/components/Freud/Redistribution/FundOverrideCell.tsx` | CREATE | Override dropdown |
| `ui/components/Freud/Redistribution/HeartButton.tsx` | CREATE | Heart toggle |
| `ui/pages/[group]/[round]/freud/redistribution.tsx` | MODIFY | Wire up all components |

## Verification

```bash
cd ui

# Run algorithm tests
npx vitest __tests__/freud-redistribution.test.ts

# Type check
yarn typecheck

# Dev server
yarn dev

# Manual:
# 1. Navigate to FREUD → Redistribution
# 2. Verify budget summary shows correct numbers
# 3. Click "Finish run" on Combo model — verify M:Combo column populates
# 4. Run all 4 models — verify all M: columns show results
# 5. Toggle Loop on for one model, click Run repeatedly — watch step by step
# 6. Reset a model — verify column clears
# 7. Set Fund override to "skip" on a dream, re-run — verify it's excluded
# 8. Heart a dream — verify persistence after page refresh
# 9. Save a snapshot — verify it appears in snapshots list
# 10. Export CSV — verify file downloads with correct data
# 11. Toggle "Show Dreams that reached goal" — verify filter works
```

## Completion Criteria

- [ ] All 4 sort methods produce correct results (verified by unit tests)
- [ ] Loop mode works step-by-step
- [ ] Finish Run completes in one click
- [ ] Reset clears model results
- [ ] All 4 models run independently and show side-by-side
- [ ] Fund overrides work correctly
- [ ] Hearts persist
- [ ] Snapshots save and load
- [ ] Row coloring matches spec
- [ ] CSV export works
- [ ] Unit tests pass
- [ ] Type check passes
