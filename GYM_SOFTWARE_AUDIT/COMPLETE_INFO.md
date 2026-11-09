# Fitness360 — Complete Repository and Setup Guide

> **Scope:** This single document describes the code and configuration in the
> checked-out repository. It is not a claim that a particular deployment is
> live, secure, backed up, or fully configured. Findings below are based on
> repository evidence; assumptions and unverified runtime/provider settings are
> called out explicitly. Secret values are intentionally never included.

## 1. Executive summary

Fitness360 is an open-source gym-management web application built as a Next.js
App Router application with TypeScript, React, Prisma, and PostgreSQL. It is a
modular monolith: browser pages and HTTP API route handlers live in one Next.js
application, domain handlers organize business operations, and shared
libraries provide data access, authentication, validation, tenant/gym scope,
integrations, and background processing.

The codebase contains member and membership management, plans and renewals,
attendance and QR check-in, payment recording, bills, expenses/finance,
analytics, staff and trainer workflows, leads, classes, campaigns, reminders,
workouts, supplements/commerce, member pages, multi-gym account context,
custom entities/analytics, and agent/MCP surfaces. The API route audit records
169 endpoints (140 migrated to domain handlers, 29 partial at the audit
snapshot; zero routes with direct Prisma according to that generated report).

Database: PostgreSQL via Prisma. Local Docker Compose runs PostgreSQL 16 only;
the Next.js app runs on the host. Hosted PostgreSQL is supported by connection
configuration. Supabase can therefore be used as a PostgreSQL host, but the
application’s primary ORM data store remains PostgreSQL/Prisma; optional
Supabase SDK clients are separate and do not establish that Supabase Storage
is used.

Payment methods such as cash, UPI, card, and bank transfer can be recorded.
There is a Razorpay Payment Links integration with signature-verified webhook
handling, but the inspected webhook marks the checkout-link record paid and
does not itself create a normal payment record. Stripe is a marketplace
coming-soon entry; no PhonePe, Cashfree, or PayU provider checkout flow was
found in the integration audit.

Meta WhatsApp Cloud API sending code is present and credentials are
configurable, but the Inngest WhatsApp send/bulk-send/initialize functions
currently return a disabled result. Separate legacy WhatsApp Web automation
code is present and should not be confused with the official API. Email sending
via Resend is present but its variables are not listed in `.env.example`.
SMS sending was not found. Production behavior depends on credentials, provider
configuration, and deployed job/webhook setup that cannot be verified from
source alone.

Repository production-readiness posture is **substantial but not certified**:
it has authentication, role checks, gym/account scope helpers, validation,
rate limiting, API audits, migrations, tests, and CI/deployment configuration.
However, there are partial routes and external integrations, a documented
backup stub, and current typecheck issues in unrelated routes/pages discovered
during this work. Operators must validate secrets, webhook configuration,
database backups, tenant isolation, monitoring, and recovery procedures before
production use.

## 2. What the application is for

The product is aimed at gym operators and their staff. The dashboard centralizes
member records, memberships, collections, attendance, leads, communications,
staff, trainers, financial reporting, and gym configuration. Member-facing
routes provide selected member portal, class, payment, supplement, signup, and
booking capabilities. Self-hosting setup and CLI scaffolding are included.

It is **not** a collection of separate deployable backend services. The
repository describes an open-source product that can be self-hosted; cloud
marketing/developer portal and commercial website are separate repositories
according to `docs/OPEN_CORE.md`. There is evidence for multiple gyms and
locations through gym/account entities and scoping, but actual billing/tenant
provisioning plans and production SaaS operations cannot be inferred solely
from this repo.

## 3. Technology stack

| Layer | Technologies / evidence |
|---|---|
| Runtime | Node.js `>=24`, npm `>=10` (`package.json`) |
| Frontend framework | Next.js `16.1.6`, React / React DOM `19.2.3` |
| Language | TypeScript `^5`; TSX, JavaScript/ESM, shell scripts also appear |
| CSS/UI | Tailwind CSS 4, PostCSS, Radix UI primitives, Lucide icons, custom UI components |
| Data | PostgreSQL, Prisma and `@prisma/client` `^6.19.2` |
| Authentication | NextAuth v5 beta, Prisma adapter package, bcryptjs |
| Validation | Zod; React Hook Form and resolver dependencies; per-page adoption varies |
| Charts/data views | Recharts, TanStack Table, SWR |
| Background processing | Inngest and Node cron dependency; Vercel Cron configured |
| AI | Vercel AI SDK, OpenAI-compatible provider package, Anthropic provider package |
| Optional data/services | Supabase JS/SSR, Upstash Redis/rate limiting |
| Tests | Jest 30, Testing Library, Playwright |
| Hosting config | Vercel (`vercel.json`); README also describes Railway/self-hosted Node + PostgreSQL |
| License | Apache-2.0 |

Dependency presence does not itself prove a feature is wired or enabled.

### Architectural flow

```text
Browser (Next.js pages/components)
       │ fetch / NextAuth session
       ▼
src/app/api route.ts (rate limit / shared wrapper)
       │
       ▼
src/domains/<domain>/handlers (auth, validation, business rules)
       │
       ├── src/lib shared services (scope, permissions, logging, adapters)
       ▼
Prisma Client ───────── PostgreSQL
       │
       ├── Inngest events/functions and Vercel Cron
       └── external providers (Razorpay, Meta, email/AI as configured)
```

`src/app/api` is the HTTP surface. `src/domains` contains business-specific
handlers. `src/lib` provides cross-cutting infrastructure. `prisma/schema.prisma`
is the schema source, and `prisma/migrations` contains database change history.
Route handlers should be treated as wrappers where they delegate to domain
handlers, though repository route-audit metadata reports some migrations as
partial.

## 4. Local setup and configuration

### Prerequisites

- Node.js 24 or newer and npm 10 or newer (`package.json`).
- PostgreSQL locally or a hosted PostgreSQL-compatible service.
- Docker Desktop only if using the bundled local database service.

### Standard setup documented by the repository

```powershell
# From the cloned project root
Copy-Item .env.example .env
# Edit .env and provide the required values (see below)

# Option A: local database with Docker
docker compose up -d postgres

# Install dependencies and generate Prisma client
npm ci
npm run db:generate
npm run db:migrate:deploy

# Start Next.js
npm run dev
```

Open `http://localhost:3000`. If using Supabase or another managed database,
use that provider’s PostgreSQL connection strings instead of starting Docker.
The project’s `prisma/ENV.md` says to set `DATABASE_URL` and
`DIRECT_DATABASE_URL`; they may be identical for a single direct endpoint.
Supabase transaction pooler URLs (commonly port 6543) are discouraged for new
setups by that document; choose the provider’s direct connection for Prisma
migrations. Do not copy secret values into chat or source control.

The in-repo CLI is `packages/cli`; `docs/DEVELOPMENT.md` says use
`npm run fitness360:init` for initialization and warns not to use `npx
@fitness360/cli` until the package is published.

### Core environment-variable names

Names below are read from `.env.example`, `prisma/ENV.md`, and integration
source; this is not a request to configure every optional service.

| Variable | Purpose / status |
|---|---|
| `DATABASE_URL` | Prisma runtime PostgreSQL connection; required |
| `DIRECT_DATABASE_URL` | Prisma migrate/db tooling connection; required by documented setup |
| `NEXTAUTH_URL` | Application base URL for authentication; required |
| `NEXTAUTH_SECRET` | Auth/session signing secret; required, use a strong unique random value |
| `CRON_SECRET` | Protects cron endpoint; required for production cron |
| `QR_SECRET` | QR signing secret |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google OAuth |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Optional GitHub OAuth |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Optional Supabase auth/storage client configuration; service role must remain private |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Inngest configuration |
| `META_WABA_ACCESS_TOKEN`, `META_WABA_PHONE_NUMBER_ID` | Operative Meta Cloud API code path |
| `WHATSAPP_BUSINESS_PHONE_ID`, `WHATSAPP_BUSINESS_TOKEN` | Names in marketplace config; not the `META_WABA_*` names used by current Meta adapter |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Razorpay integration |
| `RESEND_API_KEY`, `EMAIL_FROM` | Used by Resend email source; absent from `.env.example` |
| `FITNESS360_AI_PROVIDER`, `FITNESS360_INFERENCE_ENABLED`, `FITNESS360_INFERENCE_CRON_LLM` | AI provider and job gates |
| `FITNESS360_AI_API_KEY`, `FITNESS360_AI_MODEL`, `FITNESS360_INFERENCE_MODEL` | AI model configuration |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Anthropic inference configuration |
| `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_MARKETING_SITE_URL` | White-label/product links |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser push subscription setup; delivery backend not verified |
| `META_WABA_*` and `RAZORPAY_*` above | External messaging/payment credentials; never expose or commit |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature verification secret |
| `NODE_ENV`, `ALLOW_DEMO_ACCOUNT_AUTO_LINK` | Runtime and demo account behavior |
| `FITNESS360_INFERENCE_MAX_MEMBERS_PER_RUN`, `FITNESS360_INFERENCE_COHORT_BRIEF`, `FITNESS360_MCP_TOKEN_TTL_SECONDS` | Optional documented AI/MCP tuning |
| `PROTECTED_ADMIN_PHONE_MAP`, `MEMBER_PROTECTION_ENABLED` | Optional protection settings |
| `ENABLE_PLAYGROUND`, `ENABLE_DEVELOPERS_PORTAL`, `ENABLE_AGENT_API`, `ENABLE_DEV_SELF_HEAL` | Feature gates; dev self-heal must not be enabled in production |
| `SOURCE_DATABASE_URL`, `TARGET_DATABASE_URL` | Data migration script input |
| `BLOB_READ_WRITE_TOKEN` | Mentioned by backup stub; does not establish a working backup destination |

Always use the latest `.env.example` and source code as the authoritative
variable list. `prisma/ENV.md` documents the canonical Prisma variable names;
legacy names may exist in local configuration but should not be assumed valid.

### Database commands

```powershell
npm run db:generate
npm run db:migrate:deploy
npm run db:push
npm run db:studio
```

`db:migrate:deploy` applies checked-in migrations to the selected database;
verify target connection and backups before applying to production.

## 5. Repository structure

```text
.
├── src/
│   ├── app/                 Next.js pages, layouts, and 169 API route handlers
│   ├── components/          Shared and feature-specific React components
│   ├── contexts/            Client contexts (sidebar/theme)
│   ├── contracts/           API contracts and wire enums
│   ├── data/                Product and marketplace data
│   ├── domains/             Domain business handlers
│   ├── hooks/               Shared React hooks
│   ├── inngest/             Background event functions
│   ├── lib/                 Auth, Prisma, validation, integrations, services
│   ├── platform/            Platform tools
│   └── types/               Shared types
├── prisma/                  Prisma schema, migrations, seed and ENV guide
├── packages/                CLI, db and kernel packages
├── scripts/                 Setup, audits, data jobs, validation and release scripts
├── e2e/                     Playwright end-to-end specs
├── openapi/                 Generated OpenAPI definition
├── mcp-server/              MCP server entrypoint
├── public/                   Icons, PWA assets, service worker
├── docs/                     Development, architecture and product docs
├── .github/workflows/        CI, production deploy, PR gate, release
├── docker-compose.yml        Local PostgreSQL only
├── vercel.json               Vercel build/region/cron configuration
└── package.json              Dependencies and developer commands
```

### Important files

| File | Role |
|---|---|
| `package.json` | Scripts, runtime requirements, dependencies, Prisma seed command |
| `next.config.ts` | Next.js headers and bundler configuration |
| `tsconfig.json` | Strict TS configuration and `@/*` alias to `src/*` |
| `prisma/schema.prisma` | Database models, enums, relations and datasource |
| `prisma/migrations/*/migration.sql` | Ordered SQL schema changes |
| `prisma/ENV.md` | PostgreSQL URL setup and migration guidance |
| `src/lib/prisma.ts` | Prisma Client initialization |
| `src/lib/auth.ts` | NextAuth configuration/provider integration |
| `src/middleware.ts` | Request/session routing protections |
| `src/lib/api-handler.ts` | Shared API wrapper/errors |
| `src/lib/permissions.ts` | Permission model |
| `src/lib/gym-scope.ts`, `account-scope.ts`, `account-user-scope.ts` | Tenant/gym/account lookup and scope helpers |
| `src/lib/security/` | Security helpers, request parsing, and related protections |
| `src/lib/payments/razorpay.ts` | Razorpay transport/configuration |
| `src/lib/whatsapp/meta-cloud.ts` | Meta Cloud API client |
| `src/inngest/` | Event-driven/background job definitions |
| `src/app/api/` | HTTP endpoints |
| `openapi/openapi.json` | Generated API specification |
| `docs/API_ROUTE_AUDIT.md` | Generated endpoint/migration audit snapshot |
| `docs/FEATURE_PARITY.md` | Product surface parity status (dashboard/API/MCP/self-host) |
| `docker-compose.yml` | Local PostgreSQL container |
| `vercel.json` | Vercel cron and build settings |
| `jest.config.js`, `playwright.config.ts` | Unit and browser test config |

## 6. Frontend routes and navigation

The following page files were enumerated under `src/app`. Dynamic segments
(`[]`) are route parameters. This list describes page modules, not every
navigation link or access policy.

| Route | Page purpose |
|---|---|
| `/` | Application landing/root |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Authentication |
| `/privacy`, `/terms` | Legal pages |
| `/dashboard` | Main operations dashboard |
| `/dashboard/analytics` | Analytics |
| `/dashboard/attendance` | Attendance |
| `/dashboard/members`, `/dashboard/members/new`, `/dashboard/members/[id]` | Member listing, registration and profile |
| `/dashboard/members/[id]/add-payment`, `/dashboard/members/[id]/renew` | Member payment and renewal |
| `/dashboard/payments`, `/dashboard/payments/future-membership-stack-cleanup` | Payment operations and maintenance page |
| `/dashboard/bills`, `/dashboard/bills/generate`, `/dashboard/bills/[id]`, `/dashboard/bills/[id]/print` | Bill/invoice list, generation, detail and print |
| `/dashboard/bills/whatsapp` | WhatsApp bill delivery workflow |
| `/dashboard/renewals`, `/dashboard/overdue`, `/dashboard/reminders` | Renewal, overdue and reminder operations |
| `/dashboard/employees`, `/dashboard/trainers` | Staff and trainer management |
| `/dashboard/finances` | Finance |
| `/dashboard/leads` | Lead management |
| `/dashboard/classes`, `/dashboard/workouts`, `/dashboard/challenges` | Fitness programs, classes and engagement |
| `/dashboard/campaigns`, `/dashboard/wa-history` | Campaign and WhatsApp history surfaces |
| `/dashboard/tasks`, `/dashboard/workspace`, `/dashboard/settings` | Operations and configuration |
| `/dashboard/marketplace`, `/dashboard/supplements`, `/dashboard/supplements/invoices/[id]/print` | Marketplace, commerce and printable supplement invoice |
| `/member`, `/member/classes`, `/member/pay`, `/member/supplements` | Member-facing portal pages |
| `/book/[slug]`, `/widget/book/[slug]` | Public booking flows |
| `/settings/account`, `/settings/billing`, `/settings/notifications` | Account-level settings |

The shared dashboard shell is `src/components/dashboard/dashboard-shell.tsx`;
`src/components/app-sidebar.tsx` provides sidebar navigation, and
`src/components/site-header.tsx` renders session identity, gym selector,
undo/theme/logout actions. A route’s actual access must be checked in page
layouts, middleware, and APIs—not inferred from its location.

## 7. Feature inventory and implementation notes

Status definitions:

- **Implemented (source evidence):** meaningful UI and/or backend behavior is
  present. It does not imply every edge case or deployment configuration is
  verified.
- **Partial:** some layers/workflows exist, with documented disabled paths,
  incomplete code, or limited feature parity.
- **Not found:** targeted repository searches did not locate an implementation;
  this is not proof no external service exists.
- **Needs runtime verification:** source alone cannot prove provider/account
  setup or live behavior.

| Feature | Evidence and implementation assessment |
|---|---|
| Dashboard / analytics | Dashboard and analytics pages exist; analytics API domains and chart dependency exist. Verify each metric against its data query and test cases. |
| Members | Registration, list, detail, update, photo, and related APIs exist under `src/app/dashboard/members` and `/api/members*`. |
| Plans / memberships | Membership assignment and lifecycle logic exist in `memberships` domain and renewal/member pages; inspect schema and specific business rules before changing. |
| Renewal / expiry | Renewal and overdue UI/API and cron jobs exist; source does not prove a specific production scheduler has run. |
| Attendance | UI/API, attendance domain, QR path, and QR signing helper exist. No biometric integration was found in the repository inventory. |
| Payments / collections | Manual collection and payment-recording flows exist; payment methods are data values and do not necessarily call a provider. |
| Gateway checkout | Razorpay Payment Links implementation and webhook exist; inspect `PAYMENT_GATEWAY` section below for limits. Other named providers were not found. |
| Bills / invoices / receipts | Bills and commerce invoice endpoints/pages exist, including print routes and refund route. Provider receipt delivery paths require runtime verification. |
| Refunds | Bill refund endpoint exists; verify external gateway refund behavior separately—endpoint presence is not proof that a provider refund is issued. |
| Trainers / staff | Trainer management and employee management pages and APIs exist. Permissions are role-based and may be account-scoped. |
| Workouts / diet | Workout page and diet-plan API exist; whether a trainer/member-specific complete portal assignment flow exists must be checked in the associated handlers. |
| Classes / bookings | Classes, booking API, member classes and public booking routes exist. |
| Leads / trials | Lead APIs and pages, follow-up and trial booking routes exist. |
| Expenses / finance | Expense APIs and finance dashboard exist. |
| Campaigns / reminders | Campaign, reminder and WhatsApp history UI/API exist. Meta sending job path is currently disabled in Inngest functions. |
| Notifications | Inbox API and notification-related modules exist; push delivery is not verified end-to-end. |
| Supplements / commerce | Product, orders, member supplements, invoices and marketplace paths exist; feature status varies by route. |
| Goals / challenges / engagement | Goal, challenge, participant and leaderboard routes exist. |
| QR check-in | QR attendance and signed QR helper exist; treat as implemented at source level, not biometric attendance. |
| Member portal | Member pages and OTP endpoints exist; complete member onboarding/auth workflow must be runtime-tested. |
| Multi-gym | Gym/account models, selectors, scope helpers and ADR support multiple gyms/locations at source level. |
| SaaS / billing of gyms | Account and billing surfaces exist, but commercial provisioning, subscription enforcement and support operations need further verification. |
| Email | Resend transport and password reset/payment bill call sites exist. Configuration is not fully represented in `.env.example`. |
| SMS | No SMS vendor send integration found in targeted source searches. |
| Cloud file storage | Supabase clients are scaffolded; no verified application upload/storage flow from the integration audit. |
| Cloud DB backup | Backup service was found to be a stub; do not assume working backups. |
| AI | Groq-compatible assistant and Groq/Anthropic inference paths exist, with feature flags/mock fallback; production keys/provider output require runtime verification. |
| Agent/MCP | MCP server and agent API surfaces exist, gated/configured in some paths. |

## 8. Roles, authentication, and authorization

### Roles and access

Source uses Prisma roles including at least `ADMIN` and `SUB_ADMIN`; UI labels
`SUB_ADMIN` as employee in the employee-management form. Shared permissions
are listed in `src/lib/permissions.ts` and include view/edit access for members,
payments, renewals, reminders, reports, and WhatsApp reminder functions.
Other staff/trainer/member roles are represented in the full schema and
domain-specific authorization; consult the DB schema and route handlers for
the exact role enum and each endpoint’s policy.

### Sign-in and identity

- NextAuth configuration is under `src/lib/auth.ts`; NextAuth App Router
  callback is `/api/auth/[...nextauth]`.
- Login/signup pages are `/login` and `/signup`; signup handler is
  `/api/auth/signup`.
- Passwords use bcryptjs in account creation/reset code.
- Password reset handler exists at `/api/auth/password-reset`; reset pages
  include `/forgot-password` and `/reset-password`.
- Google/GitHub OAuth variables are optional in `.env.example`.
- Member OTP routes `/api/member/otp/send` and `/api/member/otp/verify` exist.
- Sessions, cookies, callback behavior and production settings require a
  deployment-specific review.

### Security controls visible in source

- API route audit and Zod checks for mutating bodies.
- Shared API handler, authentication helpers, role checks, and rate-limit
  wrappers.
- Tenant/gym/account scope utilities and an accepted ADR requiring gym scoping
  for tenant-owned data.
- Security response headers in `next.config.ts`.
- QR signing, idempotency, audit logging, pagination and PII anonymization
  utilities are present.
- `docs/SECURITY.md` instructs operators to use private vulnerability
  reporting, HTTPS, strong secrets and a scoped database, and warns against
  enabling demo account auto-link in production.

Security posture is not a guarantee of absence of bugs. The route audit lists
partial migrations, and tenant-isolation check results should be run on the
actual target revision. See the security discussion in the final sections.

## 9. Database and data model

### Database technology and provider

Prisma datasource uses PostgreSQL. `DATABASE_URL` is used for runtime;
`DIRECT_DATABASE_URL` is documented for migrations, `db push`, and Studio.
Docker Compose sets up Postgres 16 locally. The repository does not lock the
operator to Supabase: any compatible PostgreSQL provider can be used. The
`.env` file is local configuration and must never be copied into audit docs.

### Schema inventory

`prisma/schema.prisma` is authoritative for models, scalar fields, enums,
relations, indexes, and uniqueness. SQL migration files under
`prisma/migrations/` express applied schema evolution. The full model-by-model
column/PK/FK/relationship inventory and SQL constraint details are recorded in
the **Database reference** section below after direct schema extraction; do
not substitute assumptions based on page names for schema evidence.

Migration directories found in this checkout:

1. `0_init`
2. `20260710120000_sprint_product_extensions`
3. `20260712120000_auth_signup_oauth`
4. `20260712140000_gymflo_import_batch`
5. `20260712200000_custom_entities_analytics`
6. `20260713140000_setting_gym_scope`

These are source migration files, not proof all environments have applied
them. A local `prisma migrate status` check during this session found these six
migrations pending in the configured Supabase database, and then
`prisma migrate deploy` applied them successfully. That reflects the
then-current developer environment only; do not infer other users’ or
production database state.

### Database relationships and constraints

Prisma schema declares application-side relational integrity. Important
tenancy decisions are recorded in `docs/adr/003-mandatory-gym-id.md`: every
tenant-owned query must scope by `gymId` directly or through a helper; routes
resolve gym from the session/request; member operations check membership in
the gym. The ADR notes previous unscoped queries and calls cross-tenant reads
a Sev-1 incident. This is a risk rationale, not proof the current code has no
scope defects.

### Database backup

`/api/cron/db-backup` exists, but the inspected cloud backup implementation
returns a stub; cloud backup export is explicitly not implemented. Arrange
provider-native backups and test restore independently.

## 10. API documentation

### API conventions

API endpoints are Next.js route handlers under `src/app/api/**/route.ts`.
The generated OpenAPI document is `openapi/openapi.json`; the generated route
audit is `docs/API_ROUTE_AUDIT.md`. Shared contracts are in `src/contracts/`.
Authentication, authorization, body validation, rate limiting, error response
shape and tenant scope are route-specific/shared-helper concerns. The generated
route audit is a 2026-07-13 snapshot and should be regenerated before using it
as a current completeness guarantee.

There are **169 API route files** in the inspected tree. Listing every concrete
path/method/query schema by manual transcription here risks inventing
parameters; use `openapi/openapi.json` and source handlers as the exact
endpoint-level authority. A grouped verified surface follows; this list is
not an exhaustive method/parameter schema:

| API group | Example route families / purpose |
|---|---|
| Identity | `/api/auth/[...nextauth]`, `/api/auth/signup`, `/api/auth/password-reset` |
| Members | `/api/members`, `/api/members/[id]`, photos, insights, communications, diet plan, repair/fix routes |
| Membership / payments | payment creation/quick entry, member payment, renewals, checkout links, Razorpay webhook |
| Attendance | `/api/attendance`, bootstrap, call-list, `/api/attendance/qr` |
| Billing | `/api/bills`, `/api/bills/[id]`, allocate, PDF, refund, templates |
| Analytics | `/api/analytics/*`, dashboard collections/sidebar counts, custom analytics |
| Leads / trials | `/api/leads*`, follow-ups, book-trial, free-trial-visits |
| Staff / trainers | `/api/users*`, `/api/trainers*` |
| Communications | `/api/communications/events`, campaign send/probe, reminders, inbox and WhatsApp history |
| Commerce | `/api/commerce/*`, products, orders, invoices and gym GST |
| Engagement / fitness | `/api/classes*`, challenges, participants, goals, leaderboard, workouts/diet assignments |
| Finance | `/api/expenses*`, finance endpoints, opportunities |
| Tenant/platform | accounts, account-context, gym context, gyms, marketplace, approvals, audit, admin repair/tasks |
| Jobs | `/api/cron/*`, `/api/inngest` |
| Integrators | `/api/agent/v1/*`, `/api/mcp`, OAuth token; some require feature gates |

For exact routes, verbs, parameters, security schemes, and OpenAPI request/
response definitions, inspect `openapi/openapi.json`; for actual implementation
and business checks, inspect the matching route and domain handler. The API
route audit reports 140 migrated routes, 29 partial routes, and zero direct
Prisma in route modules in that generated snapshot.

## 11. Payments, billing, and gateway integrations

### Internal payment records

Gym transactions can be entered/recorded through staff payment and quick-entry
flows, with payment methods including UPI, cash, card, bank transfer, and
other. These values represent how a payment was collected; selecting “UPI”
does not mean an automatic UPI gateway request took place. Billing pages,
bill APIs, print/PDF paths, allocation, and refund endpoints exist.

### Provider audit

| Provider | Finding |
|---|---|
| Razorpay | **Implemented, with limitations.** `src/lib/payments/razorpay.ts`, `src/domains/payments/handlers/razorpay-link.ts`, `public-member-pay.ts`, and `razorpay-webhook.ts` implement Payment Links. Webhook signature is checked in production; `payment_link.paid` updates a checkout-link row. Inspected webhook does not itself create a normal `Payment` record. Requires `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Test/live mode depends on credentials/provider settings and is not established by source. |
| Stripe | **Not implemented as checkout.** Appears in marketplace catalog as `coming_soon`; a secret name may be catalog metadata, not a working integration. |
| PhonePe | **No gateway API flow found.** Term may occur as a parsed payment method; that is not gateway integration. |
| Cashfree | **Not found** in targeted source/config/dependency audit. |
| PayU | **Not found** in targeted source/config/dependency audit. |
| Other | Manual cash, UPI, card, bank-transfer and other payment methods are application records. |

### Verification/refunds

Razorpay signature-checked webhook path is the verified provider callback.
Webhook-side payment ledger reconciliation, duplicate/idempotency behavior,
refund API calls, and all recovery scenarios must be independently tested.
Presence of `/api/bills/[id]/refund` alone does not establish a refund against
an external gateway.

## 12. WhatsApp, email, SMS and notifications

### Meta WhatsApp Cloud

- Meta Cloud client: `src/lib/whatsapp/meta-cloud.ts` (`sendMetaWabaText`).
- Communications adapter: `src/domains/communications/adapters/meta-waba-adapter.ts`.
- Current operative env names: `META_WABA_ACCESS_TOKEN`,
  `META_WABA_PHONE_NUMBER_ID`.
- Adapter selection considers credentials and gym-level enablement/force.
- The repo also has a WhatsApp bill workflow, reminders/campaigns/history,
  message templates and communications ledger-related modules.
- `.env.example` includes Meta WABA variables and marketplace-specific legacy
  `WHATSAPP_BUSINESS_PHONE_ID` / `WHATSAPP_BUSINESS_TOKEN` names; confirm the
  active path before configuring deployment.
- Inngest send, bulk-send and initialize handlers in
  `src/inngest/whatsapp-functions.ts` currently return “WhatsApp is disabled”.
  Thus an API transport is present, but automated scheduled sending via those
  jobs is partial/disabled.
- A separate legacy WhatsApp Web/Playwright/Browserbase path in
  `src/lib/whatsapp.ts` exists; it is not the official Meta Cloud API.
- Template approval, business verification, provider webhook completeness,
  inbound automation, and delivery status monitoring require Meta/deployment
  configuration and must not be assumed.

### Email, SMS and push

- Email: Resend integration in `src/lib/email/send.ts`; password reset and
  payment-bill call sites were found. Requires `RESEND_API_KEY` and
  `EMAIL_FROM`, which were not listed in `.env.example`.
- SMS: no vendor-backed sending flow found in the focused integration search.
- Web push: client subscription code uses `NEXT_PUBLIC_VAPID_PUBLIC_KEY`;
  complete server-side push delivery was not found/verified.
- In-app notifications/inbox endpoints are present.

## 13. Background jobs and external services

### Jobs and scheduling

- `vercel.json` schedules `/api/cron/unified` daily (`0 0 * * *`) in region
  `bom1`.
- Unified cron route/task registry exists; cron access uses `CRON_SECRET`.
- Inngest endpoint is `/api/inngest`; functions cover lifecycle/renewals,
  opportunity, outbox, recovery, WhatsApp and other event handling.
- `node-cron` dependency and scripts also exist; dependency presence alone does
  not prove each job runs in production.

### AI

Assistant and inference paths use AI SDKs with Groq-compatible and Anthropic
configurations. Feature flags and dev mock/fallbacks exist. AI provider,
model, keys, cost limits and production run schedules must be explicitly
configured. Nightly inference cron LLM is documented as off by default in
production.

### Other external services

- NextAuth Google/GitHub OAuth are optional.
- Supabase client constructors exist, but a production storage upload path was
  not verified.
- Upstash Redis/rate-limit packages exist; check runtime configuration to know
  whether distributed rate-limiting is active.
- Browserbase SDK/Playwright packages support some automation utilities.
- Vercel is concretely configured; Railway and self-hosted Node/PostgreSQL are
  documented options.

## 14. Complete user journeys (high-level verified flow)

The following describes the architecture and source surfaces. Exact business
rules and mandatory fields should be read in the linked form schemas and
handlers. A page’s presence is not proof that every flow has complete UI and
automated coverage.

### Owner/admin signup and login

1. User opens `/signup` or `/login`.
2. Signup page posts JSON to `/api/auth/signup`.
3. Route invokes identity signup handler, validates fields, checks for existing
   user, and provisions an owner account through auth helpers.
4. NextAuth credentials/OAuth flow establishes a session.
5. Middleware/layout and API handlers enforce session/role checks.

### Member registration and payment collection

1. Staff opens `/dashboard/members/new` and fills member details, selected
   plan/payment details and membership information.
2. Form submits to `/api/members`; the member domain handler validates and
   writes through Prisma.
3. Related membership and payment records are created according to handler
   logic; verify the exact transaction boundary and amount reconciliation in
   the current source before operational use.
4. Member page `/dashboard/members/[id]` shows details; payment and renewal
   subroutes allow subsequent activity.

### Razorpay checkout

1. Staff or member flow calls the Razorpay payment-link handler.
2. Integration creates an internal checkout-link record and calls Razorpay
   when live configuration is present; demo URL fallback may be available
   without keys.
3. User pays via provider-hosted link.
4. Provider posts `payment_link.paid`; webhook validates signature and marks
   checkout link paid.
5. Inspected webhook does not create the ordinary payment ledger record;
   verify/reconcile this path before treating it as complete accounting.

### Attendance

1. Staff dashboard attendance/QR path produces or reads signed QR payload.
2. QR endpoint verifies request/signature and attendance handler validates gym
   and member scope.
3. Attendance is stored through Prisma and reflected in attendance views/
   analytics. Biometric hardware is not present in the audited repository.

### Renewal / expiry

1. Dashboard exposes renewals/overdue/member renewal routes.
2. Scheduled cron or Inngest lifecycle functions process time-based
   maintenance/renewal work.
3. Messaging/reminder surfaces may create/send notices depending on channel,
   gym settings, credentials and enabled job path.
4. Production scheduler execution and WhatsApp job status must be monitored;
   source configuration alone does not prove successful delivery.

### Employee management

1. Admin opens `/dashboard/employees`, enters employee name/contact/password/
   role and active status.
2. UI posts to `/api/users`; admin-only handler validates, hashes password with
   bcryptjs, and creates the user and account membership.
3. Employee can sign in with assigned credentials; password change behavior
   depends on stored must-change flag and auth flow.

### Bills and finance

1. Staff creates/records payment and bill.
2. Bill APIs persist details and support bill detail, allocation, PDF/print,
   templates and refund routes.
3. Finance and analytics pages query stored payment/bill/expense data.
4. Email/WhatsApp receipt delivery is conditional on their separate
   integration configuration and implementation status.

## 15. Test coverage and quality signals

- Jest configuration: `jest.config.js`, `src/**/__tests__`, plus colocated
  source tests; route modules are excluded from coverage collection by
  configuration comment because handlers are tested elsewhere.
- Playwright specs: `e2e/login.spec.ts`, `dashboard.spec.ts`, `members.spec.ts`,
  `payment-flow.spec.ts`, `renewals-chase.spec.ts`, `analytics-hub.spec.ts`.
- Validation scripts: `scripts/validate-cli.ts`, `scripts/dev-validate.mjs`,
  API route audit, tenant-scope audit, mutating Zod audit, grandfather shrink,
  route line limit, OpenAPI freshness.
- CI workflows: `.github/workflows/ci.yml`, `deploy-production.yml`,
  `pr-review-gate.yml`, `release.yml`.
- Repository enumeration found 30 source unit-test files and 6 Playwright E2E
  specs; this is a file count, not test coverage percentage.
- During this session, ESLint on two edited employee files passed (a previous
  task’s changes). A full typecheck surfaced generated `.next` route typing
  errors and source errors in trainers commissions/payments. This is
  environment-time evidence and should be re-run against a clean current
  checkout before treating as baseline.

## 16. Known limitations, missing items and commercial readiness

### Findings directly supported by the repo audit

1. Backup service’s cloud implementation is a stub; arrange and test backups.
2. WhatsApp Inngest send/bulk/initialize functions are disabled, despite
   transport code and UI/credentials being present.
3. Razorpay checkout-link webhook marks a checkout record paid but does not
   itself create the normal payment record.
4. No PhonePe, Cashfree, or PayU API provider implementation was found.
5. Stripe is marked coming soon; no checkout implementation found.
6. SMS sending provider was not found.
7. Browser push subscription code exists; server delivery path is unverified.
8. Supabase clients exist, but application file storage workflow was not
   verified.
9. `.env.example` omits Resend variables used by email source and contains
   WhatsApp variable names that differ from operative `META_WABA_*` path.
10. API route audit snapshot documents 29 partial route migrations and should
    be regenerated as source evolves.

### Roadmap priorities

**P0 — before production**

- Verify tenant/gym scope and authorization for every sensitive route; run
  `npm run audit:tenant-scope:p0` and resolve all high-severity findings.
- Reconcile Razorpay webhook events into the canonical payment ledger with
  idempotency and tests; verify signature handling, retries, and refunds.
- Implement/replace backup stub with provider backups or encrypted backup
  exports, retention, alerting, and restore drills.
- Resolve disabled WhatsApp job paths or clearly disable UI/actions and explain
  the operational limitation.
- Validate all required environment names, production secrets, HTTPS, cron
  authentication, Inngest signing, and provider webhooks.
- Run clean production build, typecheck, lint, migration status, unit/E2E smoke
  tests against a dedicated staging database.

**P1 — operational completeness**

- Add receipt/communication delivery status, retry queue, and clear failure
  reporting.
- Complete push delivery or remove unsupported subscription UX.
- Document email provider configuration and harmonize WhatsApp config names.
- Validate member-facing onboarding, password reset and employee access
  journeys end to end.
- Add backup/restore and payment reconciliation monitoring.

**P2 — product maturity**

- Expand automated tests around tenant boundaries, billing edge cases,
  refunds, schedule retries, and permission matrices.
- Clarify which staff roles receive which permissions; test UI and API parity.
- Improve reporting/data export and production observability based on usage.
- Define SaaS provisioning, per-account quotas/billing and support practices
  if commercial multi-tenant operation is intended.

These are recommendations based on identified gaps, not promises that other
features are absent.

## 17. Final assessment

Fitness360 is a sizeable, actively structured gym-management product rather
than a simple prototype: it has a broad Next.js dashboard/API, Prisma-backed
PostgreSQL model, domain-oriented handlers, multi-gym concepts, auth/RBAC,
communications, payment recording, a Razorpay integration, tests, CI and
deployment configuration. It is suitable for continued development and
controlled staging evaluation.

It should **not** be considered automatically production-ready just because
the project builds or a page works locally. The most important verified
operational cautions are disabled WhatsApp background sending, incomplete
Razorpay ledger reconciliation in the inspected webhook, and the cloud backup
stub. Database/provider configuration, tenant isolation, user permissions,
restore procedures, external provider verification, and test/build status must
be validated in the target deployment.

## 18. Detailed source references

Use these paths for the source of truth behind this guide:

- Project setup: `README.md`, `docs/DEVELOPMENT.md`, `prisma/ENV.md`,
  `.env.example`, `docker-compose.yml`
- Architecture/product scope: `docs/OPEN_CORE.md`, `docs/FEATURE_PARITY.md`,
  `docs/adr/001-modular-monolith-first.md`,
  `docs/adr/002-api-auth-classes.md`,
  `docs/adr/003-mandatory-gym-id.md`
- Schema/migrations: `prisma/schema.prisma`, `prisma/migrations/`
- API inventory: `docs/API_ROUTE_AUDIT.md`, `openapi/openapi.json`,
  `src/app/api/`
- Domain logic: `src/domains/`
- Auth and security: `src/lib/auth.ts`, `src/lib/permissions.ts`,
  `src/lib/api-handler.ts`, `src/lib/security/`, `src/middleware.ts`
- Integrations/jobs: `src/lib/payments/`, `src/lib/whatsapp/`,
  `src/lib/email/`, `src/inngest/`, `src/app/api/cron/`,
  `src/app/api/inngest/`
- Tests/automation: `src/**/__tests__/`, `e2e/`, `jest.config.js`,
  `playwright.config.ts`, `.github/workflows/`

## Appendix A: Complete Prisma model and enum definitions

The following reference is extracted from `prisma/schema.prisma` in this
repository snapshot. It preserves model field names, Prisma scalar/enum types,
defaults, uniqueness, indexes, and declared relations. It contains no runtime
credential values. Refer to the migration SQL for database-specific DDL history.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  // App runtime: DATABASE_URL
  url      = env("DATABASE_URL")
  // Migrations / studio: DIRECT_DATABASE_URL (same as DATABASE_URL when host has no separate direct URL)
  directUrl = env("DIRECT_DATABASE_URL")
}

enum AccountPlan {
  FREE
  PRO
  ENTERPRISE
}

enum AccountMemberRole {
  OWNER
  ADMIN
  STAFF
}

enum OAuthClientType {
  ACCOUNT
  AGENT
}

model Account {
  id                 String               @id @default(uuid()) @db.Uuid
  name               String
  plan               AccountPlan          @default(FREE)
  createdAt          DateTime             @default(now())
  updatedAt          DateTime             @updatedAt
  User               User[]
  Gym                Gym[]
  AccountMembership  AccountMembership[]
  OAuthClient        OAuthClient[]
}

model AccountMembership {
  id        String            @id @default(cuid())
  userId    String
  accountId String            @db.Uuid
  role      AccountMemberRole @default(STAFF)
  isActive  Boolean           @default(true)
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt
  User      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  Account   Account           @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([userId, accountId])
  @@index([accountId])
  @@index([userId])
}

model OAuthClient {
  id               String          @id @default(cuid())
  clientId         String          @unique
  clientSecretHash String
  type             OAuthClientType
  accountId        String          @db.Uuid
  gymId            String?         @db.Uuid
  name             String
  scopes           String[]
  isActive         Boolean         @default(true)
  revokedAt        DateTime?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  Account          Account         @relation(fields: [accountId], references: [id], onDelete: Cascade)
  Gym              Gym?            @relation(fields: [gymId], references: [id], onDelete: Cascade)
  OAuthAccessToken OAuthAccessToken[]

  @@index([accountId])
  @@index([gymId])
}

model OAuthAccessToken {
  id        String      @id @default(cuid())
  tokenHash String      @unique
  clientId  String
  accountId String      @db.Uuid
  gymId     String?     @db.Uuid
  scopes    String[]
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime    @default(now())
  OAuthClient OAuthClient @relation(fields: [clientId], references: [clientId], onDelete: Cascade)

  @@index([clientId])
  @@index([accountId])
  @@index([expiresAt])
}

model Gym {
  id                   String                 @id @default(uuid()) @db.Uuid
  accountId            String                 @db.Uuid
  name                 String
  publicBookSlug       String?                @unique
  address              String?
  phone                String?
  email                String?
  gstin                String?
  invoiceLegalName     String?
  invoiceStateCode     String?
  logoUrl              String?
  financialYearStart   DateTime?              @db.Date
  financialYearEnd     DateTime?              @db.Date
  currencyCode         String                 @default("INR")
  createdAt            DateTime               @default(now())
  updatedAt            DateTime               @updatedAt
  Account              Account                @relation(fields: [accountId], references: [id], onDelete: Cascade)
  Member               Member[]
  Payment              Payment[]
  Membership           Membership[]
  Bill                 Bill[]
  Achievement          Achievement[]
  Attendance           Attendance[]
  Reminder             Reminder[]
  OverdueTracking      OverdueTracking[]
  TrainerClient        TrainerClient[]
  TrainerCommission    TrainerCommission[]
  Workout              Workout[]
  ExpectedPayment      ExpectedPayment[]
  MessageLog           MessageLog[]
  ChurnPrediction      ChurnPrediction[]
  ReminderLog          ReminderLog[]
  WhatsAppSendLog      WhatsAppSendLog[]
  CommunicationEvent   CommunicationEvent[]
  Opportunity          Opportunity[]
  Challenge            Challenge[]
  ChallengeParticipant ChallengeParticipant[]
  Expense              Expense[]
  Salary               Salary[]
  Plan                 Plan[]
  AttendanceUpload     AttendanceUpload[]
  FreeTrialVisit       FreeTrialVisit[]
  AuditLog             AuditLog[]
  GymClass             GymClass[]
  ClassBooking         ClassBooking[]
  MarketplaceInstall   GymMarketplaceInstall[]
  PaymentCheckoutLink  PaymentCheckoutLink[]
  OAuthClient          OAuthClient[]
  Goal                 Goal[]
  Approval             Approval[]
  Offer                Offer[]
  Product              Product[]
  DietPlanAssignment   DietPlanAssignment[]
  Lead                 Lead[]
  OrderLine            OrderLine[]
  WhatsAppTemplate     WhatsAppTemplate[]
  WhatsAppCampaign     WhatsAppCampaign[]
  SupplementGstInvoice SupplementGstInvoice[]
  GymFact                GymFact[]
  Service                Service[]
  InvoiceTransaction   InvoiceTransaction[]
  LeadFollowUp         LeadFollowUp[]
  StaffNotification    StaffNotification[]
  AdminTask            AdminTask[]
  DailyStats           DailyStats[]
  ErrorLog             ErrorLog[]
  CustomEntityDefinition CustomEntityDefinition[]
  CustomEntityRecord   CustomEntityRecord[]
  CustomAnalyticsDefinition CustomAnalyticsDefinition[]
  Setting               Setting[]

  @@index([accountId])
}

enum CustomFieldType {
  TEXT
  NUMBER
  BOOLEAN
  DATE
  SELECT
}

enum CustomAnalyticsSource {
  MEMBERS
  PAYMENTS
  ATTENDANCE
  CUSTOM_ENTITY
}

enum CustomAnalyticsAggregation {
  COUNT
  SUM
  AVG
}

model CustomEntityDefinition {
  id          String   @id @default(cuid())
  gymId       String   @db.Uuid
  slug        String
  name        String
  description String?
  fields      Json
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  Gym         Gym      @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Records     CustomEntityRecord[]

  @@unique([gymId, slug])
  @@index([gymId])
}

model CustomEntityRecord {
  id        String                 @id @default(cuid())
  gymId     String                 @db.Uuid
  entityId  String
  data      Json
  createdAt DateTime               @default(now())
  updatedAt DateTime               @updatedAt
  Gym       Gym                    @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Entity    CustomEntityDefinition @relation(fields: [entityId], references: [id], onDelete: Cascade)

  @@index([gymId, entityId])
}

model CustomAnalyticsDefinition {
  id          String                     @id @default(cuid())
  gymId       String                     @db.Uuid
  slug        String
  name        String
  description String?
  source      CustomAnalyticsSource
  aggregation CustomAnalyticsAggregation @default(COUNT)
  fieldKey    String?
  entitySlug  String?
  filters     Json?
  groupBy     String?
  isActive    Boolean                    @default(true)
  createdAt   DateTime                   @default(now())
  updatedAt   DateTime                   @updatedAt
  Gym         Gym                        @relation(fields: [gymId], references: [id], onDelete: Cascade)

  @@unique([gymId, slug])
  @@index([gymId])
}

model Service {
  id          String   @id @default(cuid())
  gymId       String   @db.Uuid
  name        String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  Gym         Gym      @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Plan        Plan[]

  @@index([gymId])
  @@unique([gymId, name])
}

enum GymFactType {
  METRIC
  INSIGHT
  AGGREGATE
}

model GymFact {
  id        String      @id @default(cuid())
  gymId     String      @db.Uuid
  factKey   String
  factType  GymFactType @default(METRIC)
  value     Json
  source    String
  validAt   DateTime    @default(now())
  createdAt DateTime    @default(now())
  Gym       Gym         @relation(fields: [gymId], references: [id], onDelete: Cascade)

  @@unique([gymId, factKey])
  @@index([gymId, factType])
}

model Achievement {
  id          String   @id @default(cuid())
  gymId       String   @db.Uuid
  memberId    String
  name        String
  description String
  icon        String?
  earnedAt    DateTime @default(now())
  Gym         Gym      @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member      Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([earnedAt])
  @@index([gymId])
  @@index([memberId])
}

model Attendance {
  id         String           @id @default(cuid())
  gymId      String           @db.Uuid
  memberId   String
  checkIn    DateTime         @default(now())
  checkOut   DateTime?
  location   String?
  qrCodeData String?
  method     AttendanceMethod @default(MANUAL)
  Gym        Gym              @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member     Member           @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([checkIn])
  @@index([gymId])
  @@index([memberId])
  @@index([memberId, checkIn])
  @@index([checkIn, method])
  @@index([gymId, checkIn])
}

model FreeTrialVisit {
  id              String           @id @default(cuid())
  gymId           String           @db.Uuid
  kind            WalkInVisitKind
  name            String
  phone           String
  visitDate       DateTime         @db.Date
  amount          Decimal?         @db.Decimal(10, 2)
  notes           String?
  ptSessionCount  Int?
  createdById String?
  createdAt   DateTime         @default(now())
  Gym         Gym              @relation(fields: [gymId], references: [id], onDelete: Cascade)
  User        User?            @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@index([gymId])
  @@index([visitDate])
  @@index([phone])
  @@index([gymId, phone, kind])
  @@index([gymId, visitDate, kind])
}

model Bill {
  id               String        @id @default(cuid())
  gymId            String        @db.Uuid
  memberId         String
  billNumber       String
  programType      ProgramType
  amount           Decimal?      @db.Decimal(10, 2)
  paymentMethod    PaymentMethod
  month            String
  validFrom        DateTime
  validTo          DateTime
  nextPaymentDate  DateTime?
  workoutPlan      String
  hideAmount       Boolean       @default(false)
  notes            String?
  generatedById    String
  billSentAt       DateTime?
  status           BillStatus    @default(ISSUED)
  dueDate          DateTime?     @db.Date
  tax              Decimal?      @db.Decimal(10, 2)
  discountAmount   Decimal?      @db.Decimal(10, 2)
  discountNote     String?
  subscriptionFee  Decimal?      @db.Decimal(10, 2)
  paidAmount       Decimal       @default(0) @db.Decimal(10, 2)
  dueAmount        Decimal       @default(0) @db.Decimal(10, 2)
  membershipId     String?
  deletedAt        DateTime?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  Gym              Gym           @relation(fields: [gymId], references: [id], onDelete: Cascade)
  User             User          @relation(fields: [generatedById], references: [id])
  Member           Member        @relation(fields: [memberId], references: [id], onDelete: Cascade)
  Membership       Membership?   @relation(fields: [membershipId], references: [id], onDelete: SetNull)
  Payment          Payment[]
  InvoiceTransaction InvoiceTransaction[]
  ExpectedPayment  ExpectedPayment[]

  @@unique([gymId, billNumber])
  @@index([billNumber])
  @@index([createdAt])
  @@index([gymId])
  @@index([memberId])
  @@index([status])
  @@index([dueDate])
  @@index([deletedAt])
}

model Challenge {
  id                   String                 @id @default(cuid())
  gymId                String                 @db.Uuid
  name                 String
  description          String
  type                 ChallengeType
  status               ChallengeStatus        @default(UPCOMING)
  startDate            DateTime
  endDate              DateTime
  targetValue          Int?
  prize                String?
  createdAt            DateTime               @default(now())
  updatedAt            DateTime               @updatedAt
  Gym                  Gym                    @relation(fields: [gymId], references: [id], onDelete: Cascade)
  ChallengeParticipant ChallengeParticipant[]

  @@index([endDate])
  @@index([gymId])
  @@index([startDate])
  @@index([status])
}

model ChallengeParticipant {
  id           String    @id @default(cuid())
  gymId        String    @db.Uuid
  challengeId  String
  memberId     String
  currentValue Int       @default(0)
  rank         Int?
  isWinner     Boolean   @default(false)
  joinedAt     DateTime  @default(now())
  Gym          Gym       @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Challenge    Challenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  Member       Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([challengeId, memberId])
  @@index([challengeId])
  @@index([gymId])
  @@index([memberId])
}

model Expense {
  id           String          @id @default(cuid())
  gymId        String          @db.Uuid
  description  String
  category     ExpenseCategory
  type         ExpenseType     @default(ONE_TIME)
  amount       Decimal         @db.Decimal(10, 2)
  paymentDate  DateTime
  method       PaymentMethod
  vendor       String?
  reference    String?
  notes        String?
  nextDueDate  DateTime?
  status       ExpenseStatus   @default(PAID)
  dueDate      DateTime?       @db.Date
  paidAt       DateTime?
  recordedById String
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
  Gym          Gym             @relation(fields: [gymId], references: [id], onDelete: Cascade)
  User         User            @relation(fields: [recordedById], references: [id])

  @@index([category])
  @@index([gymId, paymentDate])
  @@index([gymId])
  @@index([paymentDate])
  @@index([type])
  @@index([status])
  @@index([dueDate])
}

model Member {
  id                   String                 @id
  gymId                String                 @db.Uuid
  name                 String
  phone                String
  email                String?
  gender               Gender?
  dateOfBirth          DateTime?
  address              String?
  emergencyContact     String?
  photo                String?
  source               MemberAcquisitionSource?
  goal                 MemberFitnessGoal?
  healthIssue          String?
  country              String?
  state                String?
  city                 String?
  pincode              String?
  status               MemberStatus           @default(ACTIVE)
  joinDate             DateTime               @default(now())
  nextRenewalDate      DateTime?              @db.Date
  lastPaymentDate      DateTime?              @db.Date
  lastReminderSentAt   DateTime?
  createdById          String?
  deletedAt            DateTime?
  createdAt            DateTime               @default(now())
  updatedAt            DateTime               @updatedAt
  Achievement          Achievement[]
  Attendance           Attendance[]
  Bill                 Bill[]
  ChallengeParticipant ChallengeParticipant[]
  User                 User?                  @relation(fields: [createdById], references: [id])
  Membership           Membership[]
  Payment              Payment[]
  Reminder             Reminder[]
  TrainerClient        TrainerClient[]
  TrainerCommission    TrainerCommission[]
  Workout              Workout[]
  ExpectedPayment      ExpectedPayment[]
  MessageLog           MessageLog[]
  ChurnPrediction      ChurnPrediction[]
  ReminderLogs         ReminderLog[]          @relation("ReminderLogs")
  WhatsAppSendLogs     WhatsAppSendLog[]
  CommunicationEvents  CommunicationEvent[]
  Opportunities        Opportunity[]
  OverdueTracking      OverdueTracking[]
  ClassBooking         ClassBooking[]
  PaymentCheckoutLink  PaymentCheckoutLink[]
  DietPlanAssignment   DietPlanAssignment[]
  OrderLine            OrderLine[]
  SupplementGstInvoice SupplementGstInvoice[]
  Gym                  Gym                    @relation(fields: [gymId], references: [id], onDelete: Restrict)

  @@unique([gymId, phone])
  @@index([id])
  @@index([gymId])
  @@index([phone])
  @@index([status, createdAt])
  @@index([status])
  @@index([status, joinDate])
  @@index([nextRenewalDate])
  @@index([status, nextRenewalDate])
  @@index([email])
  @@index([deletedAt])
}

model Membership {
  id                    String                     @id @default(cuid())
  gymId                 String                     @db.Uuid
  memberId              String
  planId                String
  startDate             DateTime                   @db.Date
  endDate               DateTime                   @db.Date
  amount                Decimal                    @db.Decimal(10, 2)
  previousMembershipId  String?
  sourcePaymentId       String?
  lifecycleStatus       MembershipLifecycleStatus  @default(ONGOING)
  createdAt             DateTime                   @default(now())
  Gym                   Gym                        @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member                Member                     @relation(fields: [memberId], references: [id], onDelete: Cascade)
  Plan                  Plan                       @relation(fields: [planId], references: [id])
  PreviousMembership    Membership?                @relation("MembershipRenewal", fields: [previousMembershipId], references: [id], onDelete: SetNull)
  RenewedMemberships    Membership[]               @relation("MembershipRenewal")
  Bill                  Bill[]

  @@unique([memberId, startDate, endDate])
  @@index([endDate])
  @@index([gymId])
  @@index([memberId, endDate])
  @@index([memberId])
  @@index([startDate, endDate])
  @@index([gymId, endDate])
  @@index([previousMembershipId])
  @@index([lifecycleStatus])
}

model Payment {
  id                    String           @id @default(cuid())
  gymId                 String           @db.Uuid
  memberId              String
  amount                Decimal          @db.Decimal(10, 2)
  method                PaymentMethod
  status                PaymentStatus    @default(COMPLETED)
  reference             String?
  notes                 String?
  receivedById          String
  receivedAt            DateTime         @db.Date
  paymentDate           DateTime?        @db.Date
  planId                String?
  duration              String?
  source                PaymentSource?
  createdAt             DateTime         @default(now())
  friendsFamilyDiscount Boolean          @default(false)
  isPersonalTrainer     Boolean          @default(false)
  monthlyRate           Decimal?         @db.Decimal(10, 2)
  packageDuration       String?
  specialOccasion       String?
  studentGymfloPlan     Boolean          @default(false)
  month                 Int?
  year                  Int?
  billSentAt            DateTime?
  billId                String?
  Gym                   Gym              @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member                Member           @relation(fields: [memberId], references: [id], onDelete: Cascade)
  User                  User             @relation(fields: [receivedById], references: [id])
  Plan                  Plan?            @relation(fields: [planId], references: [id])
  ExpectedPayment       ExpectedPayment?
  Bill                  Bill?            @relation(fields: [billId], references: [id], onDelete: SetNull)
  InvoiceTransaction    InvoiceTransaction[]

  @@index([gymId])
  @@index([memberId])
  @@index([memberId, receivedAt])
  @@index([memberId, paymentDate])
  @@index([method, receivedAt])
  @@index([gymId, receivedAt])
  @@index([gymId, status, receivedAt])
  @@index([receivedAt])
  @@index([paymentDate])
  @@index([status, receivedAt])
  @@index([year, month])
  @@index([memberId, status])
  @@index([billId])
}

model InvoiceTransaction {
  id            String                 @id @default(cuid())
  gymId         String                 @db.Uuid
  billId        String
  paymentId     String?
  type          InvoiceTransactionType
  amount        Decimal                @db.Decimal(10, 2)
  occurredAt    DateTime               @default(now())
  paymentMethod PaymentMethod?
  note          String?
  referenceId   String?
  createdById   String?
  createdAt     DateTime               @default(now())
  Gym           Gym                    @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Bill          Bill                   @relation(fields: [billId], references: [id], onDelete: Cascade)
  Payment       Payment?               @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  User          User?                  @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@index([gymId])
  @@index([billId])
  @@index([paymentId])
  @@index([occurredAt])
}

model Plan {
  id           String       @id
  gymId        String       @db.Uuid
  serviceId    String?
  name         String
  durationDays Int
  price        Decimal      @db.Decimal(10, 2)
  description  String?
  planType     PlanType     @default(GYM)
  isActive     Boolean      @default(true)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  Gym          Gym          @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Service      Service?     @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  Membership   Membership[]
  Payment      Payment[]

  @@index([gymId])
  @@index([planType, durationDays])
  @@index([serviceId])
}

model Reminder {
  id           String         @id @default(cuid())
  gymId        String         @db.Uuid
  memberId     String
  type         ReminderType
  message      String
  scheduledFor DateTime
  sentAt       DateTime?
  status       ReminderStatus @default(SCHEDULED)
  errorMessage String?
  createdAt    DateTime       @default(now())
  Gym          Gym            @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member       Member         @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([gymId])
  @@index([scheduledFor])
  @@index([status])
}

model Salary {
  id                           String        @id @default(cuid())
  gymId                        String        @db.Uuid
  employeeId                   String
  amount                       Decimal       @db.Decimal(10, 2)
  paymentDate                  DateTime
  month                        Int
  year                         Int
  method                       PaymentMethod
  reference                    String?
  notes                        String?
  paidById                     String
  createdAt                    DateTime      @default(now())
  Gym                          Gym           @relation(fields: [gymId], references: [id], onDelete: Cascade)
  User_Salary_employeeIdToUser User          @relation("Salary_employeeIdToUser", fields: [employeeId], references: [id], onDelete: Cascade)
  User_Salary_paidByIdToUser   User          @relation("Salary_paidByIdToUser", fields: [paidById], references: [id])

  @@index([employeeId])
  @@index([gymId, paymentDate])
  @@index([gymId])
  @@index([paymentDate])
  @@index([year, month])
}

model Setting {
  id          String   @id @default(cuid())
  gymId       String   @db.Uuid
  key         String
  value       String
  description String?
  updatedAt   DateTime @updatedAt
  Gym         Gym      @relation(fields: [gymId], references: [id], onDelete: Cascade)

  @@unique([gymId, key], name: "gymId_key")
  @@index([gymId])
}

model OverdueTracking {
  id              String   @id @default(cuid())
  gymId           String   @db.Uuid
  memberId        String
  month           String
  detectedAt      DateTime @default(now())
  lastSeenAt      DateTime?
  markedInactiveAt DateTime?
  resolvedAt      DateTime?
  notes           String?
  Gym             Gym      @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member          Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([memberId, month])
  @@index([gymId])
  @@index([memberId])
  @@index([detectedAt])
  @@index([markedInactiveAt])
  @@index([gymId, resolvedAt])
}

enum JobExecutionStatus {
  RUNNING
  COMPLETED
  FAILED
}

model JobExecution {
  id          String             @id @default(cuid())
  jobName     String
  status      JobExecutionStatus
  startedAt   DateTime           @default(now())
  completedAt DateTime?
  metadata    Json?
  error       String?            @db.Text

  @@index([jobName])
  @@index([jobName, status])
}

model TrainerClient {
  id        String    @id @default(cuid())
  gymId     String    @db.Uuid
  trainerId String
  memberId  String
  startDate DateTime  @default(now())
  endDate   DateTime?
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  Gym       Gym       @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member    Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)
  User      User      @relation(fields: [trainerId], references: [id], onDelete: Cascade)

  @@unique([trainerId, memberId])
  @@index([gymId])
  @@index([memberId])
  @@index([trainerId])
  @@index([trainerId, isActive])
}

model TrainerCommission {
  id             String    @id @default(cuid())
  gymId          String    @db.Uuid
  trainerId      String
  memberId       String
  amount         Decimal   @db.Decimal(10, 2)
  commissionRate Decimal   @db.Decimal(5, 2)
  baseAmount     Decimal   @db.Decimal(10, 2)
  month          Int
  year           Int
  isPaid         Boolean   @default(false)
  paidDate       DateTime?
  notes          String?
  createdAt      DateTime  @default(now())
  Gym            Gym       @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member         Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)
  User           User      @relation(fields: [trainerId], references: [id], onDelete: Cascade)

  @@index([gymId])
  @@index([isPaid])
  @@index([gymId, year, month])
  @@index([memberId])
  @@index([trainerId])
  @@index([year, month])
}

model User {
  id                             String              @id @default(cuid())
  accountId                      String?             @db.Uuid
  email                          String?             @unique
  contactNumber                  String              @unique
  passwordHash                   String?
  name                           String
  role                           Role                @default(SUB_ADMIN)
  isActive                       Boolean             @default(true)
  mustChangePassword             Boolean             @default(true)
  lastPasswordChange             DateTime?
  createdAt                      DateTime            @default(now())
  updatedAt                      DateTime            @updatedAt
  commissionRate                 Decimal?            @db.Decimal(5, 2)
  isTrainer                      Boolean             @default(false)
  Account                        Account?            @relation(fields: [accountId], references: [id], onDelete: SetNull)
  AccountMembership            AccountMembership[]
  AuthProviders                  UserAuthProvider[]
  Bill                           Bill[]
  Expense                        Expense[]
  Member                         Member[]
  Payment                        Payment[]
  Salary_Salary_employeeIdToUser Salary[]            @relation("Salary_employeeIdToUser")
  Salary_Salary_paidByIdToUser   Salary[]            @relation("Salary_paidByIdToUser")
  TrainerClient                  TrainerClient[]
  TrainerCommission              TrainerCommission[]
  AttendanceUpload               AttendanceUpload[]
  FreeTrialVisit                 FreeTrialVisit[]
  ReminderLogsSentBy             ReminderLog[]       @relation("ReminderLogsSentBy")
  AuditLog                       AuditLog[]
  InvoiceTransaction             InvoiceTransaction[]
  PasswordResetToken             PasswordResetToken[]
  StaffNotification              StaffNotification[]
  LeadFollowUp                   LeadFollowUp[]
  ErrorLog                       ErrorLog[]

  @@index([accountId])
}

model UserAuthProvider {
  id             String   @id @default(cuid())
  userId         String
  provider       String
  providerUserId String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  User           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerUserId])
  @@index([userId])
}

model AuditLog {
  id         String   @id @default(cuid())
  gymId      String?  @db.Uuid
  userId     String
  action     String // e.g. "payment_add", "member_add", "reminder_sent"
  entityType String // e.g. "Payment", "Member", "Reminder"
  entityId   String?
  details    Json?
  createdAt  DateTime @default(now())

  Gym  Gym? @relation(fields: [gymId], references: [id], onDelete: SetNull)
  User User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([gymId])
  @@index([userId])
  @@index([createdAt])
  @@index([action])
}

model Workout {
  id              String            @id @default(cuid())
  gymId           String            @db.Uuid
  memberId        String
  name            String
  description     String?
  date            DateTime          @default(now())
  duration        Int?
  caloriesBurned  Int?
  notes           String?
  createdAt       DateTime          @default(now())
  Gym             Gym               @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member          Member            @relation(fields: [memberId], references: [id], onDelete: Cascade)
  WorkoutExercise WorkoutExercise[]

  @@index([date])
  @@index([gymId])
  @@index([memberId])
}

model WorkoutExercise {
  id           String   @id @default(cuid())
  workoutId    String
  exerciseName String
  sets         Int
  reps         Int
  weight       Decimal? @db.Decimal(10, 2)
  restTime     Int?
  notes        String?
  createdAt    DateTime @default(now())
  Workout      Workout  @relation(fields: [workoutId], references: [id], onDelete: Cascade)

  @@index([workoutId])
}

enum AttendanceMethod {
  MANUAL
  RFID
  QR_CODE
  BIOMETRIC
  GEOFENCE
}

enum WalkInVisitKind {
  FREE_TRIAL
  DAY_PASS
}

enum ChallengeStatus {
  UPCOMING
  ACTIVE
  COMPLETED
  CANCELLED
}

enum ChallengeType {
  ATTENDANCE
  WORKOUT_COUNT
  CALORIES_BURNED
  WEIGHT_LOSS
  CUSTOM
}

enum ExpenseCategory {
  RENT
  UTILITIES
  EQUIPMENT
  MAINTENANCE
  MARKETING
  SUPPLIES
  INSURANCE
  PROFESSIONAL_SERVICES
  SOFTWARE_SUBSCRIPTION
  TRAVEL
  FOOD_BEVERAGES
  OTHER
}

enum ExpenseType {
  RECURRING
  ONE_TIME
}

enum ExpenseStatus {
  PENDING
  PAID
  OVERDUE
}

enum BillStatus {
  ISSUED
  PAID
  PARTIAL
  OVERDUE
  REFUND
  CANCELLED
}

enum InvoiceTransactionType {
  PAYMENT
  REFUND
}

enum MembershipLifecycleStatus {
  UPCOMING
  ONGOING
  EXPIRING
  EXPIRED
  RENEWED
}

enum MemberAcquisitionSource {
  PROMOTIONS
  WORD_OF_MOUTH
  REFERRAL
  WALK_IN
  OTHER
}

enum MemberFitnessGoal {
  FITNESS
  BODYBUILDING
  FAT_LOSS
  WEIGHT_GAIN
  OTHER
}

enum FollowUpMethod {
  CALL
  EMAIL
  IN_PERSON
  WHATSAPP
  OTHER
}

enum FollowUpStatus {
  PENDING
  DONE
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

enum MemberStatus {
  ACTIVE
  EXPIRED
}

enum PaymentMethod {
  UPI
  CASH
  MIXED
  CARD
  BANK_TRANSFER
  CHEQUE
  ONLINE
  OTHER
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

enum PaymentSource {
  MANUAL
  WHATSAPP
  BULK_IMPORT
}

enum ProgramType {
  MAINTENANCE
  BODYBUILDING
  WEIGHT_LOSS
}

enum ReminderStatus {
  SCHEDULED
  SENT
  FAILED
  CANCELLED
}

enum ReminderType {
  RENEWAL_DUE
  RENEWAL_OVERDUE
  PAYMENT_PENDING
  BIRTHDAY
  CUSTOM
}

enum Role {
  ADMIN
  SUB_ADMIN
}

model ExpectedPayment {
  id             String        @id @default(cuid())
  gymId          String        @db.Uuid
  memberId       String
  membershipId   String?
  billId         String?
  dueDate        DateTime
  amount         Decimal       @db.Decimal(10, 2)
  status         PaymentStatus @default(PENDING)
  paymentId      String?       @unique
  reminderSent   Boolean       @default(false)
  reminderSentAt DateTime?
  notes          String?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  Gym            Gym           @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member         Member        @relation(fields: [memberId], references: [id], onDelete: Cascade)
  Payment        Payment?      @relation(fields: [paymentId], references: [id])
  Bill           Bill?         @relation(fields: [billId], references: [id], onDelete: SetNull)

  @@index([gymId])
  @@index([memberId, dueDate])
  @@index([status, dueDate])
  @@index([dueDate])
  @@index([billId])
}

model MessageLog {
  id           String        @id @default(cuid())
  gymId        String?       @db.Uuid
  memberId     String?
  phone        String
  message      String        @db.Text
  status       MessageStatus @default(PENDING)
  sentAt       DateTime?
  deliveredAt  DateTime?
  errorMessage String?       @db.Text
  retryCount   Int           @default(0)
  metadata     Json?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  Gym          Gym?          @relation(fields: [gymId], references: [id], onDelete: SetNull)
  Member       Member?       @relation(fields: [memberId], references: [id], onDelete: SetNull)

  @@index([gymId])
  @@index([memberId])
  @@index([status])
  @@index([createdAt])
  @@index([phone])
}

model AttendanceUpload {
  id           String                 @id @default(cuid())
  gymId        String                 @db.Uuid
  uploadedById String
  imageUrl     String
  fileName     String
  uploadDate   DateTime
  parsed       Boolean                @default(false)
  parsedData   Json?
  status       AttendanceUploadStatus @default(PENDING)
  errorMessage String?                @db.Text
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt
  Gym          Gym                    @relation(fields: [gymId], references: [id], onDelete: Cascade)
  UploadedBy   User                   @relation(fields: [uploadedById], references: [id])

  @@index([gymId])
  @@index([uploadedById])
  @@index([uploadDate])
  @@index([status])
}

model ChurnPrediction {
  id                   String    @id @default(cuid())
  gymId                String    @db.Uuid
  memberId             String
  score                Int // 0-100
  riskLevel            String // SAFE, RISK, HIGH_CHURN
  attendanceLast30Days Int
  paymentDelayDays     Int?
  daysUntilExpiry      Int?
  lastAttendanceDate   DateTime?
  calculatedAt         DateTime  @default(now())
  Gym                  Gym       @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member               Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([gymId, memberId])
  @@index([gymId])
  @@index([memberId])
  @@index([riskLevel])
  @@index([calculatedAt])
}

enum MessageStatus {
  PENDING
  QUEUED
  SENT
  DELIVERED
  FAILED
  RETRY
}

enum AttendanceUploadStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model ReminderLog {
  id          String            @id @default(cuid())
  gymId       String            @db.Uuid
  memberId    String
  type        ReminderLogType
  phoneNumber String
  message     String            @db.Text
  sentAt      DateTime          @default(now())
  status      ReminderLogStatus
  error       String?           @db.Text
  sentBy      String
  metadata    Json?
  createdAt   DateTime          @default(now())

  Gym    Gym    @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member Member @relation("ReminderLogs", fields: [memberId], references: [id], onDelete: Cascade)
  SentBy User   @relation("ReminderLogsSentBy", fields: [sentBy], references: [id])

  @@index([gymId])
  @@index([memberId])
  @@index([sentAt])
  @@index([type])
  @@index([status])
  @@index([gymId, sentAt])
}

model ReminderTemplate {
  id        String          @id @default(cuid())
  name      String          @unique
  type      ReminderLogType
  subject   String?
  message   String          @db.Text
  variables Json?
  isActive  Boolean         @default(true)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}

model ReceiptTemplate {
  id          String      @id @default(cuid())
  name        String      @unique
  type        ReceiptType
  htmlContent String      @db.Text
  variables   Json?
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model WhatsAppSendLog {
  id         String              @id @default(cuid())
  gymId      String              @db.Uuid
  memberId   String
  memberName String
  type       WhatsAppSendLogType
  sentAt     DateTime            @default(now())
  status     WhatsAppSendStatus  @default(SENT)
  error      String?             @db.Text
  createdAt  DateTime            @default(now())

  Gym    Gym    @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member Member @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([gymId])
  @@index([memberId])
  @@index([sentAt])
  @@index([type])
}

enum WhatsAppSendLogType {
  BILL
  REMINDER
}

enum WhatsAppSendStatus {
  SENT
  FAILED
}

enum CommunicationChannel {
  WHATSAPP
  SMS
  EMAIL
  IN_APP
}

enum CommunicationDirection {
  OUTBOUND
  INBOUND
}

enum CommunicationEventStatus {
  PENDING
  QUEUED
  SENT
  DELIVERED
  FAILED
  READ
}

enum OpportunityPriority {
  LOW
  MEDIUM
  HIGH
}

enum OpportunityStatus {
  OPEN
  CONTACTED
  RECOVERED
  LOST
}

model CommunicationEvent {
  id                String                   @id @default(cuid())
  gymId             String                   @db.Uuid
  memberId          String?
  channel           CommunicationChannel
  direction         CommunicationDirection   @default(OUTBOUND)
  templateId        String?
  message           String                   @db.Text
  status            CommunicationEventStatus
  provider          String?
  providerMessageId String?
  legacySource      String?
  legacyId          String?
  createdAt         DateTime                 @default(now())
  updatedAt         DateTime                 @updatedAt
  Gym               Gym                      @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member            Member?                  @relation(fields: [memberId], references: [id], onDelete: SetNull)

  @@unique([legacySource, legacyId])
  @@index([gymId])
  @@index([memberId])
  @@index([channel])
  @@index([status])
  @@index([createdAt])
}

enum PredictionLabel {
  LIKELY_TO_PAY
  AT_RISK
  UNLIKELY
}

enum InferenceSource {
  RULES
  LLM
  HYBRID
}

model Opportunity {
  id               String              @id @default(cuid())
  gymId            String              @db.Uuid
  memberId         String
  score            Float
  amountAtRisk     Decimal             @db.Decimal(12, 2)
  priority         OpportunityPriority
  reasons          Json
  payProbability        Int                 @default(50)
  churnRisk             Int                 @default(50)
  predictionLabel       PredictionLabel     @default(AT_RISK)
  readinessModelVersion String?
  featureSnapshot       Json?
  inferenceSource       InferenceSource       @default(RULES)
  llmAssessment         Json?
  status                OpportunityStatus   @default(OPEN)
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
  Gym              Gym                 @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member           Member              @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([gymId, status, priority])
  @@index([gymId, status, predictionLabel])
  @@index([gymId, memberId])
  @@index([createdAt])
}

enum ReminderLogType {
  RENEWAL
  OVERDUE
  CUSTOM
}

enum ReminderLogStatus {
  SENT
  FAILED
  DELIVERED
  READ
}

enum ReceiptType {
  ADMISSION
  RENEWAL
}

enum PlanType {
  GYM
  PT
}

enum ClassSessionStatus {
  UPCOMING
  ONGOING
  CANCELLED
  COMPLETED
}

enum ClassBookingStatus {
  CONFIRMED
  CANCELLED
  WAITLISTED
}

model GymClass {
  id           String             @id @default(cuid())
  gymId        String             @db.Uuid
  name         String
  trainerName  String?
  description  String?
  startsAt     DateTime
  endsAt       DateTime
  capacity     Int                @default(20)
  status       ClassSessionStatus @default(UPCOMING)
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt
  Gym          Gym                @relation(fields: [gymId], references: [id], onDelete: Cascade)
  ClassBooking ClassBooking[]

  @@index([gymId, startsAt])
  @@index([gymId, status])
}

model ClassBooking {
  id       String             @id @default(cuid())
  gymId    String             @db.Uuid
  classId  String
  memberId String
  status   ClassBookingStatus @default(CONFIRMED)
  bookedAt DateTime           @default(now())
  Gym      Gym                @relation(fields: [gymId], references: [id], onDelete: Cascade)
  GymClass GymClass           @relation(fields: [classId], references: [id], onDelete: Cascade)
  Member   Member             @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([classId, memberId])
  @@index([gymId])
  @@index([memberId])
}

model GymMarketplaceInstall {
  id          String   @id @default(cuid())
  gymId       String   @db.Uuid
  slug        String
  enabled     Boolean  @default(true)
  config      Json?
  installedAt DateTime @default(now())
  updatedAt   DateTime @updatedAt
  Gym         Gym      @relation(fields: [gymId], references: [id], onDelete: Cascade)

  @@unique([gymId, slug])
  @@index([gymId])
}

model PaymentCheckoutLink {
  id          String   @id @default(cuid())
  gymId       String   @db.Uuid
  memberId    String?
  amount      Decimal  @db.Decimal(10, 2)
  currency    String   @default("INR")
  provider    String   @default("razorpay")
  externalId  String?
  checkoutUrl String?
  status      String   @default("created")
  expiresAt   DateTime?
  createdAt   DateTime @default(now())
  Gym         Gym      @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member      Member?  @relation(fields: [memberId], references: [id], onDelete: SetNull)

  @@index([gymId])
  @@index([memberId])
  @@index([externalId])
}

enum GoalStatus {
  ACTIVE
  COMPLETED
  CANCELLED
}

model Goal {
  id           String     @id @default(cuid())
  gymId        String     @db.Uuid
  title        String
  metricType   String     @default("recovery")
  targetInr    Decimal    @db.Decimal(12, 2)
  recoveredInr Decimal    @default(0) @db.Decimal(12, 2)
  baselineInr  Decimal    @default(0) @db.Decimal(12, 2)
  deadline     DateTime?
  status       GoalStatus @default(ACTIVE)
  createdById  String?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  Gym          Gym        @relation(fields: [gymId], references: [id], onDelete: Cascade)

  @@index([gymId, status])
}

enum ApprovalType {
  SEND_REMINDER
  BULK_REMINDER
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  EXECUTED
  FAILED
}

model Approval {
  id          String         @id @default(cuid())
  gymId       String         @db.Uuid
  type        ApprovalType
  status      ApprovalStatus @default(PENDING)
  payload     Json
  createdById String?
  decidedById String?
  decidedAt   DateTime?
  executedAt  DateTime?
  error       String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  Gym         Gym            @relation(fields: [gymId], references: [id], onDelete: Cascade)

  @@index([gymId, status])
  @@index([createdAt])
}

enum OfferStatus {
  DRAFT
  ACTIVE
  EXPIRED
}

model Offer {
  id               String      @id @default(cuid())
  gymId            String      @db.Uuid
  name             String
  description      String?
  discountPercent  Decimal?    @db.Decimal(5, 2)
  discountInr      Decimal?    @db.Decimal(10, 2)
  validFrom        DateTime?
  validUntil       DateTime?
  segment          Json?
  status           OfferStatus @default(DRAFT)
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt
  Gym              Gym         @relation(fields: [gymId], references: [id], onDelete: Cascade)

  @@index([gymId, status])
}

enum ProductCategory {
  MERCH
  SUPPLEMENT
}

model Product {
  id                         String          @id @default(cuid())
  gymId                      String          @db.Uuid
  name                       String
  category                   ProductCategory @default(SUPPLEMENT)
  priceInr                   Decimal         @db.Decimal(10, 2)
  description                String?
  hsnCode                    String?
  gstRatePercent             Decimal         @default(18) @db.Decimal(5, 2)
  priceIncludesGst           Boolean         @default(true)
  amazonReferenceUrl         String?
  amazonReferenceNote        String?
  amazonReferenceUpdatedAt   DateTime?
  amazonReferenceUpdatedById String?
  isActive                   Boolean         @default(true)
  createdAt                  DateTime        @default(now())
  updatedAt                  DateTime        @updatedAt
  Gym                        Gym             @relation(fields: [gymId], references: [id], onDelete: Cascade)
  OrderLine                  OrderLine[]
  SupplementGstInvoiceLine   SupplementGstInvoiceLine[]

  @@index([gymId, isActive])
}

enum OrderLineStatus {
  PENDING
  PAID
  CANCELLED
}

model OrderLine {
  id                    String                @id @default(cuid())
  gymId                 String                @db.Uuid
  memberId              String?
  productId             String
  quantity              Int                   @default(1)
  unitPriceInr          Decimal               @db.Decimal(10, 2)
  status                OrderLineStatus       @default(PENDING)
  supplementGstInvoiceId String?
  notes                 String?
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  Gym                   Gym                   @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Product               Product               @relation(fields: [productId], references: [id], onDelete: Cascade)
  Member                Member?               @relation(fields: [memberId], references: [id], onDelete: SetNull)
  SupplementGstInvoice  SupplementGstInvoice? @relation(fields: [supplementGstInvoiceId], references: [id], onDelete: SetNull)

  @@index([gymId, memberId])
  @@index([gymId, status])
  @@index([supplementGstInvoiceId])
}

enum SupplementInvoiceStatus {
  DRAFT
  ISSUED
  CANCELLED
}

model SupplementGstInvoice {
  id                 String                    @id @default(cuid())
  gymId              String                    @db.Uuid
  invoiceNumber      String
  memberId           String?
  buyerName          String?
  buyerPhone         String?
  buyerGstin         String?
  taxableTotalInr    Decimal                   @db.Decimal(12, 2)
  cgstTotalInr       Decimal                   @db.Decimal(12, 2)
  sgstTotalInr       Decimal                   @db.Decimal(12, 2)
  igstTotalInr       Decimal                   @default(0) @db.Decimal(12, 2)
  grandTotalInr      Decimal                   @db.Decimal(12, 2)
  status             SupplementInvoiceStatus   @default(DRAFT)
  placeOfSupplyState String?
  notes              String?
  issuedAt           DateTime?
  issuedById         String?
  createdAt          DateTime                  @default(now())
  updatedAt          DateTime                  @updatedAt
  Gym                Gym                       @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member             Member?                   @relation(fields: [memberId], references: [id], onDelete: SetNull)
  Lines              SupplementGstInvoiceLine[]
  OrderLines         OrderLine[]

  @@unique([gymId, invoiceNumber])
  @@index([gymId, status])
  @@index([memberId])
}

model SupplementGstInvoiceLine {
  id              String               @id @default(cuid())
  invoiceId       String
  productId       String?
  description     String
  hsnCode         String
  quantity        Int
  unitPriceInr    Decimal              @db.Decimal(10, 2)
  gstRatePercent  Decimal              @db.Decimal(5, 2)
  taxableValueInr Decimal              @db.Decimal(12, 2)
  cgstInr         Decimal              @db.Decimal(12, 2)
  sgstInr         Decimal              @db.Decimal(12, 2)
  igstInr         Decimal              @default(0) @db.Decimal(12, 2)
  lineTotalInr    Decimal              @db.Decimal(12, 2)
  Invoice         SupplementGstInvoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  Product         Product?             @relation(fields: [productId], references: [id], onDelete: SetNull)

  @@index([invoiceId])
}

model DietPlanAssignment {
  id                  String    @id @default(cuid())
  gymId               String    @db.Uuid
  memberId            String
  title               String
  linkUrl             String?
  notes               String?
  assignedAt          DateTime  @default(now())
  complianceCheckedAt DateTime?
  Gym                 Gym       @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Member              Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([gymId, memberId])
}

enum WhatsAppTemplateCategory {
  RENEWAL
  TRIAL
  LEAD
  GENERAL
}

model WhatsAppTemplate {
  id               String                   @id @default(cuid())
  gymId            String                   @db.Uuid
  name             String
  metaTemplateName String?
  body             String
  category         WhatsAppTemplateCategory @default(GENERAL)
  isApproved       Boolean                  @default(false)
  createdAt        DateTime                 @default(now())
  updatedAt        DateTime                 @updatedAt
  Gym              Gym                      @relation(fields: [gymId], references: [id], onDelete: Cascade)

  @@unique([gymId, name])
  @@index([gymId, category])
}

enum WhatsAppCampaignStatus {
  DRAFT
  QUEUED
  SENT
  FAILED
}

model WhatsAppCampaign {
  id             String                 @id @default(cuid())
  gymId          String                 @db.Uuid
  name           String
  templateId     String?
  message        String?                @db.Text
  segment        Json?
  analytics      Json?
  recipientCount Int                    @default(0)
  status         WhatsAppCampaignStatus @default(DRAFT)
  payload        Json?
  sentAt         DateTime?
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt
  Gym            Gym                    @relation(fields: [gymId], references: [id], onDelete: Cascade)

  @@index([gymId, status])
}

model MemberOtpChallenge {
  id        String   @id @default(cuid())
  gymId     String   @db.Uuid
  phone     String
  codeHash  String
  memberId  String?
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([gymId, phone])
}

enum LeadSource {
  WALK_IN
  WEBSITE
  WHATSAPP
  REFERRAL
  INSTAGRAM
  PHONE_CALL
  OTHER
}

enum LeadStatus {
  NEW
  CONTACTED
  TRIAL_SCHEDULED
  TRIAL_DONE
  CONVERTED
  LOST
}

model Lead {
  id                 String      @id @default(cuid())
  gymId              String      @db.Uuid
  name               String
  phone              String
  email              String?
  source             LeadSource  @default(WEBSITE)
  status             LeadStatus  @default(NEW)
  notes              String?
  followUpAt         DateTime?
  assignedToId       String?
  freeTrialVisitId   String?
  convertedMemberId  String?
  lostReason         String?
  deletedAt          DateTime?
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt
  Gym                Gym         @relation(fields: [gymId], references: [id], onDelete: Cascade)
  LeadFollowUp       LeadFollowUp[]

  @@index([gymId, status])
  @@index([gymId, phone])
  @@index([gymId, followUpAt])
  @@index([gymId, status, createdAt])
  @@index([createdAt])
  @@index([deletedAt])
}

model LeadFollowUp {
  id            String          @id @default(cuid())
  gymId         String          @db.Uuid
  leadId        String
  userId        String?
  method        FollowUpMethod  @default(CALL)
  scheduleDate  DateTime        @db.Date
  outcome       String?
  status        FollowUpStatus  @default(PENDING)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  Gym           Gym             @relation(fields: [gymId], references: [id], onDelete: Cascade)
  Lead          Lead            @relation(fields: [leadId], references: [id], onDelete: Cascade)
  User          User?           @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([gymId])
  @@index([leadId])
  @@index([scheduleDate])
  @@index([status])
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
  User      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}

model StaffNotification {
  id        String    @id @default(cuid())
  gymId     String    @db.Uuid
  userId    String
  title     String
  body      String
  readAt    DateTime?
  createdAt DateTime  @default(now())
  Gym       Gym       @relation(fields: [gymId], references: [id], onDelete: Cascade)
  User      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([gymId, userId])
  @@index([userId, readAt])
  @@index([createdAt])
}

enum AdminTaskPriority {
  HIGH
  MEDIUM
  LOW
}

enum AdminTaskStatus {
  PENDING
  RESOLVED
  DISMISSED
}

model AdminTask {
  id          String            @id @default(cuid())
  gymId       String            @db.Uuid
  type        String
  priority    AdminTaskPriority @default(MEDIUM)
  status      AdminTaskStatus   @default(PENDING)
  title       String
  description String            @db.Text
  metadata    Json?
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  resolvedAt  DateTime?
  resolvedBy  String?
  Gym         Gym               @relation(fields: [gymId], references: [id], onDelete: Cascade)

  @@index([gymId, status])
  @@index([gymId, type, status])
  @@index([gymId, priority])
  @@index([createdAt])
}

model DailyStats {
  id                    String   @id @default(cuid())
  gymId                 String   @db.Uuid
  statDate              DateTime @db.Date
  totalMembers          Int      @default(0)
  activeMembers         Int      @default(0)
  todayCheckIns         Int      @default(0)
  currentlyInGym        Int      @default(0)
  qrCheckInsToday       Int      @default(0)
  todayCollection       Decimal  @default(0) @db.Decimal(14, 2)
  todayPaymentCount     Int      @default(0)
  expiringThisWeek      Int      @default(0)
  overdueCount          Int      @default(0)
  renewalsBadge         Int      @default(0)
  monthPaymentCount     Int      @default(0)
  monthPaymentTotal     Decimal  @default(0) @db.Decimal(14, 2)
  attendanceEligible    Int      @default(0)
  attendanceActiveToday Int      @default(0)
  attendanceCheckedIn   Int      @default(0)
  attendancePending     Int      @default(0)
  updatedAt             DateTime @updatedAt
  Gym                   Gym      @relation(fields: [gymId], references: [id], onDelete: Cascade)

  @@unique([gymId, statDate])
  @@index([gymId, statDate])
  @@index([updatedAt])
}

enum ErrorLogSource {
  API
  CLIENT
  CRON
  INNGEST
  PRISMA
}

model ErrorLog {
  id         String         @id @default(cuid())
  gymId      String?        @db.Uuid
  source     ErrorLogSource
  code       String
  message    String         @db.Text
  stack      String?        @db.Text
  route      String?
  userId     String?
  prismaCode String?
  metadata   Json?
  createdAt  DateTime       @default(now())
  Gym        Gym?           @relation(fields: [gymId], references: [id], onDelete: SetNull)
  User       User?          @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([gymId, createdAt])
  @@index([source, createdAt])
  @@index([code])
  @@index([createdAt])
}

model OutboxEvent {
  id          String    @id @default(cuid())
  gymId       String?   @db.Uuid
  type        String
  payload     Json
  createdAt   DateTime  @default(now())
  publishedAt DateTime?

  @@index([publishedAt, createdAt])
  @@index([gymId])
  @@index([type])
}
```
