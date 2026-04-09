# Phase 1: Foundation

**Status**: Pending
**Started**: —
**Parent Plan**: [development-plan.md](../development-plan.md)

## Objective

Set up all database models, GraphQL schema, navigation, and page shells. This phase produces no user-visible functionality beyond navigation — it creates the scaffolding that Phases 2-6 fill in independently.

## Implementation Steps

### Step 1.1: Database Schema

Modify `ui/server/prisma/schema.prisma`:

**Add to Round model:**
```prisma
freudTotalBudget Int? @map("freud_total_budget")
```

**Add new models** (in this order, after existing models):

1. `DreamReviewTag` — round-scoped internal tags for dream review
2. `DreamReview` — reviewer assignment (bucket ↔ roundMember)
3. `DreamReviewComment` — internal comment thread per bucket
4. `FreudHeart` — team approval signal per bucket
5. `FreudSnapshot` — saved redistribution model results
6. `BatchEmail` — sent email log
7. `Conversation` — conversation with linked buckets
8. `ConversationMessage` — messages in a conversation

**Add relation fields to existing models:**
- `Bucket`: add `dreamReviewTags`, `dreamReviews`, `dreamReviewComments`, `freudHearts`, `conversations` relations
- `Round`: add `freudTotalBudget`, `dreamReviewTags`, `freudSnapshots`, `batchEmails`, `conversations` relations
- `RoundMember`: add `dreamReviews`, `dreamReviewComments`, `freudHearts`, `freudSnapshots`, `batchEmailsSent`, `conversationsCreated`, `conversationMessages` relations

See spec.md §3.1 for exact field definitions.

Run migration:
```bash
cd ui && yarn migrate
```

### Step 1.2: GraphQL Schema

Add to `ui/server/graphql/schema/index.js`:

**New types** (add after existing type definitions):
- `DreamReviewTag` (id, value, color)
- `DreamReview` (id, reviewer, createdAt)
- `DreamReviewComment` (id, author, content, createdAt, updatedAt)
- `FreudHeart` (id, member)
- `FreudBucketData` (bucket, tag, goal, stretch, funded, missing, funders, progress, hearts, reviewedBy)
- `FreudSnapshot` (id, algorithm, data, createdBy, createdAt)
- `BatchEmail` (id, subject, summary, message, sentBy, recipientCount, sentAt)
- `Conversation` (id, title, buckets, messages, createdBy, messageCount, lastMessageAt, createdAt)
- `ConversationMessage` (id, author, content, createdAt)

**New queries** (add to Query type):
- `dreamReviewTable(roundId: ID!): [FreudBucketData!]!`
- `dreamReviewTags(roundId: ID!): [DreamReviewTag!]!`
- `dreamReviewComments(bucketId: ID!): [DreamReviewComment!]!`
- `freudData(roundId: ID!): [FreudBucketData!]!`
- `freudSnapshots(roundId: ID!): [FreudSnapshot!]!`
- `batchEmails(roundId: ID!): [BatchEmail!]!`
- `conversations(roundId: ID!): [Conversation!]!`
- `conversation(id: ID!): Conversation`

**New mutations** (add to Mutation type):
- All 14 mutations from spec.md §3.2

**Add to Round type:**
- `freudTotalBudget: Int`

### Step 1.3: Stub Resolvers

Create `ui/server/graphql/resolvers/queries/freud.ts`:
```typescript
// Stub resolvers — return empty arrays for now
export const dreamReviewTable = async () => [];
export const dreamReviewTags = async () => [];
export const dreamReviewComments = async () => [];
export const freudData = async () => [];
export const freudSnapshots = async () => [];
export const batchEmails = async () => [];
export const conversations = async () => [];
export const conversation = async () => null;
```

Create `ui/server/graphql/resolvers/mutations/freud.ts`:
```typescript
// Stub mutations — throw "not implemented" for now
const notImplemented = () => { throw new Error("Not implemented yet"); };

export const createDreamReviewTag = notImplemented;
export const deleteDreamReviewTag = notImplemented;
export const addDreamReviewTag = notImplemented;
export const removeDreamReviewTag = notImplemented;
export const addDreamReviewer = notImplemented;
export const removeDreamReviewer = notImplemented;
export const createDreamReviewComment = notImplemented;
export const editDreamReviewComment = notImplemented;
export const deleteDreamReviewComment = notImplemented;
export const toggleFreudHeart = notImplemented;
export const saveFreudSnapshot = notImplemented;
export const sendBatchEmail = notImplemented;
export const createConversation = notImplemented;
export const addConversationMessage = notImplemented;
export const addBucketsToConversation = notImplemented;
export const setFreudTotalBudget = notImplemented;
```

Create type resolvers as needed (e.g., `types/Conversation.ts` for computed fields like `messageCount`, `lastMessageAt`).

### Step 1.4: Wire Resolvers

Update `ui/server/graphql/resolvers/queries/index.ts`:
```typescript
export * as freudQueries from "./freud";
```

Update `ui/server/graphql/resolvers/mutations/index.ts`:
```typescript
export * as freudMutations from "./freud";
```

Update `ui/server/graphql/resolvers/index.ts`:
- Import `freudQueries` and `freudMutations`
- Spread into `Query` and `Mutation` objects
- Import and add any new type resolvers (Conversation, ConversationMessage, DreamReviewTag)

### Step 1.5: Add `freudTotalBudget` to Round Resolver

Update `ui/server/graphql/resolvers/types/Round.ts`:
- Add `freudTotalBudget` field resolver (direct passthrough from Prisma)

### Step 1.6: Navigation — SubMenu

Update `ui/components/SubMenu.tsx`:

In the `roundItems` function, add FREUD tab after Budget Items:
```typescript
{
  label: formatMessage({ defaultMessage: "FREUD" }),
  href: `/${groupSlug}/${roundSlug}/freud`,
  startsWithHref: true,
  admin: true, // reuse existing admin/mod gating pattern
},
```

Note: The existing `admin` flag filters by `isAdmin` only. We need to also allow `isModerator`. Check the filter logic at the bottom of `roundItems` — it currently filters `(i.admin ? isAdmin : true)`. We may need to change this to also check `isModerator` for the FREUD tab, or add a `mod` flag. Evaluate the best approach when implementing.

### Step 1.7: FreudLayout Component

Create `ui/components/Freud/FreudLayout.tsx`:
- Accept `children`, `currentUser`, `round` props
- Gate: if user is not admin/mod, redirect or show nothing
- Render sub-tab navigation:
  - Dream Review → `/[group]/[round]/freud`
  - Redistribution → `/[group]/[round]/freud/redistribution`
  - Emails → `/[group]/[round]/freud/emails`
  - Conversations → `/[group]/[round]/freud/conversations`
- Highlight active tab based on `router.asPath`
- Render `{children}` below tabs

Follow the styling pattern from SubMenu (border-bottom active indicator, Tailwind classes).

### Step 1.8: Page Shells

Create 5 page files:

**`ui/pages/[group]/[round]/freud/index.tsx`**:
```tsx
const FreudReviewPage = ({ round, currentUser, currentGroup }) => {
  const isAdminOrMod = currentUser?.currentCollMember?.isAdmin ||
                        currentUser?.currentCollMember?.isModerator;
  if (!isAdminOrMod || !round) return null;

  return (
    <div className="flex-1">
      <SubMenu currentUser={currentUser} round={round} />
      <FreudLayout currentUser={currentUser} round={round}>
        <div className="p-4">Dream Review Table (coming in Phase 2)</div>
      </FreudLayout>
    </div>
  );
};
```

Same pattern for:
- `freud/redistribution.tsx`
- `freud/emails.tsx`
- `freud/conversations/index.tsx`
- `freud/conversations/[conversationId].tsx`

### Step 1.9: Cache Invalidation

Update `ui/graphql/client.ts`:

Add to the `updates.Mutation` section in the cache exchange config:
```typescript
createDreamReviewTag: invalidateRound,
deleteDreamReviewTag: invalidateRound,
addDreamReviewTag: invalidateBucket,
removeDreamReviewTag: invalidateBucket,
addDreamReviewer: invalidateBucket,
removeDreamReviewer: invalidateBucket,
toggleFreudHeart: invalidateBucket,
saveFreudSnapshot: invalidateRound,
sendBatchEmail: invalidateRound,
createConversation: invalidateRound,
setFreudTotalBudget: invalidateRound,
```

For comment and conversation message mutations, invalidate the specific query:
```typescript
createDreamReviewComment: (_result, _args, cache) => {
  cache.invalidate("Query", "dreamReviewComments");
},
addConversationMessage: (_result, args, cache) => {
  cache.invalidate({ __typename: "Conversation", id: args.conversationId });
},
```

## Edge Cases to Handle

- Round with no buckets (empty FREUD pages should show helpful empty state)
- User who is group admin but not round admin/mod (should still have access per existing `isCollOrGroupAdmin` pattern — verify)
- Navigation between FREUD sub-tabs should preserve scroll position

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/server/prisma/schema.prisma` | MODIFY | Add 7 models + freudTotalBudget + relations |
| `ui/server/graphql/schema/index.js` | MODIFY | Add types, queries, mutations |
| `ui/server/graphql/resolvers/queries/freud.ts` | CREATE | Stub query resolvers |
| `ui/server/graphql/resolvers/mutations/freud.ts` | CREATE | Stub mutation resolvers |
| `ui/server/graphql/resolvers/queries/index.ts` | MODIFY | Export freud queries |
| `ui/server/graphql/resolvers/mutations/index.ts` | MODIFY | Export freud mutations |
| `ui/server/graphql/resolvers/index.ts` | MODIFY | Wire freud resolvers |
| `ui/server/graphql/resolvers/types/Round.ts` | MODIFY | Add freudTotalBudget |
| `ui/server/graphql/resolvers/types/Conversation.ts` | CREATE | Computed fields |
| `ui/server/graphql/resolvers/types/ConversationMessage.ts` | CREATE | Type resolver |
| `ui/server/graphql/resolvers/types/DreamReviewTag.ts` | CREATE | Type resolver |
| `ui/components/SubMenu.tsx` | MODIFY | Add FREUD tab |
| `ui/components/Freud/FreudLayout.tsx` | CREATE | Sub-tab layout |
| `ui/pages/[group]/[round]/freud/index.tsx` | CREATE | Dream Review page shell |
| `ui/pages/[group]/[round]/freud/redistribution.tsx` | CREATE | Redistribution page shell |
| `ui/pages/[group]/[round]/freud/emails.tsx` | CREATE | Emails page shell |
| `ui/pages/[group]/[round]/freud/conversations/index.tsx` | CREATE | Conversation list shell |
| `ui/pages/[group]/[round]/freud/conversations/[conversationId].tsx` | CREATE | Single conversation shell |
| `ui/graphql/client.ts` | MODIFY | Cache invalidation rules |

## Verification

```bash
cd ui

# Run migration
yarn migrate

# Type check
yarn typecheck

# Start dev server
yarn dev

# Manual verification:
# 1. Log in as admin/mod user
# 2. Navigate to a round
# 3. Verify FREUD tab appears in SubMenu
# 4. Click through all sub-tabs
# 5. Verify non-admin user does NOT see FREUD tab
```

## Completion Criteria

- [ ] Migration runs without errors
- [ ] Dev server starts without errors
- [ ] Type check passes
- [ ] FREUD tab visible only to admin/mod users
- [ ] All 4 sub-tabs navigate correctly
- [ ] GraphQL playground shows all new types/queries/mutations
- [ ] No regressions in existing functionality
