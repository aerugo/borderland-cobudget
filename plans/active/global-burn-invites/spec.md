# Feature: Invite Round Members from Global Burn Instance

**Status**: Draft
**Created**: 2026-04-18

## Goal

Let round admins pull a list of current members from a Global Burn instance's
`members-cobudget` API endpoint and bulk-invite everyone who is not already a
round participant.

## Background

Burn event organizers maintain their canonical membership roster outside of
Cobudget (on Global Burn instances such as borderland). Today, to get those
members into a Cobudget round, admins have to export emails from Global Burn
and paste them into the existing bulk invite modal. This is manual, error
prone, and has to be redone every time new members register on the Burn side.

Global Burn exposes a dedicated endpoint that returns the current membership
list for a specific event:

```
GET https://<INSTANCE_URL>/api/burn/<EVENT_ID>/members-cobudget
Authorization: Bearer <API_KEY>
```

The response body is a JSON array of email strings.

We want round admins to (1) configure the three parameters once per round,
(2) verify the connection works, and (3) preview + send invites in a clear
two-step flow. API keys must be treated as secrets (never exposed back to
the client once saved).

## Acceptance Criteria

- [ ] AC1: A new "Invite members" tab is available in round settings,
      listed alongside existing tabs (General, Guidelines, etc.).
- [ ] AC2: The tab contains a section titled "Invite from Global Burn
      instance" with form fields for Instance URL, Event ID, and API Key.
- [ ] AC3: The API Key field is a password-style input. After saving, the
      raw value is never returned to the client — only a status
      (`EMPTY` | `PROVIDED`) is exposed through GraphQL.
- [ ] AC4: A "Test connection" button makes the request server-side and
      surfaces one of four outcomes:
        - 200 → success, show event member count
        - 403 → "API key is invalid"
        - 400 → "Event does not exist"
        - network / DNS / non-burn response → "Instance URL is wrong"
- [ ] AC5: When the connection is verified, admin can press "Fetch members"
      and see (a) total members on the Global Burn event, and (b) how many
      of those are not yet round participants.
- [ ] AC6: Admin can send invites to all non-participants with one click.
      The existing `inviteRoundMembers` mutation is reused.
- [ ] AC7: The flow works for events with thousands of members without
      timing out or producing partial-state failures visible to the admin.
- [ ] AC8: Only round admins or group admins can view the tab, change
      settings, test the connection, or trigger a sync.

## Technical Requirements

### Database Changes

Add to `Round` model in [ui/server/prisma/schema.prisma](../../../ui/server/prisma/schema.prisma):

- `globalBurnInstanceUrl   String?`  — e.g. `https://members.theborderland.se`
- `globalBurnEventId       String?`  — e.g. `2026`
- `globalBurnApiKey        String?`  — stored encrypted-at-rest via Postgres;
  never returned through GraphQL
- `globalBurnVerified      Boolean?` — mirrors `ocVerified` pattern;
  set true after a successful test-connection call

No new indexes required.

### GraphQL Changes

New resolvers added to [ui/server/graphql/resolvers/mutations/round.ts](../../../ui/server/graphql/resolvers/mutations/round.ts)
and [ui/server/graphql/resolvers/types/Round.ts](../../../ui/server/graphql/resolvers/types/Round.ts):

- Mutation: `editGlobalBurnSettings(roundId, instanceUrl, eventId, apiKey): Round`
  - `apiKey` is `null` → no change, `""` → clear, string → set
  - Any edit clears `globalBurnVerified`
- Mutation: `testGlobalBurnConnection(roundId): GlobalBurnConnectionResult`
  - Returns `{ status: OK | INVALID_KEY | EVENT_NOT_FOUND | UNREACHABLE, memberCount, error }`
  - On `OK`, also sets `round.globalBurnVerified = true`
- Query (via Round type resolver): `Round.globalBurnApiKeyStatus: TOKEN_STATUS`
  (reuses existing `TOKEN_STATUS` enum from `ocTokenStatus`)
- Mutation: `syncGlobalBurnMembers(roundId, dryRun: Boolean): GlobalBurnSyncResult`
  - `dryRun: true` → returns `{ totalInEvent, alreadyMembers, toInvite }`
     without touching the DB
  - `dryRun: false` → performs the invite via `inviteRoundMembersHelper` +
    `emailService.bulkInviteMembers`, returns same counts
- New schema types in [ui/server/graphql/schema/index.js](../../../ui/server/graphql/schema/index.js):
  `GlobalBurnConnectionResult`, `GlobalBurnSyncResult`, enum `GlobalBurnConnectionStatus`

### UI Changes

- Add `"invite-members"` tab entry in
  [ui/components/RoundSettings/index.tsx](../../../ui/components/RoundSettings/index.tsx).
- New folder `ui/components/RoundSettings/InviteMembers/`:
  - `index.tsx` — tab container
  - `GlobalBurnSection.tsx` — config form + test connection + sync flow
- Two-step sync UX in `GlobalBurnSection`:
  1. Settings form (URL, Event ID, API key) with "Save" + "Test connection"
     buttons.
  2. After verified: "Fetch members" button → show counts → "Send invites"
     button with loading state.

### Cache Invalidation

Update [ui/graphql/client.ts](../../../ui/graphql/client.ts):

- `editGlobalBurnSettings` → updateQuery on the round's settings fields
  (no cache-level invalidation required; the mutation response reshapes the
  Round).
- `testGlobalBurnConnection` → same (response contains updated verified flag).
- `syncGlobalBurnMembers` → invalidate round members list (same pattern as
  `inviteRoundMembers`); look at existing `cache.invalidate` calls for
  `inviteRoundMembers` to mirror them.

## Dependencies

- Global Burn `members-cobudget` endpoint already exists and returns a
  JSON array of email strings (confirmed in user brief).
- Existing `inviteRoundMembersHelper` is the reuse target — it caps at
  10,000 emails per call, de-duplicates against current round members, and
  fires a fire-and-forget email batch via Postmark (batches of 500).

## Out of Scope

- Scheduled / automatic sync. First cut is manual button-press only.
- Bi-directional sync (removing from Cobudget when removed from Burn).
- Per-member metadata (name, profile, etc.) — we only take emails.
- Retry / resume for a partially failed invite send (relies on Postmark's
  retry semantics, same as existing bulk invite).
- Support for Global Burn events with > 10,000 members in one shot. If the
  API returns more than that, we surface a clear error and ask the admin to
  contact us. Chunking can be added later if this ever happens in practice.

## Security & Authorization

- All mutations and the `globalBurnApiKeyStatus` resolver guarded by
  `combineResolvers(isCollOrGroupAdmin, ...)` (same as existing invite
  mutations).
- API key: stored plain in DB like `ocToken` today, but **never returned**
  through GraphQL. Only the derived `TOKEN_STATUS` enum is exposed.
- The server-side HTTP call uses a timeout (~10s) and does not follow
  redirects, to prevent SSRF to internal hosts. We should also block
  obviously-internal hostnames (localhost, 127.x.x.x, RFC1918 ranges) when
  the instance URL is entered — see Open Questions Q2.
- Rate limiting: rely on the existing mutation auth + 10k per-call cap.
  No new per-minute limit added in v1.

## Resolved Questions

- **Q1 (response shape)**: Confirmed flat `string[]` of emails. Service
  still validates at runtime and rejects non-array / non-string payloads.
- **Q2 (SSRF)**: Yes, add hostname blocking before the `fetch`. String-
  based check on the parsed URL's hostname rejects:
    - `localhost`, `127.*`, `::1`
    - RFC1918 private ranges (`10.*`, `172.16-31.*`, `192.168.*`)
    - Link-local `169.254.*` (AWS IMDS lives here)
    - Non-`https://` schemes (force TLS)
  **Dev-mode bypass**: skip the check when `process.env.NODE_ENV ===
  "development"`, so admins running both Cobudget and a local Global
  Burn instance on `localhost` can test end-to-end. Same env signal used
  by [ui/server/send-email.ts](../../../ui/server/send-email.ts) for its
  Postmark-vs-console switch. Unit tests for the service must set
  `NODE_ENV=production` explicitly, otherwise the guard is a no-op under
  Vitest and the block logic goes unexercised.

## Open Questions

- [ ] Q3: Should `testGlobalBurnConnection` persist `globalBurnVerified`
      only on success, or also flip it to `false` on failure? Proposed:
      flip to `true` on success, `false` on any failure outcome.
- [ ] Q4: Do we show the admin the fetched email list for review, or just
      the counts? Proposed: counts only, with a small note ("Emails are
      never displayed here — they come directly from your Global Burn
      instance"). This avoids leaking personal data through the Cobudget
      UI for events that haven't opted into that.
