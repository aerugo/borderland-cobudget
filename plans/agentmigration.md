# Cobudget Deployment Agent Migration Guide

This documents every MCP server, credential, and integration needed for an AI agent to manage Cobudget's deployment infrastructure.

---

## 1. MCP Servers Required

### 1.1 Vercel MCP Server

**Purpose:** Manages frontend deployment (Next.js app), monitors deployments, reads build/runtime logs.

| Detail | Value |
|--------|-------|
| Team ID | `team_uBAcmxN6wsbPdTqpw3EXV95w` |
| Team Slug | `cobudget` |
| Project ID | `prj_rti5hs8rpKggBCvLUEaeUQUR1AHJ` |
| Project Name | `cobudget` |

**What the agent can do with it:**
- List/inspect deployments
- Read build logs and runtime logs to diagnose failures
- Trigger deployments
- Access protected preview URLs
- Check domain availability

**Credential needed:** A Vercel API token with access to the "Cobudget" team. This is configured in the MCP server's authentication, not in the project itself.

---

## 2. GitHub Secrets (CI/CD)

These are stored in the GitHub repository settings and used by GitHub Actions workflows:

| Secret Name | Used By | Purpose |
|-------------|---------|---------|
| `STAGING_DATABASE_URL` | `.github/workflows/main.yml` | PostgreSQL connection string for staging DB. Prisma migrations run on push to `main`. |
| `DATABASE_URL` | `.github/workflows/prod.yml` | PostgreSQL connection string for production DB. Prisma migrations run on push to `prod`. |
| `DEPLOY_PRIVATE_KEY` | `.github/workflows/master.yml` | SSH private key for Dokku deployment to `api.dreams.wtf`. Deploys on push to `master`. |

**To transfer:** The new agent needs access to the GitHub repo settings, or the human admin needs to copy these secrets into the new environment.

---

## 3. Vercel Environment Variables

These must be configured in the Vercel project dashboard (or via CLI). The full list from `ui/.env.local.default` and `ui/next.config.js`:

### Required for the app to function:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `COOKIE_SECRET` | Session cookie encryption key |
| `MAGIC_LINK_SECRET` | Magic link token signing |
| `FROM_EMAIL` | Sender email address |
| `POSTMARK_API_TOKEN` | Transactional email delivery |
| `MAGIC_LINK_TIME_LIMIT` | Magic link expiry (seconds) |
| `DEPLOY_URL` | Canonical deployment URL (e.g. `dreams.wtf`) |
| `PLATFORM_NAME` | Display name (e.g. "Cobudget") |
| `BUCKET_NAME_SINGULAR` / `BUCKET_NAME_PLURAL` | UI terminology |

### Optional integrations:

| Variable | Purpose |
|----------|---------|
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook OAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `STRIPE_API_KEY` | Stripe payments |
| `STRIPE_ACCOUNT_WEBHOOK_SECRET` | Stripe webhook verification |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Stripe Connect webhook verification |
| `STRIPE_MONTHLY_PLAN_PRICE_ID` / `STRIPE_YEARLY_PLAN_PRICE_ID` | Subscription plan IDs |
| `CROWDIN_PROJECT_ID` / `CROWDIN_API_TOKEN` | Translation management |
| `RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY` | Bot protection |
| `ERROR_REPORTING_WEBHOOK` | Discord webhook for error alerts |
| `HELPSCOUT_KEY` | Help Scout support widget |
| `TERMS_URL` / `TERMS_UPDATED_AT` | Terms of service |
| `PRIVACY_POLICY_URL` | Privacy policy link |
| `LANDING_PAGE_URL` | External landing page |
| `PRIVATE_KEY` | RSA private key for Discourse SSO |

---

## 4. Deployment Architecture

```
                    ┌─────────────┐
                    │   GitHub    │
                    │  Repository │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         push main    push prod    push master
              │            │            │
              v            v            v
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Migrate  │ │ Migrate  │ │ Deploy   │
        │ Staging  │ │Production│ │ to Dokku │
        │   DB     │ │   DB     │ │(api.dreams│
        └──────────┘ └──────────┘ │  .wtf)   │
                                  └──────────┘
              │
              v
        ┌──────────┐
        │  Vercel  │  (auto-deploys from GitHub)
        │ Frontend │
        │ + API    │
        └──────────┘
```

**Branches and their roles:**
- **`main`** — Staging. Pushes trigger Prisma migrations on the staging database + Vercel preview deploy.
- **`prod`** — Production. Pushes trigger Prisma migrations on the production database + Vercel production deploy.
- **`master`** — Legacy API server. Pushes deploy to Dokku at `api.dreams.wtf` (may be deprecated; the `.env.production` endpoints referencing `api.dreams.wtf` are commented out).

---

## 5. Deployment Hosts

| Service | Host | Purpose |
|---------|------|---------|
| Vercel | Configured via GitHub integration | Next.js frontend + serverless API routes |
| Dokku | `api.dreams.wtf` | Legacy standalone API server |
| PostgreSQL | Managed externally (connection via `DATABASE_URL`) | Application database |
| Postmark | SaaS | Transactional email |
| Stripe | SaaS | Payment processing |

---

## 6. Local Development Credentials

For the agent to run the project locally, it also needs:

| Item | Location | Purpose |
|------|----------|---------|
| Docker | System-level | Runs local PostgreSQL via `ui/docker-compose.yml` |
| Node.js v22 | System-level | Runtime (specified in `.nvmrc`) |
| `ui/.env.development` | Already in repo (git-tracked) | Local dev config with localhost endpoints |
| `ui/.env` | Gitignored, needs manual creation | May contain local overrides |

---

## 7. Agent Permissions (Claude Code)

The current agent's permission allowlist is in `.claude/settings.local.json`. Key deployment-relevant permissions include:

- **Git:** add, commit, push, pull, merge, branch, checkout, fetch, diff, restore
- **Vercel MCP:** list_teams, list_projects, list_deployments, get_deployment, get_deployment_build_logs
- **Prisma:** migrate dev, migrate deploy, generate, db push, db execute
- **Docker:** docker-compose up/down, docker ps, docker exec, docker run
- **Build:** yarn run build, npx next build, npx tsc

---

## 8. Checklist for the New Agent

To fully replicate this agent's deployment capabilities:

1. **Vercel MCP Server** — Install and authenticate with a token that has access to team `cobudget` (`team_uBAcmxN6wsbPdTqpw3EXV95w`)
2. **GitHub repo access** — Clone access + ability to push to `main`, `prod`, and `master` branches
3. **GitHub Secrets** — Ensure `STAGING_DATABASE_URL`, `DATABASE_URL`, and `DEPLOY_PRIVATE_KEY` are configured in repo settings
4. **Vercel Environment Variables** — All variables listed in Section 3 must be set in the Vercel project dashboard
5. **Node.js v22 + Yarn** — Runtime for building and running the project
6. **Docker** — For local PostgreSQL development database
7. **Copy `.claude/settings.local.json`** — Provides the permission allowlist so the agent doesn't need to re-approve every operation
