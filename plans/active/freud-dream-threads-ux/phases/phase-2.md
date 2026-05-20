# Phase 2: Frontend — Tab Integration

**Status**: Implementation Complete (pending manual matrix verification)
**Started**: 2026-04-10
**Implementation Completed**: 2026-04-10
**Parent Plan**: [../development-plan.md](../development-plan.md)

## Objective

Deliver a new **"Dream Team"** tab on every dream page whose viewer is a participant (cocreator, admin, moderator, or super admin). The tab renders a viewer-scoped list of private topics for the current dream and supports opening a thread inline via `?thread=<id>`. Remove the old blue `BucketConversationIndicator` panel above the tabs. Parameterize `ConversationThread` so the new inline usage and the existing admin hub usage can both be satisfied from one component.

**Out of Phase 2 scope** — deferred to later phases:
- "+ New topic" button / `NewTopicForm` (Phase 3)
- Private-channel visual affordances (lock icon, banner, background tint, empty-state copy variants) (Phase 4)
- Tab-label lock icon + polished count badge (Phase 4)

Phase 2 is strictly about **getting the tab wired up and the list + thread flow working end-to-end**. Styling stays minimal and neutral — no lock icons, no banners, no role-branched copy yet. The new tab is labelled plainly "Dream Team (N)" and the empty state is the current plain-text placeholder.

## Implementation Steps

### Step 2.1: Extend `BUCKET_QUERY` with the 4 new fields

File: [ui/pages/[group]/[round]/[bucket]/index.tsx](../../../../ui/pages/[group]/[round]/[bucket]/index.tsx)

Add to the `bucket(id: $id) { ... }` selection set, next to `isFavorite`:

```graphql
canAccessPrivateConversations
canStartPrivateConversation
noOfPrivateConversations
```

We deliberately do **not** pull the full `privateConversations` list here — `TopicList` will run its own scoped query (see Step 2.4) so the bucket page doesn't pay for the list on every render, and so the list can be re-fetched independently after creating or replying without re-fetching the entire bucket.

### Step 2.2: Delete `BucketConversationIndicator` and its usage

1. Remove the import at line 12: `import BucketConversationIndicator from "components/Freud/BucketConversationIndicator";`
2. Remove the JSX block at lines 265-271 that renders `<BucketConversationIndicator .../>`.
3. Delete the file [ui/components/Freud/BucketConversationIndicator.tsx](../../../../ui/components/Freud/BucketConversationIndicator.tsx). Per Decision 5 in work-notes, this component has no other call sites and is replaced by the tab.

### Step 2.3: Conditionally add `"dreamteam"` to `tabsList` + render the new Tab

In the bucket page component:

1. Derive `showDreamTeamTab = !!bucket?.canAccessPrivateConversations`.
2. Make `tabsList` dynamic (not a hardcoded static array):
   ```tsx
   const tabsList = useMemo(() => {
     const list = ["bucket", "comments", "funders"];
     if (showExpensesTab) list.push("expenses");
     if (showDreamTeamTab) list.push("dreamteam");
     return list;
   }, [showExpensesTab, showDreamTeamTab]);
   ```
   **Important**: the existing code hardcodes `["bucket", "comments", "funders", "expenses"]` regardless of whether Expenses is visible — but the Expenses `<Tab>` itself is already conditionally rendered. This means the tab-index sync for Expenses is already off-by-one when Expenses is hidden. Fixing this is a pre-existing bug **out of scope** for Phase 2. We preserve the current behaviour for Expenses exactly, and only add `dreamteam` at the tail of the array when the tab is shown. The append order is `bucket | comments | funders | expenses? | dreamteam?` — so when Expenses is hidden, `dreamteam` takes index 3; when Expenses is visible, `dreamteam` takes index 4. The existing `useEffect` `findIndex` logic handles this correctly because it resolves by name, not by fixed index.
3. Add a new `<Tab>` rendered only when `showDreamTeamTab`, appended after the Expenses tab in the `<Tab.List>`, using the same `className` pattern as the other tabs. Label for Phase 2:
   ```tsx
   Dream Team{bucket?.noOfPrivateConversations ? ` (${bucket.noOfPrivateConversations})` : ""}
   ```
   No icon, no `<FormattedMessage>` — the existing FREUD surface is English-only anyway (decision rationale: consistent with the hub's copy, and Phase 4 will add the lock icon).
4. Add a new `<Tab.Panel>` rendered only when `showDreamTeamTab`, appended after the Expenses panel, containing `<PrivateThreadsTab bucket={bucket} groupSlug={...} roundSlug={...} />`.

### Step 2.4: Create `ui/components/Bucket/PrivateThreadsTab/index.tsx`

**Contract**:

```tsx
type Props = {
  bucket: {
    id: string;
    round: { id: string; slug: string; group: { slug: string } };
    canStartPrivateConversation: boolean;
  };
  groupSlug: string;
  roundSlug: string;
};
```

**Behavior**:

1. Wrap everything in the Comments-tab layout shell (Decision 11 — match Comments visually):
   ```tsx
   <div className="bg-white border-b-default">
     <div className="page grid gap-10 grid-cols-1 md:grid-cols-sidebar">
       <div>
         {/* body */}
       </div>
     </div>
   </div>
   ```
2. Read `router.query.thread` as `threadId`.
3. If `threadId` is set, render:
   ```tsx
   <ConversationThread
     conversationId={threadId}
     groupSlug={groupSlug}
     roundSlug={roundSlug}
     onBack={clearThreadParam}
     backLabel="Back to Dream Team"
   />
   ```
   where `clearThreadParam` pushes `{ ...router.query, thread: undefined }` to the router with `{ scroll: false }`.
4. Else render `<TopicList bucketId={bucket.id} onOpenThread={(id) => setThread(id)} />` where `setThread` pushes `?thread=<id>` preserving all other query params.

### Step 2.5: Create `ui/components/Bucket/PrivateThreadsTab/TopicList.tsx`

**Contract**:

```tsx
type Props = {
  bucketId: string;
  onOpenThread: (conversationId: string) => void;
};
```

**Query**:

```graphql
query BucketPrivateConversations($bucketId: ID!) {
  bucket(id: $bucketId) {
    id
    privateConversations {
      id
      title
      messageCount
      createdAt
      buckets { id title }
      createdBy {
        id
        user { id username name }
      }
      messages {
        id
        content
        createdAt
        author {
          id
          user { id username name }
        }
      }
    }
  }
}
```

This runs independently from `BUCKET_QUERY` so it can refresh on its own after mutations.

**Rendering**:

- Loading → `<CardListSkeleton count={3} />` from [`components/Freud/LoadingSkeleton`](../../../../ui/components/Freud/LoadingSkeleton.tsx) (same skeleton the hub uses — visual consistency is free).
- Empty list → plain-text placeholder: `"No conversations yet."` (role-branched copy is Phase 4).
- Non-empty → one row per topic, identical shape to the hub's list rows from [`ConversationList`](../../../../ui/components/Freud/Conversations/ConversationList.tsx). Clicking a row calls `onOpenThread(conv.id)` instead of `<Link>`-navigating.

Row copy layout (adapted from hub's [`ConversationList.tsx:202-222`](../../../../ui/components/Freud/Conversations/ConversationList.tsx#L202-L222)):

```tsx
<button
  type="button"
  key={conv.id}
  onClick={() => onOpenThread(conv.id)}
  className="block w-full text-left bg-white border rounded-lg p-4 hover:border-blue-300 transition-colors"
>
  <div className="font-medium text-sm">{conv.title}</div>
  {lastMsg && (
    <div className="text-xs text-gray-400 mt-1">
      Last message: {dayjs(lastMsg.createdAt).fromNow()} by{" "}
      {lastMsg.author?.user?.name || lastMsg.author?.user?.username}
      {" · "}
      {conv.messageCount ?? conv.messages?.length} message
      {(conv.messageCount ?? conv.messages?.length) !== 1 ? "s" : ""}
    </div>
  )}
</button>
```

No `<Link>` because we want to stay on the dream page. No `Dreams:` sub-line because every row on this list is scoped to the current dream already (the "which other dreams does this topic span" disclosure can be added in Phase 4 if useful).

**Do NOT include the "+ New topic" button yet** — that's Phase 3.

### Step 2.6: Parameterize `ConversationThread`

File: [ui/components/Freud/Conversations/ConversationThread.tsx](../../../../ui/components/Freud/Conversations/ConversationThread.tsx)

Extend the `Props` type and the component signature. The new props are all optional so the existing call site in [pages/[group]/[round]/freud/conversations/[conversationId].tsx](../../../../ui/pages/[group]/[round]/freud/conversations/[conversationId].tsx) doesn't have to change:

```tsx
export default function ConversationThread({
  conversationId,
  groupSlug,
  roundSlug,
  onBack,
  backHref,
  backLabel,
  privateChannel, // reserved for Phase 4 — accept but don't use yet
}: {
  conversationId: string;
  groupSlug: string;
  roundSlug: string;
  onBack?: () => void;
  backHref?: string;
  backLabel?: string;
  privateChannel?: boolean;
}) {
```

Replace the hard-coded back link at [lines 139-144](../../../../ui/components/Freud/Conversations/ConversationThread.tsx#L139-L144) with:

```tsx
{(onBack || backHref) && (
  onBack ? (
    <button
      type="button"
      onClick={onBack}
      className="text-sm text-blue-600 hover:underline mb-4 block"
    >
      ← {backLabel ?? "Back"}
    </button>
  ) : (
    <Link
      href={backHref!}
      className="text-sm text-blue-600 hover:underline mb-4 block"
    >
      ← {backLabel ?? "Back to Conversations"}
    </Link>
  )
)}
```

The existing call site in the admin hub page does not pass any of the new props. To preserve its current UX (it shows "← Back to Conversations" linking to `/freud/conversations`), we need to either:
- **Option A**: leave its behaviour-preserving default in the component (i.e. if neither `onBack` nor `backHref` is set, still render the old hard-coded link to `/freud/conversations`).
- **Option B**: update the hub call site to explicitly pass `backHref={`/${groupSlug}/${roundSlug}/freud/conversations`}` and `backLabel="Back to Conversations"`.

**Chosen**: Option B. The component should render *no* back link when neither is set, and the hub page explicitly passes the link. This keeps the component's behaviour explicit and avoids a hidden default tied to a specific URL shape.

Update the hub page [pages/[group]/[round]/freud/conversations/[conversationId].tsx](../../../../ui/pages/[group]/[round]/freud/conversations/[conversationId].tsx) to pass:

```tsx
<ConversationThread
  conversationId={conversationId}
  groupSlug={router.query.group as string}
  roundSlug={router.query.round as string}
  backHref={`/${router.query.group}/${router.query.round}/freud/conversations`}
  backLabel="Back to Conversations"
/>
```

### Step 2.7: Verify cache invalidation still works end-to-end

Phase 1 already wired the `Bucket.privateConversations` / `noOfPrivateConversations` invalidation on `createConversation` + `addConversationMessage`. But the new `TopicList` in Step 2.5 uses a **separate** urql query (`BucketPrivateConversations`) rather than piggy-backing on `BUCKET_QUERY`. Verify that:

- Replying to a thread (Phase 1's `addConversationMessage` hook) invalidates the `Bucket.privateConversations` field, which in turn invalidates any live query that selected it — **including the standalone `BucketPrivateConversations` query**. Urql graphcache normalizes by entity+field, so invalidating `Bucket.privateConversations` for a given bucket ID should invalidate the field on that normalized entity regardless of which query selected it.
- The `noOfPrivateConversations` invalidation should refresh the tab-label badge on `BUCKET_QUERY` after a reply.

No code change needed in Phase 2 if the above holds — it's verified manually in Step 2.8. If the TopicList query doesn't refresh, we'll either (a) add a `reexecuteQuery({ requestPolicy: "network-only" })` after the mutation in the thread's send handler, or (b) extend `TopicList` to use the same `useQuery` ref that urql has already invalidated.

### Step 2.8: Manual verification matrix

Run `yarn dev` and, against `borderland_dreams_prod` mirrored data, verify:

1. **Visibility matrix** — load a dream page as each of:
   - Admin of the round → tab visible, label shows count
   - Moderator of the round → tab visible
   - Cocreator of *this* dream → tab visible
   - Signed-in round member who is neither → tab NOT visible
   - Signed-out → tab NOT visible
2. **List & open** — click the Dream Team tab, see the list, click a topic, see the thread inline.
3. **Back** — click "← Back to Dream Team" in the thread header → lands on the list with `?tab=dreamteam` preserved, `?thread=` cleared.
4. **Deep-link** — paste `?tab=dreamteam&thread=<id>` → opens directly on the thread.
5. **Reply** — send a message → appears in the thread and the "Last message" line on the list refreshes when you navigate back. The tab label count (if any) also updates.
6. **Hub still works** — navigate to `/<group>/<round>/freud/conversations/<id>` → thread renders, "← Back to Conversations" header link present and points at `/<group>/<round>/freud/conversations`.

## Edge Cases to Handle

- **`?tab=dreamteam` when viewer has no access** — handled naturally: if `canAccessPrivateConversations` is false, the tab isn't in `tabsList`, so `useEffect`'s `findIndex` returns -1 and we default to index 0 (the "bucket" tab). No explicit guard needed. The Phase 4 task will add a normalize-on-navigation affordance, but for Phase 2 the -1 fallback is sufficient.
- **`?thread=<id>` when viewer has no access to that specific topic** — `ConversationThread`'s existing "Conversation not found or you don't have access" state handles this. No new code needed.
- **`?thread=<id>` when `?tab=` is missing** — the thread renders, but because we didn't force `tab=dreamteam`, the user would see the default "bucket" tab. This is a Phase 4 polish item. For Phase 2, deep-links are expected to include both params.
- **Bucket page loading skeleton** — if `bucket?.canAccessPrivateConversations` is read before the query resolves, `showDreamTeamTab` is `false` and the tab briefly isn't rendered. When the query resolves, the tab appears. This is the same flicker the Expenses tab has today — acceptable; no skeleton placeholder needed.
- **`router.query.thread` being an array** — Next.js types `query` values as `string | string[] | undefined`. Defensively coerce: `const threadId = Array.isArray(router.query.thread) ? router.query.thread[0] : router.query.thread`.
- **Clearing the `thread` param** — set it to `undefined` in the query object; Next.js strips `undefined` values before building the URL.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/pages/[group]/[round]/[bucket]/index.tsx` | MODIFY | Query fields, tab list, tab, panel, indicator removal |
| `ui/components/Freud/BucketConversationIndicator.tsx` | DELETE | Replaced by the tab |
| `ui/components/Bucket/PrivateThreadsTab/index.tsx` | CREATE | Tab panel container: list ↔ thread switch on `?thread=` |
| `ui/components/Bucket/PrivateThreadsTab/TopicList.tsx` | CREATE | Dream-scoped topic list |
| `ui/components/Freud/Conversations/ConversationThread.tsx` | MODIFY | Optional `onBack`/`backHref`/`backLabel`/`privateChannel` props |
| `ui/pages/[group]/[round]/freud/conversations/[conversationId].tsx` | MODIFY | Pass explicit `backHref` + `backLabel` to preserve hub UX |

## Verification

```bash
cd ui
yarn typecheck
yarn test:run
# then yarn dev and walk through Step 2.8 matrix
```

## Completion Criteria

- [ ] `yarn typecheck` passes.
- [ ] `yarn test:run` passes (41/41 — no new tests in this phase).
- [ ] Dev server compiles cleanly.
- [ ] Visibility matrix (5 viewer classes) verified manually.
- [ ] List + thread open + back + reply flow verified manually.
- [ ] Deep-link `?tab=dreamteam&thread=<id>` works.
- [ ] Admin hub `/freud/conversations/<id>` still renders with its back link.
- [ ] `BucketConversationIndicator.tsx` deleted, no remaining imports.
