# Automatic Country Pricing and Price Groups — Design Specification

**Date:** 2026-08-16  
**Status:** Revised after code-level review
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
| Booking snapshot | Stores country/currency/amounts, not the applied price ID | Add `offering_price_id` to paid bookings |
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

For a paid offering:

1. Resolve the request country on the server.
2. Find the one active membership for that offering/country whose group is published.
3. Apply the early-booking amount when its end time has not passed; otherwise apply the standard amount.
4. Return the resolved country, group ID, currency, amounts, and an expectation object for checkout comparison.
5. Re-detect country and re-resolve price during paid booking creation.
6. Compare the current result with the submitted expectation; never use submitted money as the charged value.
7. Store the group ID, resolved country, and monetary snapshot on the booking.
8. Build the payment from the stored booking snapshot.

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
    "totalAmountMinor": 15000
  }
}
```

The paid-booking body returns this object unchanged. It is an expectation, not an authority. The server independently resolves the current price and compares all four fields.

If group, country, currency, or total changed, the server returns HTTP `409` with code `PRICE_CHANGED` and the new public price preview in `details.currentPrice`. The frontend replaces the displayed amount and requires a second explicit confirmation. The failed request does not convert the hold or create a booking/payment. It keeps the original hold active, stores its ID/token in client state, and reuses that same hold for the second confirmation; it must not create a competing hold for the same slot. Normal hold expiry still applies.

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

- `offering_price_id uuid null references offering_prices(id)`;
- index on `offering_price_id`.

Existing and free bookings remain null. Every newly created paid booking must store a non-null applied group ID plus the existing country, currency, base, discount, tax, and total snapshots. Payment retries continue using the booking snapshot and do not reprice an already-created booking.

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
    "supportedCurrencies": ["EGP"]
  }
}
```

The currency list comes from `PAYMENT_SUPPORTED_CURRENCIES`, is normalized/deduplicated by the API, and is the same list used for server validation. Production must configure it to match the merchant account. The default development value is `EGP`.

### 7.2 Public offerings

Remove `prices` from public offering list, detail, and booking-config payloads and from `PublicOffering`. The frontend does not currently consume this array. The dedicated price-preview endpoint is the only public price source.

### 7.3 Public price preview

`POST /public/booking/price-preview` accepts `offeringId` and the existing optional coupon field only. It contains no country. The response removes `requestedCountryCode`, `countrySource`, and `fallbackApplied`; it returns `resolvedCountryCode`, price/group details, and `expectedPrice`.

### 7.4 Paid booking

`POST /public/payments/paid-bookings` adds required `expectedPrice` for paid confirmation and contains no country. The route supplies trusted detection to the service. The service resolves the current group before converting the hold, compares expectations, and writes the booking snapshot transactionally.

## 8. Country Detection Trust Boundary

Add configuration:

- `COUNTRY_HEADER_PROVIDER=cloudflare|vercel|none`, default `none`;
- `TRUST_PROXY_HOPS`, integer, default `0` locally and explicitly configured in production.

Behavior:

- `cloudflare` accepts only `CF-IPCountry`;
- `vercel` accepts only `X-Vercel-IP-Country`;
- `none` accepts no country header and uses GeoIP only;
- remove support for generic `X-Geo-Country` and `X-Country-Code`;
- invalid/unknown provider values fail application startup;
- if the trusted provider header is missing or invalid, use GeoIP on the effective client IP;
- if neither produces a valid ISO country, return no detection and never default to Egypt.

Production infrastructure must restrict the API origin to Cloudflare/the configured reverse proxy and strip inbound provider headers before adding its trusted value. `TRUST_PROXY_HOPS` must match the actual Coolify proxy chain; it cannot remain an unconditional hardcoded `1`.

## 9. Migration and Deployment

### 9.1 Preflight

The migration command reports counts and stops before writes if it finds:

- more than one non-archived price for the same offering/country, including different currencies;
- an invalid/non-ISO country code;
- negative amounts;
- a published paid price with standard amount `0`;
- incomplete early-booking pairs;
- early-booking amount greater than or equal to the standard amount;
- a currency absent from `PAYMENT_SUPPORTED_CURRENCIES`.

Existing price rows with `status = scheduled` are reported and deterministically converted to `draft`; this preserves their current non-public behavior. The audit log records each conversion.

### 9.2 Backfill

1. Add `name` as nullable.
2. Add the parent composite unique key, memberships table, and nullable booking FK.
3. For every price row, set `name` to the country display name or code.
4. Insert one membership from legacy `country_code`, active unless the group is archived.
5. Convert legacy `scheduled` price status to `draft` and record it.
6. Enforce `name not null`.
7. Verify row counts and membership uniqueness.
8. Drop the old country/currency unique index.
9. Create/verify the active membership partial unique index.

All IDs, currency, amounts, early-booking values, and timestamps are preserved.

### 9.3 Deployment sequence

1. Set `ADMIN_PRICE_WRITES_ENABLED=false`; admin reads stay available and write endpoints return `503` with a maintenance message.
2. Run preflight and database migration.
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
- Membership replacement locks the group and current memberships, deactivates removed rows, then upserts/reactivates requested rows.
- The partial unique index is the final overlap guard; unique violations map to `PRICE_COUNTRY_CONFLICT`.
- Public lookup joins active memberships to one published group by offering and exact detected country.
- Paid confirmation rechecks both the slot hold and current price before conversion. A changed price preserves the owned hold for reconfirmation; an unavailable country releases it.
- Submitted country, group, currency, and money are never charged as authoritative values.
- An already-created booking/payment retry uses its immutable monetary snapshot.

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

## 13. Files Expected to Change

| File/area | Change |
|---|---|
| `rammah-api/src/db/schema/index.ts` | Group memberships and booking price FK |
| `rammah-api/drizzle/*` | Preflight/backfill/index migration |
| `rammah-api/src/config/env.ts` | Provider, proxy, currency, and write-pause config |
| `rammah-api/src/app.ts` | Configured trust-proxy hops |
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

## 14. Testing Requirements

Minimum added coverage:

| Layer | Minimum | Cases |
|---|---:|---|
| Unit | 12 | provider headers, no EG fallback, ISO/currency/amount rules, early pricing, expectation comparison |
| API integration | 10 | one/multi-country CRUD, overlap, archive/reuse, migration, strict preview, paid snapshot, price change |
| Frontend component/API | 6 | no country input/default, group editor, unavailable price, changed-price reconfirmation with hold reuse, locations unaffected |
| Browser E2E | 4 | supported paid checkout, unsupported country, mid-flow price edit, foreign-location booking |

Release verification also requires API/Next type checks, lint, full tests, production builds, migration dry-run against a database copy, and post-deploy smoke tests.

## 15. What Is Working and Must Not Change

- Global booking advance-days rules continue to decide the earliest bookable date.
- Capacity, holds, appointment sessions, programs, workshops, and event occurrences continue to decide availability.
- Payment callback signature verification, reconciliation, idempotency, and retry-from-booking-snapshot remain intact.
- Free and quote-only booking modes remain independent of country pricing.
- Historical booking/payment monetary values remain immutable.
- CMS/R2 media storage is unrelated and unchanged.

## 16. Future Compatibility

Because price groups belong to an offering, the model works for appointments, courses, workshops, programs, and events. Scheduling decides what is bookable; country membership decides the detected customer's price. Future ticket tiers, add-ons, taxes, per-occurrence overrides, and coupons remain separate pricing layers.

## 17. Non-Goals

- customer-selected pricing/billing country;
- exchange-rate conversion;
- automatic currency choice outside configured groups;
- tax/VAT implementation;
- coupons, bundles, ticket tiers, or add-ons;
- restricting attendance locations to pricing country;
- changing historical booking/payment amounts;
- R2/media changes.

## 18. Acceptance Criteria

1. Admin can create and edit a one-country or multi-country group through existing `/prices` endpoints and UI.
2. The database prevents two non-archived groups for one offering from claiming the same country.
3. Archiving a group releases its countries without changing historical bookings.
4. No public request or UI field can choose pricing country.
5. Failed country detection returns nullable context, never Egypt.
6. Supported detected country receives only its exact published group price.
7. Unknown/unsupported country receives `COUNTRY_PRICE_UNAVAILABLE`, creates no paid hold/payment, and sees the approved message.
8. A preview-to-confirmation change returns `PRICE_CHANGED`; no booking/payment is created until the customer confirms the new value using the same still-owned hold.
9. New paid bookings store non-null group ID, resolved country, and exact monetary snapshot; retries use that snapshot.
10. Public offering endpoints no longer expose every country's prices.
11. A customer can book a published location in another country without changing pricing country.
12. Existing prices migrate to one-country groups with IDs and money intact; conflicts stop preflight with record IDs.
13. Scheduled legacy prices become audited drafts and remain non-public.
14. Only the configured provider header is trusted; invalid detection never falls back.
15. All minimum tests, type checks, lint, builds, migration dry-run, and browser QA pass.
