# Automatic Country Pricing and Price Groups — Design Specification

**Date:** 2026-08-16
**Status:** Engineering-reviewed; ready for implementation
**Scope:** Admin offering prices, public price preview, paid booking checkout, server-side country detection, and price audit snapshots

## 1. Outcome

An administrator can define one price for one country or share one price across several countries. The customer never selects or submits a pricing country. The API detects the customer's country from trusted request context and uses only the published price group that explicitly contains that country.

If the country cannot be detected, or the offering has no published price for that country, the normal customer flow stops before creating a paid hold and displays:

> Pricing is not available in your country.

There is no Egypt default, first-price fallback, customer override, or automatic currency conversion.

## 2. Decisions

1. A price group belongs to exactly one offering, not to a slot, session, or occurrence.
2. A price group contains:
   - an administrator-facing name;
   - one currency;
   - one standard amount;
   - an optional early-booking amount and end date/time;
   - one or more ISO 3166-1 alpha-2 countries;
   - `draft`, `published`, or `archived` status.
3. A one-country price is a normal group containing one country.
4. One country can belong to only one non-archived group for the same offering. Draft groups reserve their countries as well as published groups.
5. Published prices for paid offerings must be positive integers in minor units. Draft groups may temporarily contain zero while being edited.
6. The early-booking amount and end date/time are either both present or both absent. A published early-booking amount must be positive and lower than the standard amount.
7. Early-booking date/time is entered in the global booking timezone and stored as UTC.
8. A group currency must be included in the server's payment-provider currency allowlist.
9. Group country replacement is atomic: either every requested country is assigned or nothing changes.
10. Archiving is terminal in this version. An archived group becomes read-only and releases its countries for new groups.
11. Pricing country and attendance location are separate concepts. A customer may book an event in another country while paying the price assigned to their detected country.
12. Existing appointment, session, scheduled-program, capacity, global booking lead-time, payment reconciliation, and media/R2 behavior must not change.
13. Paid hold conversion, current-price resolution, expectation comparison, booking creation, and payment-row creation are one database transaction.
14. A converted owned hold is replayed before any mutable form, location, country, or price validation; a lost response can never create or reprice a second booking.
15. Forwarded IP and provider-country headers are trusted by explicit proxy CIDRs, never by a numeric hop count.
16. The API owns one checked-in ISO country catalog and returns it to the admin UI; validation and display options never use separate country lists.
17. The checkout expectation contains the complete displayed monetary breakdown, not only the total.
18. Price-group mutations and their audit records commit or roll back together.

## 3. Verified Current State

Verified against the repository on 2026-08-16:

| Area | Current behavior | Required change |
|---|---|---|
| Price storage | One `offering_prices` row per country/currency | Treat each row as a group header and add country memberships |
| Admin API | `/admin/offerings/:id/prices` accepts one `countryCode` | Keep the paths and accept `name` plus `countryCodes[]` |
| Public catalog | Returns the full published `prices` array | Remove the array from public offering payloads |
| Price preview | Selects from `offering_prices.country_code` | Join the detected country to active group memberships |
| Country context | Falls back to `EG` when detection fails | Return `null`; never choose Egypt automatically |
| Forwarded headers | Accepts four country headers without provider selection | Accept only the configured provider's header |
| Booking snapshot | Stores country/currency/amounts, not the applied price ID | Add an offering-consistent `offering_price_id` to paid bookings |
| Price-change protection | `PRICE_CHANGED` exists only in the error union | Compare the displayed expectation with the current server price |
| Locations | Client may filter locations by detected/default country | Show all offering locations; detection may only affect ordering |

## 4. Customer Behavior

### 4.1 Country handling

- The booking flow contains no pricing-country input, selector, or hidden customer-controlled country field.
- Public country, price-preview, booking, and payment request bodies do not accept `countryCode` as a pricing input.
- Unknown properties are stripped or rejected by request validation and never influence pricing.
- The API resolves country independently for price preview and paid booking creation.
- `GET /public/country` returns nullable detection data and never a default:

```json
{
  "data": {
    "countryCode": null,
    "detectedCountryCode": null,
    "source": null
  }
}
```

For a successful detection, `countryCode` and `detectedCountryCode` contain the same uppercase ISO code and `source` is `header` or `geoip`.

### 4.2 Exact price resolution

For paid preview:

1. Resolve the request country on the server.
2. Find the one active membership for that offering/country whose group is published.
3. Apply the early-booking amount when its end time has not passed; otherwise apply the standard amount.
4. Return the resolved country, group ID, currency, amounts, and an expectation object for checkout comparison.

For paid confirmation:

1. Re-detect country on the server; the request contains no pricing country.
2. Start one database transaction and lock the owned hold.
3. If the hold is already converted, return its existing booking/payment before reading mutable form, location, country, or price state.
4. For an active hold, validate its target and capacity, then lock the matching published price group and active country membership.
5. Calculate the current effective price once using the transaction clock and compare the complete submitted expectation.
6. Store the group ID, resolved country, and monetary snapshot on the booking, convert the hold, and create the payment row in that transaction.
7. Commit before calling the external payment provider; provider retries use the stored booking/payment snapshot and never reprice.

### 4.3 Unavailable price

If detection fails or no matching published group exists, price preview and paid booking creation return HTTP `422` with:

```json
{
  "error": {
    "code": "COUNTRY_PRICE_UNAVAILABLE",
    "message": "Pricing is not available in your country."
  }
}
```

The frontend must show that exact message, disable paid confirmation, and avoid creating a paid hold or payment intent. No other country's price is displayed or charged. If the country becomes unavailable only after a hold was created, the server releases that hold before returning the error.

### 4.4 Price changes before confirmation

Price preview returns:

```json
{
  "expectedPrice": {
    "priceId": "uuid",
    "countryCode": "SA",
    "currency": "SAR",
    "baseAmountMinor": 15000,
    "discountAmountMinor": 0,
    "taxAmountMinor": 0,
    "totalAmountMinor": 15000
  }
}
```

The paid-booking body returns this object unchanged. It is an expectation, not an authority. The server independently resolves the current price and compares all seven fields.

If group, country, currency, or any displayed monetary component changed, the server returns HTTP `409` with code `PRICE_CHANGED` and the new public price preview in `details.currentPrice`. The frontend replaces the displayed amount and requires a second explicit confirmation. The failed request does not convert the hold or create a booking/payment. It keeps the original hold active, stores its ID/token in client state, and reuses that same hold for the second confirmation; it must not create a competing hold for the same slot. Normal hold expiry still applies.

If the first confirmation committed but its HTTP response was lost, retrying with the same owned hold returns the existing booking/payment even if the form, location, detected country, or group changed afterwards. Replays do not call the provider twice; they reuse the payment idempotency key and stored checkout session behavior.

### 4.5 Free and quote-only offerings

- Free bookings require no price group and are not blocked by missing country pricing.
- Quote-only offerings keep their existing quote flow and expose no public prices.
- A detected country may be stored as metadata on free/quote requests, but is never accepted from the customer.

### 4.6 Attendance locations

Detected pricing country must not restrict attendance locations. The customer sees every published location assigned to the offering, or the fixed location of a scheduled session/program. Matching-country locations may be sorted first, but locations in other countries remain selectable. The server validates only that the submitted location is published and assigned to the booking target; it does not require location country to equal pricing country.

## 5. Administrator Behavior

The existing offering pricing section becomes **Price groups** without creating a second admin subsystem.

Each editor contains:

- Group name, for example `Egypt`, `GCC`, or `Europe EUR`;
- searchable country multi-select;
- currency selected from the provider-backed allowlist;
- Standard price;
- optional Early-booking price;
- optional Early-booking end date/time in the global booking timezone;
- status;
- Save and Archive actions.

The same control supports one or many countries. Archived groups are visible for audit but cannot be edited or restored in this version.

If a country belongs to another non-archived group for the same offering, saving returns HTTP `409` with `PRICE_COUNTRY_CONFLICT` and identifies each conflicting country and group. The server never moves assignments silently.

The list shows name, full country list, currency, standard amount, early-booking summary, and status. The UI displays country names; the API stores uppercase codes.

The searchable country options come from `GET /admin/offerings/:id/prices` metadata. The API uses a single checked-in ISO 3166-1 alpha-2 code catalog for both this metadata and request validation; Node's `Intl.DisplayNames` supplies English labels with the code as a deterministic fallback. The frontend must not keep its own `commonCountries` list.

## 6. Data Model

### 6.1 Extend `offering_prices` as the group header

Add:

- `name varchar(120) not null` after backfill;
- unique `(id, offering_id)` to support a composite membership foreign key.

Retain the existing ID, offering, currency, amounts, early-booking fields, status, and timestamps.

Keep legacy `country_code` as a non-authoritative compatibility column for one release. New writes set it to the alphabetically first active member country. Public/admin group reads use memberships, never this column.

Drop `offering_prices_country_unique` in the initial migration after successful membership backfill. Keeping it would prevent a country from being reused after its old group is archived. The membership partial unique index replaces it.

### 6.2 Add `offering_price_countries`

```sql
create table offering_price_countries (
  price_id uuid not null,
  offering_id uuid not null,
  country_code varchar(2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (price_id, country_code),
  foreign key (price_id, offering_id)
    references offering_prices (id, offering_id)
    on delete cascade,
  check (country_code ~ '^[A-Z]{2}$')
);

create unique index offering_price_countries_active_unique
  on offering_price_countries (offering_id, country_code)
  where active = true;

create index offering_price_countries_price_idx
  on offering_price_countries (price_id);
```

The API also validates codes against a canonical ISO 3166-1 allowlist; the database regex is only a format guard.

Draft and published groups have active memberships. Archiving changes group status and deactivates all memberships in one transaction. Removed memberships are deactivated, not deleted, so audit history remains. Re-adding the same country to the same group reactivates its row.

### 6.3 Extend `bookings`

Add:

- `offering_price_id uuid null`;
- composite foreign key `(offering_price_id, offering_id)` referencing `offering_prices (id, offering_id)`;
- index on `offering_price_id`.

The composite foreign key prevents application bugs from linking a booking to another offering's group. Existing and free bookings remain null. Every newly created paid booking must store a non-null applied group ID plus the existing country, currency, base, discount, tax, and total snapshots. Payment retries continue using the booking snapshot and do not reprice an already-created booking.

## 7. API Contracts

### 7.1 Keep the existing admin paths

- `GET /admin/offerings/:id/prices`
- `POST /admin/offerings/:id/prices`
- `PATCH /admin/offerings/:id/prices/:priceId`
- `DELETE /admin/offerings/:id/prices/:priceId` (archive)

No `/price-groups` aliases are added.

Create/update payload:

```json
{
  "name": "GCC",
  "countryCodes": ["SA", "AE", "KW"],
  "currency": "USD",
  "baseAmountMinor": 15000,
  "earlyBirdAmountMinor": 12000,
  "earlyBirdEndsAt": "2026-09-01T20:59:59.000Z",
  "status": "published"
}
```

For one compatibility release, create/update may accept legacy `countryCode` only when `countryCodes` is absent and transform it to a one-item array. Supplying both is a validation error. Responses always use `name` and `countryCodes[]`.

Create accepts only `draft` or `published`. Patch accepts only `draft` or `published` for a non-archived group. `DELETE` is the only way to archive, and all mutations against an archived group return `409`.

`GET /prices` returns:

```json
{
  "data": [],
  "meta": {
    "supportedCurrencies": ["EGP"],
    "countries": [
      { "code": "EG", "name": "Egypt" },
      { "code": "SA", "name": "Saudi Arabia" }
    ]
  }
}
```

The currency list comes from `PAYMENT_SUPPORTED_CURRENCIES`, is normalized/deduplicated by the API, and is the same list used for server validation. Production must configure it to match the merchant account. The default development value is `EGP`. The country list is the API-owned canonical catalog sorted by display name.

### 7.2 Public offerings

Remove `prices` from public offering list, detail, and booking-config payloads and from `PublicOffering`. The frontend does not currently consume this array. The dedicated price-preview endpoint is the only public price source.

### 7.3 Public price preview

`POST /public/booking/price-preview` accepts `offeringId` and the existing optional coupon field only. It contains no country. The response removes `requestedCountryCode`, `countrySource`, and `fallbackApplied`; it returns `resolvedCountryCode`, price/group details, and `expectedPrice`.

### 7.4 Paid booking

`POST /public/payments/paid-bookings` adds required `expectedPrice` for a new paid confirmation and contains no country. The route supplies trusted detection to the service. A converted-hold replay takes precedence. For an active hold, the repository resolves and locks the current group, compares expectations, converts the hold, and writes the booking/payment snapshots in one transaction.

Preview and confirmation share one pricing implementation rather than duplicating early-booking or monetary rules:

- a repository query accepts either the normal database client or the current transaction and can optionally lock the selected group/membership;
- a pure calculator accepts a price row and explicit `now` and returns the effective monetary snapshot;
- a pure comparator returns either an exact match or the current public expectation.

The preview service uses the unlocked query. Paid confirmation uses the same query with its transaction and locks. This keeps preview and checkout behavior identical while preserving the atomic checkout boundary.

## 8. Country Detection Trust Boundary

Add configuration:

- `COUNTRY_HEADER_PROVIDER=cloudflare|vercel|none`, default `none`;
- `TRUSTED_PROXY_CIDRS`, comma-separated CIDRs/IPs, default empty locally.

Behavior:

- `cloudflare` accepts only `CF-IPCountry`;
- `vercel` accepts only `X-Vercel-IP-Country`;
- `none` accepts no country header and uses GeoIP only;
- a provider header is accepted only when `req.socket.remoteAddress` matches `TRUSTED_PROXY_CIDRS`;
- Express `trust proxy` uses the same compiled CIDR predicate to derive the effective client IP;
- remove support for generic `X-Geo-Country` and `X-Country-Code`;
- invalid/unknown provider values or CIDRs fail application startup;
- selecting `cloudflare` or `vercel` with an empty trusted-proxy list fails application startup;
- if the trusted provider header is missing or invalid, use GeoIP on the effective client IP;
- if neither produces a valid ISO country, return no detection and never default to Egypt.

Production infrastructure must restrict the API origin to Cloudflare/the configured reverse proxy and strip inbound provider headers before adding its trusted value. The project declares `proxy-addr` as a direct dependency for CIDR compilation rather than importing Express's transitive copy.

Cloudflare R2 configuration does not proxy website requests and does not make `CF-IPCountry` trustworthy. Until the application domain is orange-cloud proxied through Cloudflare and direct origin access is restricted, production must keep `COUNTRY_HEADER_PROVIDER=none` and rely on GeoIP/no-detection behavior.

## 9. Migration and Deployment

### 9.1 Read-only pricing preflight

Add `npm run db:pricing-groups:preflight`. It connects to the target database read-only, reports counts and offending record IDs, reads `PAYMENT_SUPPORTED_CURRENCIES`, and exits non-zero if it finds:

- more than one non-archived price for the same offering/country, including different currencies;
- an invalid/non-ISO country code;
- negative amounts;
- a published paid price with standard amount `0`;
- incomplete early-booking pairs;
- early-booking amount greater than or equal to the standard amount;
- a currency absent from `PAYMENT_SUPPORTED_CURRENCIES`.

Existing price rows with `status = scheduled` are reported and deterministically converted to `draft`; this preserves their current non-public behavior. The audit log records each conversion.

The existing `db:migrations:preflight` remains the migration-history integrity check and is not renamed or overloaded with data inspection.

### 9.2 Backfill

1. Add `name` as nullable.
2. Before any write, repeat every database-only invariant in a PostgreSQL `DO` block and raise with offending IDs; the write pause makes the environment-dependent currency preflight stable.
3. Add the parent composite unique key, memberships table, and nullable composite booking FK.
4. For every price row, set `name` to the country display name or code.
5. Insert one membership from legacy `country_code`, active unless the group is archived.
6. Convert legacy `scheduled` price status to `draft` and insert a system audit row in the same migration transaction.
7. Enforce `name not null`.
8. Verify row counts and membership uniqueness.
9. Drop the old country/currency unique index.
10. Create/verify the active membership partial unique index.

All IDs, currency, amounts, early-booking values, and timestamps are preserved.

### 9.3 Deployment sequence

1. Set `ADMIN_PRICE_WRITES_ENABLED=false`; admin reads stay available and write endpoints return `503` with a maintenance message.
2. Run migration-history preflight, pricing-groups data preflight, and the database migration.
3. Deploy API code that reads memberships and supports both new and legacy admin inputs.
4. Run API smoke tests, then enable admin price writes.
5. Deploy the new admin/customer frontend.
6. Verify exact-match pricing, unsupported-country blocking, price changes, archive/reuse, and payment retries.
7. Remove legacy input and `offering_prices.country_code` in a later cleanup release.

Old and new admin writers must never run concurrently. This explicit short write pause replaces the previous unsupported claim that the migration is fully rolling-safe.

### 9.4 Rollback

- Before enabling writes, rollback is application rollback plus schema retention; additive tables remain harmless.
- After multi-country groups are created, do not roll back to the original one-country application because it cannot represent all memberships.
- Roll back only to the compatibility API from deployment step 3, disable admin writes, and keep the migrated schema.
- Full database reversal requires a pre-migration backup and maintenance window. Recreating the old unique index is allowed only after a preflight proves there are no archived/header conflicts.
- Existing bookings/payments are never rewritten during rollback.

## 10. Concurrency and Consistency

- Create/update/archive runs in a transaction.
- Group mutations lock the group before memberships, deactivates removed rows, then upserts/reactivates requested rows. Paid confirmation uses the same group-then-membership lock order.
- The partial unique index is the final overlap guard; unique violations map to `PRICE_COUNTRY_CONFLICT`.
- Public lookup joins active memberships to one published group by offering and exact detected country.
- Paid confirmation locks the owned hold, handles converted replay, then rechecks capacity and locks the current group/membership before conversion. No external provider or email call occurs while database locks are held.
- A changed price preserves the owned active hold for reconfirmation. An unavailable country changes that owned active hold to released in the same transaction before returning the error.
- Submitted country, group, currency, and money are never charged as authoritative values.
- An already-created booking/payment retry uses its immutable monetary snapshot.
- Create/update/archive writes its before/after audit record inside the same transaction as the group and membership mutation.

The paid path uses this order:

```text
POST paid-bookings
  |
  +-- detect country from trusted request context
  |
  +-- BEGIN
       |
       +-- lock owned hold
       |    |
       |    +-- converted --> load existing booking/payment --> COMMIT --> replay
       |    +-- invalid/expired -----------------------------> ROLLBACK --> unavailable
       |
       +-- validate capacity + target using one transaction clock
       +-- lock price group, then active country membership
       |    |
       |    +-- missing --> release owned hold --> COMMIT --> 422
       |    +-- expectation mismatch ---------> ROLLBACK --> 409 + current price
       |
       +-- insert booking snapshot
       +-- convert hold
       +-- insert payment snapshot
       +-- COMMIT
  |
  +-- create/reuse external checkout session by stored payment idempotency key
```

All admin mutations and paid confirmation acquire price locks in `group -> memberships` order. The paid path acquires `hold -> group -> memberships`; admin paths never acquire holds, so they cannot form a reverse lock cycle.

## 11. Errors

| Condition | HTTP | Code | Behavior |
|---|---:|---|---|
| Country unknown or no published group | 422 | `COUNTRY_PRICE_UNAVAILABLE` | Block paid confirmation |
| Country already reserved by another group | 409 | `PRICE_COUNTRY_CONFLICT` | Identify conflicting countries/groups |
| Displayed expectation differs from current price | 409 | `PRICE_CHANGED` | Return current price and require reconfirmation |
| Invalid ISO country, currency, amount, or early pair | 400 | `VALIDATION_ERROR` | Highlight exact admin fields |
| Admin price writes paused for migration | 503 | `SERVICE_UNAVAILABLE` | Show maintenance message |

## 12. Implementation Slices

```text
#1 Schema + preflight
       |
       +--> #2 Group repository/service + admin compatibility
       |          |
       |          +--> #3 Admin Price groups UI
       |
       +--> #4 Trusted detection + strict public preview
                  |
                  +--> #5 Paid expectation check + booking snapshot
                             |
                             +--> #6 Public contract cleanup + browser QA
```

The schema must land before either API branch. Admin and public API work can then proceed independently. Checkout comparison depends on strict public preview. Browser QA comes last because it exercises all preceding contracts.

Implementation remains sequential in this worktree because schema, generated migration metadata, shared API contracts, and payment code overlap. After slice #2 stabilizes the API response, the two frontend slices can be developed independently, but they must merge before the checkout E2E suite.

## 13. Files Expected to Change

| File/area | Change |
|---|---|
| `rammah-api/src/db/schema/index.ts` | Group memberships and booking price FK |
| `rammah-api/drizzle/*` | In-transaction assertions, backfill, constraints, and indexes |
| `rammah-api/src/scripts/pricing-groups-preflight.ts` plus query module | Read-only data/currency preflight with offending IDs |
| `rammah-api/src/config/env.ts` and `.env.example` | Provider, trusted CIDRs, currency, and write-pause config |
| `rammah-api/src/app.ts` | CIDR-based Express trust-proxy predicate |
| `rammah-api/src/shared/geo/countries.ts` | Canonical ISO codes and display metadata |
| `rammah-api/src/shared/geo/request-country.ts` | Provider-specific trusted detection, no default |
| `rammah-api/src/modules/country/public-country.routes.ts` | Nullable country context |
| `rammah-api/src/modules/offerings/admin-offerings.*` | Group DTOs, transactions, conflicts, audit |
| `rammah-api/src/modules/offerings/offerings.*` | Remove public price matrix |
| `rammah-api/src/modules/pricing/public-price-preview.*` | Membership lookup and expectation response |
| `rammah-api/src/modules/payments/public-payments.*` | Reprice/compare and store group snapshot |
| `rammah-api/src/shared/errors/app-error.ts` | Stable country/group/maintenance codes |
| `rammah-api/src/modules/openapi/openapi.routes.ts` | Updated contracts without new route aliases |
| `rammah-next/components/admin/AdminOfferingPricing.tsx` | Group editor and multi-country UI |
| `rammah-next/components/BookingFlow.tsx` | No default/input, strict unavailable and changed-price states |
| `rammah-next/lib/api/admin.ts` | Group DTO and response metadata |
| `rammah-next/lib/api/bookings.ts` | Expected-price contract and nullable country context |
| `rammah-next/lib/api/offerings.ts` | Remove public `prices`, keep location choice independent |
| API/Next package and test configs | Direct `proxy-addr`, React component testing, and Playwright E2E tooling |

## 14. Testing Requirements

Detected test infrastructure: API Vitest unit/integration/regression suites, Next Vitest unit/regression suites, and no existing component DOM or browser E2E runner. This feature adds `jsdom` plus Testing Library for React components and Playwright with a `test:e2e` script. Browser journeys use deterministic API fixtures; the API integration suite separately runs against the migrated test database and mock payment provider for persistence, locking, and payment invariants. No live merchant or external checkout is used.

Minimum added coverage:

| Layer | Minimum | Cases |
|---|---:|---|
| Unit | 12 | provider headers, no EG fallback, ISO/currency/amount rules, early pricing, expectation comparison |
| API integration | 10 | one/multi-country CRUD, overlap, archive/reuse, migration, strict preview, paid snapshot, price change |
| Frontend component/API | 6 | no country input/default, group editor, unavailable price, changed-price reconfirmation with hold reuse, locations unaffected |
| Browser E2E | 4 | supported paid checkout, unsupported country, mid-flow price edit, foreign-location booking |

Release verification also requires API/Next type checks, lint, full tests, production builds, migration dry-run against a database copy, and post-deploy smoke tests.

### 14.1 Required test files and branches

| Test file/area | Required assertions |
|---|---|
| `request-country.unit.test.ts` | provider/header matrix; trusted and untrusted peer; invalid CIDR startup; `XX`/`T1`/invalid ISO; GeoIP; no Egypt fallback; spoofed generic headers ignored |
| `offering-price-validation.unit.test.ts` | canonical ISO; duplicate countries; currency allowlist; draft/published zero rules; full early-booking pair; exact end-time boundary |
| `pricing-resolution.unit.test.ts` | standard/early price calculation with injected clock; complete expectation match/mismatch for every field; no match and no fallback |
| `price-groups.integration.test.ts` | one/many-country create, list metadata, update, overlap conflict, atomic replacement, archive, reuse, terminal archive, audit atomicity |
| `pricing-groups-upgrade.integration.test.ts` | clean backfill; scheduled-to-draft audit; dirty-data failures with IDs; IDs/money/timestamps preserved; old index removed and partial index enforced |
| `public-pricing.integration.test.ts` | strict exact-country preview; unknown/unsupported country; public offering payload contains no price matrix |
| `paid-pricing-concurrency.integration.test.ts` | admin edit racing confirmation; full `PRICE_CHANGED`; unavailable membership releases hold; mismatch preserves hold; converted replay precedes repricing; composite FK rejects cross-offering group |
| Existing payment/booking integration suites | snapshot retry, callback verification, reconciliation, capacity, expired/wrong-token holds remain green |
| `AdminOfferingPricing.test.tsx` | canonical searchable list, one/many selection, conflict details, archived read-only state, supported currency metadata |
| `BookingFlow.test.tsx` | no country field/default, preview-before-hold, 422 blocking state, 409 explicit reconfirmation with same hold, expired hold recovery, foreign location remains selectable |
| Playwright `pricing-country.spec.ts` | supported paid flow; unsupported country; mid-flow admin edit/reconfirm; foreign-location booking |

### 14.2 Coverage diagram

```text
CODE PATHS                                             USER FLOWS
[PLANNED ★★★] detectCountryFromRequest                 [PLANNED →E2E] Supported paid checkout
  +-- configured provider?                               +-- detect -> exact preview
  |    +-- trusted peer + valid header -> country         +-- create one hold -> confirm -> checkout
  |    +-- untrusted/invalid/missing -> GeoIP              +-- retry lost response -> same booking/payment
  +-- provider none -> GeoIP
  +-- invalid/no result -> null                         [PLANNED →E2E] Unsupported/unknown country
                                                          +-- approved 422 message
[PLANNED ★★★] admin price-group mutation                  +-- no paid hold/payment intent
  +-- validate name/countries/currency/money
  +-- lock group -> memberships                        [PLANNED →E2E] Price changes mid-flow
  +-- overlap -> 409 details                              +-- same owned hold remains active
  +-- save group + memberships + audit                    +-- show current price -> explicit reconfirm
  +-- archive -> deactivate memberships + audit
                                                        [PLANNED →E2E] Attendance in another country
[PLANNED ★★★] paid confirmation                            +-- pricing follows detected country
  +-- lock owned hold                                      +-- all assigned locations remain selectable
  |    +-- converted -> immutable replay
  |    +-- expired/invalid -> slot unavailable          [PLANNED ★★★] Admin editing
  +-- lock current group + membership                     +-- canonical country search and multi-select
  |    +-- missing -> release hold -> 422                  +-- overlap/validation errors recoverable
  |    +-- changed -> preserve hold -> 409                 +-- archived group read-only
  +-- match -> snapshot + convert + payment -> commit
  +-- provider session after commit -> idempotent retry

REGRESSION COVERAGE: capacity, booking lead time, scheduled programs, payment callbacks,
reconciliation, free/quote flows, location assignment, and historical snapshots remain in
their existing integration/regression suites and are mandatory release gates.
```

Every planned branch above must have a behavior assertion, not only a render/smoke assertion. The four customer journeys exercise the complete browser workflow with deterministic network fixtures, while migrated-database API integration tests cover the transaction and persistence boundaries. Provider HTTP remains mocked at the existing payment adapter boundary.

## 15. What Already Exists and Must Be Reused

- The existing `/admin/offerings/:id/prices` routes, admin pricing component, `offering_prices` IDs, and audit table are extended rather than replaced.
- `lockOwnedSlotHold(...).for("update")` and the converted-hold replay branch already protect hold ownership/idempotency; the new pricing transaction preserves and extends this ordering.
- Booking and payment rows already store immutable monetary snapshots, and payment retries already use them.
- Existing migration-upgrade integration tests provide the pattern for applying the new migration from the immediately previous schema.
- Existing request-country, price-validation, capacity, callback-security, finalization, and booking regression suites are extended as regression gates.
- Global booking advance-days rules continue to decide the earliest bookable date.
- Capacity, holds, appointment sessions, programs, workshops, and event occurrences continue to decide availability.
- Payment callback signature verification, reconciliation, idempotency, and retry-from-booking-snapshot remain intact.
- Free and quote-only booking modes remain independent of country pricing.
- Historical booking/payment monetary values remain immutable.
- CMS/R2 media storage is unrelated and unchanged.

## 16. Future Compatibility

Because price groups belong to an offering, the model works for appointments, courses, workshops, programs, and events. Scheduling decides what is bookable; country membership decides the detected customer's price. Future ticket tiers, add-ons, taxes, per-occurrence overrides, and coupons remain separate pricing layers.

## 17. NOT in Scope

- customer-selected pricing/billing country;
- exchange-rate conversion;
- automatic currency choice outside configured groups;
- tax/VAT implementation;
- coupons, bundles, ticket tiers, or add-ons;
- restricting attendance locations to pricing country;
- changing historical booking/payment amounts;
- R2/media changes.
- connecting or migrating DNS itself; the rollout gate only specifies when Cloudflare header mode may be enabled;
- reopening archived groups; archive remains terminal for this release;
- per-session, per-occurrence, tier, add-on, or quantity pricing;
- translating the admin country catalog; English display names with code fallback are sufficient for this release.

## 18. Acceptance Criteria

1. Admin can create and edit a one-country or multi-country group through existing `/prices` endpoints and UI.
2. The database prevents two non-archived groups for one offering from claiming the same country.
3. Archiving a group releases its countries without changing historical bookings.
4. No public request or UI field can choose pricing country.
5. Failed country detection returns nullable context, never Egypt.
6. Supported detected country receives only its exact published group price.
7. Unknown/unsupported country receives `COUNTRY_PRICE_UNAVAILABLE`, creates no paid hold/payment, and sees the approved message.
8. A preview-to-confirmation change in any expectation field returns `PRICE_CHANGED`; no booking/payment is created until the customer confirms the complete new monetary value using the same still-owned hold.
9. New paid bookings store a group ID belonging to the same offering, resolved country, and exact monetary snapshot; retries use that snapshot.
10. Public offering endpoints no longer expose every country's prices.
11. A customer can book a published location in another country without changing pricing country.
12. Existing prices migrate to one-country groups with IDs and money intact; conflicts stop preflight with record IDs.
13. Scheduled legacy prices become audited drafts and remain non-public.
14. Only the configured provider header received from an explicitly trusted proxy CIDR is trusted; invalid detection never falls back to another country.
15. A concurrent admin edit cannot slip between paid price comparison and booking snapshot creation, and a converted-hold retry returns the original booking/payment before repricing.
16. All minimum tests, type checks, lint, builds, migration dry-run, and browser QA pass.

## 19. Engineering Review Findings

All findings below were verified against the current repository and folded into this specification.

| # | Severity / confidence | Evidence | Adopted correction |
|---:|---|---|---|
| 1 | P1 / 10 | `public-payments.service.ts:339` resolves price before `public-payments.repository.ts:129` starts its transaction | Resolve, lock, compare, and snapshot price inside the hold-conversion transaction |
| 2 | P1 / 10 | `app.ts:43` contains `app.set("trust proxy", 1)` | Replace numeric hops with an explicit shared CIDR predicate and trusted-peer check |
| 3 | P1 / 9 | `db/migration-preflight.ts:41` validates migration history, not legacy price data | Add a read-only pricing preflight and repeat database invariants inside migration SQL |
| 4 | P1 / 10 | `db/schema/index.ts:719` has `offering_id`, while current bookings have no applied-price FK | Add nullable `(offering_price_id, offering_id)` composite FK |
| 5 | P1 / 10 | `public-payments.service.ts:282` has an existing converted-hold replay branch before mutable validation | Make replay precedence an explicit contract and regression test |
| 6 | P2 / 9 | `public-price-preview.service.ts:29-35` owns early-price calculation/selection while confirmation needs transactional reuse | Share an executor-aware query, pure calculator with injected clock, and pure comparator |
| 7 | P2 / 10 | `AdminOfferingPricing.tsx:47-48` hardcodes separate currency/country lists | API owns canonical countries and currency metadata; admin consumes it |
| 8 | P2 / 10 | `admin-offerings.service.ts:409/429` mutates a price and writes audit in separate calls | Put group, memberships, and audit row in the same transaction |
| 9 | P2 / 9 | Original expectation contract compared only group/country/currency/total | Compare base, discount, tax, and total as one displayed snapshot |
| 10 | P1 / 10 | No Playwright dependency, config, or E2E script exists | Add reproducible mock-provider E2E infrastructure and four critical journeys |
| 11 | P2 / 10 | Next tests currently run in Node with no DOM/component configuration | Add jsdom and Testing Library for the six required component/API behaviors |
| 12 | P1 / 9 | Existing suites contain no group migration or checkout-versus-admin concurrency coverage | Add migration-upgrade and two-transaction concurrency integration suites |
| 13 | P2 / 8 | Multi-country groups can create per-group membership reads and long checkout locks if implemented naively | Load admin memberships in one query, use indexed exact public lookup, and keep provider/network calls outside locks |

The PostgreSQL locking choice follows the platform's explicit row-lock semantics: selected rows remain protected from conflicting updates until transaction end. The proxy correction follows Express's warning that numeric hop counts are unsafe when paths of different lengths can reach the application. Cloudflare country headers remain an infrastructure trust signal only when requests actually pass through the configured proxy.

References: [PostgreSQL explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html), [Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html), [Cloudflare request headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/).

## 20. Performance and Query Constraints

- Public preview executes one exact indexed membership/group lookup by `(offering_id, country_code)` and never loads all countries' prices.
- Paid confirmation performs the same exact lookup inside its transaction and locks at most one group, one membership, and the owned hold.
- Admin list loads groups and memberships in one joined query and groups rows in memory; no per-group membership query is allowed.
- Canonical country metadata is a process-static value and requires no database query.
- External payment provider calls, email/outbox work, and display-name construction occur after commit or outside the locked section.
- No cache is added initially: price updates are low-volume, exact database lookup is cheap, and correctness on immediate admin edits matters more than cache hit rate.
- Query plans in migration/staging must show use of `offering_price_countries_active_unique` for exact public lookup; a sequential scan on realistic seeded volume blocks release.

## 21. Production Failure Modes

| Failure | Handling | Test | Customer/admin result |
|---|---|---|---|
| Spoofed country/provider header | Ignore unless immediate peer is trusted; fall back to GeoIP/null | Unit + API security | Correct price or approved unavailable message |
| Country cannot be resolved | Return 422 before a paid hold/payment intent | Component + E2E | Clear approved message; cannot continue payment |
| Group changes during confirmation | Row locks serialize the edit; compare current snapshot atomically | Concurrency integration + E2E | 409 with current price and explicit reconfirmation |
| Country removed after hold creation | Release only the owned active hold in the transaction | Integration | 422; slot is no longer unnecessarily held |
| Response lost after commit | Converted-hold replay returns immutable booking/payment first | Integration + E2E | Retry resumes the same checkout, no duplicate booking/payment |
| Concurrent admin overlap | Partial unique index wins; map violation to conflict details | Integration | Recoverable 409, no partial memberships |
| Dirty legacy data | Read-only preflight and SQL assertion stop before backfill writes | Upgrade integration | Deployment stops with offending IDs |
| Hold expires before reconfirmation | Existing hold validation rejects conversion | Component + E2E | Slot-unavailable recovery; no competing hold is silently created |
| Provider fails after commit | Existing payment idempotency/retry flow reuses stored snapshot | Existing + extended payment integration | Retryable checkout; booking amount does not change |

No planned production failure is both silent and uncovered; critical gap count after review is zero.

## 22. Implementation Tasks

Synthesized from the engineering review. Execute and verify sequentially in the current feature worktree.

- [ ] **T1 (P1, human: ~4h / CC: ~45m)** — Database — add group memberships, composite booking FK, dual preflight, backfill, audit conversion, and constraints.
  - Surfaced by: findings 3, 4, and 12.
  - Verify: migration-history preflight, pricing preflight fixtures, fresh migration, upgrade integration suite, and dry-run against a production copy.
- [ ] **T2 (P1, human: ~2h / CC: ~25m)** — Country trust — add canonical ISO catalog, explicit proxy CIDRs, provider-specific trusted-peer detection, nullable public context, and startup validation.
  - Surfaced by: findings 2 and 7.
  - Verify: environment, app proxy, request-country, spoofing, and no-default unit/API tests.
- [ ] **T3 (P1, human: ~5h / CC: ~50m)** — Admin pricing API — implement one/many-country group CRUD, locking, conflict mapping, metadata, compatibility input, write pause, and transactional audit.
  - Surfaced by: findings 7, 8, and 13.
  - Verify: price-group integration suite and query-count assertion.
- [ ] **T4 (P1, human: ~3h / CC: ~30m)** — Public pricing — implement the shared exact resolver/calculator/comparator and remove public price matrices.
  - Surfaced by: findings 6 and 9.
  - Verify: pricing unit/integration tests and public contract/OpenAPI tests.
- [ ] **T5 (P1, human: ~5h / CC: ~50m)** — Paid checkout — move price resolution/comparison into atomic hold conversion, preserve replay precedence, release unavailable holds, and store the applied group snapshot.
  - Surfaced by: findings 1, 4, 5, 9, and 12.
  - Verify: concurrency, ownership, capacity, payment finalization, callback, and replay integration suites.
- [ ] **T6 (P2, human: ~4h / CC: ~40m)** — Admin frontend — replace the single-country form with the metadata-driven price-group editor and searchable multi-select.
  - Surfaced by: findings 7 and 11.
  - Verify: admin component tests, typecheck, lint, and production build.
- [ ] **T7 (P1, human: ~4h / CC: ~40m)** — Customer frontend — remove country defaults, enforce unavailable blocking, and implement same-hold changed-price reconfirmation without filtering attendance locations.
  - Surfaced by: findings 5, 9, and 11.
  - Verify: BookingFlow component/regression tests, typecheck, lint, and production build.
- [ ] **T8 (P1, human: ~4h / CC: ~45m)** — Release QA — add Playwright infrastructure, four critical E2Es, smoke checks, and post-deploy verification.
  - Surfaced by: findings 10 and 12.
  - Verify: full API/Next test commands, `test:e2e`, migration dry-run, and production smoke.

No new `TODOS.md` item is created: all review findings are necessary for this release, while future tiers/taxes/coupons remain explicit non-goals rather than actionable debt. Outside-voice review was skipped; no parallel agents were used.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---:|---:|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | Not required for this engineering correction |
| Codex Review | `/codex review` | Independent second opinion | 0 | — | Skipped |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | CLEAR | 13 issues found and folded; 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | Recommended before final UI polish, not an implementation blocker |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | Not required |

- **VERDICT:** ENG CLEARED — specification is ready for implementation in the defined slices.

NO UNRESOLVED DECISIONS
