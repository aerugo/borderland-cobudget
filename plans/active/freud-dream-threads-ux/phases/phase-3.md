# Phase 3: Frontend — New Topic From Dream Context

**Status**: Implementation Complete (manual verification pending)
**Started**: 2026-04-10
**Parent Plan**: [../development-plan.md](../development-plan.md)

## Objective

Let both cocreators and admins/mods start a new private topic directly from the Dream Team tab on a dream, with the current dream pre-selected. Two role variants of the same form component:

- **Admin/mod**: dream picker is editable. Current dream pre-selected, other dreams in the round can be added/removed. Mirrors the hub `ConversationList` picker.
- **Cocreator**: dream is locked to the current dream (rendered as a read-only chip, no picker). First-release simplification per Decision 8 in work-notes — multi-own-dream topics can be added in a follow-up if demand emerges.

**Out of Phase 3 scope** — deferred to Phase 4:
- Role-branched empty-state copy ("No conversations yet. Start one to reach the Dream Team privately...") — Phase 3 keeps the neutral `"No conversations yet."`.
- Lock icon / "Private channel" banner on the form.
- Rich text compose (Remirror) — Phase 3 keeps plain-text textarea, same as the hub.

## Implementation Steps

### Step 3.1: Create `ui/components/Bucket/PrivateThreadsTab/NewTopicForm.tsx`

**Contract**:

```tsx
type Props = {
  roundId: string;
  bucket: {
    id: string;
    title: string;
  };
  canEditBucketSelection: boolean;
  onCreated: (conversationId: string) => void;
  onCancel: () => void;
};
```

**Behavior**:

1. Local state: `title`, `message`, `selectedBucketIds: Set<string>` pre-populated with `new Set([bucket.id])`.
2. Execute the same `CREATE_CONVERSATION` mutation the hub uses — import it from `components/Freud/Conversations/ConversationList` or re-declare it inline. Decision: **re-declare inline** in `NewTopicForm.tsx` to keep the component self-contained and avoid coupling to the hub's file. The selection set must include `buckets { id }` for Phase 1's cache invalidation to work.
3. Fields:
   - Title `<input>` (plain text).
   - Dreams section:
     - If `canEditBucketSelection === true`: fetch `dreamReviewTable(roundId: $roundId)` via the existing `BUCKETS_QUERY` shape (re-declared inline), render the same checkbox list as [`ConversationList.tsx:150-171`](../../../../ui/components/Freud/Conversations/ConversationList.tsx#L150-L171) with the current bucket pre-checked.
     - If `canEditBucketSelection === false`: render a static read-only chip showing `bucket.title`. No query, no `dreamReviewTable` fetch — cocreators would get `null` from that query anyway (it's admin-scoped), and we don't need the data.
   - Initial message `<textarea>` (plain text, rows=4).
4. "Create" button disabled unless `title.trim() && message.trim() && selectedBucketIds.size > 0`.
5. "Cancel" button calls `onCancel`.
6. On successful mutation (`!result.error`):
   - `toast.success("Conversation created")`.
   - Call `onCreated(result.data.createConversation.id)`.
7. On error: `toast.error(result.error.message)`.

### Step 3.2: Update `TopicList.tsx` with a "+ New topic" toggle

Add two new props:

```tsx
type Props = {
  bucketId: string;
  canStart: boolean;
  onOpenThread: (conversationId: string) => void;
  renderNewTopicForm: () => React.ReactNode;
};
```

Or more ergonomically, accept a `canStart` boolean and a child-render function:

**Chosen shape**: extend `TopicList` to accept `canStart: boolean` + `renderNewTopicForm: (onDone: () => void) => ReactNode`. `TopicList` owns the `showForm` toggle state and the "+ New topic" button; parent provides the form element. This keeps `TopicList` independent of the mutation layer and lets `PrivateThreadsTab` decide whether to render the admin or cocreator variant.

Behavior changes:

1. If `canStart`, render a `+ New topic` button at the top of the list (above the rows, below no header since there's no header in Phase 3). Button toggles `showForm`.
2. If `showForm`, render `renderNewTopicForm(() => setShowForm(false))`.
3. Empty state + row rendering unchanged.

### Step 3.3: Wire `PrivateThreadsTab/index.tsx` to pass form down

Extend Props:

```tsx
type Props = {
  bucket: {
    id: string;
    title: string;
    round: { id: string };
    canStartPrivateConversation: boolean;
  };
  groupSlug: string;
  roundSlug: string;
  canEditBucketSelection: boolean;
};
```

Pass `canStart={bucket.canStartPrivateConversation}` to `TopicList`. Provide `renderNewTopicForm` that instantiates `NewTopicForm` with `roundId`, `bucket`, `canEditBucketSelection`, `onCreated={(id) => { closeForm(); setThread(id); }}`, and `onCancel={closeForm}`.

### Step 3.4: Thread `canEditBucketSelection` + bucket fields through the bucket page

In [ui/pages/[group]/[round]/[bucket]/index.tsx](../../../../ui/pages/[group]/[round]/[bucket]/index.tsx):

1. Add `round { id title }` selection on the bucket (NOTE: `round.id` is already selected; just verify). `title` is for the cocreator read-only chip — no, wait, we're rendering `bucket.title` not `round.title`. `bucket.title` is already in `BUCKET_QUERY`.
2. Compute `canEditBucketSelection = !!(currentUser?.currentCollMember?.isAdmin || currentUser?.currentCollMember?.isModerator)`.
3. Pass `canEditBucketSelection` to `<PrivateThreadsTab>`.

### Step 3.5: Extend bucket query fields

Phase 2's `BUCKET_QUERY` already selects `id`, `title`, `round { id }`, `canAccessPrivateConversations`, `canStartPrivateConversation`, `noOfPrivateConversations`. No additions needed for Phase 3 — the form's dream-picker query (`dreamReviewTable`) is fetched inside `NewTopicForm` independently.

### Step 3.6: Verify cache invalidation end-to-end

Phase 1 already set up `createConversation` to invalidate `Bucket.privateConversations` + `Bucket.noOfPrivateConversations` for every bucket in the mutation result. Verify:

- After creating a topic from Phase 3's form, the `TopicList` query (`BucketPrivateConversations`) refreshes to include the new row.
- The tab label badge `(N)` updates from `(0)` to `(1)`.
- The newly created thread opens inline via the `onCreated` → `setThread` flow.

No code change expected — it's verified manually in Step 3.7.

### Step 3.7: Manual verification matrix

Run `yarn dev` against mirrored prod data:

1. **Admin happy path**: Open a dream as a round admin → Dream Team tab → click "+ New topic" → form opens with editable dream picker, current dream pre-checked → fill title + message → Create → form closes, new thread opens inline, tab badge increments.
2. **Admin picks multiple dreams**: Same as above but check a second dream → Create → the new topic appears on both dreams' Dream Team tabs.
3. **Admin cancels form**: Open form → Cancel → form closes, list unchanged.
4. **Cocreator happy path**: Open a dream as one of its cocreators → Dream Team tab → "+ New topic" → form opens with dream rendered as a locked chip (no picker) → fill title + message → Create → new thread opens inline.
5. **Cocreator tries to link other dreams**: impossible by UI (no picker). Backend gate still enforces it, but there's no way to exercise that path through Phase 3's UI.
6. **Validation**: empty title / empty message / (admin only) zero selected dreams → Create button is disabled.
7. **Error path**: If the backend rejects (e.g. bucket is in a different round — shouldn't happen through the UI), `toast.error` fires and the form stays open with state intact.

## Edge Cases to Handle

- **`dreamReviewTable` returns empty for cocreators** — cocreators don't fetch it at all (guarded by `canEditBucketSelection`). Safe.
- **Admin deselects the current dream** — allowed. The form remains valid as long as at least one dream is selected. The new topic won't appear on the *current* dream's list after creation (because it's no longer linked), but the `onCreated` → `setThread` flow still tries to open it inline. The thread query will succeed (admin has access via `isAdmin`), but the user will see a thread linked to a different dream. Acceptable — this is an admin power-user action and they explicitly deselected. No guard needed.
- **Cocreator is also a round admin** — they get `canEditBucketSelection=true` (admin wins), so they see the picker. Matches the admin flow. Correct — admin-role wins over cocreator-role for UI decisions, per the existing pattern.
- **Form state preservation on role change** — impossible in a single page lifetime. Not a concern.
- **Concurrent create + type-ahead** — creating the topic closes the form and resets state. Concurrent typing is lost. Acceptable (same as hub).

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/components/Bucket/PrivateThreadsTab/NewTopicForm.tsx` | CREATE | The inline form with admin/cocreator variants |
| `ui/components/Bucket/PrivateThreadsTab/TopicList.tsx` | MODIFY | Accept `canStart` + `renderNewTopicForm` props, toggle form |
| `ui/components/Bucket/PrivateThreadsTab/index.tsx` | MODIFY | Pass form down; accept `canEditBucketSelection` prop |
| `ui/pages/[group]/[round]/[bucket]/index.tsx` | MODIFY | Compute and pass `canEditBucketSelection` |

## Verification

```bash
cd ui
yarn typecheck
yarn test:run
# then yarn dev and walk through Step 3.7 matrix
```

## Completion Criteria

- [ ] `yarn typecheck` passes (no new errors in touched files).
- [ ] `yarn test:run` passes (41/41 — no new tests in this phase).
- [ ] Dev server compiles cleanly.
- [ ] Admin happy path verified manually.
- [ ] Cocreator happy path verified manually.
- [ ] "+ New topic" button visibility matches `canStartPrivateConversation`.
- [ ] Dream picker editability matches `canEditBucketSelection` (admin editable, cocreator locked).
- [ ] Tab badge increments after successful create.
- [ ] New thread opens inline after successful create.
