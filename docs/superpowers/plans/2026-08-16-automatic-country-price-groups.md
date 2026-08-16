# Automatic Country Pricing and Price Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-managed one/many-country price groups and strict automatic server-side country pricing with atomic paid checkout.

**Architecture:** Existing `offering_prices` rows become price-group headers and a new membership table maps countries to groups. Preview and paid confirmation share one exact-price calculator, while paid confirmation performs price resolution, comparison, hold conversion, booking snapshot, and payment creation in one PostgreSQL transaction. Country headers are accepted only from explicitly trusted proxy CIDRs.

**Tech Stack:** Node.js 24.14.0, npm 11.9.0, TypeScript, Express 4, Zod, Drizzle/PostgreSQL, Vitest 4, Next.js 16.3.0, React 19.2.4, Testing Library, Playwright.

## Global Constraints

- Preserve all existing uncommitted F0 contract-guard changes; never reset or overwrite them.
- No customer-controlled pricing country, Egypt default, first-price fallback, or currency conversion.
- Keep existing `/admin/offerings/:id/prices` routes; no `/price-groups` aliases.
- Preserve global booking lead time, capacity, scheduled programs, payment callbacks/reconciliation, and R2/media behavior.
- Use TDD for every new behavior: RED, GREEN, then refactor.
- Use one implementation worktree and no subagents, per user preference.

---

### Task 1: Schema, Pricing Preflight, and Upgrade Migration

**Files:**
- Modify: `rammah-api/src/db/schema/index.ts`
- Create: `rammah-api/src/modules/pricing/pricing-groups-preflight.ts`
- Create: `rammah-api/src/modules/pricing/pricing-groups-preflight.unit.test.ts`
- Create: `rammah-api/src/scripts/pricing-groups-preflight.ts`
- Modify: `rammah-api/package.json`
- Create: generated `rammah-api/drizzle/0013_*.sql`, snapshot, journal entry
- Create: `rammah-api/src/test/pricing-groups-upgrade.integration.test.ts`
- Modify: `rammah-api/drizzle/migration-lock.json`

**Interfaces:**
- Produces: `offeringPriceCountries`, `bookings.offeringPriceId`, composite parent/booking foreign keys, partial active-country unique index.
- Produces: `inspectPricingGroupsMigration(db, supportedCurrencies)` returning counts plus offending IDs and `assertPricingGroupsMigrationReady(report)`.

- [x] Write unit tests for duplicate active country, invalid ISO, amount/early-pair, scheduled classification, and unsupported currency reports.
- [x] Run `npx vitest run --config vitest.config.ts src/modules/pricing/pricing-groups-preflight.unit.test.ts`; observed missing-module/API failure.
- [x] Implement the pure report/classification module and read-only CLI command `db:pricing-groups:preflight`.
- [x] Run the unit test; PASS.
- [x] Write upgrade integration tests for clean backfill, scheduled audit, dirty-data abort with IDs, preserved IDs/money/timestamps, and composite FK enforcement.
- [x] Run `npx vitest run --config vitest.integration.config.ts src/test/pricing-groups-upgrade.integration.test.ts`; observed missing migration failure.
- [x] Add Drizzle schema definitions, generate migration 0013, add SQL assertions/backfill/audit/index changes, and lock the new migration metadata.
- [x] Re-run the upgrade integration test and schema/typecheck; PASS.
- [x] Commit only Task 1 files with `feat(pricing): add country price group schema`.

### Task 2: Canonical Countries and Trusted Request Detection

**Files:**
- Create: `rammah-api/src/shared/geo/countries.ts`
- Modify: `rammah-api/src/shared/geo/request-country.ts`
- Modify: `rammah-api/src/config/env.ts`
- Modify: `rammah-api/src/app.ts`
- Modify: `rammah-api/src/modules/country/public-country.routes.ts`
- Modify: `rammah-api/src/modules/pricing/request-country.unit.test.ts`
- Modify: `rammah-api/src/app.unit.test.ts`
- Modify: `rammah-api/.env.example`
- Modify: `rammah-api/package.json` and lockfile

**Interfaces:**
- Produces: `countryCatalog`, `isIsoCountryCode`, `compileTrustedProxyCidrs`, and provider-aware `detectCountryFromRequest`.
- Environment: `COUNTRY_HEADER_PROVIDER=cloudflare|vercel|none`, `TRUSTED_PROXY_CIDRS` comma list.

- [x] Rewrite request-country/app tests for provider matrix, trusted/untrusted socket peer, invalid CIDR/provider startup, `XX`/`T1`, GeoIP, and no fallback.
- [x] Run focused tests; observed failures against the current four-header/default-EG behavior.
- [x] Add direct `proxy-addr` dependency/types, canonical catalog, validated env, shared predicate, nullable route response, and `.env.example` docs.
- [x] Run focused tests, all API unit tests, and `npm run typecheck`; PASS.
- [x] Commit Task 2 files with `feat(pricing): trust automatic country detection`.

### Task 3: Transactional Admin Price-Group API

**Files:**
- Modify: `rammah-api/src/modules/offerings/admin-offerings.repository.ts`
- Modify: `rammah-api/src/modules/offerings/admin-offerings.service.ts`
- Modify: `rammah-api/src/modules/offerings/admin-offerings.routes.ts`
- Modify: `rammah-api/src/modules/offerings/offerings.mapper.ts`
- Modify: `rammah-api/src/shared/errors/app-error.ts`
- Create: `rammah-api/src/modules/offerings/price-groups.integration.test.ts`
- Modify: `rammah-api/src/modules/offerings/offering-price-validation.unit.test.ts`
- Modify: `rammah-api/src/modules/openapi/openapi.routes.ts`

**Interfaces:**
- Consumes: Task 1 membership schema and Task 2 country/currency validation.
- Produces: existing `/prices` CRUD using `{name,countryCodes[],currency,amounts,status}` and metadata `{supportedCurrencies,countries}`.

- [x] Add failing validation/integration tests for one/many CRUD, legacy input, overlap, atomic replacement, archive/reuse, archived terminal state, write pause, and audit atomicity.
- [x] Run focused tests; observed contract/schema failures against the single-country implementation.
- [x] Implement executor-aware repository transactions with `group -> memberships` locking and in-transaction audit inserts.
- [x] Implement service/route DTOs, compatibility input, stable conflict/maintenance errors, and OpenAPI contract.
- [x] Run focused tests, API unit/integration suites, typecheck, OpenAPI check, and build; PASS.
- [x] Commit Task 3 files with `feat(admin): manage country price groups`.

### Task 4: Shared Strict Public Price Resolution

**Files:**
- Modify: `rammah-api/src/modules/pricing/public-price-preview.repository.ts`
- Modify: `rammah-api/src/modules/pricing/public-price-preview.service.ts`
- Modify: `rammah-api/src/modules/pricing/public-price-preview.routes.ts`
- Create: `rammah-api/src/modules/pricing/pricing-resolution.ts`
- Create: `rammah-api/src/modules/pricing/pricing-resolution.unit.test.ts`
- Modify: `rammah-api/src/modules/pricing/public-price-preview.service.unit.test.ts`
- Modify: `rammah-api/src/modules/offerings/offerings.repository.ts`
- Modify: `rammah-api/src/modules/offerings/offerings.mapper.ts`
- Create/modify: public pricing/catalog integration tests

**Interfaces:**
- Produces: `calculateEffectivePrice(row, now)`, `toExpectedPrice(snapshot)`, `compareExpectedPrice(expected,current)`, and exact executor-aware group lookup with optional row locking.
- Preview response exposes resolved country, group details, full price, and seven-field `expectedPrice` only.

- [ ] Add failing unit tests for standard/early boundary, every expectation field, null/no-match, and exact-country-only behavior.
- [ ] Add failing integration test proving public offerings no longer expose the price matrix.
- [ ] Implement pure pricing functions and exact membership query reusable with `db` or `tx`; refactor preview to use them.
- [ ] Remove public catalog price arrays and obsolete fallback/request-source fields.
- [ ] Run pricing/catalog tests, API unit/integration suites, typecheck, OpenAPI check, and build; expect PASS.
- [ ] Commit Task 4 files with `feat(pricing): resolve exact public country prices`.

### Task 5: Atomic Paid Confirmation and Snapshot Replay

**Files:**
- Modify: `rammah-api/src/modules/payments/public-payments.repository.ts`
- Modify: `rammah-api/src/modules/payments/public-payments.service.ts`
- Modify: `rammah-api/src/modules/payments/public-payments.routes.ts`
- Modify: `rammah-api/src/modules/bookings/public-bookings.routes.ts`
- Modify: relevant payment/booking types and mappers
- Create: `rammah-api/src/modules/payments/paid-pricing-concurrency.integration.test.ts`
- Modify: existing hold ownership/payment finalization/callback tests as contract fixtures require

**Interfaces:**
- Consumes: Task 4 `expectedPrice` and executor-aware price lookup.
- Produces: active-hold transaction result variants `replay`, `price_changed`, `country_unavailable`, `converted`, and existing availability rejections.

- [ ] Add failing integration tests for concurrent admin edit, full expectation mismatch, same-hold preservation, country removal/release, converted replay before repricing, and cross-offering group rejection.
- [ ] Run focused suite; expect failure because price resolution currently occurs before `db.transaction`.
- [ ] Move active-hold price lock/calculation/comparison into `createPaidBookingFromHold`; preserve the converted branch as the first mutable-state exit.
- [ ] Store `offeringPriceId` and full server snapshot; release unavailable owned holds transactionally; create provider session only after commit.
- [ ] Run focused and all booking/payment integration/regression suites, API typecheck, and build; expect PASS.
- [ ] Commit Task 5 files with `fix(payments): make paid pricing atomic`.

### Task 6: Admin Price-Group UI

**Files:**
- Modify: `rammah-next/lib/api/admin.ts`
- Modify: `rammah-next/components/admin/AdminOfferingPricing.tsx`
- Create: `rammah-next/vitest.config.ts`
- Create: `rammah-next/components/admin/AdminOfferingPricing.test.tsx`
- Modify: `rammah-next/package.json` and lockfile

**Interfaces:**
- Consumes: Task 3 price-group data and response metadata.
- Produces: metadata-driven searchable one/many country editor with archived read-only state.

- [ ] Add jsdom/Testing Library test config and failing component tests for metadata options, one/many selection, conflict display, supported currencies, and archived read-only state.
- [ ] Run focused component tests; expect failures against current single-country datalist UI.
- [ ] Update admin API types/client and implement accessible searchable multi-select without local country/currency arrays.
- [ ] Run component/unit tests, typecheck, lint, and production build; expect PASS.
- [ ] Commit Task 6 files with `feat(admin): edit multi-country price groups`.

### Task 7: Strict Booking UX and Same-Hold Reconfirmation

**Files:**
- Modify: `rammah-next/lib/api/bookings.ts`
- Modify: `rammah-next/lib/api/offerings.ts`
- Modify: `rammah-next/components/BookingFlow.tsx`
- Create: `rammah-next/components/BookingFlow.test.tsx`
- Modify: `rammah-next/regressions/booking-source-precedence.regression.test.ts` if contract fixtures change

**Interfaces:**
- Consumes: Tasks 4-5 nullable country/preview/paid contracts.
- Produces: no country input/default, strict 422 blocking, seven-field expectation, and explicit 409 reconfirmation reusing the same hold ID/token.

- [ ] Add failing component/regression tests for no default/input, preview-before-hold, unavailable blocking, same-hold price reconfirmation, expired hold recovery, and foreign location selection.
- [ ] Run focused tests; expect failures against current fallback/request contract.
- [ ] Implement API types and BookingFlow state transitions; do not create a second hold after `PRICE_CHANGED`.
- [ ] Run frontend tests, typecheck, lint, and build; expect PASS.
- [ ] Commit Task 7 files with `feat(booking): enforce automatic country pricing`.

### Task 8: Browser E2E and Release Verification

**Files:**
- Create: `rammah-next/playwright.config.ts`
- Create: `rammah-next/e2e/pricing-country.spec.ts`
- Modify: `rammah-next/package.json` and lockfile
- Modify: production runbook/env documentation where required

**Interfaces:**
- Produces: `npm run test:e2e` using the migrated test database and mock payment adapter.

- [ ] Add Playwright setup and four failing/blocked E2E journeys: supported checkout, unsupported country, mid-flow admin edit/reconfirm, and foreign-location booking.
- [ ] Add deterministic API/database fixtures and implement only the harness needed by those journeys.
- [ ] Run E2E until all four pass.
- [ ] Run API unit, integration, booking regression, typecheck, OpenAPI, and build commands.
- [ ] Run Next unit, component, booking regression, typecheck, lint, build, and E2E commands.
- [ ] Run migration-history preflight, pricing-groups preflight against a migrated test copy, `git diff --check`, and inspect `git status` for intentional files only.
- [ ] Update spec/task checkboxes and commit with `test(pricing): cover country pricing journeys`.

## Self-Review

- Spec coverage: Tasks 1-8 cover schema/migration, admin groups, country trust, preview, atomic paid confirmation, admin/customer UI, public contract cleanup, and all four test layers.
- Placeholder scan: no deferred implementation placeholders; future taxes/coupons/tiers remain explicit non-goals in the design spec.
- Type consistency: `countryCodes`, seven-field `expectedPrice`, `offeringPriceId`, `TRUSTED_PROXY_CIDRS`, and existing `/prices` paths are used consistently across tasks.
