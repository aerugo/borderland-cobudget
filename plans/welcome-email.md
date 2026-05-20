# Feature Plan: Welcome Email for Rounds

## Summary

Allow round admins to configure a custom welcome email that is automatically sent to users when they **create their first bucket** in a round. If no welcome email is configured, the feature is disabled (no email sent).

---

## Data Model

### Prisma Schema Change

Add two fields to the `Round` model:

```prisma
model Round {
  // ... existing fields ...
  welcomeEmailSubject  String?   // Email subject line (plain text)
  welcomeEmailBody     String?   // Email body (markdown/rich text stored as markdown)
}
```

### Migration

```
npx prisma migrate dev --name add_round_welcome_email
```

Both fields are nullable. `null` = feature disabled for this round.

---

## Backend

### 1. GraphQL Schema

Add to the Round type:

```graphql
type Round {
  # ... existing fields ...
  welcomeEmailSubject: String
  welcomeEmailBody: String
}
```

Update the `editRound` mutation to accept:

```graphql
input EditRoundInput {
  # ... existing fields ...
  welcomeEmailSubject: String
  welcomeEmailBody: String
}
```

**Files to modify:**
- `ui/server/graphql/resolvers/types/Round.ts` — expose the new fields
- `ui/server/graphql/resolvers/mutations/round.ts` — handle saving in `editRound`

### 2. Email Service

Add a new method to `ui/server/services/EmailService/email.service.ts`:

```typescript
sendBucketCreationWelcomeEmail: async ({ round, user, bucket, group }) => {
  // Only send if welcomeEmailBody is set
  if (!round.welcomeEmailBody) return;

  const roundLink = appLink(`/${group.slug}/${round.slug}`);
  const bucketLink = appLink(`/${group.slug}/${round.slug}/${bucket.id}`);
  const htmlBody = await mdToHtml(round.welcomeEmailBody);

  await sendEmail({
    to: user.email,
    subject: round.welcomeEmailSubject || `Welcome to ${round.title}!`,
    html: `Hi${user.name ? ` ${escape(user.name)}` : ''}!
      <br/><br/>
      ${htmlBody}
      <br/><br/>
      <a href="${bucketLink}">View your bucket: ${escape(bucket.title)}</a>
      <br/><br/>
      ${footer}
    `,
  });
}
```

### 3. Event Subscriber

In `ui/server/subscribers/email.subscriber.ts`, add:

```typescript
eventHub.subscribe("create-bucket", "welcome-email", async (args) => {
  await emailService.sendBucketCreationWelcomeEmail(args);
});
```

**Important:** The `create-bucket` event is already emitted in the `createBucket` mutation (see `bucket.ts:91`). It already includes `round`, `bucket`, and `currentGroup`. We just need to also pass the `user` and ensure the round has the welcome email fields loaded.

### 4. Modify `createBucket` mutation

In `ui/server/graphql/resolvers/mutations/bucket.ts`, update the round query to include the welcome email fields (they're included by default since they're on the Round model), and pass `user` to the event:

```typescript
await eventHub.publish("create-bucket", {
  currentGroup: round.group,
  currentGroupMember,
  bucket,
  round,
  user,  // ADD THIS
});
```

### 5. Guard: Only send once per user per round

To prevent sending the welcome email every time a user creates a bucket (they might create multiple), track this:

**Option A (simple):** Check if the user already has other buckets in this round before sending. If they're a cocreator on any other bucket, skip.

```typescript
const existingBuckets = await prisma.bucket.count({
  where: {
    roundId: round.id,
    cocreators: { some: { userId: user.id } },
    id: { not: bucket.id }, // exclude the one just created
  },
});
if (existingBuckets > 0) return; // not their first bucket
```

**Option B (robust):** Add a `welcomeEmailSentAt` DateTime field on `RoundMember`. More reliable but heavier schema change.

**Recommendation:** Start with Option A. It's simpler and handles 99% of cases. Option B can be added later if needed.

---

## Frontend

### 1. New Settings Tab Component

Create `ui/components/RoundSettings/WelcomeEmail/index.tsx`:

- Subject line input (plain text)
- Rich text body editor (using existing `<Wysiwyg>` component from `ui/components/Wysiwyg/`)
- Save button (calls `editRound` mutation)
- Preview button (renders the email in a modal as it would appear)
- Clear/disable button (sets both fields to null)
- Help text: "This email will be sent to members when they create their first dream in this round. Leave empty to disable."

### 2. Add Tab to RoundSettings

In `ui/components/RoundSettings/index.tsx`, add a new tab:

```typescript
import WelcomeEmail from "./WelcomeEmail";

// In the defaultTabs array:
{
  slug: "welcome-email",
  name: intl.formatMessage({ defaultMessage: "Welcome Email" }),
  component: WelcomeEmail,
},
```

Place it after "Guidelines" and before "Bucket Review" — it's a communications feature.

### 3. GraphQL Query Update

Update the round query (wherever round settings are fetched) to include `welcomeEmailSubject` and `welcomeEmailBody`.

---

## File Change Summary

| File | Change |
|------|--------|
| `ui/server/prisma/schema.prisma` | Add `welcomeEmailSubject` and `welcomeEmailBody` to Round |
| `ui/server/graphql/resolvers/types/Round.ts` | Expose new fields |
| `ui/server/graphql/resolvers/mutations/round.ts` | Accept new fields in editRound |
| `ui/server/graphql/resolvers/mutations/bucket.ts` | Pass `user` to create-bucket event |
| `ui/server/services/EmailService/email.service.ts` | Add `sendBucketCreationWelcomeEmail` |
| `ui/server/subscribers/email.subscriber.ts` | Subscribe to `create-bucket` for welcome email |
| `ui/components/RoundSettings/WelcomeEmail/index.tsx` | **New** — admin editor UI |
| `ui/components/RoundSettings/index.tsx` | Add Welcome Email tab |
| GraphQL queries (various) | Include new fields when fetching round |

---

## Edge Cases

1. **User creates multiple buckets** — Only send on first bucket (Option A guard above)
2. **Admin changes welcome email after users already got it** — No re-send; only new bucket creators get the updated version
3. **Empty subject** — Default to "Welcome to {round.title}!"
4. **Empty body but subject set** — Treat as disabled (require body to be non-null)
5. **Email delivery failure** — Don't block bucket creation; fire-and-forget via eventHub (existing pattern)

---

## Testing Plan

1. Create a round, verify no welcome email tab shows fields as empty/disabled
2. Write a welcome email with rich text (bold, links, lists)
3. Create a bucket as a different user → verify email received with correct formatting
4. Create a second bucket as same user → verify NO duplicate email
5. Clear the welcome email → create bucket → verify no email sent
6. Preview button renders correctly

---

## Implementation Order

1. Schema migration + prisma generate
2. GraphQL type + mutation changes
3. Email service method + subscriber
4. Guard logic (first bucket check)
5. Frontend settings component
6. Testing
