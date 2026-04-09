# Cobudget: AI Agent Implementation Planning Guide

This directory is where AI agents create and track implementation plans for features and changes to **Cobudget** -- a collaborative budgeting and participatory funding platform.

**Codebase root**: `/ui` (Next.js full-stack app -- frontend + GraphQL API in one)
**Database schema**: See [ui/server/prisma/schema.prisma](../ui/server/prisma/schema.prisma)
**GraphQL schema**: See [ui/server/graphql/schema/](../ui/server/graphql/schema/)

---

## Directory Structure

```
plans/
├── CLAUDE.md                    # This file - planning protocol
├── active/                      # Plans currently being implemented
│   └── <feature-name>/
│       ├── spec.md              # Feature specification (required)
│       ├── development-plan.md  # Phased implementation plan (required)
│       ├── work-notes.md        # Progress tracking and session notes (required)
│       └── phases/
│           ├── phase-1.md       # Detailed plan for phase 1
│           ├── phase-2.md       # Detailed plan for phase 2
│           └── ...
├── completed/                   # Finished plans (for reference)
│   └── <feature-name>/
│       └── ...
└── migration/                   # One-off migration or refactor plans
```

---

## Cobudget Architecture At A Glance

Before planning any feature, understand the core architecture:

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (pages router) |
| Language | TypeScript 5.7, React 18 |
| API | GraphQL via Apollo Server (endpoint: `POST /api`) |
| ORM | Prisma 5 |
| Database | PostgreSQL 13 |
| GraphQL Client | Urql 4 with graphcache |
| UI | MUI 5 + Tailwind CSS + Styled Components |
| Rich Text | Remirror |
| Auth | Passport.js (Magic Link, Google, Facebook OAuth) |
| Payments | Stripe (connected accounts, checkout sessions) |
| Expenses | Open Collective integration (webhooks + API) |
| Email | Postmark (template-based) |
| Images | Cloudinary |
| i18n | react-intl + Crowdin |
| Tests | Vitest (unit), Cypress (E2E) |
| Deploy | Vercel |

### Core Domain Model

```
Group (Organization)
  └── Round (Funding Cycle)
       ├── RoundMember (participants with allocated budgets)
       ├── Bucket (project proposal)
       │    ├── BudgetItem (income/expense line items)
       │    ├── FieldValue (custom fields: text, boolean, enum, file)
       │    ├── Comment (discussion + log entries)
       │    ├── Image (Cloudinary-hosted)
       │    └── Flag (guideline compliance)
       ├── Allocation (budget given to member: ADD/SET)
       ├── Contribution (member funds a bucket)
       ├── Expense (OC-integrated expense tracking)
       ├── Guideline (round rules for bucket review)
       └── Tag (bucket categorization)
```

### Key Files & Directories

| Path | Purpose |
|------|---------|
| `ui/pages/` | Next.js pages + API routes |
| `ui/pages/api/index.ts` | Apollo Server GraphQL endpoint |
| `ui/pages/api/auth/` | Auth endpoints (magic link, OAuth callbacks) |
| `ui/pages/api/stripe/` | Stripe webhook handlers |
| `ui/pages/api/oc-hooks/` | Open Collective webhook handler |
| `ui/server/graphql/schema/` | GraphQL SDL type definitions |
| `ui/server/graphql/resolvers/` | Resolvers (mutations, types, helpers) |
| `ui/server/prisma/schema.prisma` | Database schema (source of truth) |
| `ui/server/passport/` | Auth strategies |
| `ui/server/services/EmailService/` | Email notification logic |
| `ui/components/` | React components (~59 directories) |
| `ui/graphql/client.ts` | Urql client with cache config |
| `ui/contexts/` | React contexts |
| `ui/utils/` | Client-side utilities |

### ID Strategy & Conventions

- IDs use `cuid()` (not UUIDs)
- Soft deletes via `deleted: Boolean` fields
- Timestamps: `createdAt @default(now())` + `updatedAt @updatedAt`
- Unique constraints on slug combinations (e.g., group slug + round slug)
- JSON fields for flexible metadata (`ocMeta`, `customData`)

### Authorization Model

- **Group-level**: `GroupMember.isAdmin`
- **Round-level**: `RoundMember.isAdmin` / `isModerator` / `isApproved` / `isRemoved`
- **Platform-level**: `User.isSuperAdmin` (separate `SuperAdminSession` tracking)
- Permission checks happen in GraphQL resolvers via `req.user` and role lookups

---

## Starting a New Implementation

### 1. Understand the Context

Before writing any code:

- **Read the Prisma schema** (`ui/server/prisma/schema.prisma`) for the models you'll touch
- **Read the GraphQL schema** (`ui/server/graphql/schema/`) for existing queries/mutations
- **Read relevant resolvers** (`ui/server/graphql/resolvers/`) to understand existing patterns
- **Study existing implementations** that solve similar problems (find a comparable feature)
- **Analyze the current state** of files you'll modify -- understand what exists before changing it
- **Check the Urql cache config** (`ui/graphql/client.ts`) if your feature affects GraphQL caching

### 2. Create the Feature Specification

Save to `plans/active/<feature-name>/spec.md`:

```markdown
# Feature: <Name>

**Status**: Draft | Approved | In Progress | Complete
**Created**: <date>

## Goal

<One sentence describing the outcome>

## Background

<Context: why this feature is needed, what problem it solves>

## Acceptance Criteria

- [ ] AC1: <Specific, testable criterion>
- [ ] AC2: <Specific, testable criterion>
- [ ] AC3: <Specific, testable criterion>

## Technical Requirements

### Database Changes
- <Table/column additions or modifications to schema.prisma>
- <New indexes needed>

### GraphQL Changes
- <New queries or mutations in schema/>
- <New or modified resolvers>

### UI Changes
- <New pages or components>
- <User interactions>

### Cache Invalidation
- <Which Urql cache entries need updating in graphql/client.ts>

## Dependencies

- <What must exist before this can be built>
- <External services or APIs required>

## Out of Scope

- <What this feature explicitly does NOT include>

## Security & Authorization

- <Which roles can access this feature>
- <Privacy implications>

## Open Questions

- [ ] Q1: <Unresolved question>
```

### 3. Create the Development Plan

Save to `plans/active/<feature-name>/development-plan.md`:

```markdown
# <Feature Name> - Development Plan

**Status**: In Progress
**Created**: <date>
**Branch**: `<branch-name>`
**Spec**: [spec.md](spec.md)

## Summary

<1-2 sentence description of what this implementation accomplishes>

## Current State Analysis

<Describe what exists now and what problem you're solving>

### Files to Modify

| File | Current State | Planned Changes |
|------|---------------|-----------------|
| `ui/server/prisma/schema.prisma` | ... | ... |
| `ui/server/graphql/schema/...` | ... | ... |
| `ui/server/graphql/resolvers/...` | ... | ... |
| `ui/components/...` | ... | ... |
| `ui/graphql/client.ts` | ... | ... |

### Files to Create

| File | Purpose |
|------|---------|
| `ui/...` | ... |

## Solution Design

<Describe the solution approach>

### Key Design Decisions

1. **<Decision>**: <Rationale>
2. **<Decision>**: <Rationale>

## Phase Overview

| Phase | Description | Deliverables |
|-------|-------------|--------------|
| 1 | <description> | <what's delivered> |
| 2 | <description> | <what's delivered> |

## Phase 1: <Name>

**Goal**: <Clear objective>
**Detailed Plan**: [phases/phase-1.md](phases/phase-1.md)

### Deliverables

1. <File or component>
2. <File or component>

### Implementation Approach

1. <Step>
2. <Step>
3. <Step>

### Success Criteria

- [ ] <Specific criterion>
- [ ] Type check passes (`yarn typecheck`)
- [ ] Dev server runs without errors

## Phase 2: <Name>

...

## Testing Strategy

### Unit Tests (Vitest)
- `ui/__tests__/<feature>.test.ts`: <what it tests>

### E2E Tests (Cypress)
- `cypress/e2e/<feature>.cy.js`: <user flow tested>

## Progress Tracking

| Phase | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| Phase 1 | Pending | | | |
| Phase 2 | Pending | | | |
```

### 4. Create Work Notes

Save to `plans/active/<feature-name>/work-notes.md`:

```markdown
# <Feature Name> - Work Notes

**Feature**: <brief description>
**Started**: <date>
**Branch**: `<branch-name>`

---

## Session Log

### <date> - <Session Focus>

**Context Reviewed**:
- Read `schema.prisma` - identified relevant models: ...
- Read `resolvers/mutations/...` - understood pattern for ...
- Analyzed `components/...` - understood ...

**Completed**:
- [x] <task>
- [x] <task>

**Blockers/Issues**:
- <issue and how it was resolved>

**Next Steps**:
1. <next task>
2. <next task>

---

## Key Decisions

### Decision 1: <Title>

**Date**: <date>
**Context**: <why this decision was needed>
**Decision**: <what was decided>
**Rationale**: <why this approach>

---

## Files Modified

### Created
- `<path>` - <purpose>

### Modified
- `<path>` - <what changed>
```

### 5. Create Phase Plans

For each phase, create `plans/active/<feature-name>/phases/phase-X.md`:

```markdown
# Phase X: <Name>

**Status**: Pending | In Progress | Complete
**Started**: <date>
**Parent Plan**: [development-plan.md](../development-plan.md)

## Objective

<What this phase accomplishes>

## Implementation Steps

### Step X.1: <Database/Schema Changes>

Modify `ui/server/prisma/schema.prisma`:
- <What to add/change>

Run migration:
```bash
cd ui && yarn migrate
```

### Step X.2: <GraphQL Schema>

Add to `ui/server/graphql/schema/<file>.js`:
- <Types/queries/mutations to add>

### Step X.3: <Resolvers>

Create/modify `ui/server/graphql/resolvers/<file>`:
- <Resolver logic>

### Step X.4: <Frontend Components>

Create/modify `ui/components/<Component>/`:
- <Component structure and behavior>

### Step X.5: <Cache Updates>

Update `ui/graphql/client.ts`:
- <Cache invalidation rules for new mutations>

## Edge Cases to Handle

- <edge case 1>
- <edge case 2>

## Files

| File | Action | Purpose |
|------|--------|---------|
| `ui/server/prisma/schema.prisma` | MODIFY | <what changes> |
| `ui/server/graphql/schema/...` | MODIFY | <what changes> |
| `ui/server/graphql/resolvers/...` | CREATE | <purpose> |
| `ui/components/...` | CREATE | <purpose> |

## Verification

```bash
cd ui

# Type check
yarn typecheck

# Run dev server and test manually
yarn dev

# Run unit tests
yarn test:run

# Run specific test
npx vitest <test-file>
```

## Completion Criteria

- [ ] Dev server starts without errors
- [ ] Feature works end-to-end in browser
- [ ] Type check passes
- [ ] No regressions in existing functionality
```

---

## Execution Workflow

### Starting Each Session

1. **Read `work-notes.md`** to understand current state
2. **Review the current phase plan** in `phases/phase-X.md`
3. **Check which branch you're on** and if there are uncommitted changes
4. **Continue from the documented next step**

### Working Through Each Phase

1. **Create the detailed phase plan** in `phases/phase-X.md` before starting
2. **Follow the standard implementation order**:
   - Database schema changes (Prisma) + migration
   - GraphQL schema (SDL types)
   - Resolvers (business logic)
   - Frontend components
   - Cache invalidation rules
   - Tests (if applicable)
3. **Update `work-notes.md` continuously**:
   - What was completed
   - Decisions made and rationale
   - Issues encountered and resolutions
   - Next steps when resuming
4. **Verify at major milestones** (`yarn typecheck`, manual testing)

### Completing a Phase

1. **Verify the feature works**: manual test in browser
2. **Run type checking**: `cd ui && yarn typecheck`
3. **Update phase status** in `development-plan.md`
4. **Add completion notes** to `work-notes.md`
5. **Create next phase plan** in `phases/phase-X+1.md`

### Completing the Implementation

1. **Full verification**: type check + manual test + any automated tests
2. **Final review checklist**:
   - [ ] Feature works end-to-end
   - [ ] Type checking passes
   - [ ] No regressions
   - [ ] Work notes reflect final state
   - [ ] Commit(s) are clean and well-described
3. **Move plan to `completed/`** directory

---

## Common Patterns in Cobudget

### Adding a New GraphQL Mutation

1. Add the mutation to the SDL schema in `ui/server/graphql/schema/index.js`
2. Create the resolver in `ui/server/graphql/resolvers/mutations/`
3. Wire it into the mutation resolver map
4. Add cache update rules in `ui/graphql/client.ts` if needed
5. Call it from a React component using Urql's `useMutation`

### Adding a Database Field

1. Add the field to `ui/server/prisma/schema.prisma`
2. Run `cd ui && yarn migrate` to create the migration
3. Expose it via GraphQL schema if needed
4. Add it to relevant resolvers

### Working with Permissions

Check authorization in resolvers by:
1. Getting the current user from `context.user`
2. Looking up their membership: `prisma.roundMember.findUnique(...)` or `prisma.groupMember.findUnique(...)`
3. Checking role flags: `isAdmin`, `isModerator`, `isApproved`
4. For super admin: check `context.ss` (super admin session)

### Working with Stripe

- Stripe integration lives in `ui/server/stripe/`
- Webhook handlers in `ui/pages/api/stripe/webhooks/`
- Use connected accounts pattern (each round can have its own Stripe account)
- Test webhooks locally with `./scripts/forward-stripe-webhooks.sh`

### Working with Open Collective

- OC webhook handler: `ui/pages/api/oc-hooks/[webhook-token].ts`
- OC API helpers: `ui/server/graphql/resolvers/helpers/opencollective.ts`
- Expenses sync bidirectionally between Cobudget and OC
- OC metadata stored in `Expense.ocMeta` (JSON field)

---

## Development Environment

```bash
# Start database
cd ui && docker-compose up -d

# Apply migrations
yarn migrate

# Start dev server (includes Prisma client generation)
yarn dev

# Type check
yarn typecheck

# Run unit tests
yarn test

# Run E2E tests
yarn test:e2e  # starts Next.js in test mode
```

---

## Agent Handoff Commands

### Start New Feature

```
Plan this feature according to the template in plans/CLAUDE.md
and then implement it.
```

### Resume Work

```
Keep implementing the plan in plans/active/<feature>/development-plan.md
following the protocol defined in plans/CLAUDE.md
```

### Check Progress

```
Did you follow the plan so far, or did you diverge?
If you diverged, how and why?
```

---

## Checklists

### Pre-Implementation Checklist

- [ ] Read relevant Prisma models in `schema.prisma`
- [ ] Read relevant GraphQL schema and resolvers
- [ ] Study similar existing features for patterns
- [ ] Analyze current state of files to modify
- [ ] Create spec.md
- [ ] Create development-plan.md
- [ ] Create work-notes.md
- [ ] Create first phase plan

### Phase Completion Checklist

- [ ] Feature works in browser
- [ ] Type checking passes (`yarn typecheck`)
- [ ] Work notes updated with session log
- [ ] Phase status updated in development plan

### Implementation Completion Checklist

- [ ] Feature works end-to-end
- [ ] Type checking passes
- [ ] No regressions
- [ ] Documentation updated (if user-facing)
- [ ] Work notes reflect final state
- [ ] Plan moved to `completed/` directory

---

*Last Updated: 2026-04-09*
