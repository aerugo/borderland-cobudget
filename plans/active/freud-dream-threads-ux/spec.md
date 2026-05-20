# Feature: Dream-scoped Private Thread Tab

**Status**: Draft
**Created**: 2026-04-10
**Parent feature**: [FREUD](../freud/spec.md)

## Goal

Give dream co-creators a first-class, symmetrical channel to talk privately with the Dream Team about their dream, accessible directly from the dream page — including the ability to **start** a conversation, not just read and reply. Admins/mods keep their existing hub-level workflow intact.

## Background

FREUD already ships private conversations between the Dream Team (round admins/moderators) and dream co-creators. Today:

- Admins/mods manage conversations from the FREUD admin hub at `/[group]/[round]/freud/conversations` (list + thread). **Only admins/mods can create a topic.**
- On the public dream page, co-creators see a blue [`BucketConversationIndicator`](../../../ui/components/Freud/BucketConversationIndicator.tsx) panel **above** the tabs that links out to the admin thread route. The resolver already allows co-creators to view threads linked to their own dream, but the entry-point is cramped, doesn't feel like part of the dream, and sits in an unexpected location above the main content.
- Co-creators have **no way to reply or read threads inline** with the dream they care about. They have to leave the dream and land in the admin-looking FREUD area.
- Co-creators have **no way to proactively reach out** to the Dream Team from within Cobudget at all. A cocreator who has a question today has no formal channel — they have to find a Dream Team member off-platform.

Conversations are already many-to-many with buckets (`Conversation ⇄ Bucket` via `_ConversationBuckets`), so the same topic can legitimately appear on multiple dream pages.

We want the dream page to surface these private threads as a dedicated, clearly-labelled "private channel" tab that sits next to the public Comments tab. The tab is symmetrical: both cocreators and the Dream Team can start topics, read topics, and reply. Admins/mods keep their hub for the round-wide overview.

## Acceptance Criteria

- [ ] AC1: The dream detail page has a new tab (label: "Dream Team" with a lock icon) that appears in the existing tab bar next to Comments.
- [ ] AC2: The tab is shown to every **participant** of the dream:
  - Round admins / moderators (always).
  - Dream co-creators of this specific dream (always, regardless of topic count).
  - Super admin sessions (always).
  - Never to signed-out users, non-cocreator round members, or other dreamers.
- [ ] AC3: The tab badge shows the count of private topics visible to the viewer (e.g. "Dream Team (3)"). When the count is 0, the tab renders without a numeric badge.
- [ ] AC4: Selecting the tab shows a list of topics linked to this dream (topic title, last message snippet, last-message time, participant summary) — visually identical in structure to the existing [`ConversationList`](../../../ui/components/Freud/Conversations/ConversationList.tsx) but scoped to this dream.
- [ ] AC5: Selecting a topic opens the full thread **inline in the tab** (no full-page navigation), reusing the same thread UI the admin hub uses. Browser back/forward and shareable URLs work via a `?tab=dreamteam&thread=<id>` query param pattern.
- [ ] AC6: The thread view visually communicates this is a private channel (lock icon in header, muted background tint, explanatory line: "Private channel — visible only to this dream's cocreators and the Dream Team. Public comments are in the Comments tab."). Functionally it behaves exactly like the admin hub thread: same compose box, same "Dream Team" badge next to admin/mod messages, same mentions behaviour.
- [ ] AC7: **Both cocreators and admins/mods can create a new topic from within the tab.** The new-topic form pre-selects the current dream.
  - For **admins/mods**, the dream selector is editable and they can add more dreams if the topic spans several dreams.
  - For **cocreators**, the topic is scoped to this dream only — they cannot link the topic to other dreams they do not cocreate. The dream selector is either hidden or locked to the current dream.
- [ ] AC8: When a cocreator starts a topic, the `createConversation` mutation enforces that every bucket in `bucketIds` is one the caller cocreates (multi-dream cocreator topics are allowed iff the cocreator is a cocreator of all selected dreams). Non-participants cannot create topics regardless of what the UI allows.
- [ ] AC9: When a topic spans multiple dreams, opening it from dream A shows the same canonical conversation that appears on dream B — message history is shared.
- [ ] AC10: The old [`BucketConversationIndicator`](../../../ui/components/Freud/BucketConversationIndicator.tsx) panel above the tabs is removed.
- [ ] AC11: Admin/mod hub at `/[group]/[round]/freud/conversations` still works and is unchanged. It continues to list all round-wide topics.
- [ ] AC12: Sending a new message / creating a new topic updates the tab badge and list without a full page reload.
- [ ] AC13: Empty state: when the list is empty, the panel shows a friendly "No conversations yet" message plus a prominent "+ New topic" button. Copy differs slightly for cocreator vs admin/mod (see Design Decisions in the dev plan).

## Technical Requirements

### Database Changes

None. The existing `Conversation ⇄ Bucket` many-to-many relation and `ConversationMessage` model already support all needed data. No migration.

### GraphQL Changes

**New fields on `Bucket` type** (in [ui/server/graphql/schema/index.js](../../../ui/server/graphql/schema/index.js) Bucket type):

```graphql
# Viewer-scoped. Empty when the viewer has no access.
privateConversations: [FreudConversation!]!
# Count of the above. Convenient for the tab badge without reloading the bucket query.
noOfPrivateConversations: Int!
# Whether the viewer has access to the private channel on this dream at all
# (i.e. is an admin/mod of the round, a cocreator of this bucket, or a super admin).
# Drives tab visibility on the dream page.
canAccessPrivateConversations: Boolean!
# Whether the viewer can start a new private topic on this dream.
# True for admins/mods (of any dream) and for cocreators of THIS dream.
# Drives the "+ New topic" button visibility.
canStartPrivateConversation: Boolean!
```

**New type resolver** entries on `Bucket` (colocated with the existing Bucket type resolvers in `ui/server/graphql/resolvers/types/`):

- `privateConversations(bucket, _, ctx)`: Delegates to the same scoping logic as the existing [`bucketConversations`](../../../ui/server/graphql/resolvers/queries/freud.ts) query. **Extract the existing scoping to a shared helper** (`getViewerScopedBucketConversations(bucketId, ctx)`) and have both the query and the field resolver call it, so we do not duplicate the auth/scoping rules.
- `noOfPrivateConversations`: Count version of the same.
- `canAccessPrivateConversations`: `true` iff viewer is round admin/mod, cocreator of this bucket, or super admin session.
- `canStartPrivateConversation`: identical to `canAccessPrivateConversations` in practice (any participant can start a topic) — kept as a separate field for semantic clarity and future-proofing if we ever want to restrict topic-starting (e.g. during a freeze period) without losing read access.

**Mutation change**: `createConversation` in [ui/server/graphql/resolvers/mutations/freud.ts](../../../ui/server/graphql/resolvers/mutations/freud.ts) currently gates on `assertAdminOrMod(roundId, user.id, ss)`. **Relax this** to: "viewer must be admin/mod OR must be a cocreator of **every** bucket in `bucketIds`". Super admin sessions bypass both checks. No other mutations change.

**Existing `bucketConversations` query**: keep for backwards compatibility (the admin hub may still use it indirectly) — but ideally switch call sites to the new Bucket field.

### UI Changes

**New pages**: None.

**New components**:

| File | Purpose |
|------|---------|
| `ui/components/Bucket/PrivateThreadsTab/index.tsx` | Tab panel container. Decides between showing the list view or the thread view based on `?thread=<id>` query param. Handles the private-channel header/banner. |
| `ui/components/Bucket/PrivateThreadsTab/TopicList.tsx` | List of topics scoped to this dream. Thin wrapper that renders one row per topic and a "+ New topic" button (admin/mod only). |
| `ui/components/Bucket/PrivateThreadsTab/NewTopicForm.tsx` | Inline new-topic form for admin/mod. Pre-selects current dream. Adapted from the form inside [`ConversationList`](../../../ui/components/Freud/Conversations/ConversationList.tsx). |

**Component reuse**: The existing [`ConversationThread`](../../../ui/components/Freud/Conversations/ConversationThread.tsx) should be reused as-is for the thread body, but we need to make its "← Back to Conversations" link configurable — either accept a `backHref` prop, a `onBack` callback, or a `backLabel`. When used inside the bucket tab, back should clear the `?thread=` query param (stay on the tab), not navigate to the admin hub.

**Modified components**:

| File | Change |
|------|--------|
| [`ui/pages/[group]/[round]/[bucket]/index.tsx`](../../../ui/pages/[group]/[round]/[bucket]/index.tsx) | Extend `BUCKET_QUERY` to fetch `noOfPrivateConversations` and `canStartPrivateConversation`. Remove `BucketConversationIndicator` render. Add "messages" to `tabsList`. Conditionally render a new `<Tab>` + `<Tab.Panel>` when `noOfPrivateConversations > 0 || canStartPrivateConversation`. Panel contents: `<PrivateThreadsTab bucketId={bucket.id} roundSlug={...} groupSlug={...} currentUser={currentUser} canStart={bucket.canStartPrivateConversation} />`. |
| [`ui/components/Freud/Conversations/ConversationThread.tsx`](../../../ui/components/Freud/Conversations/ConversationThread.tsx) | Add optional `backHref`, `backLabel`, `onBack`, `privateChannel` props. When `privateChannel` is true, render the lock icon and muted styling. Default behaviour unchanged for the admin hub. |
| [`ui/components/Freud/BucketConversationIndicator.tsx`](../../../ui/components/Freud/BucketConversationIndicator.tsx) | **Deleted.** No longer referenced. |

### Cache Invalidation

Update [`ui/graphql/client.ts`](../../../ui/graphql/client.ts) so that `createConversation` and `addConversationMessage` updates invalidate the new `Bucket.privateConversations` / `noOfPrivateConversations` fields on every bucket they touch (iterate the `bucketIds` / bucket relation in the mutation result). The existing `bucketConversations(bucketId)` query invalidation should continue to work unchanged.

## Dependencies

- FREUD Phases 1-6 (data model + conversations backend + admin hub UI) must be in place. They are.
- No external services.

## Out of Scope

- **Unread-message tracking / badges.** Per-user read state on conversations is not modelled yet. Tab badge shows total topic count, not unread. A follow-up feature can add `ConversationRead` tracking.
- **Email notifications to co-creators when a message is posted.** The existing @-mention flow stays. Broader notification design is deferred.
- **Redesign of the admin FREUD conversations hub.** Hub remains at `/freud/conversations` unchanged.
- **Discourse mirror.** Private threads stay in-app only.
- **Reordering existing tabs** (Comments, Funders, Expenses). We only add one tab.
- **Mobile-specific tab scroll polish** beyond what already exists on the bucket page tab bar.
- **Image attachments or rich text** inside the reply box. Plain text parity with current `ConversationThread`.

## Security & Authorization

- **Read access** (`privateConversations`, `noOfPrivateConversations`, `canAccessPrivateConversations`): viewer is admin/mod of the round, OR viewer is a cocreator of this specific bucket, OR viewer is super admin session. Anyone else sees empty / `false`.
- **Create access** (`canStartPrivateConversation` field + `createConversation` mutation server-side check): viewer must be admin/mod of the round, OR must be a cocreator of **every** bucket listed in `bucketIds`, OR super admin session. This means:
  - An admin/mod can create a multi-dream topic across any set of dreams.
  - A cocreator can create a topic on their own dream(s). If they cocreate multiple dreams, they can start a topic that spans those dreams. They cannot drag in dreams they do not cocreate.
  - A random round member who is not an admin/mod and not a cocreator of any listed bucket is rejected (401/403-equivalent GraphQL error).
- The UI enforcement is advisory: the backend mutation is the authoritative gate. The `NewTopicForm` is only rendered client-side when `canStartPrivateConversation` is true, but the mutation re-verifies regardless.
- When a topic spans multiple dreams, the viewer only sees it via a dream they are a cocreator of (or if they are admin/mod). A cocreator of dream A viewing dream A's tab does **not** gain access to dream B's tab on dream B's page unless they are also a cocreator of dream B. The existing many-to-many scoping preserves this naturally because the field is resolved per-bucket.
- Privacy line shown in the banner is user-facing reassurance, not enforcement.
- **Notification on cocreator-initiated topic**: The existing `createConversation` notification code already emails "cocreators of linked dreams + other admins/mods of the round, minus the sender". This already produces the right behaviour when the sender is a cocreator (round admins/mods + other cocreators of this dream get notified). No mutation change needed to the notification path.

## Open Questions

- [x] Q1: Tab label — **"Dream Team"** (decided 2026-04-10). Matches the existing in-app vocabulary (the same badge admins/mods already wear on their messages). Privacy is signalled by the lock icon, the panel banner, and the visual treatment rather than the label.
- [x] Q2: Empty states and cocreator-initiated topics — **Symmetrical channel** (decided 2026-04-10). Both cocreators and admins/mods always see the tab when they are participants of the dream. Both can start topics. Both see an empty state with a "+ New topic" button when the list is empty. This is a scope expansion: the `createConversation` mutation must be relaxed to allow cocreator-of-bucket authorization, and `canStartPrivateConversation` now covers both roles. Copy in the empty state differs subtly: cocreators see "Start a conversation with the Dream Team about this dream." / admins see "Start a conversation with this dream's cocreators.".
- [x] Q3: Back navigation — **Back to the current dream's tab list** (decided 2026-04-10). Clicking back from a thread opened inside a dream page clears the `?thread=` query param and stays on the same dream's Dream Team tab, regardless of whether the topic also spans other dreams. The admin hub is still reachable via the round's FREUD submenu for round-wide overviews.
- [x] Q4: Thread view layout — **Match the Comments tab layout** (decided 2026-04-10). Full page width using the same `page grid gap-10 grid-cols-1 md:grid-cols-sidebar` wrapper the public Comments tab uses. No bespoke max-width on the thread container. Zero new layout code — drop `ConversationThread` into the same grid shell Comments uses. Rationale: visual grammar consistency with the rest of the dream page, single thread layout to maintain (the admin hub thread already uses full width), private-channel signalling is already carried by the lock icon, banner, and background tint. If wide threads feel sparse in practice, tightening is a trivial follow-up.
