# Phase 1: Backend — Viewer-scoped Bucket Fields + Relaxed Create

**Status**: Pending
**Started**: —
**Parent Plan**: [../development-plan.md](../development-plan.md)

## Objective

Expose private conversations per-bucket in a single viewer-scoped round-trip, and relax `createConversation` so cocreators can start topics on their own dreams. After this phase:

- The `bucket(id)` query can return `privateConversations`, `noOfPrivateConversations`, `canAccessPrivateConversations`, and `canStartPrivateConversation`, each correctly scoped to the viewer.
- The existing [`bucketConversations`](../../../../ui/server/graphql/resolvers/queries/freud.ts) query is refactored to share scoping logic with the new type resolver (no behaviour change).
- The [`createConversation`](../../../../ui/server/graphql/resolvers/mutations/freud.ts) mutation accepts both admin/mod callers and cocreators-of-every-listed-bucket. Super admin sessions still bypass.
- The admin FREUD conversations hub at `/freud/conversations` continues to work unchanged.

**Scope boundary**: No frontend changes in this phase. The dream page still renders the old `BucketConversationIndicator` until Phase 2.

## Pre-flight Context (already confirmed)

- Prisma schema: `_ConversationBuckets` m2m already exists. No migration. See [migration 20260409225552_freud_features](../../../../ui/server/prisma/migrations/20260409225552_freud_features/migration.sql).
- GraphQL SDL: the existing conversation SDL type is `FreudConversation` (not `Conversation`). New Bucket fields must use `FreudConversation!` as element type. The spec's code fence shows `[Conversation!]!` — this is a spec typo; treat the phase as authoritative and use `FreudConversation!`.
- Resolver registry: `Bucket` type resolver lives at [`ui/server/graphql/resolvers/types/Bucket.ts`](../../../../ui/server/graphql/resolvers/types/Bucket.ts) and is re-exported from [`types/index.ts`](../../../../ui/server/graphql/resolvers/types/index.ts) and wired into the root resolver map at [`resolvers/index.ts`](../../../../ui/server/graphql/resolvers/index.ts). No registry plumbing needed — new exports from `Bucket.ts` are picked up automatically.
- `freudMutations` and `freudQueries` are namespace-re-exported: [`mutations/index.ts`](../../../../ui/server/graphql/resolvers/mutations/index.ts) / [`queries/index.ts`](../../../../ui/server/graphql/resolvers/queries/index.ts) already do `export * as freudMutations from "./freud";`. No wiring changes.
- The current [`bucketConversations` query](../../../../ui/server/graphql/resolvers/queries/freud.ts) (lines ~166–201) already implements the scoping policy we want to share. Its body is the source for the extracted helper.
- The current [`createConversation` mutation](../../../../ui/server/graphql/resolvers/mutations/freud.ts) (lines ~368–442) gates on `assertAdminOrMod(roundId, user?.id, ss)`. That single line is what this phase relaxes. The rest of the body (data write + notification path) is unchanged; the notification path already does the right thing when the sender is a cocreator because it emails "cocreators of linked dreams + other admins/mods − sender".
- `addConversationMessage` (same file, ~line 444) already permits cocreators to reply to existing topics — no change needed.

## Implementation Steps

### Step 1.1: Extract `getViewerScopedBucketConversations` helper

Location: top of [`ui/server/graphql/resolvers/queries/freud.ts`](../../../../ui/server/graphql/resolvers/queries/freud.ts), alongside the existing `assertAdminOrMod` helper.

Signature:

```ts
export async function getViewerScopedBucketConversations(
  bucketId: string,
  ctx: { user?: { id: string } | null; ss?: any }
): Promise<FreudConversationRow[]>;
```

Behaviour: identical to the current `bucketConversations` query body.

1. If no `user` and no `ss`, throw `"You need to be logged in"` — matches existing behaviour so admin hub errors don't change.
2. Load the bucket with its cocreators: `prisma.bucket.findUnique({ where: { id: bucketId }, include: { cocreators: true } })`. If `null`, return `[]`.
3. If not `ss`: look up the round member; if neither admin/mod nor cocreator, return `[]`.
4. Return the same `prisma.conversation.findMany({ where: { buckets: { some: { id: bucketId } } }, include: { buckets: true, createdBy: { include: { user: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1, include: { author: { include: { user: true } } } }, _count: { select: { messages: true } } }, orderBy: { updatedAt: "desc" } })` shape the existing query uses.

Then refactor the existing `bucketConversations` query resolver to a one-liner:

```ts
export const bucketConversations = (_parent, { bucketId }, ctx) =>
  getViewerScopedBucketConversations(bucketId, ctx);
```

**Verify no behaviour change**: the admin hub thread list should still render identically.

### Step 1.2: Add a shared `viewerCanAccessBucketConversations` predicate helper

Small helper used by (a) the new `canAccessPrivateConversations` field resolver and (b) the new `assertCanCreateConversation` gate.

Signature:

```ts
export async function viewerCanAccessBucketConversations(
  bucket: { id: string; roundId: string; cocreators: { userId: string }[] },
  ctx: { user?: { id: string } | null; ss?: any }
): Promise<boolean>;
```

Behaviour: `true` iff `ss` OR viewer is a `roundMember` with `isAdmin || isModerator` for `bucket.roundId` OR viewer is one of `bucket.cocreators` by `userId`. `false` for signed-out.

This is deliberately a pure predicate over an already-loaded bucket, so callers control the load. For the field resolver we'll load the bucket's cocreators; for `assertCanCreateConversation` we'll already have them in scope.

### Step 1.3: Add `assertCanCreateConversation` gate helper

Location: near the top of [`ui/server/graphql/resolvers/mutations/freud.ts`](../../../../ui/server/graphql/resolvers/mutations/freud.ts), alongside the existing `assertAdminOrMod`.

Signature:

```ts
export async function assertCanCreateConversation(
  roundId: string,
  bucketIds: string[],
  ctx: { user?: { id: string } | null; ss?: any }
): Promise<void>;
```

Policy, in order:

1. **Super admin bypass**: if `ctx.ss`, return.
2. **Signed-in check**: if no `ctx.user`, throw `"You need to be logged in"`.
3. **Non-empty**: if `bucketIds.length === 0`, throw `"At least one dream must be selected"`.
4. **Round match**: load all `bucketIds` in one query: `prisma.bucket.findMany({ where: { id: { in: bucketIds } }, include: { cocreators: { select: { userId: true } } } })`. If the result length differs from `bucketIds.length`, throw `"One or more dreams not found"`. If any bucket's `roundId` differs from the argument `roundId`, throw `"All dreams must belong to the same round"`.
5. **Admin/mod path**: look up the round member. If `isAdmin || isModerator`, return (admin/mods can link any bucket in the round).
6. **Cocreator path**: verify **every** loaded bucket's `cocreators` contains an entry with `userId === ctx.user.id`. If not, throw `"You can only start a conversation on dreams you cocreate"`.

**Design note**: We do NOT fall back to a "partially-cocreator" allow policy. The rule is all-or-nothing per call — if a cocreator includes a dream they don't own in `bucketIds`, the whole mutation fails loudly. This matches the Security section of [../spec.md](../spec.md) and prevents a cocreator from starting a topic on "my dream + someone else's dream".

**Edge case — empty `ctx.user`**: step 2 handles it before any prisma calls.

**Edge case — caller is a signed-in user but not a round member**: they can only pass the check if they are a cocreator of every bucket in the list. A non-member cocreator is structurally impossible (cocreators are round members), so in practice this devolves to "non-member + not admin/mod + not cocreator → reject".

### Step 1.4: Refactor `createConversation` to use the new gate

In [`ui/server/graphql/resolvers/mutations/freud.ts`](../../../../ui/server/graphql/resolvers/mutations/freud.ts), replace the line:

```ts
await assertAdminOrMod(roundId, user?.id, ss);
```

with:

```ts
await assertCanCreateConversation(roundId, bucketIds, { user, ss });
```

Everything else in the mutation body (member lookup, `prisma.conversation.create`, notification emails) is unchanged. The notification logic already excludes the sender and includes "cocreators of linked dreams + other admins/mods", which is correct for both admin-initiated and cocreator-initiated topics.

**Risk note**: `createConversation` currently does `await prisma.roundMember.findUnique({ where: { userId_roundId: { userId: user.id, roundId } }, include: { user: true } })` after the old gate and throws "Round member not found" if absent. That throw still applies — super admin sessions must supply a `user` with a round membership to create, or they must not be super admin. Check how the admin hub currently handles super admin create. If it works today, it keeps working — we've only replaced the gate.

### Step 1.5: Add 4 Bucket SDL fields

Modify [`ui/server/graphql/schema/index.js`](../../../../ui/server/graphql/schema/index.js), inside the `type Bucket { ... }` block (currently ~lines 778–826). Append after `isFavorite: Boolean`:

```graphql
    # FREUD Dream Team private channel — per-viewer scoped.
    privateConversations: [FreudConversation!]!
    noOfPrivateConversations: Int!
    canAccessPrivateConversations: Boolean!
    canStartPrivateConversation: Boolean!
```

No changes to any existing Bucket field.

### Step 1.6: Add 4 Bucket type resolvers

Modify [`ui/server/graphql/resolvers/types/Bucket.ts`](../../../../ui/server/graphql/resolvers/types/Bucket.ts). Append at the bottom of the file:

```ts
import {
  getViewerScopedBucketConversations,
  viewerCanAccessBucketConversations,
} from "../queries/freud";

export const privateConversations = async (bucket, _args, ctx) => {
  try {
    return await getViewerScopedBucketConversations(bucket.id, ctx);
  } catch {
    // Signed-out viewers should see an empty list (not an error), because
    // the field is requested inline on the public bucket page.
    return [];
  }
};

export const noOfPrivateConversations = async (bucket, _args, ctx) => {
  try {
    const list = await getViewerScopedBucketConversations(bucket.id, ctx);
    return list.length;
  } catch {
    return 0;
  }
};

export const canAccessPrivateConversations = async (bucket, _args, ctx) => {
  if (!ctx?.user && !ctx?.ss) return false;
  const withCocreators = await prisma.bucket.findUnique({
    where: { id: bucket.id },
    include: { cocreators: { select: { userId: true } } },
  });
  if (!withCocreators) return false;
  return viewerCanAccessBucketConversations(withCocreators, ctx);
};

export const canStartPrivateConversation = canAccessPrivateConversations;
```

**Why the `try/catch` wrappers on `privateConversations` and `noOfPrivateConversations`**: the extracted helper preserves the existing `throw "You need to be logged in"` behaviour for the query (so admin hub error surface is unchanged). But on a **field** requested inline on the public bucket page, we want signed-out viewers to get an empty list rather than break the whole bucket query. Catching the specific "not logged in" error and coercing to `[]`/`0` is the simplest shape-preserving thing; the alternative is an early guard `if (!ctx.user && !ctx.ss) return [];` which is cleaner — prefer that if the extracted helper lets us.

**Preferred alternative**: change the extracted helper to `return []` for signed-out viewers and delete the try/catch. Keep the query resolver's explicit logged-in check by calling `assertLoggedIn(ctx)` first in `bucketConversations`. This yields cleaner field resolvers; note the tradeoff in work-notes if taken.

**Aliasing `canStartPrivateConversation = canAccessPrivateConversations`**: in this release the two fields are identical (any participant can create). Aliasing means no duplicate SQL. The fields are kept separate in the SDL for semantic clarity and future-proofing (decision #4 in [development-plan.md](../development-plan.md)). If they ever diverge, swap the alias for a dedicated resolver.

**`prisma` import**: [`Bucket.ts`](../../../../ui/server/graphql/resolvers/types/Bucket.ts) already imports `prisma from "../../../prisma"` at the top — reuse it.

### Step 1.7: Extend Urql cache invalidation for the new fields

Modify [`ui/graphql/client.ts`](../../../../ui/graphql/client.ts), in the `updates.Mutation` section. Current state (lines ~610–619):

```ts
createConversation(_result, _args, cache) {
  cache.inspectFields("Query")
    .filter((f) => f.fieldName === "conversations")
    .forEach((f) => cache.invalidate("Query", f.fieldName, f.arguments));
},
addConversationMessage(_result, args, cache) {
  cache.inspectFields("Query")
    .filter((f) => f.fieldName === "conversation")
    .forEach((f) => cache.invalidate("Query", f.fieldName, f.arguments));
},
```

Extend both handlers so they also invalidate the new Bucket fields on every affected bucket. Target state:

```ts
createConversation(result: any, _args, cache) {
  // Existing: invalidate the round-wide conversations list query.
  cache.inspectFields("Query")
    .filter((f) => f.fieldName === "conversations")
    .forEach((f) => cache.invalidate("Query", f.fieldName, f.arguments));

  // Also invalidate the legacy bucketConversations(bucketId) query for every
  // bucket the new topic is linked to.
  const linkedBuckets: Array<{ id: string }> = result?.createConversation?.buckets ?? [];
  cache.inspectFields("Query")
    .filter((f) => f.fieldName === "bucketConversations")
    .forEach((f) => {
      const bucketId = f.arguments?.bucketId;
      if (typeof bucketId === "string" && linkedBuckets.some((b) => b.id === bucketId)) {
        cache.invalidate("Query", f.fieldName, f.arguments);
      }
    });

  // Invalidate the new per-bucket fields so the tab list and badge refresh.
  for (const b of linkedBuckets) {
    cache.invalidate({ __typename: "Bucket", id: b.id }, "privateConversations");
    cache.invalidate({ __typename: "Bucket", id: b.id }, "noOfPrivateConversations");
  }
},
addConversationMessage(result: any, args, cache) {
  cache.inspectFields("Query")
    .filter((f) => f.fieldName === "conversation")
    .forEach((f) => cache.invalidate("Query", f.fieldName, f.arguments));

  // The mutation result is a ConversationMessage — it does not include the
  // parent conversation's bucket list. Walk the cached Conversation entity
  // to find linked buckets and invalidate their field cache.
  const convId = args?.conversationId;
  if (typeof convId === "string") {
    const buckets = cache.resolve({ __typename: "FreudConversation", id: convId }, "buckets") as any[] | null;
    if (Array.isArray(buckets)) {
      for (const ref of buckets) {
        const bucketId = cache.resolve(ref as any, "id") as string | null;
        if (typeof bucketId === "string") {
          cache.invalidate({ __typename: "Bucket", id: bucketId }, "privateConversations");
          cache.invalidate({ __typename: "Bucket", id: bucketId }, "noOfPrivateConversations");
        }
      }
    }
  }
},
```

**Risk**: `result?.createConversation?.buckets` requires that every call site selects `buckets { id }` in the mutation response. The admin hub's `ConversationList.tsx` currently only selects `id` and `title`, not `buckets { id }`. We must add `buckets { id }` to both the admin hub's mutation and to any new call site in Phase 3. Document this in the phase-3 file.

**Fallback if buckets are absent**: the `for` loop is a no-op and the new Bucket fields simply don't refresh automatically. Users would need to refetch. This is safe (no stale writes), just degraded UX. The phase-3 call site should add `buckets { id }` to guarantee the invalidation path runs.

**Why per-field `cache.invalidate(entity, fieldName)` and not full-Bucket invalidation**: whole-entity invalidation would also nuke expensive fields like `budgetItems`, `contributions`, and trigger a bigger refetch than needed. Field-level invalidation only forces the four new fields to refetch.

### Step 1.8: Manual GraphiQL verification

Start the dev server: `cd ui && yarn dev`. Open the in-app GraphiQL (wherever the project exposes it) and verify:

**Read fields — 5 viewer classes against a test round with ≥1 topic linked to a test bucket:**

```graphql
query Q($id: ID!) {
  bucket(id: $id) {
    id
    title
    noOfPrivateConversations
    canAccessPrivateConversations
    canStartPrivateConversation
    privateConversations {
      id
      title
      messageCount
    }
  }
}
```

Expected per viewer:

| Viewer | `noOf` | `canAccess` | `canStart` | `privateConversations` |
|---|---|---|---|---|
| Signed-out | 0 | false | false | [] |
| Round admin | N | true | true | scoped list (N items) |
| Round moderator | N | true | true | scoped list (N items) |
| Cocreator of this bucket | N | true | true | scoped list (N items) |
| Signed-in non-cocreator non-admin | 0 | false | false | [] |

**Mutation — `createConversation` with the new gate:**

```graphql
mutation M($roundId: ID!, $title: String!, $bucketIds: [ID!]!, $initialMessage: String!) {
  createConversation(
    roundId: $roundId
    title: $title
    bucketIds: $bucketIds
    initialMessage: $initialMessage
  ) {
    id
    title
    buckets { id title }
  }
}
```

Expected:

| Caller | `bucketIds` | Result |
|---|---|---|
| Round admin | single bucket in the round | success |
| Round admin | two buckets in the round | success |
| Round admin | one bucket NOT in `roundId` | `"All dreams must belong to the same round"` |
| Moderator | single bucket in the round | success |
| Cocreator of bucket X | `[X]` | success |
| Cocreator of buckets X, Y | `[X, Y]` | success |
| Cocreator of bucket X only | `[X, Y]` where Y is someone else's | `"You can only start a conversation on dreams you cocreate"` |
| Cocreator of bucket X | `[Y]` only (not theirs) | same error |
| Non-admin non-cocreator round member | any | same error |
| Signed-out | any | `"You need to be logged in"` |
| Any signed-in | `[]` | `"At least one dream must be selected"` |
| Any signed-in | `["nope"]` | `"One or more dreams not found"` |

**Regression spot checks** (must still work unchanged):

- Admin hub `/freud/conversations`: list loads, thread opens, reply works.
- Admin creating a new topic via `ConversationList` form: works.
- `addConversationMessage` from cocreator: works (unchanged).

## Edge Cases to Handle

- **Cocreator of bucket but bucket deleted**: The `bucketId` lookup returns `deleted` buckets too. Should a cocreator be able to start a topic on a soft-deleted dream? **Decision for this phase**: mirror existing `bucketConversations` query behaviour, which does not filter `deleted`. The existing admin hub also ignores `deleted` here. Do not introduce a new filter in this phase; a `deleted` filter would be a cross-cutting change best done in a dedicated cleanup.
- **`bucketIds` contains duplicates**: Prisma dedupes on `connect`, and the length check in step 4 of the gate would then spuriously fail (`findMany` returns unique rows, fewer than the input array). Handle by deduping inside the gate: `const unique = [...new Set(bucketIds)]` and then comparing `unique.length` to the query result length.
- **Concurrency: a cocreator loses cocreator status mid-request**: the gate reads fresh from the DB at call time, so the race window is the duration of the mutation. Acceptable — no locking needed.
- **Super admin session with no `user`**: existing `createConversation` dereferences `user.id` for the `member` lookup. If a super admin session has no associated user, this throws. Not changed by this phase; pre-existing behaviour.
- **Signed-in user with no round membership trying to read the fields**: `getViewerScopedBucketConversations` returns `[]` via the "not admin/mod and not cocreator" branch. Field resolvers return `[]`/`false`. Good.
- **A multi-dream topic where the viewer cocreates dream A but not dream B**: on dream A's page, `privateConversations` includes the topic (the cocreator-of-A check passes). On dream B's page, the viewer is not admin/mod and not cocreator of B, so the field returns `[]`. The many-to-many scoping does the right thing per-bucket automatically.

## Files

| File | Action | Purpose |
|------|--------|---------|
| [`ui/server/graphql/resolvers/queries/freud.ts`](../../../../ui/server/graphql/resolvers/queries/freud.ts) | MODIFY | Extract `getViewerScopedBucketConversations` + `viewerCanAccessBucketConversations`; refactor `bucketConversations` to call them |
| [`ui/server/graphql/resolvers/mutations/freud.ts`](../../../../ui/server/graphql/resolvers/mutations/freud.ts) | MODIFY | Add `assertCanCreateConversation`; swap `createConversation`'s gate |
| [`ui/server/graphql/schema/index.js`](../../../../ui/server/graphql/schema/index.js) | MODIFY | Add 4 fields to the `Bucket` type SDL |
| [`ui/server/graphql/resolvers/types/Bucket.ts`](../../../../ui/server/graphql/resolvers/types/Bucket.ts) | MODIFY | Add 4 field resolvers, aliasing the two boolean ones |
| [`ui/graphql/client.ts`](../../../../ui/graphql/client.ts) | MODIFY | Extend `createConversation` / `addConversationMessage` cache updates to invalidate the new Bucket fields on linked buckets |
| [`ui/components/Freud/Conversations/ConversationList.tsx`](../../../../ui/components/Freud/Conversations/ConversationList.tsx) | MODIFY (tiny) | Add `buckets { id }` to the `CREATE_CONVERSATION` mutation selection set so the cache-update hook has the bucket list |

## Verification

```bash
cd ui

# Type check
yarn typecheck

# Run existing unit tests (should pass unchanged)
yarn test:run

# Start dev server and verify manually per Step 1.8
yarn dev
```

**Not writing Phase 1 unit tests**: the scoping/auth logic is pure and testable, but the existing Freud backend has zero unit test coverage and the other backend changes in this repo are being verified manually. We stay consistent with the surrounding code. If we later decide to add tests, a good first target is `assertCanCreateConversation` as a pure function — fixture a caller, a list of buckets, assert throws/returns. Note this as a follow-up, not a blocker.

## Completion Criteria

- [ ] `yarn typecheck` passes.
- [ ] `yarn test:run` passes (no regressions in existing tests).
- [ ] Admin hub `/freud/conversations`: list loads, creating a topic still works, replies still work.
- [ ] On the dream page (still using the old indicator), the bucket query can be augmented with the 4 new fields in GraphiQL and returns the expected values for all 5 viewer classes.
- [ ] `createConversation` gate matrix verified per Step 1.8 — all 11 rows produce the expected success/error outcome.
- [ ] `ConversationList.tsx` mutation selection set includes `buckets { id }`; the admin hub still functions.
- [ ] No files outside the "Files" table above have been modified.
- [ ] Work notes updated with what was done and any deviations from this plan.
