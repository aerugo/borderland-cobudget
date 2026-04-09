# Phase 6: Dream Conversations

**Status**: Complete
**Started**: 2026-04-10
**Completed**: 2026-04-10
**Parent Plan**: [development-plan.md](../development-plan.md)

## Objective

Build the private conversation system between Dream Team and dreamers. Admins/mods create conversations linked to specific dreams; all co-creators of those dreams become participants. Conversations have threaded messages with email notifications. Co-creators access conversations from their dream page or via email links.

## Deferred from Phase 1

The following items were deferred from Phase 1 and must be completed in this phase:
- **Create `types/Conversation.ts`** — type resolver for computed fields `messageCount` and `lastMessageAt` on `FreudConversation`
- **Wire `FreudConversation` type resolver** into `resolvers/index.ts` (import and add to resolver map)

Note: `ConversationMessage` and `DreamReviewTag` type resolvers are NOT needed — all their fields are direct Prisma passthroughs.

## Implementation Steps

### Step 6.1: Query Resolvers

**`conversations(roundId)`**:
```typescript
export const conversations = async (_, { roundId }, ctx) => {
  const member = await getRoundMember(ctx);

  if (member.isAdmin || member.isModerator) {
    // Admins/mods see all conversations in the round
    return prisma.conversation.findMany({
      where: { roundId },
      include: {
        buckets: true,
        createdBy: { include: { user: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  } else {
    // Co-creators only see conversations linked to their dreams
    return prisma.conversation.findMany({
      where: {
        roundId,
        buckets: {
          some: {
            cocreators: { some: { id: member.id } },
          },
        },
      },
      include: { /* same as above */ },
      orderBy: { updatedAt: 'desc' },
    });
  }
};
```

**`conversation(id)`**:
```typescript
export const conversation = async (_, { id }, ctx) => {
  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      buckets: { include: { cocreators: true } },
      createdBy: { include: { user: true } },
      messages: {
        include: { author: { include: { user: true } } },
        orderBy: { createdAt: 'asc' },
      },
      round: true,
    },
  });

  if (!conv) return null;

  // Auth: must be admin/mod OR cocreator of a linked bucket
  const member = await getRoundMember(ctx, conv.roundId);
  const isAdminMod = member?.isAdmin || member?.isModerator;
  const isCocreator = conv.buckets.some(b =>
    b.cocreators.some(cc => cc.id === member?.id)
  );

  if (!isAdminMod && !isCocreator) return null;

  return conv;
};
```

### Step 6.2: Conversation Type Resolver

Create/update `ui/server/graphql/resolvers/types/Conversation.ts`:

```typescript
export default {
  messageCount: (parent) => parent._count?.messages ?? parent.messages?.length ?? 0,
  lastMessageAt: (parent) => {
    const lastMsg = parent.messages?.[0]; // if ordered desc, take: 1
    return lastMsg?.createdAt ?? null;
  },
};
```

### Step 6.3: `createConversation` Mutation

```typescript
export const createConversation = async (_, { roundId, title, bucketIds, initialMessage }, ctx) => {
  // Auth: admin/mod only
  const member = await getAdminOrMod(ctx, roundId);

  const conversation = await prisma.conversation.create({
    data: {
      title,
      roundId,
      createdById: member.id,
      buckets: { connect: bucketIds.map(id => ({ id })) },
      messages: {
        create: {
          content: initialMessage,
          authorId: member.id,
        },
      },
    },
    include: {
      buckets: { include: { cocreators: { include: { user: true } } } },
      messages: { include: { author: { include: { user: true } } } },
    },
  });

  // Send email notification to all cocreators of linked buckets
  const recipientEmails = new Set<string>();
  conversation.buckets.forEach(bucket => {
    bucket.cocreators.forEach(cc => {
      if (cc.user?.email && cc.id !== member.id) {
        recipientEmails.add(cc.user.email);
      }
    });
  });

  // Also notify all other admins/mods
  const adminMods = await prisma.roundMember.findMany({
    where: {
      roundId,
      OR: [{ isAdmin: true }, { isModerator: true }],
      NOT: { id: member.id },
    },
    include: { user: true },
  });
  adminMods.forEach(am => {
    if (am.user?.email) recipientEmails.add(am.user.email);
  });

  // Send emails
  for (const email of recipientEmails) {
    await sendEmail({
      to: email,
      subject: `Dream Team: ${title}`,
      html: `<p>${member.user.username} started a conversation about your dream(s).</p>
             <p>${initialMessage}</p>
             <p><a href="${conversationUrl}">View and reply</a></p>`,
    });
  }

  return conversation;
};
```

### Step 6.4: `addConversationMessage` Mutation

```typescript
export const addConversationMessage = async (_, { conversationId, content }, ctx) => {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { buckets: { include: { cocreators: true } } },
  });

  // Auth: admin/mod OR cocreator of linked bucket
  const member = await getRoundMember(ctx, conv.roundId);
  const isAdminMod = member.isAdmin || member.isModerator;
  const isCocreator = conv.buckets.some(b =>
    b.cocreators.some(cc => cc.id === member.id)
  );
  if (!isAdminMod && !isCocreator) throw new Error("Not authorized");

  const message = await prisma.conversationMessage.create({
    data: { conversationId, authorId: member.id, content },
    include: { author: { include: { user: true } } },
  });

  // Update conversation updatedAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Send email to all other participants (exclude author)
  // ... similar pattern to createConversation notification

  return message;
};
```

### Step 6.5: `addBucketsToConversation` Mutation

```typescript
export const addBucketsToConversation = async (_, { conversationId, bucketIds }, ctx) => {
  // Auth: admin/mod only
  // Connect additional buckets
  // Notify new cocreators
};
```

### Step 6.6: Conversation List Component

Create `ui/components/Freud/Conversations/ConversationList.tsx`:

- Card list of conversations (not a table — conversations are more prose-like)
- Each card shows:
  - Title (bold)
  - Linked dream names (comma-separated, links to dream pages)
  - Last message excerpt + author + relative time
  - Message count badge
- Sorted by most recently updated
- "New Conversation" button at top right

### Step 6.7: Conversation Form

Create `ui/components/Freud/Conversations/ConversationForm.tsx`:

Modal or page section with:
- Title input (required)
- Dream picker (multi-select, like batch email picker but for conversations)
  - Shows dream title + cocreator count
  - "Participants will include: X co-creators + all admins/mods"
- Initial message (rich text or plain text)
- "Create Conversation" button

On submit: calls `createConversation` mutation, then navigates to the new conversation page.

### Step 6.8: Conversation Thread Component

Create `ui/components/Freud/Conversations/ConversationThread.tsx`:

For `ui/pages/[group]/[round]/freud/conversations/[conversationId].tsx`:

Layout:
- Back link: "← Back to Conversations"
- Title (h2)
- Dream links: "Dreams: Dream A · Dream B"
- Participant summary: "Lovisa, Martin (Dream Team) + 5 co-creators"
- Message stream:
  - Each message: avatar, name, role badge (admin/co-creator), timestamp, content
  - Role badge based on author's `isAdmin`/`isModerator` status
  - Messages in chronological order
- Reply input at bottom

### Step 6.9: Message Input

Create `ui/components/Freud/Conversations/MessageInput.tsx`:

- Text area (plain text is fine for v1, or use Wysiwyg for consistency)
- "Send" button
- Disable while mutation is in flight
- Clear input on successful send
- Auto-scroll to new message

### Step 6.10: Dreamer-Facing Conversation Indicator

Add to the bucket/dream page (for co-creators only):

Update `ui/pages/[group]/[round]/[bucket]/index.tsx` or the Bucket component:
- Query: check if any conversations exist linked to this bucket
- If yes, show a "Dream Team Conversation" section with:
  - Conversation title(s)
  - Last message excerpt
  - "View Conversation" link
- Only visible to cocreators of the bucket + admins/mods

This requires adding a query like:
```graphql
bucketConversations(bucketId: ID!): [Conversation!]!
```

Or use the existing `conversation` query with bucket filtering.

### Step 6.11: Wire into Pages

**Conversation list** (`freud/conversations/index.tsx`):
- Query `conversations(roundId)`
- Render ConversationList
- "New Conversation" opens ConversationForm modal

**Single conversation** (`freud/conversations/[conversationId].tsx`):
- Query `conversation(id)`
- Render ConversationThread
- Handle message submission

## Edge Cases to Handle

- Conversation with no linked buckets (shouldn't happen — require at least 1)
- Co-creator removed from dream after conversation started — they keep access (snapshot at creation? or dynamic? — go dynamic for simplicity)
- Very long message — scrollable, no truncation
- Co-creator who is also admin/mod — show admin badge, not co-creator badge
- Dream with 0 co-creators linked to conversation — conversation still exists, only admins can see
- Concurrent messages — optimistic update with refetch to catch other users' messages

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/server/graphql/resolvers/queries/freud.ts` | MODIFY | Implement conversations, conversation queries |
| `ui/server/graphql/resolvers/mutations/freud.ts` | MODIFY | Implement conversation mutations |
| `ui/server/graphql/resolvers/types/Conversation.ts` | MODIFY | messageCount, lastMessageAt |
| `ui/server/graphql/schema/index.js` | MODIFY | Add bucketConversations query if needed |
| `ui/components/Freud/Conversations/ConversationList.tsx` | CREATE | List view |
| `ui/components/Freud/Conversations/ConversationForm.tsx` | CREATE | New conversation form |
| `ui/components/Freud/Conversations/ConversationThread.tsx` | CREATE | Message thread |
| `ui/components/Freud/Conversations/MessageInput.tsx` | CREATE | Reply input |
| `ui/pages/[group]/[round]/freud/conversations/index.tsx` | MODIFY | Wire up list |
| `ui/pages/[group]/[round]/freud/conversations/[conversationId].tsx` | MODIFY | Wire up thread |
| `ui/pages/[group]/[round]/[bucket]/index.tsx` | MODIFY | Add conversation indicator for cocreators |

## Verification

```bash
cd ui
yarn typecheck
yarn dev

# Manual:
# 1. As admin: create conversation linked to 2 dreams
# 2. Verify email sent to cocreators
# 3. As cocreator: access conversation via email link
# 4. Verify cocreator can view thread and reply
# 5. Verify cocreator CANNOT see conversations for other dreams
# 6. As admin: verify reply notification email received
# 7. Verify conversation indicator shows on bucket page for cocreators
# 8. Add another dream to conversation — verify new cocreators get access
# 9. As non-member: verify cannot access conversation
```

## Completion Criteria

- [ ] Admins/mods can create conversations linked to dreams
- [ ] Initial message sent as email to all cocreators
- [ ] Cocreators can view and reply
- [ ] Cocreators cannot see other conversations
- [ ] New messages trigger email notifications
- [ ] Conversation indicator shows on bucket page
- [ ] Authorization works correctly for all roles
- [ ] Type check passes

## Deferred to Phase 7

- **Deferred from P1**: `types/Conversation.ts` type resolver — computed fields `messageCount` and `lastMessageAt` are instead computed inline in the `conversations` and `conversation` query resolvers. Works but diverges from the GraphQL type resolver pattern used elsewhere. Should be extracted if the type is queried from multiple resolver paths.
- Step 6.7: `ConversationForm.tsx` as separate component — new conversation form built inline in ConversationList instead
- Step 6.9: `MessageInput.tsx` as separate component — reply input built inline in ConversationThread
- Step 6.10: Dreamer-facing conversation indicator on bucket page (`ui/pages/[group]/[round]/[bucket]/index.tsx`)
- Step 6.10: `bucketConversations` query for bucket page
- Email notifications on conversation creation and new messages (both createConversation and addConversationMessage)
- Participant summary line in ConversationThread ("Lovisa, Martin (Dream Team) + 5 co-creators")
