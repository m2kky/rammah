# Production Readiness Execution Plan

## 1. Purpose

This document turns the current Rammah platform from a feature-rich development build into a releasable, observable, recoverable production system.

It is the execution source of truth for the final hardening phase. Every task below identifies:

- priority and owner;
- dependencies and estimated effort;
- existing files to modify and new files to create;
- required verification;
- acceptance criteria that close the task.

This plan does not replace the product requirements. Product scope remains owned by `docs/01-product/`, functional behavior by `docs/02-requirements/`, and system design by `docs/03-architecture/`.

## 2. Outcome and Readiness Target

The target is a launchable first production release on a Hostinger VPS with:

- a self-hosted Next.js frontend behind Nginx;
- an Express API and a background worker built from the same backend image;
- PostgreSQL with repeatable migrations, daily off-site backups, and a tested restore procedure;
- Kashier live payments with verified and idempotent callbacks;
- Google Calendar/Meet event creation and external busy-block synchronization;
- Resend transactional email with queued retries;
- S3-compatible CMS media storage;
- stable existing English routes plus a complete Arabic public customer journey under `/ar`, with one shared booking/payment/provider state;
- an English admin interface that authors, previews, publishes, and audits English and Arabic content independently;
- mandatory CI gates for lint, typecheck, tests, build, migrations, dependency audit, and container build;
- staging rehearsal, production smoke tests, rollback, monitoring, and an incident path.

Readiness is reached only when all P0/P1 tasks and launch gates G0-G6 are closed. A feature looking complete in the UI is not sufficient.

## 3. Fixed Decisions and Required Decisions

### 3.1 Fixed decisions

| ID | Decision | Reason |
| --- | --- | --- |
| D-01 | Consolidate frontend, API, deployment files, and docs into the root `rammah` monorepo before CI work. | The root has only one local commit and no remote, so this is the lowest-cost point to gain one protected branch, one compatibility SHA, and atomic release review. |
| D-02 | Preserve the existing frontend history and current local `MethodologySection.tsx` edit before removing the nested `.git`. | Consolidation must not destroy authored work or make the original frontend history unrecoverable; create a tag and Git bundle, then import history under `rammah-next/`. |
| D-03 | First production release runs one API instance and one worker instance. | The current rate limiter is process-local; horizontal scaling is deferred until shared rate-limit/cache coordination exists. |
| D-04 | Use PostgreSQL transaction-level advisory locks for logical booking slots and row locks for fixed sessions. | Recurring slots have no row to lock; transaction locks serialize capacity checks without a new infrastructure dependency. |
| D-05 | Use a transactional outbox table and a worker process for email, Calendar, external busy sync, hold expiry, and payment reconciliation jobs. | Booking/payment state and side effects must not diverge when a provider is slow or unavailable. |
| D-06 | Use Vitest for API/frontend unit tests and Playwright for browser E2E. | Both fit the TypeScript codebase and support CI coverage and browser workflows. |
| D-07 | Use npm workspaces, Docker images, Docker Compose, Nginx, and GitHub Actions/GHCR for VPS delivery. | One root gate produces compatible immutable web/API/worker artifacts and a rollback target instead of deploying mutable source folders. |
| D-08 | Use an S3-compatible provider for CMS uploads; use MinIO only for local/integration tests. | Media must survive container replacement and be recoverable independently from the VPS filesystem. |
| D-09 | External Google busy data is fail-closed when the last successful sync exceeds the configured freshness limit. | A stale calendar must not silently produce double bookings. |
| D-10 | Expose one public HTTPS origin and proxy `/api` to Express through Nginx. | Same-origin browser traffic simplifies cookies, CSRF/CORS, cache rules, monitoring, and compatible frontend/API release behavior. |
| D-11 | Preserve all existing unprefixed English URLs, publish Arabic under `/ar`, keep admin chrome English, and share all business entities/state across locales. | Arabic becomes a complete presentation and communication layer without duplicating offerings, prices, slots, bookings, payments, or provider records and without risking English route regressions. |

### 3.2 Decisions required before Phase 4

| ID | Owner | Decision deadline | Recommended default | Blocking work |
| --- | --- | --- | --- | --- |
| DR-01 | Product/business | End of Phase 1 | Remove coupons and tax calculation from first launch unless exact business/tax rules are supplied; do not keep a fake `not_applied`/zero-tax contract. | FEAT-05, FEAT-10 |
| DR-02 | Business/legal | End of Phase 2 | Supply approved privacy, terms, refund/cancellation, cookie/analytics text, and the data-retention/legal-hold matrix. | FEAT-03, SEC-11, LAUNCH-04 |
| DR-03 | Operations | End of Phase 2 | Confirm production/staging domains, VPS access, DNS owner, and off-site backup destination. | OPS-04 through OPS-10 |
| DR-04 | Business/providers | End of Phase 2 | Confirm Kashier live approval, Resend verified domain, Google OAuth production app, and S3 credentials. | JOB-03 through JOB-05, FEAT-07, LAUNCH-02 |
| DR-05 | Product | End of Phase 2 | Confirm whether CMS media upload is required on day one; default is yes because it is in the FRS. | FEAT-07 |
| DR-06 | Operations/budget | End of Phase 1 | Prefer managed PostgreSQL. If self-hosted on the VPS is selected, require WAL/PITR-capable off-site recovery in addition to daily dumps, disk alerts, and a stricter restore drill. | OPS-04, OPS-08/09 |
| DR-07 | Business/finance | End of Phase 2 | Use manual, audited Kashier refunds for first launch unless an approved refund API and business state machine are supplied. | FEAT-06, FEAT-12, OPS-12 |
| DR-08 | Product/legal | End of Phase 2 | Use double opt-in newsletter confirmation and signed unsubscribe tokens; if rejected, record the approved lawful basis and retain consent/unsubscribe evidence. | FEAT-02, JOB-03, SEC-11 |
| DR-09 | Operations/product | End of Phase 1 | Poll Google FreeBusy on a two-minute schedule over the booking horizon; fail closed after five minutes stale; defer push notifications/incremental event sync unless the SLO cannot be met. | JOB-05, LAUNCH-02 |
| DR-10 | Product/legal | End of Phase 2 | Launch without marketing trackers on admin, payment, booking-status, or token-bearing pages; add consent-aware analytics later. Keep operational error/performance telemetry with PII redaction. | FEAT-03, WEB-05, OPS-07 |
| DR-11 | Product/security | End of Phase 1 | Provide owner-only CLI create/reset and session revocation for launch; do not expose a public admin password-reset flow unless email ownership/recovery policy is approved. | SEC-08, FEAT-12, OPS-12 |
| DR-12 | Product/legal/SEO | End of Phase 2 | Assign Arabic content owner and reviewers; approve the inventory structure and review policy for Arabic page, offering, legal, email, SEO, media-alt, and CTA/link content. Machine translation may seed drafts but cannot satisfy launch approval. Final row sign-off closes in LOC-12/LAUNCH-04. | LOC-10 through LOC-12, LAUNCH-04/05 |

No task may silently decide a legal, tax, privacy, provider, recovery, or credential-management requirement in code.

## 4. What Already Exists and Must Be Reused

| Capability | Existing implementation | Plan treatment |
| --- | --- | --- |
| Express routing and validation | `rammah-api/src/app.ts`, Zod route schemas, shared error handler | Extend; do not replace the framework. |
| PostgreSQL/Drizzle schema and migrations | `rammah-api/src/db/schema/index.ts`, `rammah-api/drizzle/0000-0003*.sql` | Add forward-only migrations; never rewrite applied migration files. |
| Admin sessions | `modules/auth/*`, hashed DB token, secure cookie settings | Add CSRF, proxy awareness, expiry cleanup, and security tests. |
| Payment adapter and webhook ledger | `modules/payments/kashier.adapter.ts`, `public-payments.*`, `payment_webhook_events` | Repair replay finalization and make processing transactional. |
| Availability, holds, free/paid booking | `modules/availability/*`, `modules/bookings/*`, `modules/sessions/*` | Add atomic capacity locking and concurrency tests. |
| Email ledger/templates/Resend | `modules/emails/*`, `email_deliveries` | Move network delivery behind outbox/worker; keep ledger and idempotency. |
| Google OAuth/event ledger | `modules/calendar/*`, `calendar_events`, `external_calendar_busy_blocks` | Reuse tables; add polling/sync cursor/freshness and worker execution. |
| CMS metadata APIs/admin | `modules/cms/*`, `components/admin/AdminCms.tsx` | Add real object upload/delete/publish flow rather than parallel CMS. |
| Smoke/preflight scripts | `scripts/smoke.ts`, `business-smoke.ts`, `production-preflight.ts` | Keep as release checks; add automated tests beneath them. |
| Public/admin UI | `rammah-next/app`, `components`, `lib/api` | Repair incomplete flows and add resilience, accessibility, and tests. |
| English public routes and CMS entities | Current unprefixed `rammah-next/app/**` routes and base CMS/offering records | Preserve routes and records; add locale-aware presentation and additive translation rows rather than parallel business data. |
| Operations documentation | `docs/03-architecture/*`, `docs/06-engineering/Production-Runbook.md` | Update to the final executable topology and commands. |

## 5. Target Runtime Architecture

```text
Internet
   |
   v
Nginx (TLS, request limits, static caching, rate guard)
   |-------------------------------|
   v                               v
Next.js web :3000              Express API :4000
   |                               |
   |                               +------------------------+
   |                               |                        |
   +---------- API HTTPS ----------+                        v
                                   |                 PostgreSQL :5432
                                   |                        ^
                                   v                        |
                         outbox_events / ledgers -----------+
                                   |
                                   v
                            Worker process
                  |-------------|-------------|-------------|
                  v             v             v             v
               Kashier       Resend        Google        S3-compatible
                                            Calendar      media storage

Backups: PostgreSQL pg_dump + media inventory -> encrypted off-site storage
Monitoring: uptime checks + Sentry/error tracking + structured container logs
Delivery: GitHub Actions -> GHCR images -> staging/prod Compose pull by immutable SHA
```

### Booking capacity critical section

```text
POST /public/slot-holds
  -> validate timestamps/offering
  -> BEGIN
  -> acquire advisory transaction lock(slot identity)
  -> re-read bookings + active holds + external busy state
  -> reject if capacity exhausted or calendar data stale
  -> insert hold
  -> COMMIT (lock auto-released)
```

### Trusted payment finalization

```text
Kashier callback
  -> parse bounded query
  -> verify signature
  -> resolve payment
  -> verify amount + currency + merchant order
  -> BEGIN
  -> insert verified provider event ON CONFLICT DO NOTHING
  -> if duplicate: return stored outcome only; never trust replay parameters
  -> lock payment/booking rows
  -> apply monotonic payment transition
  -> enqueue outbox jobs in same transaction
  -> COMMIT
  -> worker creates Calendar/Meet and sends emails idempotently
```

## 6. Release Gates

| Gate | Requirement | Evidence |
| --- | --- | --- |
| G0 Repository baseline | One monorepo has a remote, protected branch, clean ignores, preserved legacy history, reproducible workspace installs, and one release SHA. | Clean-clone/import verification and release manifest. |
| G1 Security/correctness | Payment replay and slot races fixed; CSRF/proxy/rate-limit/anti-spam/privacy behavior tested; dependency audit has no high/critical production findings. | Security regression suite and review sign-off. |
| G2 Automated quality | Lint, typecheck, unit, integration, migrations, build, and E2E pass in CI. | Required green jobs on the canonical repository. |
| G3 Feature completeness | No fake forms, placeholder legal copy, dead admin routes, missing FRS admin modules, unsafe CMS lifecycle, contract-advertised unimplemented pricing/offering behavior, or incomplete Arabic customer journey. | Acceptance matrix + bilingual content inventory + requirements traceability + product sign-off. |
| G4 Staging operations | Immutable images deploy; health, worker, providers, backups, restore, logs, and rollback are exercised. | Staging rehearsal report. |
| G5 Launch approval | Controlled live English low-value provider validation plus the complete Arabic staging/sandbox equivalent, locale-correct email, Calendar/Meet, DNS/TLS, signed English/Arabic content, mobile/RTL, SEO/hreflang, accessibility, performance, and staging soak pass. | Signed bilingual launch checklist authorizing production Arabic enablement; the first Arabic live smoke is recorded in LAUNCH-07/G6 after enablement. |
| G6 Canary | 48 hours with no unresolved P0/P1, payment mismatch, booking conflict, failed job spike, or backup failure. | Canary report and incident log. |

## 7. Detailed Implementation Backlog

Estimates are focused engineer-days including implementation and verification. P0 blocks all real-payment deployment. P1 blocks public launch. P2 should land before launch unless explicitly deferred in the decision log.

## Phase 0 — Repository and Reproducible Baseline

### REPO-01 — Preserve current work and establish clean baselines

- **Priority / owner / estimate:** P0 / Tech lead / 0.5 day.
- **Depends on:** None.
- **Change:** Capture the root and nested frontend Git state, preserve the existing `MethodologySection.tsx` modification, and record current frontend/API SHAs. Do not delete or normalize user work during this task.
- **Files:** New `docs/05-project-plan/Baseline-Snapshot.md`; no source edits.
- **Verify:** `git status --short`, branch/upstream, `git fsck`, current root/frontend SHAs, the frontend tag, and a checksum/count of tracked public assets are recorded for both current repositories.
- **Accept:** A later cleanup cannot accidentally erase or misattribute existing work.

### REPO-02 — Preserve frontend history and consolidate the monorepo

- **Priority / owner / estimate:** P0 / Tech lead / 1-1.5 days.
- **Depends on:** REPO-01.
- **Change:** Commit or separately patch the owned `MethodologySection.tsx` change; tag the current frontend head; create and checksum an offline `git bundle`; rewrite/import frontend history under `rammah-next/` with `git filter-repo --to-subdirectory-filter`; merge unrelated histories into the root; verify commit/file ancestry; remove the nested `.git` only after recovery evidence passes. Never include runtime logs as authored changes.
- **Files:** Git history and metadata; new `docs/05-project-plan/Repository-Consolidation-Report.md`; no product-code rewrite.
- **Verify:** Original tag/SHA resolves in the bundle; imported frontend commits are reachable; `git log --follow -- rammah-next/components/MethodologySection.tsx` works; file hashes match the baseline; one root `git status` owns API, frontend, docs, and deploy files.
- **Accept:** One repository contains all intended source/history and the pre-consolidation frontend can be recovered from the verified bundle.

### REPO-03 — Publish and protect the canonical repository

- **Priority / owner / estimate:** P0 / Tech lead / 0.5-1 day.
- **Depends on:** REPO-02.
- **Change:** Create/push the root remote, set upstream/default branch, enable branch protection, required reviews/status checks, secret scanning, release owners, and PR rules. Define workspace ownership for API, frontend, docs, infrastructure, and migrations.
- **Files:** New root `README.md`; `CODEOWNERS`; update `docs/06-engineering/Git-Branching-Strategy.md`, `docs/06-engineering/Team-Workflow.md`, and `docs/06-engineering/Onboarding-Guide.md`.
- **Verify:** A fresh clone contains the complete project and history; protected-branch settings and required checks are recorded.
- **Accept:** No production source or release depends on an unpushed local-only commit, nested repository, or undocumented owner.

### REPO-04 — Remove generated/runtime files from version control

- **Priority / owner / estimate:** P1 / Frontend + backend / 0.5-1 day.
- **Depends on:** REPO-01.
- **Change:** Stop tracking dev logs, `.playwright-cli`, `output/`, `.next`, `dist`, local `.env`, and one-off generated files. Preserve intentional screenshots only under documented docs assets; inventory large historical assets for WEB-02 before any history-size rewrite.
- **Files:** Root `.gitignore`; workspace `.gitignore` rules; untrack `rammah-next/dev-server.*.log`, tracked Playwright output, and obsolete helper outputs after review.
- **Verify:** Clean clone + build produces only ignored changes.
- **Accept:** Running dev/test/build leaves the monorepo worktree clean.

### REPO-05 — Normalize commands and runtime versions

- **Priority / owner / estimate:** P1 / Tech lead / 0.5 day.
- **Depends on:** REPO-03.
- **Change:** Add a root npm-workspaces contract and pin supported Node/npm versions. Expose root lint, typecheck, unit, integration, coverage, build, E2E, smoke, preflight, Docker, and clean commands while retaining package-level commands.
- **Files:** New root `package.json`; root lockfile policy; `rammah-api/package.json`; `rammah-next/package.json`; new root `.nvmrc` or `.tool-versions`; README command tables.
- **Verify:** Every documented command exists and exits non-zero on failure on Windows and Linux.
- **Accept:** CI and humans invoke the same commands.

### REPO-06 — Add single-SHA release manifest and changelog process

- **Priority / owner / estimate:** P1 / Release owner / 0.5 day.
- **Depends on:** REPO-03.
- **Change:** Each release records the one source SHA, web/API-worker image digests, migration head, configuration version, compatibility notes, and rollback image digests.
- **Files:** New root `CHANGELOG.md`; new `docs/05-project-plan/releases/README.md`; per-release `docs/05-project-plan/releases/vX.Y.Z.md`.
- **Verify:** A release can be reconstructed from one source SHA and immutable image digests.
- **Accept:** “What is in production?” has one unambiguous answer.

**Phase 0 exit:** G0 passes.

## Phase 1 — P0 Security and Transaction Correctness

### SEC-01 — Fix forged Kashier callback replay

- **Priority / owner / estimate:** P0 / Backend / 1 day.
- **Depends on:** TEST-01 and TEST-02 may land in the same branch.
- **Change:** Validate signature, merchant order, payment, and the presence plus exact value of amount/currency before provider-event persistence; use `ON CONFLICT DO NOTHING`; on duplicate, read and return the stored event result without calling `applyTrustedPaymentResult` from current query parameters. Invalid attempts must not reserve/poison a provider-event ID; incomplete callbacks enqueue bounded authoritative reconciliation; redirect/status tokens come only from the matched stored payment, never callback input.
- **Files:** `rammah-api/src/modules/payments/public-payments.service.ts`; `public-payments.repository.ts`; `public-payments.routes.ts`; `kashier.adapter.ts`; payment types/errors.
- **Tests:** First forged callback ignored; forged-then-valid using the same and a different provider event; identical valid replay; two concurrent callbacks; unknown order; wrong/missing amount; wrong/missing currency; failed-then-paid; paid-then-failed; provider timeout; database failure between event insert and transition.
- **Accept:** No code path can mark a payment paid unless the exact processed event was verified.

### SEC-02 — Make payment finalization atomic and monotonic

- **Priority / owner / estimate:** P0 / Backend / 1-1.5 days.
- **Depends on:** SEC-01, JOB-01 schema design.
- **Change:** Lock payment/booking rows, enforce allowed state transitions, write event/payment/booking/outbox in one transaction, and make `paid` terminal against later failure callbacks.
- **Files:** `public-payments.repository.ts`; `payment-confirmation.service.ts`; `admin-payments.service.ts`; `src/db/schema/index.ts`; new forward migration.
- **Tests:** Concurrent valid callbacks, paid followed by failed, duplicate reconciliation, database failure before/after event insert, and outbox enqueue rollback.
- **Accept:** Payment, booking, provider event, and side-effect jobs cannot partially commit.

### SEC-03 — Serialize slot-hold capacity checks

- **Priority / owner / estimate:** P0 / Backend / 1-1.5 days.
- **Depends on:** TEST-02.
- **Change:** Move availability recheck and hold insert into one transaction. Centralize one lock-key function used by public hold/free/paid conversion, fixed sessions, and admin reschedule. Lock fixed session rows and use `pg_advisory_xact_lock` for recurring logical slots. Count active non-expired holds, blocking bookings, buffers, limits, and busy blocks after acquiring the lock; use configured `PAYMENT_HOLD_MINUTES` everywhere and add DB checks for positive capacity, valid intervals, and non-negative money.
- **Files:** `modules/availability/slot-holds.repository.ts`; `slot-holds.service.ts`; `availability-slots.repository.ts`; new `availability/slot-capacity.repository.ts`; `modules/sessions/public-sessions.repository.ts`; `modules/bookings/public-bookings.repository.ts`; `admin-bookings.repository.ts`; `modules/payments/public-payments.repository.ts`; new `shared/db/advisory-lock.ts`; schema/migration.
- **Tests:** 20 parallel public/free/paid/admin operations for capacity 1 yield one allocation; capacity 3 yields three; expired/released holds do not block; fixed/recurring slots share the correct lock; different slots do not serialize each other.
- **Accept:** Capacity is never exceeded under concurrent requests.

### SEC-04 — Harden booking conversion and hold ownership

- **Priority / owner / estimate:** P0 / Backend / 1 day.
- **Depends on:** SEC-03.
- **Change:** Lock/recheck holds during free and paid conversion, make conversion idempotent, bind public mutations to an unguessable hold token/secret, and prevent arbitrary hold release by ID.
- **Files:** `modules/bookings/public-bookings.repository.ts`; `public-bookings.service.ts`; `modules/availability/slot-holds.routes.ts`; `slot-holds.repository.ts`; schema/migration if a hold token hash is added.
- **Tests:** Double-submit, two tabs, expired hold, released hold, wrong token, converted hold, and concurrent free/paid conversion.
- **Accept:** A user cannot mutate another visitor’s hold and one hold produces at most one booking/payment.

### SEC-05 — Add admin CSRF protection

- **Priority / owner / estimate:** P0 / Backend + frontend / 1-1.5 days.
- **Depends on:** TEST-01, TEST-04.
- **Change:** Add CSRF token issue/validation, require it on every cookie-authenticated admin mutation, rotate it with login/session, and update the admin API client. Payment/provider webhooks remain signature-authenticated and exempt.
- **Files:** New `rammah-api/src/middleware/csrf.ts`; `modules/auth/auth.routes.ts`; `require-admin.ts`; admin mutation routers; `rammah-next/lib/api/admin.ts`; `AdminAuthGate.tsx`.
- **Tests:** Missing/invalid/stale token rejected; valid token accepted; GET/read routes unaffected; webhook unaffected.
- **Accept:** A cross-site request cannot perform an admin mutation with only the browser cookie.

### SEC-06 — Make proxy/rate-limit behavior production-correct

- **Priority / owner / estimate:** P0 / Backend + operations / 0.5-1 day.
- **Depends on:** OPS-04 topology.
- **Change:** Add validated `TRUST_PROXY`, derive client IP only from the trusted Nginx hop, create separate policies for login/public submissions/webhooks, bound webhook/event storage, and document the one-instance limit.
- **Files:** `src/config/env.ts`; `src/app.ts`; `middleware/rate-limit.ts`; payment webhook routes; `.env.example`; Nginx config.
- **Tests:** Spoofed `X-Forwarded-For`, trusted proxy chain, rate-limit reset, and invalid callback flood behavior.
- **Accept:** Rate limiting keys real clients correctly and does not allow unbounded invalid event rows.

### SEC-07 — Patch dependencies and enforce audit policy

- **Priority / owner / estimate:** P0 / Frontend + platform / 0.5-1 day.
- **Depends on:** TEST-04.
- **Change:** Upgrade Next.js from 16.2.1 to the latest patched compatible 16.2.x (minimum audited fix 16.2.10), update lockfile, review breaking/deprecation notes, and remediate production high/critical findings.
- **Files:** `rammah-next/package.json`; `package-lock.json`; `next.config.ts`; any code required by the upgrade.
- **Verify:** typecheck, lint, component tests, production build, E2E, and `npm audit --omit=dev`.
- **Accept:** No unresolved high/critical production dependency advisory; exceptions require a written risk acceptance with expiry.

### SEC-08 — Finish session/auth hardening

- **Priority / owner / estimate:** P1 / Backend / 1 day.
- **Depends on:** SEC-05, SEC-06.
- **Change:** Enforce production secret strength, session expiry/revocation cleanup, login/logout/password audit events, constant-shape auth errors, secure cookie domain/path, inactivity policy, and role checks for high-risk admin actions. Remove the default `admin@rammah.local` UI value; add owner-only `admin:create` and `admin:reset-password` commands that rotate credentials and revoke sessions; production seed never creates a known password.
- **Files:** `modules/auth/*`; new `middleware/require-role.ts`; `middleware/require-admin.ts`; `modules/audit/*`; `src/config/env.ts`; new `src/scripts/admin-create.ts` and `admin-reset-password.ts`; `rammah-next/components/admin/AdminLoginForm.tsx`; auth schema/migration if roles/last-used fields change.
- **Tests:** expired/revoked session, disabled admin, role denied, cookie flags in production, session fixation, login rate limit.
- **Accept:** Admin auth passes the security test matrix and has no default production credentials.

### SEC-09 — Expand browser/API security headers

- **Priority / owner / estimate:** P1 / Frontend + backend / 0.5-1 day.
- **Depends on:** SEC-07.
- **Change:** Apply a site-wide header baseline; deploy CSP first in report-only, inventory required GSAP/Kashier/media domains, then enforce; add HSTS at Nginx after HTTPS is stable. Mark admin, payment, thank-you, and bearer-token booking-status pages `no-store`, `noindex`, and strict-referrer; public token lookups return only the minimum masked fields needed for recovery.
- **Files:** `rammah-next/next.config.ts`; new `rammah-next/docs/csp-inventory.md` or architecture section; `rammah-api/src/app.ts`; Nginx config.
- **Tests:** public/admin/payment pages load without CSP violations; Kashier iframe works; no unsafe third-party origin is added without documentation.
- **Accept:** Security header scanner and browser console pass on staging.

### SEC-10 — Add layered anti-spam and public-submission abuse controls

- **Priority / owner / estimate:** P1 / Backend + frontend / 1 day.
- **Depends on:** SEC-06, FEAT-01/02/08 contracts.
- **Change:** Apply route-specific IP/email cooldowns, normalized duplicate detection, bounded payloads, a hidden honeypot and submission-timing signal, and structured abuse outcomes to quote/contact/newsletter endpoints. Add a feature-flagged Turnstile-compatible challenge only if staging/production abuse metrics cross an agreed threshold; never make a third-party challenge an unplanned hard dependency.
- **Files:** `middleware/rate-limit.ts`; new `middleware/public-submission-abuse.ts`; quote/contact/newsletter routes and services; `CorporateQuoteForm.tsx`; `ContactForm.tsx`; `CTASection.tsx`; `.env.example`; OpenAPI schemas.
- **Tests:** Bursts from one IP, same email from multiple IPs, legitimate duplicate retry, proxy spoof, honeypot hit, too-fast bot submit, Unicode/case normalization, and provider/challenge outage.
- **Accept:** Automated abuse is bounded and operator-visible while a legitimate retry remains idempotent and understandable.

### SEC-11 — Define and implement the customer-data lifecycle

- **Priority / owner / estimate:** P0/P1 / Product + legal + backend + operations / 1.5-2 days plus policy input.
- **Depends on:** DR-02 and DR-03.
- **Change:** Approve a field-level collection/retention matrix; minimize PII; define access, export, correction, deletion/anonymization, backup-retention, and legal/financial hold exceptions; redact logs/audit/provider payloads; add safe admin actions and scheduled cleanup where allowed.
- **Files:** `src/db/schema/index.ts`; booking/quote/contact/newsletter repositories; `modules/audit/*`; logger/error serialization; new `modules/privacy/*`; worker retention handler; `production-preflight.ts`; new `docs/03-architecture/Privacy-Data-Lifecycle.md`; legal/CMS copy.
- **Tests:** Authorization for export/delete, idempotent anonymization, retained payment/accounting facts without customer secrets, audit redaction, expired-lead cleanup, backup expiry, and restore not resurrecting data outside the agreed policy.
- **Accept:** Every collected field has purpose, owner, access rule, retention period, and tested disposal behavior; privacy promises match runtime behavior.

**Phase 1 exit:** G1 passes before any live provider key is installed.

## Phase 2 — Automated Test Foundation and CI Quality Gates

### TEST-01 — Install API unit-test framework

- **Priority / owner / estimate:** P0 / Backend / 0.5 day.
- **Depends on:** REPO-05.
- **Change:** Add Vitest and V8 coverage with deterministic time/UUID helpers and separate unit/integration configs.
- **Files:** `rammah-api/package.json`; new `vitest.config.ts`; `vitest.integration.config.ts`; `src/test/setup.ts`; `src/test/factories/*`.
- **Verify:** `npm run test:unit` and `npm run test:coverage` work with zero external services for unit tests.
- **Accept:** Tests fail the command when no test files match; Windows/Linux behavior is identical.

### TEST-02 — Build disposable PostgreSQL integration harness

- **Priority / owner / estimate:** P0 / Backend + platform / 1 day.
- **Depends on:** TEST-01.
- **Change:** Add a test database service, migration/seed/reset helpers, per-suite isolation, and safe guards that refuse non-test database URLs.
- **Files:** New `rammah-api/docker-compose.test.yml`; `src/test/integration-setup.ts`; `src/test/db.ts`; package scripts; CI service config.
- **Verify:** Fresh DB -> migrations -> tests -> cleanup, repeated twice without state leakage.
- **Accept:** Concurrency/payment tests run against real PostgreSQL in local and CI environments.

### TEST-03 — Cover critical backend domain behavior

- **Priority / owner / estimate:** P0 / Backend / 4-6 days.
- **Depends on:** TEST-02 and Phase 1 fixes.
- **Change/tests:** Add collocated `*.unit.test.ts` and `*.integration.test.ts` for auth, pricing, availability math, hold concurrency, free/paid booking, Kashier signature/callback/reconcile, admin mutations/audit, email dedupe, Calendar idempotency, quote/contact/newsletter validation, and OpenAPI/health.
- **Files:** Tests beside `src/modules/**`; shared fixtures under `src/test/`.
- **Coverage gate:** 100% branch coverage for payment callback/finalization, slot hold/conversion, session validation, and outbox claim/ack; API overall >=85% lines and >=80% branches.
- **Accept:** Every P0 regression has a named test reproducing the pre-fix failure.

### TEST-04 — Install frontend component-test framework

- **Priority / owner / estimate:** P1 / Frontend / 0.5-1 day.
- **Depends on:** REPO-05.
- **Change:** Add Vitest, jsdom, Testing Library, user-event, API mocks, and stable animation/browser API shims.
- **Files:** `rammah-next/package.json`; new `vitest.config.ts`; `vitest.setup.ts`; `test/mocks/server.ts`; component/page `*.test.tsx` files.
- **Verify:** `npm run test:unit` is deterministic and does not require a running API.
- **Accept:** Forms, auth gate, payment states, legal fallback, CMS rendering, and navigation error states have behavior tests.

### TEST-05 — Create Playwright end-to-end suite

- **Priority / owner / estimate:** P0 / Full stack / 3-4 days.
- **Depends on:** TEST-02, completed critical flows.
- **Change:** Start frontend/API/test DB using Playwright `webServer`, seed deterministic fixtures, capture traces/screenshots only on failure, and run one worker in E2E.
- **Files:** New `rammah-next/playwright.config.ts`; `tests/e2e/*.spec.ts`; `tests/e2e/fixtures/*`; backend E2E seed/cleanup script.
- **Required flows:** homepage/service, contact, corporate quote, newsletter, free booking, paid sandbox callback, payment return/retry, admin login/logout, offerings/CMS, booking reschedule/cancel, provider failure recovery.
- **Accept:** Chromium desktop + mobile project pass locally and in CI; critical payment/auth tests run serially.

### TEST-06 — Preserve smoke tests as release tests

- **Priority / owner / estimate:** P1 / Backend / 0.5 day.
- **Depends on:** TEST-03.
- **Change:** Make smoke scripts environment-safe, uniquely scoped, cleanup-guaranteed, and callable against staging without default credentials. Separate read-only smoke from mutating release smoke.
- **Files:** `src/scripts/smoke.ts`; `business-smoke.ts`; new `release-smoke.ts`; package scripts.
- **Verify:** Interrupted/failed smoke leaves no records or reports exact cleanup IDs.
- **Accept:** Smoke tests complement, rather than substitute for, automated suites.

### TEST-07 — Add API CI workflow

- **Priority / owner / estimate:** P0 / Platform / 1 day.
- **Depends on:** TEST-01 through TEST-03, REPO-02.
- **Change:** Create the root GitHub Actions workflow with PostgreSQL service and API jobs: workspace install, formatting/lint, typecheck, unit, integration, coverage, migration-from-empty, build, dependency audit, Docker build, and secret scan.
- **Files:** New root `.github/workflows/ci.yml`; API ESLint config if absent; coverage config; root workspace scripts.
- **Accept:** Branch protection requires all jobs; artifacts include coverage and failed-test diagnostics.

### TEST-08 — Add frontend CI workflow

- **Priority / owner / estimate:** P0 / Platform + frontend / 1 day.
- **Depends on:** TEST-04, TEST-05, SEC-07.
- **Change:** Extend the root CI with frontend lint, typecheck, unit/coverage, production build, dependency audit, Playwright, and Docker build jobs. Use one Playwright worker in CI for stability; make the E2E job depend on compatible API/web builds from the same SHA.
- **Files:** Root `.github/workflows/ci.yml`; `rammah-next/package.json`; root workspace scripts; Playwright config.
- **Accept:** No merge to the production branch can bypass lint/typecheck/test/build.

### TEST-09 — Add migration compatibility checks

- **Priority / owner / estimate:** P1 / Backend / 0.5-1 day.
- **Depends on:** TEST-02.
- **Change:** Verify empty install and upgrade from a sanitized previous-release schema snapshot; detect destructive SQL and require explicit migration review.
- **Files:** New `rammah-api/src/test/migrations/*`; CI workflow; update `docs/03-architecture/Migration-Plan.md`.
- **Accept:** Forward migration is proven before deployment; rollback strategy is documented when SQL is not reversible.

### TEST-10 — Turn OpenAPI into an executable API contract

- **Priority / owner / estimate:** P1 / Backend + frontend / 1-2 days.
- **Depends on:** TEST-01 and stable route schemas.
- **Change:** Replace generic request/response placeholders with shared Zod-derived schemas, document authentication/CSRF/error envelopes/pagination/provider callbacks, validate the generated document in CI, and generate or type-check the frontend client contract against it.
- **Files:** `modules/openapi/openapi.routes.ts`; route-local Zod schemas; new `src/openapi/*`; `src/scripts/check-openapi.ts`; `rammah-next/lib/api/*`; package scripts; CI workflows.
- **Tests:** Every registered route appears with method/path/status schemas; undocumented response/status fails CI; representative server responses validate; frontend contract cannot silently drift.
- **Accept:** `/openapi.json` is a reliable machine-checked contract, not a route inventory with generic bodies.

**Phase 2 exit:** G2 passes on clean clones.

## Phase 3 — Transactional Outbox, Worker, and Provider Reliability

### JOB-01 — Add outbox/job schema

- **Priority / owner / estimate:** P0 / Backend / 1 day.
- **Depends on:** TEST-02.
- **Change:** Add `outbox_events` with topic, aggregate, payload, idempotency key, state, attempts, available/locked/processed timestamps, last error, and indexes. Define queued/processing/completed/dead-letter states.
- **Files:** `src/db/schema/index.ts`; new Drizzle migration; new `modules/outbox/outbox.types.ts` and `outbox.repository.ts`.
- **Tests:** unique idempotency, claim ordering, lease expiry, retry schedule, dead-letter threshold.
- **Accept:** Jobs can be enqueued in an existing DB transaction and claimed safely by one worker.

### JOB-02 — Add worker runtime and graceful shutdown

- **Priority / owner / estimate:** P0 / Backend / 1-1.5 days.
- **Depends on:** JOB-01.
- **Change:** Add worker entrypoint, bounded polling, `FOR UPDATE SKIP LOCKED` claims, leases, exponential backoff with jitter, per-job timeout, dead-letter logs, and SIGTERM drain/DB close.
- **Files:** New `src/worker.ts`; `src/worker/runner.ts`; `src/worker/handlers/index.ts`; `src/worker/scheduler.ts`; `package.json`; `src/db/client.ts`.
- **Tests:** two workers do not double-run a job; crashed lease is reclaimed; SIGTERM stops new claims and completes/returns current work.
- **Accept:** Worker restart never loses or duplicates externally visible effects.

### JOB-03 — Queue email delivery

- **Priority / owner / estimate:** P0 / Backend / 1-1.5 days.
- **Depends on:** JOB-02, SEC-02.
- **Change:** Create email delivery/outbox rows inside booking/payment/quote/contact/newsletter transactions; worker performs timeout-bounded Resend calls; keep provider idempotency and manual admin retry. Verify Resend webhooks and record sent/delivered/bounced/complained states; suppress bounced/complained recipients while retaining auditable reason.
- **Files:** `modules/emails/email.service.ts`; `email.repository.ts`; new `public-email-webhooks.routes.ts` and verification service; booking/payment/quote/contact/newsletter services; new worker email handler; schema/migration.
- **Tests:** Resend timeout/429/500/permanent 4xx, invalid webhook signature, duplicate job/webhook, bounce/complaint suppression, template escaping/failure, retry success, dead-letter visibility.
- **Accept:** User-facing booking/payment requests do not wait for Resend and no confirmation is sent twice.

### JOB-04 — Queue Calendar/Meet create/update/cancel

- **Priority / owner / estimate:** P0 / Backend / 1.5-2 days.
- **Depends on:** JOB-02, SEC-02.
- **Change:** Replace synchronous Calendar network calls with outbox jobs; preserve deterministic event IDs; add retryable vs permanent Google error classification.
- **Files:** `modules/calendar/google-calendar.service.ts`; repository; booking/admin services; new worker Calendar handlers.
- **Tests:** OAuth expired, 401 refresh, 404 update fallback, 409 duplicate, timeout, cancel after create queued, reschedule ordering.
- **Accept:** Booking state is durable even when Google is down; admin sees job/event failure and can retry.

### JOB-05 — Implement external Google busy-block sync

- **Priority / owner / estimate:** P0 / Backend / 2-3 days.
- **Depends on:** JOB-02.
- **Change:** Add the Google FreeBusy-compatible scope and force explicit production re-consent. Poll FreeBusy over the exact public booking horizon on the DR-09 schedule, store only busy intervals, atomically replace each sync window, record last success/error/freshness/count, expose admin status/manual sync/reconnect, ignore/dedupe Rammah-created events, and block recurring plus fixed public slots when stale or overlapping. If incremental event sync is later selected, persist `nextSyncToken` and handle HTTP 410 full reset explicitly.
- **Files:** `modules/calendar/google-calendar.repository.ts`; `google-calendar.service.ts`; `admin-google-calendar.routes.ts`; availability repository/service; schema/migration; `AdminIntegrations.tsx`; new worker sync handler.
- **Provider references:** [Google FreeBusy query and accepted scopes](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query); [Google incremental sync and HTTP 410 reset behavior](https://developers.google.com/workspace/calendar/api/guides/sync).
- **Tests:** new/updated/deleted busy intervals, empty calendar, Rammah-created event, all-day events, timezone/DST, recurring events, pagination/rate limit, revoked token/re-consent, optional expired sync token full resync, provider outage, recurring/fixed overlap, stale fail-closed behavior.
- **Accept:** A manually created Google event prevents overlapping bookings within the configured freshness SLO.

### JOB-06 — Expire holds and sessions predictably

- **Priority / owner / estimate:** P1 / Backend / 0.5-1 day.
- **Depends on:** JOB-02, SEC-03.
- **Change:** Scheduled cleanup marks expired active holds, abandons eligible payment attempts, and records counts without making expiry correctness depend on cleanup timing.
- **Files:** availability/payment repositories; new worker expiry handler; outbox/scheduler config.
- **Tests:** expiry boundary, concurrent conversion vs expiry, retry-safe cleanup, large batch pagination.
- **Accept:** Tables do not accumulate active-looking expired records and conversions remain race-safe.

### JOB-07 — Add payment reconciliation schedule

- **Priority / owner / estimate:** P1 / Backend / 1 day.
- **Depends on:** JOB-02, SEC-02.
- **Change:** Periodically reconcile old `processing/pending` payments, use the same trusted finalization transaction, cap provider requests, and expose last result.
- **Files:** payment services/repository; new worker reconciliation handler; env/scheduler config; admin ledger.
- **Tests:** provider paid/failed/not-found/timeout, repeated reconciliation, rate limiting, terminal states ignored.
- **Accept:** Lost callbacks recover automatically without producing duplicate booking side effects.

### JOB-08 — Expose worker/job operations

- **Priority / owner / estimate:** P1 / Backend + frontend / 1 day.
- **Depends on:** JOB-02 through JOB-07.
- **Change:** Readiness/heartbeat, queue depth/oldest age/dead letters, admin list/detail/retry for failed jobs, and alerts for threshold breaches.
- **Files:** health routes; new `modules/outbox/admin-outbox.routes.ts`; admin API client; new/extended integrations/emails screens.
- **Accept:** Operators can distinguish provider outage, worker outage, and a permanently invalid job.

## Phase 4 — Finish Contract-Advertised Product Flows

### FEAT-01 — Connect corporate quote form to the backend

- **Priority / owner / estimate:** P1 / Frontend / 0.5-1 day.
- **Depends on:** TEST-04.
- **Change:** Replace `setTimeout` success with the existing public quote-request client, map all form fields, add validation/loading/error/retry, analytics event, and thank-you routing.
- **Files:** `components/corporate/CorporateQuoteForm.tsx`; `lib/api/bookings.ts` or new `lib/api/quote-requests.ts`; quote route/service validation.
- **Tests:** success, validation, 409/429/500, double submit, offline/network timeout.
- **Accept:** No success UI is shown until the API commits the request.

### FEAT-02 — Implement newsletter subscription end to end

- **Priority / owner / estimate:** P1 / Full stack / 1-1.5 days.
- **Depends on:** TEST-01, TEST-04.
- **Change:** Public subscribe endpoint with normalization, consent/source/timestamp, idempotent duplicate handling, rate limit, DR-08 double-opt-in state, signed confirmation and unsubscribe tokens; connect CTA; add required admin list/export/suppression status.
- **Files:** New `rammah-api/src/modules/newsletter/*`; schema/migration if consent fields are missing; `src/app.ts`; `components/CTASection.tsx`; new `lib/api/newsletter.ts`; admin CMS/engagement screen.
- **Tests:** valid, invalid, duplicate, case normalization, rate limit, consent evidence, expired/forged confirmation, confirm replay, unsubscribe/resubscribe, provider failure if confirmation/welcome email is enabled.
- **Accept:** Button is functional, accessible, privacy-compliant, and operator-visible.

### FEAT-03 — Eliminate public legal placeholders

- **Priority / owner / estimate:** P0 / Product + frontend + backend / 0.5-1 day plus legal input.
- **Depends on:** DR-02.
- **Change:** Seed approved legal versions, require published content during production preflight, render a safe unavailable state rather than draft instructions, and record version/effective date.
- **Files:** `components/LegalDocument.tsx`; CMS legal service/repository; `src/db/seed.ts`; `production-preflight.ts`; legal docs.
- **Tests:** published, missing, draft, API unavailable, version update.
- **Accept:** Production can never show internal placeholder copy.

### FEAT-04 — Resolve admin Settings and dead navigation

- **Priority / owner / estimate:** P1 / Frontend / 0.5 day.
- **Depends on:** None.
- **Change:** Either enable settings through the existing CMS settings UI or remove the disabled navigation item. Audit every sidebar link/action for live behavior and permissions.
- **Files:** `components/admin/AdminShell.tsx`; `AdminCms.tsx`; admin routes/pages.
- **Tests:** every sidebar route loads, unauthenticated redirect works, no disabled launch-critical destination.
- **Accept:** Admin has no decorative or misleading operation.

### FEAT-05 — Close coupon and tax contract decision

- **Priority / owner / estimate:** P1 / Product + backend + frontend / 0.5 day to remove, 2-4 days to implement.
- **Depends on:** DR-01.
- **Option A:** Implement coupon validity windows, usage limits, offering scope, currency/amount/percentage rules, tax rules, snapshots, admin CRUD, and payment amount parity.
- **Option B (recommended without approved rules):** Remove coupon/tax inputs and claims from MVP API/docs/UI; keep schema dormant; return no misleading `not_applied` behavior.
- **Files:** `modules/pricing/public-price-preview.*`; offerings/pricing admin; schema/migration; booking/payment snapshots; API/OpenAPI/docs; `BookingFlow.tsx`.
- **Accept:** The amount displayed, booked, hashed for Kashier, paid, and recorded is identical and fully explained.

### FEAT-06 — Complete payment failure/retry UX

- **Priority / owner / estimate:** P1 / Frontend + backend / 1-1.5 days.
- **Depends on:** SEC-02.
- **Change:** Model processing/failed/cancelled/expired/abandoned/refunded states, retry only closed attempts, poll/reconcile with bounded backoff, preserve merchant order identity rules, and show support-safe reference IDs. Implement DR-07 manual refund as a permissioned admin action/record that captures Kashier reference, amount, reason, actor, evidence, and resulting booking/payment state; do not claim an automated refund occurred.
- **Files:** `BookingPaymentFrame.tsx`; payment return/status pages; payment API client; payment service/types.
- **Tests:** browser back, refresh, duplicate Pay click, callback before return, return before callback, expired session, provider outage.
- **Accept:** User always knows whether to wait, retry, contact support, or stop; no duplicate charge attempt is created accidentally.

### FEAT-07 — Implement CMS media upload/storage

- **Priority / owner / estimate:** P1 / Full stack + operations / 2-3 days.
- **Depends on:** DR-05, D-08, TEST-02.
- **Change:** Multipart/presigned upload, MIME-bytes/extension checks, size/dimension limits, randomized non-executable object keys, DB metadata/hash/width/height, optimized variants, replace/archive, signed admin preview, public delivery policy, joined public URL+alt metadata, and orphan cleanup. SVG is rejected by default unless an approved sanitizer is added.
- **Files:** New `modules/media/*`; `src/app.ts`; `src/config/env.ts`; schema/migration if needed; `components/admin/AdminCms.tsx`; `lib/api/cms.ts`; `.env.example`; S3 test adapter/MinIO config.
- **Tests:** spoofed MIME, oversized file, executable/SVG policy, duplicate/replacement, provider timeout, orphan record/object, authorization.
- **Accept:** Admin can upload and attach launch content without filesystem coupling or exposing private credentials.

### FEAT-08 — Separate contact inquiries from quote requests or document the mapping

- **Priority / owner / estimate:** P1 / Product + full stack / 1 day.
- **Depends on:** Product confirmation.
- **Change:** Recommended: implement `contact_inquiries` public/admin path with notification and status; keep corporate requests in quote workflow. If a single queue is desired, rename contracts/UI/docs consistently.
- **Files:** New `modules/contact-inquiries/*` or quote module changes; `ContactForm.tsx`; `lib/api`; admin page/navigation; email templates.
- **Tests:** inquiry/quote routing, spam/rate limit, status/audit, notification retry.
- **Accept:** Operators can tell a general contact message from a sales quote request.

### FEAT-09 — Complete CMS/public metadata consistency

- **Priority / owner / estimate:** P1 / Full stack / 1-2 days.
- **Depends on:** FEAT-07.
- **Change:** Ensure page sections, navigation, SEO metadata, blog, offerings, legal versions, footer, and site settings published in CMS are the actual public source; remove stale hard-coded launch copy except explicit outage fallbacks. Replace global `no-store` fetching with documented bounded revalidation/tag invalidation and a measurable publish-delay SLO.
- **Files:** CMS routes/service; `lib/api/cms.ts`; public pages/components; seed data.
- **Tests:** draft vs published, archive, ordering, missing media, stale cache/revalidation.
- **Accept:** Admin-published launch-critical content appears without code deployment.

### FEAT-10 — Complete automatic country pricing, early-bird, and price snapshots

- **Priority / owner / estimate:** P0/P1 / Product + backend + frontend / 2-3 days.
- **Depends on:** DR-01, SEC-06, TEST-02.
- **Change:** Define one deterministic price resolver covering trusted automatic country detection, one active country-group membership, early-bird selection, currency minor units, and a full immutable seven-field price expectation/snapshot. Never accept a customer-entered pricing country or use a fallback country; block paid checkout when detection or pricing is unavailable. Trust provider headers only from configured proxy CIDRs and use GeoIP otherwise. Reuse the same resolver for preview and atomic hold conversion/payment creation. Coupons and non-zero tax rules remain deferred until their business rules are approved.
- **Files:** `modules/pricing/public-price-preview.repository.ts`; `public-price-preview.service.ts`; offerings pricing repositories/routes; booking/payment services and schema snapshots; `BookingFlow.tsx`; `AdminOfferingPricing.tsx`; Nginx/env geo contract; OpenAPI.
- **Tests:** Supported/unsupported country, spoofed geo header, missing detection, early-bird boundaries, no price row, multi-country overlap, price change after hold, same-hold reconfirmation, preview-to-payment parity, and callback amount/currency parity.
- **Accept:** One immutable breakdown explains the exact amount from first preview through final payment and later audit.

### FEAT-11 — Complete CMS editorial lifecycle, rich text, and scheduled publishing

- **Priority / owner / estimate:** P1 / Full stack / 2-3 days.
- **Depends on:** FEAT-07, JOB-02, TEST-04.
- **Change:** Add a maintained rich-text editor for blog/long-form fields, server-side allowlist sanitization, safe public rendering, draft/published/archived/scheduled transitions, preview, reorder, unique per-type slugs, scheduled publish worker, and audit records. Store a canonical format with an explicit version so editor upgrades do not reinterpret old content.
- **Files:** `modules/cms/admin-cms.routes.ts`; CMS service/repository/types; schema/migration; worker scheduled-publish handler; `components/admin/AdminCms.tsx` or new `AdminRichTextEditor.tsx`; public blog/legal/content renderers; CSP; OpenAPI.
- **Tests:** Stored/reflected XSS payloads, unsafe URL/style, malformed rich text, schedule timezone/DST, duplicate slug race, archive/unpublish, preview authorization, reorder conflict, editor round trip.
- **Accept:** Editors can safely author and schedule long-form content without HTML/source access, and public output contains no unsanitized markup.

### FEAT-12 — Complete the admin control plane

- **Priority / owner / estimate:** P1 / Full stack / 3-4 days.
- **Depends on:** SEC-08, JOB-08, FEAT-02/08.
- **Change:** Add multi-admin user management (invite/create, role, disable, revoke sessions), read-only searchable audit log, notification/integration/job failure center, and missing inquiries/newsletter modules. Standardize server-side search, filters, sorting, pagination, empty/loading/error states, permission guards, and CSV export limits across operational lists.
- **Files:** New `rammah-api/src/modules/admin-users/*`; new `rammah-api/src/modules/notifications/*`; new admin routes under `rammah-api/src/modules/audit/`, contact, and newsletter modules; `rammah-api/src/app.ts`; schema/migration; new `rammah-next/app/admin/(protected)/users/`, `audit/`, `notifications/`, `inquiries/`, and `newsletter/`; matching `rammah-next/components/admin/*`; `rammah-next/lib/api/admin.ts`; `rammah-next/components/admin/AdminShell.tsx`.
- **Tests:** Last-super-admin protection, disable/revoke, role matrix, audit immutability/redaction, notification acknowledge/retry link, filtered pagination stability, bounded/authorized export, session expiry with preserved form input.
- **Accept:** Every FR-222 launch module has a real authorized route and operational state; high-risk actions are auditable and no list requires an unbounded fetch.

### FEAT-13 — Verify offering catalog and lifecycle completeness

- **Priority / owner / estimate:** P1 / Full stack + product / 1.5-2 days.
- **Depends on:** FEAT-07/09/10.
- **Change:** Close gaps for category/taxonomy management; coaching, therapy-style, workshop, webinar, course, corporate and custom-quote types; online/offline/hybrid modes; duration/capacity/location/calendar/price/booking eligibility; draft/publish/archive/delete retention; quote-only routing; unique slugs and public/admin parity.
- **Files:** `modules/offerings/admin-offerings.*`; public offerings service/mapper/types; schema/migration; `AdminOfferingEditor.tsx`; `AdminOfferingsTable.tsx`; public services/detail/booking entry pages; OpenAPI/seed.
- **Tests:** Each type/mode combination, quote-only and disabled booking, archive with historical bookings, delete retention rule, category filtering, slug race, incomplete configuration publication block.
- **Accept:** Every offering allowed by the FRS has a validated admin lifecycle and the correct public booking-or-quote behavior.

**Phase 4 product-prerequisite exit:** Phase 4 feature acceptance passes, but G3 remains open until the complete bilingual Phase 4.5 journey and its signed inventory pass.

## Phase 4.5 — Complete Bilingual Arabic Customer Journey

This phase is part of the production launch, not a post-launch enhancement. It is a cross-cutting workstream: LOC-01 through LOC-10 establish the bilingual product foundation after their Phase 0-4 prerequisites; LOC-11 closes alongside the Phase 5 SEO/performance and Phase 6 environment/operations work; LOC-12 closes alongside Phase 7 staging and launch. The implementation sequence, schemas, interfaces, test snippets, commands, expected results, and per-step commits are specified in `docs/superpowers/plans/2026-07-20-bilingual-arabic-customer-journey.md`. The approved architecture and route/content decisions are in `docs/superpowers/specs/2026-07-20-bilingual-arabic-customer-journey-design.md`.

### LOC-01 — Establish the locale contract, typed copy, and trusted document direction

- **Priority / owner / estimate:** P1 / Frontend + backend / 1-1.5 days.
- **Depends on:** REPO-01 through REPO-05, TEST-01/02/04/05.
- **Change:** Define exactly `en | ar`, use `ar-EG` for human formatting, create the strict server-only `AR_PUBLIC_ENABLED=false` contract before any Arabic surface, add complete type-checked customer UI dictionaries, bidi-safe formatting helpers, server-owned document locale detection, `lang`/`dir`, Arabic font, and locale context. Reject unsupported/forged locale values; do not infer locale from IP/browser headers and do not silently fall back from Arabic to English.
- **Files:** `rammah-api/src/shared/i18n/{public-locale,public-locale-feature}.ts`; API localization tests and env contracts; `rammah-next/lib/i18n/{locales,public-feature,messages,format,bidi,document-locale}.ts`; `rammah-next/proxy.ts`; `rammah-next/app/layout.tsx`; `rammah-next/components/i18n/LocaleProvider.tsx`; `docs/02-requirements/{FRS,NFR}.md`.
- **Tests / verify:** API and frontend locale unit tests, message key/empty-copy parity guard, document-locale route matrix, bidi formatter tests, lint/typecheck/build.
- **Accept:** `/...` renders server-side as English LTR, `/ar/...` as Arabic RTL, all public customer copy is typed, and unsupported locales cannot enter persisted/provider state.

### LOC-02 — Add deterministic locale route mapping and language switching

- **Priority / owner / estimate:** P1 / Frontend / 0.5-1 day.
- **Depends on:** LOC-01, FEAT-09/13.
- **Change:** Preserve every English URL; model static route counterparts explicitly; map dynamic offering/blog slugs from published translation metadata; preserve validated tokens for status/payment routes; omit the switch when no safe counterpart exists. Never generate a counterpart by string replacement or automatic redirect.
- **Files:** `rammah-next/lib/i18n/route-map.ts`; route-map/query-allowlist tests; standalone `components/i18n/LanguageSwitcher.tsx`; `PublicFrame.tsx`/`Navbar.tsx` wiring lands in LOC-08 after every English caller is migrated.
- **Tests / verify:** Static/dynamic/token/missing-counterpart matrices on desktop/mobile; all historical English paths remain unchanged.
- **Accept:** Each visible switch lands on the same resource/journey in the other locale, or is absent when that promise cannot be made.

### LOC-03 — Add additive translation schema and verified English backfill

- **Priority / owner / estimate:** P1 / Backend + database / 2-2.5 days.
- **Depends on:** LOC-01, TEST-02/09; documentation and admin integration close with FEAT-07/09/11.
- **Change:** Add database-enforced locale/resource enums; typed current-public translation tables for settings, navigation, media alt, pages/sections, legal, SEO, blog categories/posts, offering categories/offerings, locations, booking fields/options, and email templates; add one schema-validated draft/scheduled working-copy store, immutable legal/email publication revisions, and defaulted customer-locale/provenance snapshots. Backfill English idempotently, preserve null media alt/provenance, and prove every copied field plus visible English output does not change.
- **Files:** `rammah-api/src/db/schema/index.ts`; two next journal-assigned forward-only Drizzle migrations named `bilingual_cms_translations` and `bilingual_catalog_customer_locale`; English backfill/verification scripts; localization schema/integration tests; `rammah-api/package.json`; `docs/03-architecture/{ERD,Data-Dictionary}.md`.
- **Tests / verify:** Clean and upgrade migration tests, two consecutive backfill runs, field/canonical-hash parity, conflict/orphan/extra/duplicate/NFC-slug verification, immutable revision pointers, English response golden tests, typecheck; inspect migrations for no destructive `DROP`/rewrite.
- **Accept:** Every existing public resource has one verified English translation, Arabic rows are additive, locale/slug uniqueness is enforced, and base business/history rows are not duplicated or destroyed.

### LOC-04 — Serve publication-safe localized CMS, navigation, blog, legal, and SEO APIs

- **Priority / owner / estimate:** P1 / Backend / 1.5-2 days.
- **Depends on:** LOC-03, TEST-10; launch acceptance also requires FEAT-03/09/11.
- **Change:** Default omitted legacy GET locale to English but reject supplied unsupported locales with stable `UNSUPPORTED_LOCALE`; require base and requested translation to be effectively published, return `Content-Language` and published counterpart slugs, resolve dynamic content by localized slug, and fixed pages/legal by stable base key. Legal reads follow immutable published revision pointers. Missing Arabic returns `LOCALIZED_CONTENT_NOT_FOUND`, never English content.
- **Files:** `rammah-api/src/modules/localization/{localized-resource.types,public-cms-localization.repository,public-cms-localization.service}.ts`; `modules/cms/public-cms.routes.ts`; OpenAPI routes/contracts; integration tests.
- **Tests / verify:** Arabic/English reads, fixed-key and translated-slug paths, draft/scheduled/archived isolation, missing-translation 404, counterpart metadata, OpenAPI check and typecheck.
- **Accept:** The public API cannot expose the wrong locale or unpublished translation and fixed URLs remain independent from localized content slugs.

### LOC-05 — Localize offerings, locations, booking fields, and lead endpoints without changing machine values

- **Priority / owner / estimate:** P1 / Backend / 1.5-2 days.
- **Depends on:** LOC-03, FEAT-01/02/08/10/13.
- **Change:** Localize display fields and form labels/options while preserving offering IDs, type/mode, eligibility, price minor units/currency, capacity, slot timestamps, option values, and provider mappings. Validate explicit locale on contact, quote, newsletter, availability, hold, and booking contracts.
- **Files:** public offering/availability/booking/quote/contact/newsletter repositories, services, routes, schemas, mappers, OpenAPI, and localization integration tests under `rammah-api/src/modules/**`.
- **Tests / verify:** Locale display assertions plus deep equality of all machine fields; forged/missing locale, missing translation, draft isolation, free/paid/quote-only, online/offline/hybrid, capacity and price parity.
- **Accept:** English and Arabic return different approved presentation but identical trusted catalog, pricing, availability, and submission semantics.

### LOC-06 — Persist trusted customer locale and server-owned booking answer labels

- **Priority / owner / estimate:** P1 / Backend / 1-1.5 days.
- **Depends on:** LOC-03/05, SEC-03/04/10/11.
- **Change:** Store validated locale transactionally on free/paid bookings, quote requests, contact inquiries, newsletter consent flows, and email-delivery snapshots; resolve booking field labels server-side; issue a short-lived signed consent receipt bound to the immutable legal revision/locale/hash/purpose shown to the customer and persist that exact revision atomically. Reject forged/expired/wrong-purpose receipts and client-supplied labels/legal versions. Define idempotent resubscribe locale behavior and keep payment rows locale-free.
- **Files:** booking/lead/newsletter schemas, services, repositories and integration tests; admin projections; OpenAPI.
- **Tests / verify:** Forged label/locale/legal version, missing required localized legal version, duplicate newsletter, failed transaction rollback, historical default `en`, admin visibility, consent/privacy/export/delete behavior.
- **Accept:** Operators and downstream jobs see the trusted communication locale, while customer input cannot rewrite labels or payment/business truth.

### LOC-07 — Make payment return, status, and queued customer email locale-safe

- **Priority / owner / estimate:** P1 / Backend + frontend / 1-1.5 days.
- **Depends on:** LOC-03/06, SEC-01/02, JOB-01 through JOB-03/07.
- **Change:** Use a discriminated callback result and derive token/return locale only from the verified matched booking; unmatched callbacks use no query-derived redirect data. Derive supported Kashier display language from stored locale without changing signature fields. Snapshot immutable email revision ID/hash/locale/variables at enqueue and render that same revision on every retry. Localized email formats offering/location/date/money in backend helpers, sets `lang`/`dir`, isolates machine values, and emits locale-correct links. Disabling Arabic blocks new journeys but preserves signed newsletter confirm/unsubscribe, verified token-bearing status/payment/recovery, callbacks, reconciliation, hold release, and queued email for in-flight Arabic records.
- **Files:** payment callback/finalization/routes/tests; email template/outbox/worker/delivery modules and tests; booking status/payment return API types.
- **Tests / verify:** Forged callback locale, success/decline/abandon/expiry/replay/order variants, reconciliation, locale-correct email/link, missing template, retry/idempotency, exact amount/currency parity.
- **Accept:** Payment verification remains unchanged and authoritative; stored booking locale controls every customer-facing return, status, and email outcome.

### LOC-08 — Refactor one shared public UI and add the complete `/ar` route tree

- **Priority / owner / estimate:** P1 / Frontend / 2-3 days.
- **Depends on:** LOC-01/02/04/05/07, TEST-04; this work provides the bilingual route/error portion of WEB-01/04.
- **Change:** Require locale in all public API clients and submissions; translate structured error codes; replace hardcoded public copy/Intl usage; guard dirty mid-form language changes without persisting PII and best-effort release active holds; extract shared locale-aware page modules; keep thin English wrappers and add Arabic equivalents for home, About, services/detail, blog/detail, contact, legal, thank-you, newsletter, booking, status, payment, and return. Add Arabic error/not-found boundaries and canonical legal redirects.
- **Files:** `rammah-next/lib/api/**`; shared public components; `features/public/pages/**`; existing `app/**` routes; new `app/ar/**` routes and boundaries.
- **Tests / verify:** Component/API signature tests, every listed route in clean build manifest, 404/409/429/500/offline/retry states, English visual/behavior regression, no hardcoded customer-copy guard.
- **Accept:** Both locale trees run the same components and APIs; every customer journey has an Arabic route and no Arabic failure silently redirects or renders English.

### LOC-09 — Finish RTL, accessibility, motion, and directional isolation

- **Priority / owner / estimate:** P1 / Frontend + QA / 1-1.5 days.
- **Depends on:** LOC-08, TEST-05; this task co-closes the Arabic evidence required by WEB-02/03/06/07.
- **Change:** Replace physical public layout rules with logical properties where direction matters; explicitly isolate email, phone, IDs, currency/provider references and code-like values; mirror only directional icons; retain meaningful artwork orientation; preserve logical focus/DOM order; honor reduced motion and prevent horizontal overflow.
- **Files:** shared public CSS/components, booking/payment/status forms, motion/GSAP components, locale RTL guard, Playwright/axe tests.
- **Tests / verify:** Arabic desktop/mobile screenshots and overflow probes, keyboard/screen-reader order, axe, contrast, zoom, reduced motion, slow network, Web Vitals/Lighthouse budgets in both locales.
- **Accept:** Arabic is production-quality RTL with zero serious/critical accessibility violations, no directional ambiguity, and no material performance regression from English.

### LOC-10 — Add English-admin bilingual authoring and publication gates

- **Priority / owner / estimate:** P1 / Full stack + product / 1.5-2 days.
- **Depends on:** LOC-03/04/05, FEAT-07/11/12, DR-12.
- **Change:** Add English/Arabic tabs and typed per-resource editors backed by working copies so current published content stays live during edits, independent draft/published/scheduled states, frozen scheduled payloads, idempotent scheduler, immutable legal/email revision publication, completeness/media provenance checks, sanitized rich text, normalized Unicode slug validation with bidi-control rejection, RTL inputs, protected no-store/noindex Draft Mode preview, audited copy-to-draft, publish/unpublish actions, and operator locale/status filters. Guard fixed base keys through legacy/new routes and dual-write English display fields during binary rollback compatibility. Publishing Arabic never changes English state.
- **Files:** admin localization services/routes/schemas/audit tests; `rammah-next/components/admin/**`; admin API clients/types/component/E2E tests.
- **Tests / verify:** Missing legal/body/SEO/alt/email fields block publish; role/CSRF/audit/concurrency; preview unpublished content safely; publish/unpublish Arabic without English change; XSS/bidi-control/slug collisions.
- **Accept:** Authorized admins can safely manage and audit both locales from English admin, and incomplete Arabic cannot reach public APIs.

### LOC-11 — Gate Arabic release and add bilingual SEO, sitemap, and preflight

- **Priority / owner / estimate:** P1 / Full stack + SEO + operations / 1-1.5 days.
- **Depends on:** LOC-04/08/10 and confirmed production origin; this task co-closes WEB-05 and the locale-specific OPS-01/07 checks.
- **Change:** Extend LOC-01's server-only flag consistently across web/API and fail preflight on mismatch while honoring LOC-07 in-flight exceptions; hide Arabic discovery/navigation/sitemap until enabled; add a typed publication-aware route-inventory API, exact canonical/reciprocal hreflang/`x-default`, localized metadata/OpenGraph/alt, sitemap, robots/no-store protections, locale metrics/alerts, and exact missing-resource preflight.
- **Files:** Existing API/frontend flag contracts; route-inventory repository/service/route/tests; `rammah-next/lib/i18n/locale-seo.ts`; metadata builders; `app/sitemap.ts`; `app/robots.ts`; locale observability; production/Arabic content preflight scripts and tests.
- **Tests / verify:** Disabled/enabled fixtures, missing counterpart, canonical/hreflang reciprocity, draft exclusion, no query-param locale URLs, no token indexing, content/email/legal/SEO/media-alt inventory failures.
- **Accept:** Arabic is independently reversible by flag without data rollback, cannot be indexed early, and cannot be enabled while required launch content is missing.

### LOC-12 — Prove bilingual parity, approve content, soak staging, and hand over release

- **Priority / owner / estimate:** P1 / QA + product + legal + operations / 2-3 days plus 48-hour soak.
- **Depends on:** LOC-01 through LOC-11, G0-G4, and the non-soak G5 prerequisites; execute with LAUNCH-01 through LAUNCH-05 and close G5 only after the enabled 48-hour staging soak.
- **Change:** Add deterministic shared-entity bilingual fixtures and English/Arabic desktop/mobile Playwright projects; test content/leads/free and paid booking/payment recovery/admin authoring/SEO; sign one row per route/resource in the Arabic inventory; rehearse enable-disable-re-enable; document missing-translation diagnosis, localized email retry, preview/unpublish, sitemap verification, and rollback.
- **Files:** `rammah-next/tests/e2e/bilingual-*.spec.ts`; Playwright/CI configuration; `docs/05-project-plan/{Arabic-Content-Inventory,Bilingual-Launch-Acceptance-Report}.md`; production/admin runbooks; deployment checklist.
- **Tests / verify:** Full API/frontend/clean-build suites, four browser projects, provider sandbox and low-value live locale smoke, axe/RTL/SEO/performance crawls, Arabic preflight zero failures, 48-hour staging soak with alerts/backups/workers active.
- **Accept:** Product/legal/SEO approve every Arabic row; English and Arabic machine-state parity is evidenced; zero open P0/P1 remains; disabling Arabic leaves English healthy, blocks new Arabic journeys, and still completes verified in-flight Arabic status/payment/callback/email work; runbook and rollback rehearsal are signed.

**Phase 4.5 exit:** G3 bilingual completeness passes; production Arabic remains disabled until LOC-11/12, G4/G5, and the signed staging-soak evidence are complete.

## Phase 5 — Frontend Quality, Performance, SEO, and Accessibility

### WEB-01 — Make lint/typecheck/build clean

- **Priority / owner / estimate:** P0 / Frontend / 1-2 days.
- **Depends on:** SEC-07.
- **Change:** Remove all 15 errors and 7 warnings: `any` errors, hook mutations, CommonJS lint failures in one-off scripts, unused values, and raw image warning; add an explicit `typecheck` script. Exclude/remove one-off tooling intentionally instead of weakening rules. Investigate the production build that did not complete within 120 seconds and capture timed clean-build evidence.
- **Files:** `AboutExperience.tsx`; `CorporateExperience.tsx`; `AboutGlobe.tsx`; `HeroSection.tsx`; `Footer.tsx`; `app/services/page.tsx`; `convert.js`; `extract.js`; `rename.js`; ESLint config; package scripts.
- **Accept:** lint with zero warnings, typecheck, and production build pass twice from a clean checkout.

### WEB-02 — Remove unused assets and define an asset budget

- **Priority / owner / estimate:** P1 / Frontend / 1 day.
- **Depends on:** REPO-01 inventory.
- **Change:** Prove references, then remove/archive unused `frames1`, `loading-frames`, duplicate video/images, move master source media outside deployable Git or to LFS/object storage, and add an asset audit script.
- **Files:** `rammah-next/public/**`; new `scripts/audit-public-assets.mjs`; `.gitignore`; asset documentation.
- **Budget:** tracked/deployed public assets <=30 MB before CMS media; no single unused file; CI fails on new oversized assets without allowlist.
- **Accept:** Deployment image and clone size drop materially without visual regressions.

### WEB-03 — Make motion/media progressive and accessible

- **Priority / owner / estimate:** P1 / Frontend / 1.5-2 days.
- **Depends on:** WEB-02.
- **Change:** Lazy-load frame sequences near viewport, preload only a small leading window, cap loading screen wait, add skip/fallback, honor `prefers-reduced-motion`/data saver, use poster images, and avoid `preload=auto` for non-critical videos.
- **Files:** `ServicesSection.tsx`; `LoadingScreen.tsx`; `Navbar.tsx`; `HeroSection.tsx`; associated CSS.
- **Tests:** slow 3G, failed frame/video, reduced motion, mobile memory, navigation before preload completes.
- **Accept:** Content is usable without animation/media and no forced 6.5-9 second wait remains.

### WEB-04 — Add application error boundaries and recovery states

- **Priority / owner / estimate:** P1 / Frontend / 1 day.
- **Depends on:** TEST-04.
- **Change:** Add route/global error UI, not-found page, retry actions, API timeout handling, offline/empty states, and sanitized support reference IDs.
- **Files:** New `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`; API clients; public/admin components.
- **Tests:** API 404/429/500/timeout, malformed payload, network offline, session expiry while editing.
- **Accept:** No expected backend/provider failure produces a blank screen or endless spinner.

### WEB-05 — Complete SEO and share metadata

- **Priority / owner / estimate:** P1 / Frontend + product / 1-1.5 days.
- **Depends on:** FEAT-09, production domain.
- **Change:** Add robots, sitemap, manifest, canonical URLs, OpenGraph/Twitter images, dynamic metadata for blog/service/legal pages, noindex for admin/payment status, and structured data where accurate.
- **Files:** New `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`; root/dynamic page metadata; `next.config.ts`; CMS SEO mapping.
- **Tests:** generated URLs use production origin, drafts/admin excluded, 404 not indexed, social previews valid.
- **Accept:** Search-engine and social-preview checklist passes on staging domain before DNS cutover.

### WEB-06 — Accessibility pass

- **Priority / owner / estimate:** P1 / Frontend + QA / 1.5-2 days.
- **Depends on:** TEST-05.
- **Change:** Keyboard/focus order, dialog/menu semantics, labels/errors, contrast, reduced motion, skip link, status announcements, iframe title, and English/Arabic RTL correctness across shared public journeys.
- **Files:** shared frame/navbar/footer; booking/payment forms; admin shell/forms; Playwright axe tests.
- **Accept:** Zero serious/critical automated violations and manual keyboard completion of booking/admin login.

### WEB-07 — Add performance budgets and regression checks

- **Priority / owner / estimate:** P1 / Frontend + platform / 1 day.
- **Depends on:** WEB-02, WEB-03.
- **Change:** Lighthouse CI or equivalent for homepage/services/booking; bundle analysis; Web Vitals collection; image/font caching; set measurable mobile budgets.
- **Files:** New `lighthouserc.*`; CI workflow; `next.config.ts`; analytics/monitoring integration.
- **Budgets:** No regression from agreed staging baseline; define LCP/INP/CLS and JS/image transfer thresholds in the artifact.
- **Accept:** CI stores reports and blocks material unexplained regressions.

### WEB-08 — Database/API performance and pagination pass

- **Priority / owner / estimate:** P2 / Backend + frontend / 1-2 days.
- **Depends on:** TEST-03.
- **Change:** Capture query plans for public availability and admin ledgers, add missing indexes, bound date ranges/page sizes, paginate large tables, and eliminate sequential provider/network waits in requests.
- **Files:** availability/payment/booking/email/quote repositories; schema/migration; admin API clients/tables.
- **Tests:** 10k booking/payment/email fixtures; bounded response sizes; no N+1 queries; load-test thresholds.
- **Accept:** Agreed p95 targets hold on staging-sized data.

## Phase 6 — Production Infrastructure, Observability, Backup, and Delivery

### OPS-01 — Complete production environment contract

- **Priority / owner / estimate:** P0 / Backend + operations / 1 day.
- **Depends on:** architecture decisions.
- **Change:** Close the currently observed 12 production-preflight failures; add worker, S3, trusted proxy, job retry, sync freshness, Sentry, release SHA, shutdown, DB pool/SSL, and public URL settings; validate production-only combinations plus required legal/CMS/admin/provider/backup state.
- **Files:** `rammah-api/src/config/env.ts`; API `.env.example`; frontend `.env.example`; `production-preflight.ts`; docs env matrix.
- **Accept:** Preflight has zero failures on staging/prod and rejects test/mock/local values in production.

### OPS-02 — Add backend production image

- **Priority / owner / estimate:** P0 / Platform / 1 day.
- **Depends on:** REPO-05, JOB-02.
- **Change:** Multi-stage image pinned to an approved supported Node version/digest, non-root runtime, production dependencies only, healthcheck, read-only filesystem compatibility, API/worker commands, labels with Git SHA.
- **Files:** New root/API `Dockerfile`; `.dockerignore`; package scripts.
- **Verify:** Same image runs `node dist/server.js` and `node dist/worker.js`; container scan and smoke pass.
- **Accept:** No source-mounted or mutable local dependency is required in production.

### OPS-03 — Add frontend standalone production image

- **Priority / owner / estimate:** P0 / Platform + frontend / 1 day.
- **Depends on:** SEC-07, WEB-01.
- **Change:** Enable Next standalone output and create multi-stage non-root image with only required runtime/public assets.
- **Files:** `rammah-next/next.config.ts`; new `rammah-next/Dockerfile`; `.dockerignore`.
- **Verify:** Build once, run with staging env, health/page requests pass, image contains no `.env.local` or source-only media.
- **Accept:** Frontend image is immutable and promotion-safe.

### OPS-04 — Create production/staging Compose topology

- **Priority / owner / estimate:** P0 / Platform / 1-1.5 days.
- **Depends on:** OPS-02, OPS-03, DR-03.
- **Change:** Define web, API, worker, Nginx, health dependencies, persistent volumes, networks, restart policy, resource limits, and separate staging/prod env files outside Git. Add a PostgreSQL service only for the DR-06 self-hosted choice; otherwise configure the private/TLS managed connection and exclude a local DB container.
- **Files:** New `deploy/docker-compose.production.yml`; `deploy/docker-compose.staging.yml`; `deploy/env/*.example`; update local compose only where necessary.
- **Accept:** `docker compose up` reaches healthy state from an empty VPS with documented prerequisites.

### OPS-05 — Configure Nginx/TLS and request boundaries

- **Priority / owner / estimate:** P0 / Platform / 1 day.
- **Depends on:** OPS-04, domains.
- **Change:** TLS redirect, one public origin with `/api` proxying, provider callback path, real client IP, timeouts, body limits, websocket/streaming support, security headers, compression, immutable static cache, no-cache sensitive routes, and payment callback logging policy.
- **Files:** New `deploy/nginx/rammah.conf`; TLS setup instructions/scripts; environment URLs.
- **Tests:** malformed/large/slow requests, streaming page, upload limit, Kashier callback, HSTS after certificate validation.
- **Accept:** Only Nginx ports are public; Postgres/API/web internal ports are not exposed externally.

### OPS-06 — Add API graceful shutdown and readiness semantics

- **Priority / owner / estimate:** P0 / Backend / 0.5-1 day.
- **Depends on:** JOB-02.
- **Change:** Handle SIGTERM/SIGINT, stop accepting traffic, drain HTTP, close DB pool, expose not-ready during shutdown; readiness checks DB and required runtime configuration, worker has separate heartbeat.
- **Files:** `src/server.ts`; `src/db/client.ts`; `modules/health/health.routes.ts`; worker runtime; Docker healthchecks.
- **Tests:** terminate during request/job, DB unavailable, worker stale.
- **Accept:** Deploy/restart does not corrupt in-flight work and unhealthy services are not routed.

### OPS-07 — Add structured observability and error tracking

- **Priority / owner / estimate:** P1 / Full stack + operations / 1.5-2 days.
- **Depends on:** OPS-01.
- **Change:** Correlate release/request/booking/payment/job IDs, redact secrets/PII, integrate Sentry or selected tracker for API/worker/web, instrument request/DB/job/provider spans and browser traces, emit RED/job/provider/business-integrity metrics, define sampling, and retain container logs safely.
- **Files:** backend logger/error handler; request-id middleware; new frontend/backend instrumentation; env examples; monitoring docs.
- **Alerts:** External uptime from outside the VPS; web/API/DB down; worker heartbeat stale; oldest queue age; failed/dead jobs; invalid callback/payment mismatch/pending-age spike; stale Google sync; Calendar/email failure or bounce spike; backup failure; certificate expiry; disk/CPU/memory/DB-pool exhaustion; repeated admin login failures.
- **Accept:** A synthetic failure is visible with release and request IDs but no secret/raw provider signature.

### OPS-08 — Automate database backup and retention

- **Priority / owner / estimate:** P0 / Operations / 1 day.
- **Depends on:** DR-03, OPS-04.
- **Change:** Daily encrypted custom-format `pg_dump`, pre-migration backup, checksum, retention rotation, off-site copy, failure alert, and backup inventory. For a self-hosted VPS database, additionally configure WAL archiving/PITR using pgBackRest/WAL-G or an approved equivalent and monitor archive freshness. Include S3 media versioning/replication or an independent object inventory+copy policy aligned with SEC-11 retention.
- **Files:** New `deploy/scripts/backup-postgres.ps1` or Linux `.sh` used on VPS; `verify-backup`; cron/systemd timer instructions; backup docs.
- **Accept:** Latest backup exists off VPS, checksum validates, secrets are not embedded in scripts/logs.

### OPS-09 — Automate and drill restore

- **Priority / owner / estimate:** P0 / Operations + backend / 1 day plus drill.
- **Depends on:** OPS-08.
- **Change:** Restore database and a sampled/full media set into disposable staging targets, apply only needed migrations, verify DB-to-object consistency, run smoke/business integrity checks, and document RPO/RTO plus post-restore provider reconciliation.
- **Files:** New `deploy/scripts/restore-postgres.*`; `verify-restored-data.*`; update `Backup-Recovery-Plan.md` and runbook.
- **Accept:** A timed restore drill succeeds and records actual RPO/RTO; production launch is blocked without evidence.

### OPS-10 — Add container publish and staged deployment workflows

- **Priority / owner / estimate:** P0 / Platform / 2 days.
- **Depends on:** TEST-07/08, OPS-02/03/04.
- **Change:** After green CI, build/push immutable SHA-tagged GHCR images; acquire a deploy lock; promote the already-built digests to staging and production approval; take a pre-deploy backup; run expand/contract-compatible migrations exactly once; health/smoke; rollback to prior images on failure. A database restore is never an automatic rollback after real provider events.
- **Files:** Root `.github/workflows/build-deploy.yml`; root workspace scripts; `deploy/scripts/deploy.*`; release manifest template.
- **Accept:** No workflow builds a different artifact during promotion; rollback is a tag/compose change, not a source checkout.

### OPS-11 — Add secret handling and rotation runbook

- **Priority / owner / estimate:** P0 / Operations + security / 0.5-1 day.
- **Depends on:** provider accounts.
- **Change:** Inventory secrets, owners, storage location, least privilege, staging/prod separation, rotation procedure, emergency revoke, and encryption-key caveats.
- **Files:** `.env.example` files; new `docs/06-engineering/Secret-Management-Runbook.md`; preflight checks.
- **Accept:** No real secret in Git/images/logs; every secret has an owner and rotation/test procedure.

### OPS-12 — Update executable operations documentation

- **Priority / owner / estimate:** P1 / Tech lead + operations / 1 day.
- **Depends on:** OPS-01 through OPS-11.
- **Change:** Replace aspirational commands/topology with exact image, migration, deploy, backup, restore, rollback, log, alert, and incident commands.
- **Files:** `docs/03-architecture/Deployment-Operations.md`; `Deployment-Checklist.md`; `Monitoring-Alerting-Plan.md`; `Backup-Recovery-Plan.md`; `Incident-Response-Playbook.md`; `docs/06-engineering/Production-Runbook.md`; READMEs.
- **Accept:** Another engineer can deploy/rollback/restore from docs without oral knowledge.

**Phase 6 exit:** G4 can be attempted.

## Phase 7 — Staging, Launch, and Canary

### LAUNCH-01 — Provision production-like staging

- **Priority / owner / estimate:** P0 / Operations / 1 day.
- **Depends on:** OPS-04 through OPS-11.
- **Change:** Separate staging DB/storage/provider credentials/domain; seed non-sensitive fixtures; deploy immutable images; run normal traffic, workers, provider failure drills, alerts, and backups for a minimum 48-hour soak before the launch decision.
- **Files:** External infrastructure plus tracked example/config docs only.
- **Accept:** Staging matches topology/config classes, not production data or secrets.

### LAUNCH-02 — Validate providers end to end

- **Priority / owner / estimate:** P0 / Backend + operations + business / 1-2 days.
- **Depends on:** DR-04, staging.
- **Checks:** Kashier sandbox then low-value live payment/refund/reconcile; Resend deliverability; Google OAuth/event/Meet/update/cancel/busy sync; S3 upload/delivery/backup inventory.
- **Files:** Provider checklists and release report; code only if failures are discovered.
- **Accept:** Dashboard/provider/local DB states match for every test transaction.

### LAUNCH-03 — Run destructive recovery rehearsal

- **Priority / owner / estimate:** P0 / Operations / 1 day.
- **Depends on:** OPS-09, staging.
- **Change:** Simulate failed migration/deploy, rollback images, restore DB into isolated target, reconcile provider state, and confirm no real callbacks point at the rehearsal.
- **Files:** `deploy/scripts/deploy.*`; `deploy/scripts/restore-postgres.*`; `docs/06-engineering/Production-Runbook.md`; new dated rehearsal report under `docs/05-project-plan/releases/`.
- **Accept:** Timed evidence proves deploy and data recovery paths.

### LAUNCH-04 — Final content/legal/admin setup

- **Priority / owner / estimate:** P0 / Product + admin / 1-3 days content-dependent.
- **Depends on:** DR-02, DR-12, FEAT-03, FEAT-09, LOC-10/11; final sign-off closes with LOC-12.
- **Checks:** final English/Arabic offerings/prices/availability/locations, immutable email/legal revisions, navigation, blog, contact details, SEO/hreflang, reviewed media alt/decorative provenance, links/CTAs, admin users/roles, notification recipients, and signed bilingual inventory.
- **Files:** CMS/admin data through supported APIs; `rammah-api/src/db/seed.ts` only for reusable non-secret baseline data; release manifest content checklist; no direct production SQL.
- **Accept:** No seed/default/test content, local email, placeholder, disabled launch action, or expired price remains.

### LAUNCH-05 — Run full acceptance matrix

- **Priority / owner / estimate:** P0 / QA + product / 1-2 days.
- **Depends on:** G1-G4.
- **Checks:** `production-preflight` reports zero failures; desktop/mobile browsers; free/paid booking; duplicate/concurrent/stale slots; cancellation/reschedule/manual refund; payment failures; emails; Meet; quote/contact/newsletter; CMS publish; admin recovery; accessibility; SEO; performance.
- **Files:** New `docs/05-project-plan/Launch-Acceptance-Report.md`; Playwright/Lighthouse artifacts.
- **Accept:** Zero open P0/P1; P2 requires named owner/date/risk acceptance.

### LAUNCH-06 — Security and privacy sign-off

- **Priority / owner / estimate:** P0 / Security reviewer / 1 day.
- **Depends on:** SEC tasks, staging.
- **Checks:** auth/CSRF/CORS/CSP/cookies, provider signatures, upload abuse, IDOR, rate limits, secret scan, dependency/container scan, log/PII redaction, backups access.
- **Files:** `docs/03-architecture/Auth-Security.md`; new `docs/03-architecture/Security-Threat-Model.md`; new `docs/03-architecture/Security-Launch-Checklist.md`; new `docs/03-architecture/Privacy-Data-Lifecycle.md`; new signed security review under `docs/05-project-plan/releases/`.
- **Accept:** Threat model and security checklist updated with evidence and explicit residual risks.

### LAUNCH-07 — Production release and migration

- **Priority / owner / estimate:** P0 / Release owner / 0.5-1 day.
- **Depends on:** G0-G5 sign-off.
- **Change:** Freeze content/schema changes, tag the single monorepo release SHA, take backup, deploy API/worker, migrate, deploy web from the same SHA with Arabic still disabled, health/smoke English and in-flight paths, then enable Arabic only after G0-G5 plus the signed 48-hour staging soak pass. Run controlled English/Arabic live bookings and start G6 with Arabic enabled.
- **Files:** Release manifest/changelog; no ad-hoc production edits.
- **Accept:** Exact SHAs/images/migration/config are recorded and rollback images remain available.

### LAUNCH-08 — 48-hour canary monitoring

- **Priority / owner / estimate:** P0 / On-call owner / 2 calendar days.
- **Depends on:** LAUNCH-07.
- **Watch:** availability/latency, errors, DB connections, queue age/dead letters, payment mismatch/stuck states, email/Calendar failures, backup, client Web Vitals.
- **Actions:** Roll back on security/data corruption; disable paid booking if provider trust is uncertain; fail closed when calendar freshness is unsafe.
- **Files:** Monitoring dashboards/alerts plus new dated canary report and incident log under `docs/05-project-plan/releases/`.
- **Accept:** G6 passes with incident notes and no unresolved P0/P1.

### LAUNCH-09 — Admin/operator handover

- **Priority / owner / estimate:** P1 / Product + engineering / 0.5-1 day.
- **Depends on:** stable production.
- **Change:** Admin guide for booking/payment reconciliation, failed jobs, emails, Calendar reconnect, content publish, refunds/cancellations, and escalation.
- **Files:** New `docs/06-engineering/Admin-Operations-Guide.md`; support contact/escalation matrix.
- **Accept:** Operator completes scripted tasks without developer assistance.

### LAUNCH-10 — Post-launch review and backlog split

- **Priority / owner / estimate:** P1 / Team / 0.5 day after one week.
- **Change:** Review incidents, support requests, conversion/drop-off, queue/provider reliability, performance, backup evidence; convert accepted P2/deferred work into owned backlog.
- **Files:** New dated production review under `docs/05-project-plan/releases/` and progress log.
- **Accept:** No launch debt remains ownerless or implicit.

## 8. Test Coverage and User-Flow Matrix

```text
CODE / DATA PATHS                                   USER FLOWS
[GAP -> TEST-03] Kashier callback                   [GAP -> E2E] Paid booking
  |- invalid signature                                |- create hold
  |- forged replay                                    |- preview exact amount
  |- amount/currency mismatch                         |- start/reuse payment
  |- verified first event                             |- callback before/after return
  |- verified duplicate                               |- confirmed status + email + Meet
  `- concurrent callbacks                             `- retry closed attempt only

[GAP -> TEST-03] Slot capacity                      [GAP -> E2E] Free booking
  |- recurring advisory lock                          |- two-tab/double-submit
  |- fixed session row lock                           |- expired/stale hold
  |- capacity N                                       |- location/form validation
  |- expired/released holds                           `- confirmation/cancel/reschedule
  `- stale external calendar fail-closed

[GAP -> TEST-03] Outbox/worker                      [GAP -> E2E] Admin operations
  |- transactional enqueue                            |- login/CSRF/session expiry
  |- two-worker claim                                  |- CMS publish/media upload
  |- retry/backoff/dead letter                         |- booking/payment/job recovery
  |- timeout/crash/lease recovery                      `- audit trail
  `- idempotent handler

[GAP -> TEST-04/05] Public resilience               [GAP -> E2E] Lead capture
  |- API 404/429/500/timeout                           |- contact inquiry
  |- offline/slow connection                           |- corporate quote
  |- media/animation failure                           `- newsletter subscribe
  `- legal/CMS missing content

[GAP -> TEST-03/05] Pricing contract                [GAP -> E2E] CMS/admin control
  |- trusted country/default/override                  |- rich text + scheduled publish
  |- early-bird boundary and rounding                  |- offering lifecycle/quote-only
  |- optional coupon/tax decision                      |- users/roles/session revoke
  `- preview/hold/payment snapshot parity              `- audit/notifications/search

[GAP -> LOC-01..12] Locale isolation                [GAP -> bilingual E2E] Arabic journey
  |- requested published translation                   |- content/leads/newsletter/legal
  |- identical machine state                           |- free/paid booking + recovery
  |- trusted stored customer locale                    |- RTL/a11y/performance/SEO
  `- no silent fallback or forged locale               `- admin author/publish/unpublish
```

### Mandatory backend cases

| Area | Unit | PostgreSQL integration | E2E/release |
| --- | --- | --- | --- |
| Auth/session/CSRF | validation, cookie policy, role guards | expiry/revoke/rate limit/audit | browser login/logout/session expiry |
| Availability/holds | slot math, buffers, limits, DST | parallel capacity, conversions, busy blocks | two-browser stale/concurrent booking |
| Payments | signature/hash/state mapping | callback transaction/replay/reconcile/outbox | Kashier sandbox and low-value live |
| Email | templates/error classes | delivery dedupe/outbox/retry | real staging delivery |
| Calendar | mapping/error classes | event ledger/outbox/busy sync cursor | OAuth/Meet/update/cancel/manual busy |
| Pricing | resolver priority/rounding/boundaries | snapshot and payment parity, override rules | country/early-bird/paid flow |
| CMS/media | sanitizer/state/slug validation | metadata/object/schedule consistency | rich-text upload/publish/public render |
| Offerings | type/mode/lifecycle rules | historical retention/slug/category constraints | booking vs quote routing |
| Admin control | role guards/filter contracts | users/audit/notifications/pagination | revoke/search/retry operational flows |
| Leads/privacy | normalization/validation/abuse signals | duplicate/rate/audit/status/retention | contact/quote/newsletter/export/delete flows |
| OpenAPI | schema generation | representative response validation | frontend/server contract drift gate |
| Localization/RTL | locale/message/route/bidi/SEO helpers | translation joins, status isolation, customer-locale snapshot and machine-state parity | English/Arabic desktop/mobile content, lead, booking, payment, admin, provider and rollback journeys |

### Coverage policy

- 100% branch coverage: payment callback/finalization, hold capacity/conversion, auth session/CSRF, outbox claim/ack/retry.
- API overall: at least 85% lines and 80% branches, with no excluded domain file merely to meet the number.
- Frontend: at least 80% lines for API clients and form/auth/payment state components; animation-only rendering is verified by targeted component/E2E tests.
- Every production bug receives a regression test before the fix is considered complete.
- Flaky-test retries may collect diagnostics but may not turn red tests green silently.

## 9. Production Failure Modes

| Failure | Required handling | Required test/detection | User/operator experience |
| --- | --- | --- | --- |
| Forged/replayed payment callback | Ignore; persist bounded audit; never transition payment | Adversarial integration tests + security alert threshold | Booking remains unpaid; safe reference only |
| Two users request last slot | Serialize/recheck under DB lock | Parallel PostgreSQL test | One succeeds; others get recoverable `409` |
| Google Calendar unavailable | Booking commits, outbox retries; fail closed for stale busy sync | Provider timeout tests + queue alert | Clear pending/admin warning, no silent double booking |
| Resend unavailable | Queue retry/dead letter | 429/500/timeout tests + oldest queue alert | Booking succeeds; admin sees notification delay |
| Worker stopped | API readiness remains separate; heartbeat alert | Kill/restart rehearsal | No lost jobs; delayed side effects visible |
| Callback arrives before return page | DB is source of truth | E2E ordering variants | Return page polls/statuses safely |
| Return page arrives without callback | Bounded reconcile/poll then retry guidance | E2E/provider timeout | User not told paid until trusted state exists |
| DB unavailable | Readiness false; requests fail safely; no provider ack claiming success | integration fault injection | Clear temporary error; alert fires |
| Migration fails | Stop rollout; keep old images; restore only when required | staging migration rollback rehearsal | No mixed schema/app traffic |
| Backup missing/corrupt | Alert, block risky migration/launch | checksum + restore drill | Operator gets actionable incident |
| S3 upload succeeds but DB write fails | Delete orphan or reconcile later | integration fault test + orphan job | Admin receives retryable error |
| CMS/legal content absent | Preflight/launch gate fails | production preflight test | Never display internal placeholder |
| Huge/invalid upload | Reject before storage; bounded parsing | upload abuse tests | Clear validation error |
| Animation/video fails | Static fallback and usable content | network/resource failure E2E | Page remains navigable |
| Session expires during admin edit | Preserve unsaved state where safe; redirect/re-auth | component/E2E | Clear re-login and retry path |
| Rate limiter behind proxy misconfigured | Preflight and forwarded-IP tests | staging header test | No global lockout or easy bypass |
| Geo header spoof/default mismatch | Trust only the configured proxy/CDN source; snapshot resolution inputs | integration + Nginx staging tests | Price remains deterministic and explainable |
| Early-bird/price changes during checkout | Use held immutable price snapshot until expiry | boundary and preview-to-payment tests | User is never charged a different unexplained amount |
| Public submission spam | Layer rate, duplicate, honeypot, and anomaly signals; optional challenge flag | burst/proxy/honeypot tests + abuse metrics | Legitimate retry works; operators see bounded abuse |
| Unsafe rich text or scheduled content | Sanitize server-side; explicit state machine; idempotent publish job | XSS/state/timezone tests | No script execution or accidental early publication |
| Admin disables last super-admin | Reject transaction and audit attempt | concurrency integration test | Recovery access is preserved |
| Privacy deletion request | Authorize; anonymize eligible PII; preserve documented legal records; propagate to active storage | privacy integration + restore test | Request has traceable result without silent resurrection |
| Required Arabic content/email missing | Fail closed; block publish/preflight or dead-letter email with operator alert | localization integration + Arabic preflight | Clear localized error; never silent English fallback |
| Forged/requested locale conflicts with trusted booking | Ignore untrusted locale after resource match; use stored booking locale | callback/status/email adversarial tests | Correct Arabic/English return and message without changing payment state |
| RTL layout or bidi ambiguity | Logical layout, explicit LTR isolation for machine values, no forced DOM reversal | desktop/mobile overflow, keyboard, axe and visual tests | Arabic remains readable, navigable, and unambiguous |
| Arabic feature disabled or rolled back | Return not-found, remove switch/sitemap entries, preserve all translations and business data | enable-disable-re-enable staging rehearsal | English/bookings/payments stay healthy; no destructive rollback |

No failure in this table may remain silent with neither a test nor operator-visible signal.

## 10. Parallel Execution Strategy

### Dependency table

| Workstream | Modules touched | Depends on |
| --- | --- | --- |
| A. Repository/CI foundation | root docs/Git, package scripts, workflows | REPO-01 |
| B. Payment/auth security | API payments/auth/middleware | TEST-01/02 for final verification |
| C. Booking concurrency | API availability/bookings/sessions | TEST-02 |
| D. Frontend/product completeness | frontend components/API clients/pages; CMS/pricing/admin contracts | TEST-04; backend contracts as needed |
| E. Worker/integrations | API outbox/email/calendar/worker | JOB-01; SEC-02 for payment jobs |
| F. Infrastructure | Docker/deploy/Nginx/backup/monitoring | stable commands and worker entrypoint |
| G. QA/performance | frontend E2E/assets/SEO/a11y, load tests | feature/security branches merged |
| H. Bilingual launch | locale contract, translation schema/APIs, shared UI/routes, admin authoring, RTL, SEO/content approval | TEST-01/02/04/05, FEAT-01/02/07/08/11/13, JOB-01/02/03, then LOC dependencies |

### Recommended lanes

- **Lane A, sequential:** REPO-01 -> REPO-06 -> TEST-07/08 -> release workflows.
- **Lane B, sequential:** TEST-01/02 -> SEC-01/02 -> JOB-01/02 -> payment/email/calendar worker handlers.
- **Lane C, sequential:** TEST-02 -> SEC-03/04 -> availability/external busy integration.
- **Lane D, sequential:** TEST-04 -> FEAT-01/02/03/04/06/08 -> FEAT-10/11/12/13 -> WEB-01/04/05/06.
- **Lane H, sequential:** LOC-01/02 -> LOC-03 -> LOC-04/05 -> LOC-06/07 -> LOC-08/09/10 -> LOC-11/12; begin only after the prerequisite test/CMS/lead/outbox work named in each task is stable.
- **Lane E, sequential:** OPS-01 -> Docker images -> Compose/Nginx -> backup/restore/monitoring.
- **Final integration lane:** TEST-05 -> staging -> provider/recovery/security acceptance -> launch.

### Merge/conflict warnings

- Lanes B and C both touch DB schema/migrations and booking/payment transactions. Allocate migration numbers centrally and merge schema changes in order.
- Lanes B and E both touch backend package scripts/env. Rebase before changing `package.json` or `.env.example`.
- Lane D and frontend CI both touch `package.json`; land test foundation first.
- Lane H touches the shared schema, public API clients, app routes, CMS admin, SEO, env, and CI; allocate migration numbers centrally and sequence its merges with Lanes B/D/G rather than editing the same files concurrently.
- Outbox refactors and live provider tests must not run in parallel against the same mutable test database/account.

With two engineers, run B+C under one backend owner while D runs under frontend; platform work E starts after entrypoints/env settle. With three engineers, split B and C only after TEST-02 and migration ownership are fixed.

## 11. Suggested Calendar

### One senior engineer

| Week | Primary result |
| --- | --- |
| 1 | Repository baseline, test harness, payment replay, booking concurrency, dependency/lint blockers |
| 2 | Critical backend tests, CSRF/auth, outbox/worker foundation |
| 3 | Email/Calendar jobs, external busy sync, payment UX, quote/contact/newsletter completion |
| 4 | Pricing/offering contract, media upload, rich-text/scheduled CMS, admin control-plane gaps |
| 5 | Locale foundation, translation schema/backfill, localized CMS/catalog/customer contracts |
| 6 | Shared bilingual UI, complete `/ar` journeys, payment/email locale safety, admin authoring |
| 7 | RTL/a11y/performance, bilingual SEO/preflight/content approval, OpenAPI contract, Docker/Compose/Nginx |
| 8 | CI deploy, observability/tracing, privacy lifecycle, backup/restore, production-like staging |
| 9 | Bilingual provider/recovery/security/load acceptance and enable-disable rehearsal |
| 10 | 48-hour staging soak, production launch, canary, handover, and fix buffer |
| 11-13 contingency | Provider/legal/content lead time, failed rehearsal remediation, performance/accessibility fixes, and a repeated staging soak when a release-blocking change invalidates evidence |

Expected total with the full bilingual FRS retained: 48-65 focused engineer-days, which is 10-13 focused weeks for one senior engineer, plus external provider, Arabic content, SEO, and legal lead time. The ten-week row is the no-rework path; weeks 11-13 are explicit contingency, not hidden compression. Translation/API/UI work overlaps existing CMS, resilience, SEO, accessibility, and test tasks, so estimates must not be summed mechanically; security, payment/booking correctness, customer-locale trust, required Arabic content/email, CI, backup/restore, and staging gates are never deferrable.

### Two engineers

- Engineer A: API security, tests, concurrency, outbox/worker/integrations.
- Engineer B: frontend tests/completeness/performance plus platform/CI after frontend entrypoint stabilizes.
- Split localization deliberately: Engineer A owns translation schema/APIs/customer-locale/payment-email trust; Engineer B owns locale UI/routes/RTL/admin/SEO, with one migration owner.
- Shared: staging, provider validation, recovery drill, release.

Expected total: approximately 6-7 calendar weeks if credentials, approved English/Arabic content, legal text, domains, and VPS access are ready; plan 7-8 weeks if engineers also own translation, provider, SEO, legal/content coordination, or a rehearsal must be repeated.

## 12. Definition of Done

### Code and repository

- The canonical monorepo clones, installs all workspaces, tests, builds, and containerizes from scratch.
- Both worktrees remain clean after normal commands.
- Every production release points to one source SHA and immutable compatible web/API-worker image digests.
- No unreviewed generated log/output/local env file is tracked.

### Security and correctness

- Forged/replayed callback regression suite passes.
- Concurrent capacity tests pass for recurring and fixed slots.
- CSRF, session, CORS, proxy, rate-limit, anti-spam, privacy lifecycle, upload, and secret checks pass.
- Production dependency/container scans have no unaccepted high/critical finding.

### Product

- Public/admin sitemap has no fake, dead, placeholder, or disabled launch-critical path.
- Free/paid booking, cancellation, reschedule, payment recovery, email, Calendar/Meet, and external busy prevention work.
- Country/default/override/early-bird/coupon/tax behavior matches the approved scope and one immutable price snapshot exactly.
- Final CMS, rich text, scheduled state, offering catalog, legal, SEO, and contact content is published safely.
- Required admin users/roles, inquiries, newsletter, notifications, audit, search/filter/sort/pagination modules are operational.
- Existing English URLs and behavior remain stable; every public customer journey has a tested Arabic `/ar` equivalent using the same business records/state.
- Admin manages both locales from English chrome; incomplete Arabic cannot publish and no required Arabic page/email silently falls back to English.

### Operations

- Staging and production use immutable images and documented configuration.
- Preflight, migrations, readiness, smoke, business smoke, backup, restore, and rollback are exercised.
- Monitoring/alerts and correlated traces identify API, DB, worker, queue, payment, email, Calendar, media, privacy-job, and backup failures.
- On-call and admin guides identify owners and escalation.

### Launch

- G0-G6 are signed off.
- Zero open P0/P1 issue.
- A low-value live transaction is reconciled across Kashier, DB, booking, email, and Calendar.
- English/Arabic provider parity, RTL/a11y/performance/SEO, Arabic content inventory, preflight, and feature-flag rollback rehearsal are signed.
- 48-hour canary completes without unresolved correctness/security incident.

## 13. NOT in Scope for This Launch

- Shop, cart, digital products, and private downloads; explicitly excluded from Rammah MVP.
- Public customer accounts; public users remain guest-only.
- Arabic translation of the admin interface itself and any third public locale; the English admin must still author both production public locales.
- Kubernetes, multi-region, active-active, or autoscaling.
- Multiple API instances before a shared rate-limit/cache strategy exists.
- Replacing Kashier, Resend, Google Calendar/Meet, PostgreSQL, Drizzle, Express, or Next.js.
- A microservices rewrite; API and worker share one backend codebase/image.
- Native mobile apps, AI assistants, or a broad analytics/data-warehouse project.
- Splitting the consolidated monorepo into microservice repositories or independently versioned product releases.

## 14. Implementation Task Checklist

- [ ] **T01 (P0)** REPO-01 through REPO-03: preserve current work/history, consolidate the monorepo, publish it, and protect ownership boundaries.
- [ ] **T02 (P1)** REPO-04 through REPO-06: clean artifacts, normalize workspace commands, and define one-SHA releases.
- [ ] **T03 (P0)** TEST-01/02: API unit and real-PostgreSQL integration harness.
- [ ] **T04 (P0)** SEC-01/02: payment replay fix and atomic trusted finalization.
- [ ] **T05 (P0)** SEC-03/04: atomic capacity and hold conversion/ownership.
- [ ] **T06 (P0)** SEC-05/06/08/09: CSRF, proxy/rate limits, sessions, headers.
- [ ] **T07 (P1)** SEC-10: layered anti-spam and public-submission abuse controls.
- [ ] **T08 (P0/P1)** SEC-11: approved data lifecycle, privacy actions, retention, and redaction.
- [ ] **T09 (P0)** SEC-07 + WEB-01: Next patch, audit, lint, typecheck, build.
- [ ] **T10 (P0)** TEST-03: critical backend regression and domain suites.
- [ ] **T11 (P1)** TEST-04/05/06: frontend unit, E2E, and release smoke suites.
- [ ] **T12 (P0)** TEST-07/08/09: required CI and migration gates.
- [ ] **T13 (P1)** TEST-10: executable OpenAPI and frontend/server drift gate.
- [ ] **T14 (P0)** JOB-01/02: transactional outbox and worker runtime.
- [ ] **T15 (P0)** JOB-03/04: asynchronous email and Calendar/Meet handlers.
- [ ] **T16 (P0)** JOB-05: external busy sync and stale fail-closed rule.
- [ ] **T17 (P1)** JOB-06/07/08: expiry, reconciliation, and operator visibility.
- [ ] **T18 (P1)** FEAT-01/02/08: corporate quote, newsletter, contact inquiry paths.
- [ ] **T19 (P0/P1)** FEAT-03/04/09: legal/CMS content consistency and dead-path cleanup.
- [ ] **T20 (P1)** FEAT-05/06: coupon/tax scope closure and payment retry UX.
- [ ] **T21 (P1)** FEAT-07: CMS media storage/upload if DR-05 confirms launch scope.
- [ ] **T22 (P0/P1)** FEAT-10: trusted country/override/early-bird resolver and price snapshot parity.
- [ ] **T23 (P1)** FEAT-11: safe rich text, editorial states, slug rules, and scheduled publishing.
- [ ] **T24 (P1)** FEAT-12: admin users/roles, audit, notifications, inquiries/newsletter, and bounded list controls.
- [ ] **T25 (P1)** FEAT-13: offering type/mode/category/lifecycle completeness.
- [ ] **T26 (P1)** LOC-01/02: locale contract, typed dictionaries/formatters, document direction, stable route map, and safe language switcher.
- [ ] **T27 (P1)** LOC-03/04/05: additive translation schema, verified English backfill, localized CMS/catalog/form/lead APIs, and machine-state parity.
- [ ] **T28 (P1)** LOC-06/07: trusted customer-locale snapshots, server-owned answer labels, verified payment return locale, and required localized queued emails.
- [ ] **T29 (P1)** LOC-08/09/10: shared locale UI, complete `/ar` routes, RTL/a11y/performance quality, and English-admin bilingual authoring gates.
- [ ] **T30 (P1)** LOC-11/12: Arabic feature gate, SEO/sitemap/preflight, bilingual E2E/provider parity, content approval, staging soak, rollback, and handover.
- [ ] **T31 (P1)** WEB-02/03: asset reduction and progressive/reduced motion behavior.
- [ ] **T32 (P1)** WEB-04/05/06/07: resilience, bilingual SEO, accessibility, performance budgets.
- [ ] **T33 (P2)** WEB-08: API/query/pagination/load pass.
- [ ] **T34 (P0)** OPS-01 through OPS-06: env, images, Compose, Nginx, shutdown/readiness.
- [ ] **T35 (P0/P1)** OPS-07 through OPS-09: logs/metrics/traces, DB+media backup, and restore drill.
- [ ] **T36 (P0)** OPS-10/11: immutable deploy and secret handling.
- [ ] **T37 (P1)** OPS-12: executable docs/runbooks including Arabic enable/disable and missing-translation recovery.
- [ ] **T38 (P0/P1)** LAUNCH-01 through LAUNCH-10: bilingual staging/provider/recovery/acceptance/security/privacy, release, canary, handover, and review.

## 15. Requirements Traceability

This matrix is the completeness check against the approved FRS/NFR. A requirement group is not considered covered merely because a similar screen exists; the referenced task and its acceptance evidence must close.

| Requirement group | Requirement IDs | Implementation / verification tasks |
| --- | --- | --- |
| Architecture, API authority, guest users, bilingual launch and shared state | FR-001-009 | REPO-02/03, TEST-10, LOC-01 through LOC-12 |
| Public pages, navigation, outcomes in English and Arabic | FR-010-019 | FEAT-01/02/03/08/09, LOC-02/04/08/09/11/12, WEB-04/05/06, TEST-04/05 |
| Full bilingual CMS, media, SEO, editorial states, rich text, slugs | FR-030-036 | FEAT-03/07/09/11, LOC-03/04/10/11/12, WEB-05, TEST-03/04/05 |
| Offering types, modes, metadata, quote/booking eligibility | FR-050-055 | FEAT-01/09/10/13, LOC-03/05/08/10/11/12, TEST-03/05 |
| Shared booking, holds, localized answers, capacity, status, reschedule/cancel | FR-070-086 | SEC-03/04, JOB-06, FEAT-06, LOC-05 through LOC-09/12, TEST-03/05 |
| Availability, overrides, buffers, Google Calendar/Meet, locations | FR-100-105 | SEC-03, JOB-04/05, LOC-05/08/09/12, TEST-03/05, LAUNCH-02 |
| Country pricing, detection/override, final price, early bird, coupon/tax | FR-120-126 | FEAT-05/10, SEC-06, TEST-03/05 |
| Provider adapter, sessions, callback trust, events, reconcile/failure | FR-140-145 | SEC-01/02, JOB-07, FEAT-06, LOC-06/07/11/12, TEST-03/05, LAUNCH-02 |
| Quote requests and admin follow-up | FR-160-162 | FEAT-01, FEAT-12, JOB-03, LOC-05/06/08/10/12, TEST-03/05 |
| Contact and newsletter capture/idempotency/consent | FR-180-182 | FEAT-02/08/12, SEC-10/11, LOC-05/06/08/12, TEST-03/05 |
| Customer/admin email, localized templates, delivery log | FR-200-204 | JOB-03/08, FEAT-12, LOC-03/06/07/10/12, TEST-03/05 |
| Admin auth/authorization/modules/audit/search/filter | FR-220-224 | SEC-05/08, FEAT-04/12/13, JOB-08, LOC-10/12, WEB-08, TEST-03/05 |
| Friendly/structured errors and submission preservation | FR-240-242 | TEST-10, LOC-01/02/08/09/12, WEB-04, TEST-04/05 |
| Performance and media optimization | NFR-001-005 | WEB-02/03/07/08, OPS-03/05, LAUNCH-05 |
| Usability and clear operational state | NFR-010-014 | FEAT-06/12, WEB-03/04/06, TEST-05 |
| Booking/payment/calendar/email reliability and degradation | NFR-020-024 | SEC-01-04, JOB-01-08, TEST-03/05, OPS-06/07 |
| Auth, secrets, validation, anti-spam, webhook, minimization | NFR-030-035 | SEC-01/05-11, OPS-11, TEST-03/05 |
| Availability, maintenance, growth, separation, migrations/config/API consistency | NFR-040-063 | REPO-03/05, TEST-09/10, JOB-02, WEB-08, OPS-01-06 |
| Accessibility, responsive layout, bilingual route stability, RTL, timezone/locale display and state parity | NFR-070-083 | LOC-01/02/05 through LOC-12, WEB-03/05/06/07, FEAT-10/11, TEST-04/05 |
| Logs, metrics, tracing | NFR-090-092 | JOB-08, LOC-07/11/12, OPS-07, LAUNCH-08 |
| Database/media backup and tested recovery | NFR-100-102 | OPS-08/09, LAUNCH-03 |
| Privacy notice, customer-data handling, sensitive leakage | NFR-110-112 | FEAT-03, SEC-11, LOC-03/06/07/10/12, OPS-07/11, LAUNCH-06 |

The acceptance report in LAUNCH-05 must copy this table, attach evidence links for every row, and explicitly mark any approved scope removal. An approved removal updates the FRS and decision log; it must not be represented as implemented.

## 16. Plan Maintenance Rules

- Update task status and evidence in `Progress-Log.md` after each merged logical unit.
- A task closes only with its verification evidence, not when code is written.
- Record scope/provider/legal decisions in Section 3 and the relevant release manifest.
- Any new P0/P1 discovered during implementation is inserted before the current phase exit gate.
- Do not renumber applied Drizzle migrations or rewrite historical release manifests.
- Keep this document aligned with the actual commands, topology, and acceptance behavior.
