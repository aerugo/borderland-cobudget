# Phase 4: Polish — Private Channel Affordances

**Status**: Pending
**Started**: 2026-04-10
**Parent Plan**: [../development-plan.md](../development-plan.md)

## Objective

Make the Dream Team tab feel unmistakably like a private channel (distinct from the public Comments tab), land role-branched empty state copy, add a lock icon + badge to the tab label, add a private-channel banner in the panel header, and harden the routing edge cases.

This phase is all about perceived quality — no new backend, no new data, no new mutations. The functional feature is already live after Phase 3; Phase 4 is what makes it feel finished.

## Scope

**In scope**:
1. Tab label: `Dream Team` + lock icon + `(N)` suffix when `noOfPrivateConversations > 0`.
2. Panel header banner: lock icon + "Private channel — visible only to this dream's cocreators and the Dream Team." with a link to the Comments tab.
3. Thread private styling: subtle background tint on the thread container, lock icon in the thread title header (via reinstated `privateChannel` prop on `ConversationThread`).
4. Role-branched empty state copy: "Start one to reach the Dream Team..." (cocreator) vs "Start one to reach this dream's cocreators..." (admin/mod), rendered with a centered icon + the "+ New topic" CTA inline.
5. Routing robustness: if the URL is `?tab=dreamteam` but the tab is hidden (viewer lost access, or is signed-out), fall back to the default `bucket` tab without flashing.

**Out of scope** (explicitly deferred):
- `?thread=<id>` access-denied state — already handled by `ConversationThread`'s existing "Conversation not found or you don't have access" fallback. Nothing to add.
- Loading skeletons — already done in Phase 2 (`TopicList` uses `CardListSkeleton`).
- Cache UX for last-message-preview — the Phase 1 `addConversationMessage` cache hook already invalidates `Bucket.privateConversations` on every bucket linked to the conversation, which re-runs the `TopicList` query. Verify by inspection in Step 4.6 — only add a targeted `reexecuteQuery` if it fails manual testing.
- Rich text (Remirror) — explicitly deferred by Phase 3 plan. Phase 4 keeps plain-text textarea.

## Implementation Steps

### Step 4.1: Tab label with lock icon + badge

Modify [ui/pages/[group]/[round]/[bucket]/index.tsx](../../../ui/pages/[group]/[round]/[bucket]/index.tsx):

1. Import the lock icon: `import LockOutlinedIcon from "@mui/icons-material/LockOutlined";` (matches the existing `@mui/icons-material/<Name>` per-icon pattern used in [Banner.tsx:3](../../../ui/components/Banner.tsx#L3) and [MembersTable.tsx:21](../../../ui/components/RoundMembers/MembersTable.tsx#L21)).
2. Replace the current plain-text `Dream Team` tab content with an icon + label + optional count pill:

```tsx
<Tab
  className={({ selected }) =>
    classNames(
      "block px-2 py-4 border-b-2 font-medium transition-colors",
      selected
        ? "border-anthracit text-anthracit"
        : "border-transparent text-gray-500"
    )
  }
>
  <span className="inline-flex items-center gap-1.5">
    <LockOutlinedIcon fontSize="small" />
    Dream Team
    {bucket?.noOfPrivateConversations
      ? ` (${bucket.noOfPrivateConversations})`
      : ""}
  </span>
</Tab>
```

Keep the Tab structure identical to the Comments tab — we only swap the inner content. No FormattedMessage yet (consistent with Phase 2's choice — i18n sweep can come later).

### Step 4.2: Panel header banner

Modify [ui/components/Bucket/PrivateThreadsTab/index.tsx](../../../ui/components/Bucket/PrivateThreadsTab/index.tsx):

Render a header banner **above** the list view only (not when a thread is open — the thread already has its own styling from Step 4.3). The banner should:

- Contain a small lock icon + copy: `"Private channel — visible only to this dream's cocreators and the Dream Team."`
- Optionally: a trailing muted sentence `"Public comments are in the Comments tab."` where "Comments tab" is a `<button>` that switches the tab via `router.push({ pathname, query: { ...router.query, tab: "comments", thread: undefined } })` and unsets `thread` in the query.
- Muted background: `bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-4 text-sm text-blue-900`

Only render the banner when `!threadId` (list view). When a thread is open, the thread component's own private-channel styling (Step 4.3) carries the signalling.

### Step 4.3: Thread private-channel styling — reinstate `privateChannel` prop

Modify [ui/components/Freud/Conversations/ConversationThread.tsx](../../../ui/components/Freud/Conversations/ConversationThread.tsx):

1. Add `privateChannel?: boolean` back to the props type (was removed during the simplify cleanup in Phase 3 as it was unused — now it's actually needed).
2. Apply conditional styling when `privateChannel === true`:
   - Wrap the thread body in a subtle background tint: `bg-blue-50/40` on the outer `<div>`.
   - Next to the `conv.title` `<h2>`, render a small `<LockOutlinedIcon fontSize="small" />` + a pill: `<span className="text-[10px] uppercase tracking-wide bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Private</span>`.

Pass `privateChannel` from [PrivateThreadsTab/index.tsx](../../../ui/components/Bucket/PrivateThreadsTab/index.tsx):

```tsx
<ConversationThread
  conversationId={threadId}
  onBack={clearThread}
  backLabel="Back to Dream Team"
  privateChannel
/>
```

The admin hub call site in [[conversationId].tsx](../../../ui/pages/[group]/[round]/freud/conversations/[conversationId].tsx) does **not** pass the prop — hub keeps its plain look.

### Step 4.4: Role-branched empty state copy

Modify [ui/components/Bucket/PrivateThreadsTab/TopicList.tsx](../../../ui/components/Bucket/PrivateThreadsTab/TopicList.tsx):

Add a new prop `isTeamMember: boolean` (true for admins/mods, false for cocreators). This drives the empty-state copy variant:

```tsx
type Props = {
  bucketId: string;
  canStart: boolean;
  isTeamMember: boolean;
  onOpenThread: (conversationId: string) => void;
  renderNewTopicForm: (onDone: () => void) => ReactNode;
};
```

Replace the current flat `"No conversations yet."` empty state with:

```tsx
if (conversations.length === 0) {
  return (
    <>
      {newTopicButton}
      {formBlock}
      <div className="flex flex-col items-center text-center py-10 text-gray-500">
        <LockOutlinedIcon className="text-gray-300" style={{ fontSize: 48 }} />
        <div className="mt-3 text-sm">
          No conversations yet.
        </div>
        <div className="mt-1 text-sm max-w-sm">
          {isTeamMember
            ? "Start one to reach this dream's cocreators privately."
            : "Start one to reach the Dream Team privately about this dream."}
        </div>
      </div>
    </>
  );
}
```

Note: `newTopicButton` already renders above the empty state, so the "+ New topic" CTA is visually adjacent. Good enough — no need to duplicate the button inside the empty-state block.

Thread `isTeamMember` through [PrivateThreadsTab/index.tsx](../../../ui/components/Bucket/PrivateThreadsTab/index.tsx):

- Accept a new `isTeamMember: boolean` prop on `PrivateThreadsTab`.
- Pass it to `TopicList`.

Thread it through [bucket page](../../../ui/pages/[group]/[round]/[bucket]/index.tsx):

- Reuse the already-computed `canEditBucketSelection` — it's the same predicate (`isAdmin || isModerator`). Rename the local variable to `isTeamMember` or compute both separately for clarity. **Decision**: rename to `isTeamMember` and pass it to `PrivateThreadsTab` twice (as both `canEditBucketSelection` and `isTeamMember`) — semantically they'll diverge later if we ever split team composition from picker editability, but today they're the same boolean.

### Step 4.5: Routing robustness — fall back when tab is hidden

Modify [ui/pages/[group]/[round]/[bucket]/index.tsx](../../../ui/pages/[group]/[round]/[bucket]/index.tsx) existing `useEffect` that syncs `?tab=` with `tabsList`:

Current implementation already uses `findIndex`, which returns `-1` for missing tabs and falls back to `setTab(0)`. **Verify** this handles `?tab=dreamteam&thread=<id>` when `showDreamTeamTab === false`:

- If the tab is hidden, `findIndex("dreamteam") === -1` → `setTab(0)` → user lands on the bucket tab. ✅
- But the URL still contains `?tab=dreamteam&thread=<id>`. This is fine for the tab state (the component ignores the query param), but to avoid a stale URL, normalize it: when the effect detects the fallback, push a cleaned query (drop `tab` and `thread`) with `{ shallow: true, scroll: false }`.

Add that normalization to the existing effect:

```tsx
useEffect(() => {
  const index = tabsList.findIndex((tab) => tab === router.query.tab);
  if (index > -1) {
    setTab(index);
  } else {
    setTab(0);
    // Clean stale query params if ?tab points to a hidden tab.
    if (router.query.tab || router.query.thread) {
      const { tab: _t, thread: _th, ...rest } = router.query;
      router.replace({ pathname: router.pathname, query: rest }, undefined, {
        scroll: false,
        shallow: true,
      });
    }
  }
}, [router.query.tab, tabsList]);
```

Edge case: this effect runs on every `router.query.tab` change, so a legitimate tab switch where the viewer lands on a valid tab doesn't trigger normalization. Only the "`?tab=dreamteam` but tab is hidden" path triggers it.

### Step 4.6: Verify cache UX for last-message preview

Manual check only — no code change expected.

1. Open a topic as admin. Note the timestamp/author in the row on the topic list.
2. Send a reply in the thread.
3. Click back to the topic list.
4. Verify the row shows the new `lastMsg` and updated `count`.

Expected: the Phase 1 `addConversationMessage` cache hook invalidates `Bucket.privateConversations` on every bucket linked to the conversation. When the user clicks back, the `BucketPrivateConversations` query re-runs and the row updates.

If this **doesn't** work, add a targeted `reexecuteQuery({ requestPolicy: "network-only" })` inside the thread's `handleSend` after the send succeeds — but only if manual testing shows the row is stale.

### Step 4.7: Manual verification matrix

Run `yarn dev` against mirrored prod data:

1. **Tab label visual check**: Open a dream → verify the tab shows lock icon + "Dream Team" + `(N)` (or no suffix when N=0).
2. **Panel banner visual check**: Open the tab → verify the blue banner appears above the list with lock icon and copy. Click the "Comments tab" link in the banner → verify it switches to the Comments tab and `?tab=comments` is in the URL with no `?thread=`.
3. **Thread private styling**: Open a thread inside the Dream Team tab → verify the subtle background tint and the "Private" pill next to the title.
4. **Hub thread unchanged**: Open a thread from `/freud/conversations/<id>` → verify it has **no** background tint and no "Private" pill (admin hub look is preserved).
5. **Empty state (cocreator)**: As a cocreator on a dream with no topics → verify the empty state shows "Start one to reach the Dream Team privately about this dream." + centered lock icon.
6. **Empty state (admin)**: As an admin on a dream with no topics → verify the empty state shows "Start one to reach this dream's cocreators privately.".
7. **Routing fallback**: Sign out, then navigate directly to `/<group>/<round>/<bucket>?tab=dreamteam&thread=abc` → verify the page renders the bucket tab (not a broken Dream Team tab), and the URL is cleaned to drop `tab` and `thread`.
8. **Routing normal path**: Signed in as admin, navigate to `/<group>/<round>/<bucket>?tab=dreamteam` → verify the Dream Team tab is selected and the URL is unchanged.
9. **Cache refresh after send**: Open a topic, send a reply, click back → verify the row's "last message" preview updates without a full page reload (Step 4.6 matrix).

## Edge Cases to Handle

- **Lock icon sizing**: MUI icons default to 24px which is too tall for tab text. Use `fontSize="small"` (20px) in the tab and default (24px) in the empty state / thread header.
- **Banner in thread view**: The Step 4.2 banner should not render above a thread — the thread has its own private-channel styling. Check `!threadId` before rendering the banner.
- **URL normalization race**: If the router.replace in Step 4.5 fires while another tab change is in progress, we could get a visible flash. `shallow: true` avoids a full page re-render, so it should be imperceptible. If it isn't, move the normalization into a microtask (`queueMicrotask`) — but verify first.
- **Non-team viewer on a dream they cocreate sees admin empty-state copy**: Impossible — `isTeamMember` is `false` for cocreators. They see the cocreator copy.
- **Viewer who is both an admin of the round AND a cocreator of the dream**: `isAdmin || isModerator` is `true`, so they see the admin empty-state copy ("reach cocreators"). This is semantically fine — they're wearing their admin hat on a round they manage.
- **Banner link to Comments tab**: `router.push` inside the banner click handler must use `{ scroll: false }` to avoid jumping to the top. Also drop `thread` from the query when switching.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/pages/[group]/[round]/[bucket]/index.tsx` | MODIFY | Lock icon + count on tab label; route normalization effect; pass `isTeamMember` to `PrivateThreadsTab` |
| `ui/components/Bucket/PrivateThreadsTab/index.tsx` | MODIFY | Render header banner (list view only); accept + thread `isTeamMember`; pass `privateChannel` to `ConversationThread` |
| `ui/components/Bucket/PrivateThreadsTab/TopicList.tsx` | MODIFY | Role-branched empty state copy (+ lock icon); new `isTeamMember` prop |
| `ui/components/Freud/Conversations/ConversationThread.tsx` | MODIFY | Reinstate `privateChannel?: boolean` prop; conditional background tint + "Private" pill in header |

## Verification

```bash
cd ui
yarn typecheck
yarn test:run
# then yarn dev and walk through Step 4.7 matrix
```

## Completion Criteria

- [ ] `yarn typecheck` passes (no new errors in touched files).
- [ ] `yarn test:run` passes (41/41 — no new tests in this phase).
- [ ] Dev server compiles cleanly.
- [ ] Tab label shows lock icon + count.
- [ ] Panel banner renders in list view, absent in thread view.
- [ ] Thread view has private-channel styling in the Dream Team tab; hub thread unchanged.
- [ ] Empty state copy differs for admin vs cocreator.
- [ ] Stale `?tab=dreamteam` for non-participants falls back to bucket tab and URL is cleaned.
- [ ] Last-message preview refreshes in list after sending a reply.
- [ ] Spec AC1-AC13 all verified manually (see spec.md).
