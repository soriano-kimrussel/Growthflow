# GrowthFlow

A GoHighLevel-style CRM and marketing-automation platform for agencies, built as a $0, local-first portfolio project.

An **agency** manages many client **sub-accounts**. Each sub-account gets contacts, Kanban pipelines, a calendar, email/SMS campaigns, and a database-backed workflow engine. Agency admins can stamp one sub-account's setup onto another with **snapshots**.

Email, SMS and payments are **simulated** behind provider adapters: messages land in an Outbox table you can browse, and payments record as succeeded. Nothing leaves your machine, and a real provider can be added without touching app logic.

**Stack:** Next.js 16 (App Router, server actions) · TypeScript (strict) · Tailwind CSS 4 · Prisma 7 (SQLite locally, Postgres in production) · Vitest · Playwright

---

## Quick start

Requires Node.js 20.19+.

```bash
npm install                 # also generates the Prisma client
cp .env.example .env        # defaults work as-is for local dev
npm run setup               # creates prisma/dev.db and seeds demo data
npm run dev                 # http://localhost:3000
```

### Demo logins (password `password123`)

| Email | Role |
| --- | --- |
| `admin@growthflow.dev` | Agency Admin (sees every sub-account, Agency page, snapshots) |
| `dana@brightsmile.test` | Sub-Account Admin, Bright Smile Dental |
| `sam@brightsmile.test` | Sub-Account User, Bright Smile Dental |
| `pat@peakfitness.test` | Sub-Account Admin, Peak Fitness Studio |

The seed creates one agency with two sub-accounts. They include tagged contacts, a pipeline with deals, past and upcoming appointments, an active and a draft campaign, and several active workflows. Some workflow runs and campaign enrollments are mid-wait. Use **Process due steps** or **Skip waits (demo)** on the Workflows, Campaigns or Outbox page to watch them advance.

You can also sign up at `/signup`. That creates a new agency, you as its Agency Admin, and a starter sub-account with a default pipeline.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Prisma generate + Next route types + `tsc --noEmit` |
| `npm test` | Vitest unit tests (builds a throwaway `prisma/test.db`) |
| `npm run test:e2e` | Playwright end-to-end tests (production build + throwaway `prisma/e2e.db`, port 3100) |
| `npm run setup` | `db:push` + `db:seed` |
| `npm run db:push` | Sync the schema to the database in `DATABASE_URL` |
| `npm run db:seed` | Seed demo data (refuses to run twice) |
| `npm run db:reset` | Wipe the database, re-push, re-seed |
| `npm run runner` | Run the automation runner once, directly against the DB |

First-time Playwright setup: `npx playwright install chromium`.

---

## Architecture

```
app/                    Routes. (auth) = login/signup/invite, (app) = signed-in shell
  api/runner/           Scheduled runner endpoint (cron)
modules/<module>/       One folder per module:
  service.ts              business logic; takes a tenant-scoped db, no HTTP concerns
  actions.ts              "use server" actions: resolve tenant + role, validate, call service
lib/
  db/prisma.ts          System Prisma client (platform models, runner discovery only)
  db/tenant.ts          ★ Tenant isolation layer (see below)
  auth/                 Passwords, sessions, tenant context, role permissions
  providers/messaging/  ★ Messaging adapter (interface + simulated implementation)
  providers/payments/   ★ Payments adapter (interface + simulated implementation)
  templates.ts          {{merge_field}} rendering
  time.ts, money.ts     Time-zone and currency helpers (integer cents)
components/             UI (Kanban board, forms, timeline, ...)
prisma/                 schema.prisma, seed.ts
tests/unit/             Vitest: isolation, workflow engine, campaigns, snapshots, helpers
tests/e2e/              Playwright: sign up → contact → Kanban move → timeline
```

Modules: `contacts`, `tags`, `timeline`, `opportunities`, `appointments`, `tasks`, `campaigns`, `workflows`, `messaging`, `automation` (runner), `snapshots`, `dashboard`, `agency` (sub-accounts, team, invites), `auth`.

### Multi-tenancy: isolation in the data layer

- Every tenant-owned table has a `subAccountId` column.
- `tenantDb(subAccountId)` in `lib/db/tenant.ts` returns a Prisma client extension that only ever sees one sub-account. It merges `subAccountId` into every `where` (reads, updates, deletes, counts, aggregates), stamps it on every create, and **throws** on any query that names a different sub-account or tries to move a row between sub-accounts. Platform models (users, sessions, agencies) are not reachable through it at all.
- Services only ever receive a `TenantDb`. Before linking a client-supplied foreign key (an opportunity's contact, a workflow's stage), they verify it exists through the scoped client (`assertOwned`), so cross-tenant links are impossible too.
- Every server action calls `requirePermission(...)` (`lib/auth/context.ts`). That resolves the user from the session cookie, the active sub-account from the server-side session row, and the user's role in it, then builds the scoped client. **The client never sends a `subAccountId`.** Switching sub-accounts is a request the server validates against the user's memberships.

### Roles

| Role | Can |
| --- | --- |
| Agency Admin | Everything, in every sub-account of the agency; create sub-accounts; snapshots |
| Sub-Account Admin | Manage pipelines, campaigns, workflows, team; delete contacts; collect payments |
| Sub-Account User | Work contacts, notes, tasks, deals, appointments; enroll contacts; run due steps |

Permissions live in one table in `lib/auth/permissions.ts` and are checked on the server for every mutation. The UI hides buttons as a courtesy, not as the check.

### Workflow engine

Workflows are rows: a trigger (`triggerType` + JSON filter) and ordered `WorkflowAction` rows.

- **Triggers:** contact created, tag added (optionally a specific tag), opportunity stage changed (optionally into a specific stage), appointment booked, appointment status changed (optionally to a specific status).
- **Actions:** send email, send SMS, add/remove tag, create task, move opportunity to stage, wait.
- When an event fires (`emitTrigger`), each matching active workflow gets a persisted `WorkflowRun` (contact, `currentStep`, `nextRunAt`, trigger context). The run executes immediately until it reaches a **wait**, which stores `nextRunAt` in the database. No in-memory timers.
- The **runner** (`modules/automation/runner.ts`) picks up runs whose `nextRunAt` has passed and continues them. Runs are claimed with a conditional update, so two runners can't advance the same run. Actions that fire triggers (adding a tag, moving a deal) are bounded by a depth cap plus one-active-run-per-workflow-per-contact, so workflows can't loop forever.
- Every action writes to the contact's timeline. Failures mark the run `failed`, store the error, and log it on the timeline.

Campaigns use the same pattern (`CampaignEnrollment.currentStep` / `nextRunAt`), and only advance while the campaign is `active`.

**Advancing the runner:**
- In the app: **Process due steps** (and **Skip waits (demo)**, which fast-forwards pending waits in the current sub-account).
- HTTP: `GET` or `POST /api/runner` with `Authorization: Bearer $CRON_SECRET`. It processes all sub-accounts, each through its own scoped client.
- CLI: `npm run runner`.

### Provider adapters

`lib/providers/messaging` defines `MessagingProvider` (`sendEmail`, `sendSms`). `lib/providers/payments` defines `PaymentsProvider` (`charge`). `getMessagingProvider()` / `getPaymentsProvider()` pick the implementation from `MESSAGING_PROVIDER` / `PAYMENTS_PROVIDER`. The only implementation shipped is `simulated`: it writes to the `Message` (Outbox) and `Payment` tables and always succeeds.

To add a real provider (say Resend or Twilio), implement the interface in that folder and add a `case` to the factory. Callers (`modules/messaging/service.ts`, the payment action) don't change.

### Snapshots

On the **Agency** page, an Agency Admin can snapshot a sub-account and apply the snapshot to another one. A snapshot covers pipelines and stages, campaigns and steps, and workflows and actions, never contacts or messages. Stage and pipeline references inside workflow configs are remapped to the new ids. Campaigns arrive as drafts and workflows switched off, so nothing fires until someone reviews them.

---

## Database: SQLite locally, Postgres in production

The schema avoids provider-specific features: no enums or `Json` columns (enumerations are strings validated in code, structured data is JSON text), and search uses a lower-cased `searchText` column instead of SQLite- or Postgres-only case-insensitive modes.

Prisma needs a literal `provider` in the schema, so `scripts/prisma-provider.mjs` rewrites it from `DATABASE_URL` before every generate/push:

- `file:./prisma/dev.db` → `sqlite` (driver adapter: `better-sqlite3`)
- `postgresql://...` → `postgresql` (driver adapter: `pg`)

`lib/db/prisma.ts` picks the matching driver adapter at runtime. Schema changes are applied with `prisma db push`.

---

## Deploy to Vercel (with Neon or Supabase Postgres)

1. **Create a Postgres database** (free tier) on [Neon](https://neon.tech) or [Supabase](https://supabase.com). Copy its connection string. On Supabase, use the pooled "Transaction" connection string for the app.
2. **Create the tables and demo data** from your machine, pointing at that database:
   ```bash
   DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require" npm run db:push
   DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require" npm run db:seed   # optional
   ```
   (On Windows PowerShell: `$env:DATABASE_URL="..."; npm run db:push`.) This rewrites the provider line in `prisma/schema.prisma` to `postgresql`. Run `npm run db:generate` afterwards to switch your local checkout back to SQLite, or just don't commit that one-line change.
3. **Push the repo to GitHub** and import it in Vercel. The framework preset is detected automatically.
4. **Set environment variables** in Vercel (Project → Settings → Environment Variables):
   - `DATABASE_URL`: the Postgres connection string
   - `CRON_SECRET`: a long random string
   - `MESSAGING_PROVIDER=simulated`, `PAYMENTS_PROVIDER=simulated`
   - `APP_URL`: your deployment URL (used in invitation links)
5. **Deploy.** `postinstall` and `build` run `db:generate`, which sees the Postgres URL and generates a Postgres client.
6. **Scheduling.** `vercel.json` registers a cron for `/api/runner`. Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. Hobby plans allow daily crons, so the default schedule is daily. On Pro, tighten it (for example `*/5 * * * *`), or call the endpoint from any external scheduler. The in-app **Process due steps** button always works too.

---

## Tests

- **Unit (Vitest), `tests/unit/`:** these run against a real SQLite database rebuilt per run.
  - `tenant-isolation.test.ts`: scoped queries never return, update, delete or link another sub-account's rows; platform models are blocked.
  - `workflow-engine.test.ts`: a trigger enrolls a contact; the runner advances past waits and applies every action type; trigger filters; stage, appointment and tag triggers; loop protection; failure handling.
  - `campaigns.test.ts`: step progression over time, draft/paused behaviour, merge fields, missing-address skips.
  - `snapshots.test.ts`, `helpers.test.ts`: snapshot cloning and id remapping; permissions, templates, money, time zones.
- **End-to-end (Playwright), `tests/e2e/core-flow.spec.ts`:** sign up → create a contact → add a deal → drag it across the Kanban board → confirm it persisted and appears on the contact's timeline.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, build and e2e on every push and pull request.

---

## Notes and limits

- Auth is intentionally simple: bcrypt password hashes, random session tokens stored hashed in the database, and `httpOnly` cookies. There's no email verification, password reset or rate limiting.
- All times are stored in UTC and shown in each sub-account's time zone.
- Money is stored as integer cents.
