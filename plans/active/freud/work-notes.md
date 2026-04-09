# FREUD - Work Notes

**Feature**: FREUD (Fantastic RE-distribution Utility Datasheet) — Dream Team moderator toolset
**Started**: 2026-04-09
**Branch**: `freud`

---

## Session Log

### 2026-04-09 - Specification & Planning

**Context Reviewed**:
- Read `schema.prisma` — identified core models: Round, Bucket, RoundMember, Tag, Contribution, Comment
- Read `resolvers/index.ts` — understood resolver wiring pattern (named exports, spread into root)
- Read `SubMenu.tsx` — understood admin-gated tab pattern
- Read `MembersTable.tsx` — understood MUI Table + Tailwind pattern
- Read `graphql/schema/index.js` — understood SDL structure
- Analyzed Coda.io screenshots for UX reference (5 screenshots)

**Completed**:
- [x] Created comprehensive spec.md with UX/UI design and engineering plan
- [x] Updated spec based on Coda screenshot analysis (popovers, model controls, budget summaries, row coloring)
- [x] Resolved all 11 open questions with stakeholder input
- [x] Created development-plan.md with 7 phases
- [x] Created all 7 phase plans

**Key Design Decisions Made**:
1. Redistribution advisory for v1, actionable later
2. Approval integrates in review table, publishing does not
3. Conversations web-only (no email reply parsing)
4. Fresh each round, no Coda migration
5. Single round scope
6. Hearts separate from favorites
7. No new notification settings
8. Support requests not in scope
9. Total budget is new Round field (freudTotalBudget)
10. Multiple granting phases exist and need tracking

**Next Steps**:
1. Begin Phase 1: Foundation (schema, migrations, navigation)

---

## Key Decisions

### Decision 1: Resolver File Organization

**Date**: 2026-04-09
**Context**: Spec proposed separate files per mutation (~14 files). Existing codebase groups by domain.
**Decision**: Group all FREUD queries into `queries/freud.ts` and all mutations into `mutations/freud.ts`
**Rationale**: Matches existing patterns (e.g., `round.ts` contains all round mutations). Reduces file count. FREUD is a cohesive domain.

### Decision 2: Client-Side Redistribution

**Date**: 2026-04-09
**Context**: Algorithm could run server-side or client-side.
**Decision**: Run entirely client-side as React state. Only persist snapshots server-side.
**Rationale**: Enables instant Loop/Step interaction without server round-trips. Algorithm is pure computation with small input (50-200 dreams). Snapshots provide server-side persistence when needed.

### Decision 3: Notes as Popovers (not Side Drawers)

**Date**: 2026-04-09
**Context**: Original spec proposed side drawers for internal comments.
**Decision**: Use lightweight popovers anchored to table rows.
**Rationale**: Matches existing Coda UX. Keeps the user's context in the table. Comments are typically short notes, not long discussions.

---

## Files Modified

### Created
- `plans/active/freud/spec.md` — Full feature specification
- `plans/active/freud/development-plan.md` — 7-phase implementation plan
- `plans/active/freud/work-notes.md` — This file
- `plans/active/freud/phases/phase-1.md` through `phase-7.md` — Detailed phase plans
