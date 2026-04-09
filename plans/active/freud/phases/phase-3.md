# Phase 3: Dream Review Comments

**Status**: Pending
**Started**: —
**Parent Plan**: [development-plan.md](../development-plan.md)

## Objective

Add the internal notes/comments system to the Dream Review Table. Each dream gets a comment thread visible only to admins/mods, with @-mention notifications. Comments appear in lightweight popovers anchored to table row badges.

## Implementation Steps

### Step 3.1: Query Resolver — `dreamReviewComments`

```typescript
export const dreamReviewComments = async (_, { bucketId }, { user, ss }) => {
  // Auth: admin/mod of the bucket's round
  const bucket = await prisma.bucket.findUnique({ where: { id: bucketId } });
  // ... verify membership

  return prisma.dreamReviewComment.findMany({
    where: { bucketId },
    include: { author: { include: { user: true } } },
    orderBy: { createdAt: 'asc' },
  });
};
```

### Step 3.2: Comment Mutations

**`createDreamReviewComment`**:
```typescript
export const createDreamReviewComment = async (_, { bucketId, content }, ctx) => {
  // Auth: admin/mod
  // Create comment
  const comment = await prisma.dreamReviewComment.create({
    data: { bucketId, authorId: roundMember.id, content },
    include: { author: { include: { user: true } } },
  });
  // Parse @-mentions from content (regex: @username or @Name)
  // Send email notifications to mentioned users
  return comment;
};
```

**`editDreamReviewComment`**: Update content (author only)
**`deleteDreamReviewComment`**: Delete (author only or admin)

### Step 3.3: @-Mention Parsing

Create a simple mention parser:
```typescript
// Extract mentions from comment text
// Format: @username or @"Full Name"
function parseMentions(content: string): string[] {
  const mentionRegex = /@(\w+)|@"([^"]+)"/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1] || match[2]);
  }
  return mentions;
}
```

Resolve mentions to RoundMember IDs by matching against admin/mod usernames.

### Step 3.4: Email Notifications for Mentions

When a comment contains @-mentions:
1. Resolve mentioned usernames to User emails
2. Send notification email using existing EmailService pattern
3. Email content: "[Author] mentioned you in a review note for [Dream Name]: [comment excerpt]"
4. Link to the FREUD Dream Review page

No new EmailSettings toggle needed (per design decision #7).

### Step 3.5: Comment Count Badge

Update `DreamReviewTable.tsx`:
- Add a "Notes" column (last column or right-side badge)
- Show a numbered badge (e.g., "3" in a small colored circle) for dreams with comments
- Zero-comment dreams show no badge (clean look)
- Badge color: use round color or a neutral accent

### Step 3.6: Review Notes Popover

Create `ui/components/Freud/DreamReview/ReviewNotesPopover.tsx`:

- Triggered by clicking the comment badge on a table row
- MUI Popover or Tippy anchored to the badge element
- Width: ~350px
- Content:
  - Dream title at top (small, gray)
  - Scrollable comment list:
    - Each comment: avatar, name, timestamp (absolute: "Apr 6th, 2025 at 12:55 AM"), content
  - Input at bottom: "Reply or @ mention someone"
  - @-mention autocomplete: when user types "@", show dropdown of admin/mod usernames
  - Submit on Enter (or shift+Enter for newline if we want multiline)
- Lazy-loads comments via `dreamReviewComments` query when popover opens
- Auto-scrolls to bottom on open

### Step 3.7: @-Mention Autocomplete

In the popover input:
- Detect "@" character typed
- Show a small dropdown above/below the input with admin/mod member names
- Filter as user types after "@"
- On select, insert "@username " into the input
- Data source: admin/mod members already loaded for the reviewer dropdown (reuse from Phase 2)

Implementation options:
- Simple: use a custom hook that watches input value for "@" pattern, renders a filtered list
- No need for a full rich text editor — plain text input with overlay autocomplete is sufficient

### Step 3.8: Cache Updates

Ensure `createDreamReviewComment` cache invalidation works:
- Invalidate `dreamReviewComments` query for the specific bucketId
- Also update the `_count.dreamReviewComments` on the bucket (for badge)
- May need to invalidate the `dreamReviewTable` query to refresh comment counts

## Edge Cases to Handle

- Long comments — truncate in popover with "show more" or allow scroll
- Rapid commenting — debounce or disable submit button while mutation is in flight
- Deleted comments — if author deletes, other mentions are orphaned (acceptable)
- @-mention of non-existent username — silently ignore, no error
- Popover positioning — ensure it doesn't overflow viewport (MUI Popover handles this)

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/server/graphql/resolvers/queries/freud.ts` | MODIFY | Implement dreamReviewComments |
| `ui/server/graphql/resolvers/mutations/freud.ts` | MODIFY | Implement comment CRUD + mentions |
| `ui/components/Freud/DreamReview/ReviewNotesPopover.tsx` | CREATE | Comment popover |
| `ui/components/Freud/DreamReview/DreamReviewTable.tsx` | MODIFY | Add comment badge column |

## Verification

```bash
cd ui
yarn typecheck
yarn dev

# Manual:
# 1. Click notes badge on a dream with no comments (should show empty state)
# 2. Type a comment, submit — verify it appears
# 3. Type @username — verify autocomplete shows admin/mod names
# 4. Submit comment with @mention — verify mentioned user gets email
# 5. Edit a comment — verify update
# 6. Delete a comment — verify removal
# 7. Verify badge count updates after adding/deleting
```

## Completion Criteria

- [ ] Comments CRUD works end-to-end
- [ ] Popover opens anchored to badge, shows comment stream
- [ ] @-mention autocomplete works with admin/mod names
- [ ] Email notifications sent to mentioned users
- [ ] Badge count updates correctly
- [ ] Type check passes
