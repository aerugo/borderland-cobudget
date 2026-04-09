# Phase 5: Batch Email Tool

**Status**: Pending
**Started**: —
**Parent Plan**: [development-plan.md](../development-plan.md)

## Objective

Build the batch email tool for the Dream Team to send targeted emails to dream co-creators, with a rich text composer, dream-based recipient selection, preview, confirmation, and email history.

## Implementation Steps

### Step 5.1: `sendBatchEmail` Mutation

Implement in `mutations/freud.ts`:

```typescript
export const sendBatchEmail = async (_, { roundId, subject, summary, message, bucketIds }, ctx) => {
  // 1. Auth: admin/mod
  // 2. Rate limit: check last BatchEmail for this round, reject if < 5 min ago
  // 3. Resolve recipients:
  //    a. For each bucketId, find bucket with cocreators → user → email
  //    b. Flatten all cocreator emails
  //    c. Deduplicate by email address
  // 4. Sanitize message HTML (strip <script> tags, etc.)
  // 5. Send emails via Postmark:
  //    - Use batch API (up to 500 per call)
  //    - Subject: provided subject
  //    - HtmlBody: wrap message in email template with round branding
  //    - TextBody: strip HTML for plain text fallback
  //    - From: configured sender
  // 6. Log BatchEmail record:
  //    - Snapshot recipients as JSON [{email, name, bucketTitle}]
  //    - Store bucketIds, recipientCount, subject, summary, message
  // 7. Return BatchEmail
};
```

**Postmark integration**: Follow existing pattern in `ui/server/send-email.ts`. Either:
- Use existing `sendEmail` function in a loop (simplest)
- Or use Postmark batch API directly for better performance

**Rate limiting**: Query `BatchEmail` table for most recent entry in this round. If `sentAt` is less than 5 minutes ago, throw error.

### Step 5.2: `batchEmails` Query

```typescript
export const batchEmails = async (_, { roundId }, ctx) => {
  // Auth: admin/mod
  return prisma.batchEmail.findMany({
    where: { roundId },
    include: { sentBy: { include: { user: true } } },
    orderBy: { sentAt: 'desc' },
  });
};
```

### Step 5.3: Email Composer Component

Create `ui/components/Freud/Emails/EmailComposer.tsx`:

Layout:
- Subject input (plain text)
- Summary input (plain text, small note: "Used as email preview text")
- Message body: use existing `Wysiwyg` component (Remirror-based) for rich text
- Below: recipient picker area
- Bottom: action buttons

State:
```typescript
const [subject, setSubject] = useState('');
const [summary, setSummary] = useState('');
const [messageHtml, setMessageHtml] = useState('');
const [selectedBucketIds, setSelectedBucketIds] = useState<string[]>([]);
```

### Step 5.4: Dream Recipient Picker

Create `ui/components/Freud/Emails/DreamRecipientPicker.tsx`:

- Searchable list of all dreams in the round
- Each dream row shows: checkbox, dream title, cocreator count badge
- "Add All" button — selects all dreams
- "Clear Selection" button — deselects all
- Recipient count display: "X recipients" (deduplicated)
- Data source: use the `dreamReviewTable` query results or a lighter bucket query

Deduplication logic:
```typescript
const uniqueRecipients = useMemo(() => {
  const emails = new Set<string>();
  selectedBuckets.forEach(bucket => {
    bucket.cocreators.forEach(cc => {
      if (cc.user?.email) emails.add(cc.user.email);
    });
  });
  return emails.size;
}, [selectedBuckets]);
```

### Step 5.5: Email Preview Modal

Create `ui/components/Freud/Emails/EmailPreviewModal.tsx`:

- Modal showing the email as the recipient would see it
- Renders the HTML message body in an iframe or sanitized div
- Shows subject, summary/preheader
- Shows "From: Dream Team of [Round Name]"
- Shows recipient count
- "Close" and "Send" buttons

### Step 5.6: Confirmation Dialog

Before sending, show a confirmation dialog:
- "You are about to send an email to X recipients."
- "Subject: [subject]"
- "This action cannot be undone."
- "Cancel" / "Send Batch" buttons

### Step 5.7: Email History

Create `ui/components/Freud/Emails/EmailHistory.tsx`:

- Table below the composer
- Columns: Date, Subject, Recipients, Sent By
- Click row to expand: shows full message body and recipient list
- No re-send or delete functionality (immutable log)
- Query: `batchEmails(roundId)`

### Step 5.8: Wire into Page

Update `ui/pages/[group]/[round]/freud/emails.tsx`:
- Render EmailComposer and EmailHistory
- Query bucket data for recipient picker
- Handle mutation state (loading, success, error)
- Show success toast after send

## Edge Cases to Handle

- No dreams selected — disable Send button
- Dream with no cocreators — show "0 co-creators" in picker, skip in deduplication
- Very long message — Postmark has a 50MB limit, shouldn't be an issue for text
- Rate limit hit — show user-friendly error: "Please wait X minutes before sending another batch"
- Postmark API error — show error, do NOT log the BatchEmail (only log on success)
- Draft email — no auto-save for v1 (user must complete and send in one session)

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/server/graphql/resolvers/mutations/freud.ts` | MODIFY | Implement sendBatchEmail |
| `ui/server/graphql/resolvers/queries/freud.ts` | MODIFY | Implement batchEmails |
| `ui/components/Freud/Emails/EmailComposer.tsx` | CREATE | Composer form |
| `ui/components/Freud/Emails/DreamRecipientPicker.tsx` | CREATE | Dream selection |
| `ui/components/Freud/Emails/EmailPreviewModal.tsx` | CREATE | Preview modal |
| `ui/components/Freud/Emails/EmailHistory.tsx` | CREATE | Past emails table |
| `ui/pages/[group]/[round]/freud/emails.tsx` | MODIFY | Wire up components |

## Verification

```bash
cd ui
yarn typecheck
yarn dev

# Manual (use dev Postmark or console logging):
# 1. Navigate to FREUD → Emails
# 2. Compose an email with subject, summary, message
# 3. Select 2-3 dreams — verify recipient count is correct (deduplicated)
# 4. Click "Add All" — verify count updates
# 5. Preview — verify rendering
# 6. Send — verify confirmation dialog, then success
# 7. Check email history — new entry appears
# 8. Click history row — verify expandable details
# 9. Try sending again immediately — verify rate limit error
# 10. Wait 5 minutes, send again — should succeed
```

## Completion Criteria

- [ ] Emails send to correct deduplicated recipients
- [ ] Rich text message renders correctly in email
- [ ] Rate limiting works (1 per 5 min per round)
- [ ] Confirmation dialog appears before send
- [ ] Preview modal shows rendered email
- [ ] History table shows all past batch emails
- [ ] History expandable to see full message + recipients
- [ ] Type check passes
