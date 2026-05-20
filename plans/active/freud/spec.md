# FREUD - Fantastic RE-distribution Utility Datasheet

## Comprehensive UX/UI Design & Engineering Report

**Status**: Draft
**Created**: 2026-04-09

---

## 1. Feature Overview

FREUD is a moderator-only toolset that replaces the current Coda.io integration. It consists of four major features:

1. **Dream Review Table** — Collaborative review workflow for the Dream Team
2. **FREUD Redistribution Engine** — Algorithmic redistribution modeling for underfunded dreams
3. **Batch Email Tool** — Send targeted emails to dream co-creators
4. **Dream Conversations** — Private threaded communication between Dream Team and dreamers

All FREUD features are **only visible to round admins and moderators** (`RoundMember.isAdmin || RoundMember.isModerator`).

---

## 2. UX/UI Design

### 2.1 Navigation & Access

FREUD should appear as a single new tab in the round's SubMenu, visible only to admins/moderators — following the existing pattern used by "History" and "Settings".

```
Overview | Feed | About | Participants | History | Expenses | Budget Items | FREUD | Settings
                                                                            ^^^^^
                                                              admin/mod only
```

The FREUD page itself uses an internal tab system (like Round Settings) with sub-tabs:

```
┌─────────────────────────────────────────────────────────────────┐
│  Dream Review  |  Redistribution  |  Emails  |  Conversations  │
└─────────────────────────────────────────────────────────────────┘
```

**Route structure:**
```
/[group]/[round]/freud                    → Dream Review (default)
/[group]/[round]/freud/redistribution     → FREUD Redistribution
/[group]/[round]/freud/emails             → Batch Emails
/[group]/[round]/freud/conversations      → Conversations
/[group]/[round]/freud/conversations/[id] → Single Conversation
```

### 2.2 Dream Review Table

#### Layout

A full-width data table following the MembersTable pattern (MUI Table components + Tailwind styling). The table is the primary view — no cards or grid, just dense tabular data optimized for scanning many dreams quickly.

Above the table, a **budget summary panel** provides at-a-glance round financials:

```
┌───────────────────────────────────────────────────────────────────────┐
│  [Review TODO]                                                        │
│                                                                       │
│  Set total budget: [________] kr                                      │
│                                                                       │
│  Total budget: 3,197,599 kr + 100,000 kr from F33                    │
│  Total min budget of published dreams:     4,983,926 kr              │
│  Total min budget of all dreams (incl. drafts): 4,985,926 kr         │
│  Distributed: 2,667,038 kr                                           │
│  Budget remaining: 1,332,962 kr                                       │
└───────────────────────────────────────────────────────────────────────┘
```

- **Review TODO button**: Quick filter that shows only dreams not yet reviewed
- **Set total budget**: Editable field for the Dream Team to set the total available budget (stored as round metadata, used for summary calculations)

#### Columns

| Column | Source | Interactivity |
|--------|--------|---------------|
| **#** | Row number | Display only |
| **Dream** | Bucket.title | Link to dream page (with edit icon to jump to editing) |
| **Tag** | New: DreamReviewTag (internal, not public Tag) | Inline editable via dropdown with colored chips. Filter + sort |
| **Progress** | Calculated: totalContributions / minGoal | Percentage display. Sort |
| **Cobudget Funders** | Bucket.noOfFunders | Numeric. Sort |
| **Funded** | Bucket.totalContributions | Formatted currency. Sort |
| **Goal** | Bucket.minGoal | Formatted currency |
| **Stretch** | Bucket.maxGoal | Formatted currency |
| **Reviewed By** | New: DreamReview.reviewerId | Avatar + name with dropdown selector. Filter by "unreviewed" |
| **Cocreators** | Bucket.cocreators | Username chips (display only, sourced from bucket) |
| **Notes** | New: DreamReviewComment thread | Badge with count; click to open popover |

#### Toolbar / Column Filters

Following the Coda pattern, column-level filter chips sit above the table headers:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Dream ▼ | Cocreators ▼ | Approved ▼ | Min goal ▼ | Progress ▼ | ✕ │
│                                                     [Refresh] [Search] │
└──────────────────────────────────────────────────────────────────────┘
```

- Each filter chip opens a dropdown with filter options specific to that column
- **Search**: Text search across dream title (magnifying glass icon)
- **Refresh**: Refreshes data from the database
- **Clear filters (✕)**: Removes all active filters

#### Dream Team Tags UX

- Tags are rendered as colored chips in the table cell (matching the Coda style: e.g., "Fund33" in dark, "Example" in colored, "Do not open for funding" as a warning tag)
- Clicking the tag cell opens an inline dropdown with:
  - Available tags to select/deselect
  - Colored tag chips matching the tag's assigned color
  - Small checkmark (✓) on currently applied tags
- Tags are round-scoped and managed by admins/mods only
- Separate from public-facing `Tag` model to avoid confusion
- Tag management: gear icon in the filter toolbar opens a modal to create/edit/delete DreamReviewTags (with color picker)

#### Review Assignment UX

- Each table row shows a reviewer avatar thumbnail + name, with a dropdown chevron (matching the Coda pattern)
- Clicking the reviewer cell shows a dropdown:
  - List of all admins/mods to assign as reviewer
  - Currently assigned reviewer is highlighted
  - "Add me" shortcut at top
  - Remove reviewer option
- Unreviewed dreams are visually distinct (no reviewer avatar shown, making the gap obvious when scanning)

#### Notes / Internal Comments UX

- Each row shows a **numbered badge** on the right side (e.g., "3" in a colored circle) indicating comment count
- Clicking the badge opens a **popover anchored to the row** (not a full side drawer — following the lightweight Coda pattern seen in the screenshots)
- The popover shows:
  - Chronological comment stream with avatar, name, timestamp for each
  - Short text notes (e.g., "Missing safety plan", "Has been contacted", "No response, unpublished to draft status")
  - "Reply or @ mention someone" input at the bottom
- Comments support @-mentions of other admins/mods (with autocomplete)
- @-mentioned users receive email notifications
- Comments are timestamped with absolute dates (e.g., "Apr 6th, 2025 at 12:55 AM")
- Plain text is sufficient — no rich text needed for review notes

#### Row Indicators

- Some rows may have colored dot indicators on the right margin (green, magenta) to flag status — e.g., dreams with unread comments, dreams with recent activity, or dreams needing attention
- Rows with "Approved" status can have a subtle visual distinction (e.g., checkmark icon or background tint)

### 2.3 FREUD Redistribution Engine

#### Layout

Split into three zones: budget summary, model controls, and the redistribution table.

**Budget Summary Panel** (top):
```
┌──────────────────────────────────────┬─────────────────────────────────────┐
│  Total budget:      3,300,000        │  Quick info to dream team:          │
│  Total decided:     3,548,000        │  0 dream(s) is missing a value in  │
│  Difference:         -248,000        │  Final-field, total missing: 0 kr   │
│                                      │                                     │
│  Total asked for:       4,914,255 kr │  Funds spent in 3 funding rounds:   │
│  Total asked for (stretch): 8,649,800│    2,667,038                        │
│                                      │  Funds spent by dream team: 899,994 │
└──────────────────────────────────────┴─────────────────────────────────────┘
```

**Model Controls** — Each algorithm gets its own control row (matching the Coda pattern), NOT a radio button selector:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Model   │ Description         │ Reset  │ Run        │ Loop │ Next    │  │
│         │                     │        │            │      │ Bucket  │  │
│         │                     │        │            │      │         │Funded│Contributed│
├─────────┼─────────────────────┼────────┼────────────┼──────┼─────────┤
│ Combo   │ Rank by A+B+C combo │[Reset] │[Finish run]│ ○──  │         │ 318 │2,966,100│
├─────────┼─────────────────────┼────────┼────────────┼──────┼─────────┤
│ Funders │ Rank by funder count│[Reset] │[Finish run]│ ○──  │         │ 270 │3,282,397│
├─────────┼─────────────────────┼────────┼────────────┼──────┼─────────┤
│ SEK     │ Rank by SEK to goal │[Reset] │[Finish run]│ ○──  │         │ 318 │1,800,106│
├─────────┼─────────────────────┼────────┼────────────┼──────┼─────────┤
│ Percent │ Rank by % to goal   │[Reset] │[Finish run]│ ○──  │         │ 318 │2,761,578│
└─────────┴─────────────────────┴────────┴────────────┴──────┴─────────┘
```

#### Model Controls UX

Each model row has independent controls:

- **Reset**: Clears that model's column in the redistribution table, restoring original funded values
- **Run / Finish Run**:
  - When Loop is **off**: "Finish run" executes the full redistribution algorithm to completion in one click
  - When Loop is **on**: "Run" advances one step at a time (defunds bottom dream, funds top dream), allowing the Dream Team to watch the algorithm work step by step
- **Loop toggle**: Switches between step-by-step mode and run-to-completion mode. This is a key educational/debugging feature — the Dream Team can see exactly which dream gets defunded and which gets funded at each iteration
- **Next Bucket**: When Loop is on, shows the name of the next dream that will be processed (funded or defunded)
- **Funded**: Shows how many dreams would be funded under this model
- **Contributed**: Shows total amount distributed under this model

All four models can be run independently, and their results appear side-by-side in the M: columns of the table below. This allows the Dream Team to compare outcomes across algorithms.

#### Toggle: Show Dreams That Reached Goal

Above the table, a toggle switch:
```
[○──] Show Dreams that reached goal in granting
```

When off (default during redistribution), hides dreams that are already fully funded to focus attention on underfunded dreams. When on, shows all dreams including fully funded ones.

#### Table Columns

| Column | Description | Interactivity |
|--------|-------------|---------------|
| **Dream** | Bucket title | Link to dream |
| **Tag** | Public-facing tag | Display only |
| **Goal** | Min budget goal | Display |
| **Stretch** | Stretch goal | Display |
| **Funded** | Current total contributions | Display |
| **Missing** | Goal minus Funded (negative = underfunded) | Color-coded: red if negative, green if 0+ |
| **Funders** | Number of unique funders | Display |
| **Progress** | Percentage toward goal | Progress bar |
| **Fund** | Override column — "model" or manual amount | Editable: dropdown "model" / "manual" / "skip". If manual, shows input field |
| **Final** | The final amount after redistribution | Highlighted cell. Shows result of algorithm |
| **M:Combo** | Result from Combo algorithm | Displayed when Combo is run |
| **M:Funders** | Result from Funders algorithm | Displayed when Funders is run |
| **M:SEK** | Result from SEK algorithm | Displayed when SEK is run |
| **M:Percent** | Result from Percent algorithm | Displayed when Percent is run |
| **Heart** | Dream Team approval signal | Clickable heart icon; shows list of who hearted |
| **Reviewed By** | Pulled from Dream Review table | Display only (avatars) |

#### Row Coloring & Visual Indicators

Following the Coda pattern, extensive row/cell background coloring communicates redistribution outcomes at a glance:

- **Green background** on dream name: Dream is fully funded (reached or exceeded goal)
- **Green cells** in M: columns: This model would fully fund this dream
- **Yellow/amber cells** in M: columns: This model partially funds this dream
- **No color / 0 value** in M: columns: This model would defund this dream (funds taken to fund higher-priority dreams)
- **Bold "Final" column**: The decided final amount, with green background when set
- **Red/pink "Missing" column**: Negative values shown in parentheses, e.g., "(5,840)" for underfunded dreams
- **Progress column**: Color-coded percentage — green at 100%+, yellow/amber for partial, no highlight for low

The color coding should make it immediately scannable which dreams are "winners" and "losers" under each model without reading individual numbers.

#### Fund Column Override UX

The "Fund" column allows the Dream Team to override algorithm decisions:
- Default: "model" (use algorithm result)
- "manual": Opens inline number input to specify exact amount
- "skip": Excludes dream from redistribution (keeps current funding as-is)
- "lock": Locks dream at its goal amount (takes priority in redistribution)

#### Export

- **Export to CSV** button in toolbar — exports the current table state with all algorithm results
- Useful for record-keeping and sharing with stakeholders outside the platform

### 2.4 Batch Email Tool

#### Layout

Two-panel layout:

```
┌───────────────────────────────────────────────────────────┐
│ EMAIL COMPOSER                                             │
│                                                            │
│  Subject: [________________________________]               │
│  Summary: [________________________________]               │
│                                                            │
│  Message:                                                  │
│  ┌──────────────────────────────────────────┐              │
│  │ Rich text editor (Remirror)              │              │
│  │                                          │              │
│  └──────────────────────────────────────────┘              │
│                                                            │
│  Recipients:                                               │
│  ┌──────────────────────────────────────────┐              │
│  │ Select dreams to email their co-creators │              │
│  │ [Search dreams...]                       │              │
│  │ ☑ Dream A (3 co-creators)                │              │
│  │ ☑ Dream B (2 co-creators)                │              │
│  │ ☐ Dream C (1 co-creator)                 │              │
│  └──────────────────────────────────────────┘              │
│                                                            │
│  [Add All Dreams]  [Clear Selection]                       │
│                                                            │
│  📧 Queue: 47 recipients                                  │
│                                                            │
│  [Preview Email]  [Send Batch]                             │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ EMAIL HISTORY                                              │
│                                                            │
│ Date       | Subject          | Recipients | Sent By       │
│ Apr 7      | Funding opens... | 124        | Lovisa        │
│ Apr 3      | Review reminder  | 47         | Martin        │
└───────────────────────────────────────────────────────────┘
```

#### Composer UX

1. **Subject** — plain text input
2. **Summary** — short plain text (used as email preview text / preheader)
3. **Message body** — rich text editor using existing Remirror/Wysiwyg component
4. **Recipient selection**:
   - **Dream picker** with checkboxes — selecting a dream adds all its co-creators to the recipient list
   - **"Add All"** button adds all dreams' co-creators
   - **Deduplication** — if a user is co-creator on multiple selected dreams, they get one email
   - **Recipient count badge** shows total unique recipients
   - Optional: filter dreams by tag, status, etc. before selecting
5. **Preview** — modal showing the rendered email as the recipient would see it
6. **Send Batch** — confirmation dialog: "You are about to send to 47 recipients. Proceed?"

#### Email History

- Table showing past batch emails
- Columns: Date, Subject, Recipient Count, Sent By
- Click to expand and see full message and recipient list
- No re-send functionality (to prevent accidental spam)

#### Safety Guardrails

- Confirmation modal before sending
- Rate limiting: max 1 batch per 5 minutes per round
- Sent emails are logged immutably (no delete)
- Recipient list is snapshotted at send time (not dynamic)

### 2.5 Dream Conversations

#### Conversation List View

```
┌───────────────────────────────────────────────────────────┐
│ CONVERSATIONS                          [New Conversation]  │
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Budget concerns for sound camp dreams                  │ │
│ │ Dreams: Sound Camp Alpha, Sound Camp Beta              │ │
│ │ Last message: 2h ago by Lovisa · 4 messages            │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ Fire safety requirements                               │ │
│ │ Dreams: Dragon's Breath, Fire Circus                   │ │
│ │ Last message: 1d ago by Martin · 7 messages            │ │
│ └────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

#### New Conversation Flow

1. Click "New Conversation"
2. Modal or inline form:
   - **Title** (required): conversation subject
   - **Dreams** (required): multi-select dream picker — all co-creators of selected dreams become participants
   - **Initial Message** (required): rich text
3. On create:
   - Conversation page is created
   - All co-creators of selected dreams receive email notification with link
   - Page is accessible to admins/mods + the specific co-creators

#### Single Conversation View

```
┌───────────────────────────────────────────────────────────┐
│ ← Back to Conversations                                    │
│                                                            │
│ Budget concerns for sound camp dreams                      │
│ Dreams: Sound Camp Alpha · Sound Camp Beta                 │
│ Participants: Lovisa, Martin (Dream Team) + 5 co-creators  │
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Lovisa · 2 days ago                            (admin) │ │
│ │ Hi! We noticed your budgets overlap. Can you...        │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ Robin · 1 day ago                         (co-creator) │ │
│ │ Thanks for reaching out! We can definitely...          │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ Martin · 2 hours ago                           (admin) │ │
│ │ Great, let's plan to merge these two dreams...         │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Write a reply...                                       │ │
│ │                                            [Send]      │ │
│ └────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

#### Conversation Permissions

- **Who can see**: Round admins/mods + co-creators of the linked dreams
- **Who can reply**: Same as above
- **Who can create**: Admins/mods only
- **Who can add dreams**: Admins/mods only (adding a dream adds its co-creators)

#### Email Integration

- Every new message triggers email notification to all participants (who haven't disabled it)
- Email contains the full message text + a "Reply" link to the conversation page
- Optional: email reply-to support (parse incoming emails as replies) — this is a stretch goal, not v1
- New email setting: `conversationMessage` toggle in EmailSettings

#### Dreamer Experience

- Co-creators see a "Messages" indicator on their dream page or in their navigation
- They can access the conversation page via direct link (from email) or from their dream page
- They see a "Dream Team Conversation" section on their dream if one exists
- They cannot create conversations — only reply to ones started by the Dream Team

---

## 3. Engineering Design

### 3.1 Database Schema (Prisma)

#### New Models

```prisma
// ═══════════════════════════════════════════
// DREAM REVIEW
// ═══════════════════════════════════════════

model DreamReviewTag {
  id        String   @id @default(cuid())
  value     String
  color     String   @default("#6B7280") // gray-500
  roundId   String   @map("collection_id")
  round     Round    @relation(fields: [roundId], references: [id])
  buckets   Bucket[] @relation("BucketDreamReviewTags")
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([roundId, value])
  @@map("dream_review_tags")
}

model DreamReview {
  id         String      @id @default(cuid())
  bucketId   String      @map("bucket_id")
  bucket     Bucket      @relation(fields: [bucketId], references: [id])
  reviewerId String      @map("reviewer_id")
  reviewer   RoundMember @relation(fields: [reviewerId], references: [id])
  createdAt  DateTime    @default(now()) @map("created_at")

  @@unique([bucketId, reviewerId])
  @@map("dream_reviews")
}

model DreamReviewComment {
  id        String      @id @default(cuid())
  bucketId  String      @map("bucket_id")
  bucket    Bucket      @relation(fields: [bucketId], references: [id])
  authorId  String      @map("author_id")
  author    RoundMember @relation(fields: [authorId], references: [id])
  content   String
  createdAt DateTime    @default(now()) @map("created_at")
  updatedAt DateTime    @updatedAt @map("updated_at")

  @@map("dream_review_comments")
}

// ═══════════════════════════════════════════
// FREUD REDISTRIBUTION
// ═══════════════════════════════════════════

model FreudHeart {
  id        String      @id @default(cuid())
  bucketId  String      @map("bucket_id")
  bucket    Bucket      @relation(fields: [bucketId], references: [id])
  memberId  String      @map("member_id")
  member    RoundMember @relation(fields: [memberId], references: [id])
  createdAt DateTime    @default(now()) @map("created_at")

  @@unique([bucketId, memberId])
  @@map("freud_hearts")
}

model FreudSnapshot {
  id          String   @id @default(cuid())
  roundId     String   @map("collection_id")
  round       Round    @relation(fields: [roundId], references: [id])
  algorithm   String   // "combo" | "funders" | "sek" | "percent"
  data        Json     // Full snapshot of redistribution results
  createdById String   @map("created_by_id")
  createdBy   RoundMember @relation(fields: [createdById], references: [id])
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("freud_snapshots")
}

// ═══════════════════════════════════════════
// BATCH EMAILS
// ═══════════════════════════════════════════

model BatchEmail {
  id           String   @id @default(cuid())
  roundId      String   @map("collection_id")
  round        Round    @relation(fields: [roundId], references: [id])
  subject      String
  summary      String?
  message      String   // HTML content
  sentById     String   @map("sent_by_id")
  sentBy       RoundMember @relation(fields: [sentById], references: [id])
  recipientCount Int    @map("recipient_count")
  recipients   Json     // Snapshot: [{email, name, bucketTitle}]
  bucketIds    String[] @map("bucket_ids") // Which buckets were selected
  sentAt       DateTime @default(now()) @map("sent_at")

  @@map("batch_emails")
}

// ═══════════════════════════════════════════
// CONVERSATIONS
// ═══════════════════════════════════════════

model Conversation {
  id        String                @id @default(cuid())
  title     String
  roundId   String                @map("collection_id")
  round     Round                 @relation(fields: [roundId], references: [id])
  createdById String              @map("created_by_id")
  createdBy RoundMember           @relation(fields: [createdById], references: [id])
  buckets   Bucket[]              @relation("ConversationBuckets")
  messages  ConversationMessage[]
  createdAt DateTime              @default(now()) @map("created_at")
  updatedAt DateTime              @updatedAt @map("updated_at")

  @@map("conversations")
}

model ConversationMessage {
  id             String       @id @default(cuid())
  conversationId String       @map("conversation_id")
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  authorId       String       @map("author_id")
  author         RoundMember  @relation(fields: [authorId], references: [id])
  content        String       // HTML or markdown
  createdAt      DateTime     @default(now()) @map("created_at")

  @@map("conversation_messages")
}
```

#### Modified Models (additions only)

```prisma
model Bucket {
  // ... existing fields ...
  dreamReviewTags     DreamReviewTag[]       @relation("BucketDreamReviewTags")
  dreamReviews        DreamReview[]
  dreamReviewComments DreamReviewComment[]
  freudHearts         FreudHeart[]
  conversations       Conversation[]         @relation("ConversationBuckets")
}

model Round {
  // ... existing fields ...
  freudTotalBudget Int?             @map("freud_total_budget") // Manually set by Dream Team
  dreamReviewTags  DreamReviewTag[]
  freudSnapshots   FreudSnapshot[]
  batchEmails      BatchEmail[]
  conversations    Conversation[]
}

model RoundMember {
  // ... existing fields ...
  dreamReviews         DreamReview[]
  dreamReviewComments  DreamReviewComment[]
  freudHearts          FreudHeart[]
  freudSnapshots       FreudSnapshot[]
  batchEmailsSent      BatchEmail[]
  conversationsCreated Conversation[]
  conversationMessages ConversationMessage[]
}
```

### 3.2 GraphQL Schema

#### New Types

```graphql
type DreamReviewTag {
  id: ID!
  value: String!
  color: String!
}

type DreamReview {
  id: ID!
  reviewer: RoundMember!
  createdAt: Date!
}

type DreamReviewComment {
  id: ID!
  author: RoundMember!
  content: String!
  createdAt: Date!
  updatedAt: Date!
}

type FreudHeart {
  id: ID!
  member: RoundMember!
}

type FreudBucketData {
  bucket: Bucket!
  tag: String              # public tag
  goal: Int!
  stretch: Int!
  funded: Int!
  missing: Int!
  funders: Int!
  progress: Float!
  hearts: [FreudHeart!]!
  reviewedBy: [RoundMember!]!
}

type FreudModelResult {
  bucketId: ID!
  comboResult: Int
  fundersResult: Int
  sekResult: Int
  percentResult: Int
  comboRank: Int
  fundersRank: Int
  sekRank: Int
  percentRank: Int
}

type FreudSnapshot {
  id: ID!
  algorithm: String!
  data: JSON!
  createdBy: RoundMember!
  createdAt: Date!
}

type BatchEmail {
  id: ID!
  subject: String!
  summary: String
  message: String!
  sentBy: RoundMember!
  recipientCount: Int!
  sentAt: Date!
}

type Conversation {
  id: ID!
  title: String!
  buckets: [Bucket!]!
  messages: [ConversationMessage!]!
  createdBy: RoundMember!
  messageCount: Int!
  lastMessageAt: Date
  createdAt: Date!
}

type ConversationMessage {
  id: ID!
  author: RoundMember!
  content: String!
  createdAt: Date!
}
```

#### New Queries

```graphql
type Query {
  # Dream Review
  dreamReviewTable(roundId: ID!): [FreudBucketData!]!
  dreamReviewTags(roundId: ID!): [DreamReviewTag!]!
  dreamReviewComments(bucketId: ID!): [DreamReviewComment!]!

  # FREUD Redistribution
  freudData(roundId: ID!): [FreudBucketData!]!
  freudSnapshots(roundId: ID!): [FreudSnapshot!]!

  # Batch Emails
  batchEmails(roundId: ID!): [BatchEmail!]!

  # Conversations
  conversations(roundId: ID!): [Conversation!]!
  conversation(id: ID!): Conversation
}
```

#### New Mutations

```graphql
type Mutation {
  # Dream Review Tags
  createDreamReviewTag(roundId: ID!, value: String!, color: String): DreamReviewTag!
  deleteDreamReviewTag(id: ID!): DreamReviewTag!
  addDreamReviewTag(bucketId: ID!, tagId: ID!): Bucket!
  removeDreamReviewTag(bucketId: ID!, tagId: ID!): Bucket!

  # Dream Review Assignment
  addDreamReviewer(bucketId: ID!, reviewerId: ID!): DreamReview!
  removeDreamReviewer(bucketId: ID!, reviewerId: ID!): Boolean!

  # Dream Review Comments (internal)
  createDreamReviewComment(bucketId: ID!, content: String!): DreamReviewComment!
  editDreamReviewComment(id: ID!, content: String!): DreamReviewComment!
  deleteDreamReviewComment(id: ID!): Boolean!

  # FREUD Hearts
  toggleFreudHeart(bucketId: ID!): Boolean!   # returns new heart state

  # FREUD Snapshots
  saveFreudSnapshot(roundId: ID!, algorithm: String!, data: JSON!): FreudSnapshot!

  # Batch Emails
  sendBatchEmail(
    roundId: ID!
    subject: String!
    summary: String
    message: String!
    bucketIds: [ID!]!
  ): BatchEmail!

  # Conversations
  createConversation(
    roundId: ID!
    title: String!
    bucketIds: [ID!]!
    initialMessage: String!
  ): Conversation!
  addConversationMessage(conversationId: ID!, content: String!): ConversationMessage!
  addBucketsToConversation(conversationId: ID!, bucketIds: [ID!]!): Conversation!
}
```

### 3.3 Authorization Rules

Every FREUD query and mutation must check:

```typescript
// For admin/mod only features (Dream Review, FREUD, Batch Email, Conversation creation)
const member = await getRoundMember({ odRoundMemberId, odRoundId, odUserId });
if (!member?.isAdmin && !member?.isModerator) {
  throw new Error("Not authorized");
}

// For conversations: co-creators can VIEW and REPLY but not CREATE
// Check if user is admin/mod OR is a cocreator of a linked bucket
```

Authorization summary:

| Action | Admin | Mod | Co-creator | Member |
|--------|-------|-----|------------|--------|
| View Dream Review Table | ✓ | ✓ | ✗ | ✗ |
| Manage Review Tags | ✓ | ✓ | ✗ | ✗ |
| Assign Reviewers | ✓ | ✓ | ✗ | ✗ |
| Write Review Comments | ✓ | ✓ | ✗ | ✗ |
| View FREUD Redistribution | ✓ | ✓ | ✗ | ✗ |
| Run Models / Save Snapshots | ✓ | ✓ | ✗ | ✗ |
| Heart Dreams | ✓ | ✓ | ✗ | ✗ |
| Send Batch Emails | ✓ | ✓ | ✗ | ✗ |
| View Batch Email History | ✓ | ✓ | ✗ | ✗ |
| Create Conversations | ✓ | ✓ | ✗ | ✗ |
| View Conversations | ✓ | ✓ | ✓* | ✗ |
| Reply to Conversations | ✓ | ✓ | ✓* | ✗ |

*Only for conversations linked to their dreams

### 3.4 Redistribution Algorithm Implementation

The redistribution algorithm should be implemented as a **shared utility** that can run both client-side (for instant previewing) and server-side (for saving snapshots). This is pure business logic with no database dependencies.

```typescript
// ui/utils/freud-redistribution.ts

interface FreudDream {
  id: string;
  title: string;
  goal: number;        // minGoal
  stretch: number;     // maxGoal
  funded: number;      // totalContributions
  funders: number;     // noOfFunders
  override?: "model" | "manual" | "skip" | "lock";
  manualAmount?: number;
}

type SortMethod = "combo" | "funders" | "sek" | "percent";

interface RedistributionStep {
  defundedBucketId: string | null;  // which dream lost funding this step
  fundedBucketId: string | null;    // which dream received funding this step
  amountMoved: number;
  pot: number;                      // pot balance after this step
  dreamStates: Map<string, number>; // bucketId → current funded amount
}

interface RedistributionState {
  dreams: FreudDream[];
  method: SortMethod;
  sortedDreamIds: string[];         // sorted order for this method
  currentStep: number;
  steps: RedistributionStep[];
  pot: number;
  isComplete: boolean;
  totalFunded: number;              // count of dreams fully funded
  totalContributed: number;         // sum of all final amounts
}

// Initialize a redistribution model — sorts dreams and prepares state
function initRedistribution(
  dreams: FreudDream[],
  method: SortMethod
): RedistributionState;

// Execute ONE step of the algorithm (for Loop mode)
// Returns the new state after defunding bottom + funding top
function stepRedistribution(
  state: RedistributionState
): RedistributionState;

// Run the algorithm to completion (for Finish Run mode)
// Repeatedly calls stepRedistribution until isComplete
function finishRedistribution(
  state: RedistributionState
): RedistributionState;

// Get the next bucket that will be processed (for "Next Bucket" display)
function getNextBucket(
  state: RedistributionState
): { bucketId: string; action: "defund" | "fund" } | null;

// Reset a model back to initial funded amounts
function resetRedistribution(
  dreams: FreudDream[],
  method: SortMethod
): RedistributionState;
```

The key architectural insight is that the algorithm must be **stateful and steppable** — not a pure function that runs to completion. Each step must be independently observable so the Dream Team can watch the algorithm work in Loop mode. The state object tracks the full history of steps for debugging and understanding.

The algorithm runs entirely **client-side** as React state. When the Dream Team is satisfied with a model's result, they can save a snapshot to the server via `saveFreudSnapshot`.

**Sorting implementations:**

- **Funders**: Sort descending by `funders` count (most funders first = highest priority)
- **SEK**: Sort ascending by `goal - funded` (smallest gap first = easiest to fully fund)
- **Percent**: Sort descending by `funded / goal` (closest to goal first)
- **Combo**: Rank each dream in all three sortings, sum ranks, sort ascending by total rank (lowest = highest priority)

**Important edge cases:**
- Dreams already at or above goal are excluded from redistribution
- Dreams with "skip" override keep their funding
- Dreams with "lock" override are funded to goal amount before algorithm runs
- Dreams with "manual" override use the specified amount
- If pot is empty mid-iteration, stop
- Tie-breaking: alphabetical by dream title

### 3.5 Email System Integration

#### Batch Emails

Leverage the existing Postmark integration. Create a new Postmark template for batch emails with:
- Subject (dynamic)
- Preheader/summary (dynamic)
- Body content (dynamic HTML)
- Footer: "This email was sent by the Dream Team of [Round Name]"
- Unsubscribe: Link to email settings

Implementation approach:
1. Resolve all co-creators of selected buckets
2. Deduplicate by email
3. Send via Postmark batch API (existing `send-email.ts` pattern)
4. Log the BatchEmail record

#### Conversation Notifications

Each new ConversationMessage triggers:
1. Look up all participants (admins/mods + co-creators of linked buckets)
2. Exclude the message author
3. Send email with message content + link to conversation page
4. Respect `EmailSettings.conversationMessage` toggle (new field)

### 3.6 Caching (Urql graphcache)

Add cache invalidation rules in `ui/graphql/client.ts`:

```typescript
// In the updates section of the cache exchange:
Mutation: {
  // Dream Review
  createDreamReviewTag: invalidateRound,
  deleteDreamReviewTag: invalidateRound,
  addDreamReviewTag: invalidateBucket,
  removeDreamReviewTag: invalidateBucket,
  addDreamReviewer: invalidateBucket,
  removeDreamReviewer: invalidateBucket,
  createDreamReviewComment: (result, args, cache) => {
    cache.invalidate({ __typename: 'Query', fieldName: 'dreamReviewComments' });
  },

  // FREUD
  toggleFreudHeart: invalidateBucket,
  saveFreudSnapshot: invalidateRound,

  // Batch Emails
  sendBatchEmail: invalidateRound,

  // Conversations
  createConversation: invalidateRound,
  addConversationMessage: (result, args, cache) => {
    cache.invalidate({ __typename: 'Conversation', id: args.conversationId });
  },
}
```

### 3.7 File Structure (New Files)

```
ui/
├── pages/[group]/[round]/
│   └── freud/
│       ├── index.tsx                      # Dream Review tab (default)
│       ├── redistribution.tsx             # FREUD redistribution
│       ├── emails.tsx                     # Batch emails
│       └── conversations/
│           ├── index.tsx                  # Conversation list
│           └── [conversationId].tsx       # Single conversation
│
├── components/Freud/
│   ├── FreudLayout.tsx                    # Shared layout with sub-tabs
│   ├── DreamReview/
│   │   ├── DreamReviewTable.tsx           # Main review table
│   │   ├── DreamReviewTagManager.tsx      # Tag CRUD modal
│   │   ├── DreamReviewTagCell.tsx         # Inline tag editor cell
│   │   ├── ReviewerCell.tsx              # Reviewer assignment cell
│   │   ├── ReviewNotesDrawer.tsx          # Side drawer for comments
│   │   └── DreamReviewFilters.tsx         # Filter toolbar
│   ├── Redistribution/
│   │   ├── BudgetSummary.tsx              # Top-level budget stats panel
│   │   ├── ModelControlRow.tsx            # Single model's Reset/Run/Loop/stats row
│   │   ├── ModelControlsTable.tsx         # All four model control rows
│   │   ├── RedistributionTable.tsx        # Results table with M: columns
│   │   ├── FundOverrideCell.tsx           # Fund column editor
│   │   └── HeartButton.tsx               # Heart toggle
│   ├── Emails/
│   │   ├── EmailComposer.tsx             # Email form
│   │   ├── DreamRecipientPicker.tsx       # Dream selection for recipients
│   │   ├── EmailPreviewModal.tsx          # Preview before send
│   │   └── EmailHistory.tsx              # Past emails table
│   └── Conversations/
│       ├── ConversationList.tsx           # List view
│       ├── ConversationThread.tsx         # Message thread
│       ├── ConversationForm.tsx           # New conversation form
│       └── MessageInput.tsx              # Reply input
│
├── utils/
│   └── freud-redistribution.ts            # Redistribution algorithm
│
├── server/graphql/
│   ├── resolvers/
│   │   ├── queries/
│   │   │   ├── dreamReviewTable.ts
│   │   │   ├── dreamReviewComments.ts
│   │   │   ├── freudData.ts
│   │   │   ├── freudSnapshots.ts
│   │   │   ├── batchEmails.ts
│   │   │   ├── conversations.ts
│   │   │   └── conversation.ts
│   │   └── mutations/
│   │       ├── dreamReviewTag.ts          # CRUD for review tags
│   │       ├── dreamReview.ts             # Reviewer assignment
│   │       ├── dreamReviewComment.ts      # Internal comments
│   │       ├── freudHeart.ts              # Heart toggle
│   │       ├── freudSnapshot.ts           # Save snapshot
│   │       ├── batchEmail.ts              # Send batch email
│   │       ├── conversation.ts            # Create conversation
│   │       └── conversationMessage.ts     # Add message
│   └── types/
│       ├── DreamReviewTag.ts
│       ├── Conversation.ts
│       └── ConversationMessage.ts
```

### 3.8 Implementation Phases

| Phase | Scope | Effort Estimate | Dependencies |
|-------|-------|-----------------|--------------|
| **Phase 1** | Database schema + migrations | Small | None |
| **Phase 2** | Dream Review Table (core table, tags, reviewer assignment) | Large | Phase 1 |
| **Phase 3** | Dream Review Comments (internal notes system) | Medium | Phase 2 |
| **Phase 4** | FREUD Redistribution Engine (algorithm + table UI) | Large | Phase 1 |
| **Phase 5** | Batch Email Tool | Medium | Phase 1 |
| **Phase 6** | Dream Conversations | Large | Phase 1, Phase 5 (email patterns) |
| **Phase 7** | Polish, testing, export features | Medium | All above |

### 3.9 Key Engineering Considerations

#### Performance

- **Dream Review Table**: For rounds with 100+ dreams, the table query must be efficient. Use a single query that joins buckets with their contributions, tags, reviewers — not N+1 queries. Consider pagination if rounds exceed 200+ dreams.
- **Redistribution algorithm**: Runs on all underfunded buckets. For typical rounds (50-200 dreams), client-side computation is fine. The algorithm is O(n²) worst case but n is small.
- **Batch emails**: Use Postmark's batch API (up to 500 per call). For large rounds, chunk the sends.

#### Data Integrity

- **Redistribution is advisory in v1**: The FREUD models produce *suggestions*. The actual movement of money is a separate admin action (existing `allocateToMember` / `contribute` mutations). FREUD does NOT automatically move funds in v1. An "Apply redistribution" action will be added in a later phase.
- **Snapshots**: Save redistribution results as JSON snapshots so the Dream Team can compare runs and have an audit trail.
- **Batch email logging**: Always snapshot recipients at send time (not just bucket IDs) because co-creators can change.

#### Security

- All FREUD routes must verify admin/mod status in both the page-level guard (client-side redirect) AND the GraphQL resolver (server-side enforcement)
- Conversation access control is the most complex: need to verify the requesting user is either admin/mod or a co-creator of one of the linked buckets
- Batch email content should be sanitized (no script injection in HTML emails)
- Rate-limit batch email sends

#### i18n

- All UI strings should use `react-intl` `<FormattedMessage>` / `useIntl().formatMessage()` following existing patterns
- Currency formatting should use `<FormattedNumber style="currency">` with the round's currency
- Email templates need i18n consideration (though Borderland is primarily English)

#### Existing Pattern Compliance

- Table components: Follow MembersTable pattern (MUI Table + Tailwind)
- Modals: Follow existing modal patterns (e.g., EditCocreatorsModal)
- GraphQL: Follow existing resolver structure with auth checks at top
- Pages: Follow existing Next.js pages router patterns with `currentUser`, `round`, `currentGroup` props
- Email: Follow existing EmailService patterns

#### Migration from Coda

- One-time import script to migrate existing review data from Coda (tags, reviewer assignments, notes) if historical data matters
- The Coda Pack integration can be deprecated once FREUD is stable
- Consider a transition period where both tools are available

---

## 4. Design Decisions (Resolved)

1. **Redistribution is advisory for v1, actionable later**: FREUD models are decision-support tools in v1. The Dream Team uses results to guide manual fund transfers. An "Apply redistribution" button that executes transfers will be added in a later phase once the team trusts the tool.

2. **Approval integrates, publishing does not**: The "Approved" column in the Dream Review Table is an actionable toggle that calls `approveBucket`. This is the most common action during review. Publishing still requires visiting the bucket page.

3. **Conversations are web-only**: Email notifications contain the message + a link. Replying requires visiting the platform. No inbound email parsing.

4. **Fresh each round, no migration**: FREUD starts clean each round. Historical Coda data stays in Coda for reference. No migration needed.

5. **Single round scope**: FREUD is always scoped to the current round. No cross-round views or comparisons.

6. **Hearts are separate from favorites**: Hearts are FREUD-specific team approval signals visible to all admins/mods. Favorites remain personal bookmarks. Different data models, different purposes.

7. **No new notification settings**: FREUD notifications always send to admins/mods. This is part of their role. No new toggles in EmailSettings.

8. **Support requests not in scope**: Handled elsewhere. FREUD focuses on review, redistribution, and communication.

9. **Total budget is a new Round field**: Add `freudTotalBudget` (Int, nullable) to the Round model. Manually set by Dream Team. Allows flexible input for combined funding sources.

10. **"Funds spent by dream team" calculation**: TBD — to be clarified during implementation.

11. **Multiple granting phases exist**: The Borderland runs multiple sequential granting periods within a single Cobudget round. FREUD and the redistribution summary need to be aware of which phase contributions came from. This affects the budget summary stats (e.g., "Funds spent in 3 funding rounds").

## 5. Remaining Open Questions

1. **"Funds spent by dream team" stat**: Exact meaning and calculation to be clarified during implementation.

2. **Multi-phase granting implementation**: How are granting phases currently tracked in the data model? Does `grantingOpens`/`grantingCloses` get reset, or is there a separate mechanism? This affects how FREUD calculates per-phase stats.
