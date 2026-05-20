# Phase 2: Frontend skeleton

**Status**: Complete (manual QA deferred — see verification notes)
**Started**: 2026-04-25
**Completed**: 2026-04-25
**Parent Plan**: [development-plan.md](../development-plan.md)

## Objective

Results tab visible in the round nav, page renders the four hero
tiles with real numbers, no charts yet.

## What shipped

| File | Action | Purpose |
|------|--------|---------|
| [ui/components/RoundResults/RoundResults.tsx](../../../../ui/components/RoundResults/RoundResults.tsx) | CREATE | Top-level orchestrator: urql query, loading/error/empty states, hero tile grid, freshness footer |
| [ui/components/RoundResults/StatTile.tsx](../../../../ui/components/RoundResults/StatTile.tsx) | CREATE | One headline number — label + big value + optional helper text |
| [ui/components/RoundResults/EmptyResults.tsx](../../../../ui/components/RoundResults/EmptyResults.tsx) | CREATE | Friendly placeholder when round has zero contributions |
| [ui/components/RoundResults/index.ts](../../../../ui/components/RoundResults/index.ts) | CREATE | Barrel export |
| [ui/pages/[group]/[round]/results.tsx](../../../../ui/pages/[group]/[round]/results.tsx) | CREATE | Page entry. Receives `round` + `currentUser` from `_app.tsx` like history.js does, renders `<SubMenu>` + `<RoundResults>` |
| [ui/components/SubMenu.tsx](../../../../ui/components/SubMenu.tsx) | MODIFY | Replaced History entry with Results entry (no `admin: true` flag, so it's visible to anyone with view access) |

## Key design choices in this phase

1. **`round` prop comes from `_app.tsx` `TOP_LEVEL_QUERY`**, not from a
   per-page query. The top-level query already fetches `id`,
   `currency`, `grantingCloses` — exactly the three fields the
   Results page needs from the round. Mirrors how history.js works.

2. **Auth happens server-side**. The `roundResults` resolver returns
   null for users who can't view the round (via `canViewRound`).
   The page component just renders whatever data comes back; no
   client-side auth gate. If `data?.roundResults` is null, the page
   renders an empty container (the SubMenu won't show a Results link
   at all for such users either, since the SubMenu is rendered
   regardless of `round.visibility`).

3. **Hero tile grid is the v1 design**. Layout: `grid-cols-1
   sm:grid-cols-2 lg:grid-cols-4` — stacks on mobile, two-up on
   tablet, four-up on desktop. Spec AC11 satisfied.

4. **Freshness footer uses `FormattedRelativeTime`** with
   `numeric: "auto"` so it reads "Updated 2 minutes ago" naturally.
   When `grantingCloses` is in the past, the footer switches to
   "Final results · Round closed on …".

5. **Empty state** triggers when
   `totalContributionsCount === 0`. Spec AC10.

## Verification

- [x] `yarn typecheck` — no new errors. Filtering for
      `RoundResults|results.tsx|SubMenu.tsx` returns zero hits.
      Pre-existing errors in unrelated files (Wysiwyg, new-round,
      Date scalar, stripe) untouched.
- [x] Phase 1 unit tests still pass (8/8).
- [ ] **Manual browser QA: deferred.** A pre-existing dev server
      (PID 54477, started before this session) was already running
      on port 3000 in an error state ("missing required error
      components, refreshing…" 500 on every request). I declined to
      kill it without permission and could not bind a second dev
      server to the same port. The local Postgres DB is also empty
      (`SELECT COUNT(*) FROM "Collection"` → 0) so even with a
      healthy dev server there is no fixture round to load. Manual
      QA should happen against staging or after seeding a local
      round.

## Things deliberately *not* in this phase

- Charts / `recharts` — phase 3.
- History page route migration to `/transactions` — phase 5. The
  History page file still exists at `pages/[group]/[round]/history.js`
  with its admin guard intact; it's just no longer linked from the
  SubMenu. Admins reach it via direct URL.
- i18n string extraction to Crowdin — phase 5.
- Cache invalidation on mutations — phase 4.

## Things to verify in browser when possible

- Tab appears in the SubMenu for a public round, anonymous user
- Tab requires membership for a hidden round
- Hero tiles show correct numbers
- Empty state renders for a round with no contributions
- Freshness footer reads "Updated X ago" while granting open;
  reads "Final results · Round closed on DATE" when closed
- Mobile breakpoint at 375 px — tiles stack to single column
