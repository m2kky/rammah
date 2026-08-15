# Automatic Country Pricing and Price Groups — Design Specification

**Date:** 2026-08-16  
**Status:** Proposed, awaiting written review  
**Scope:** Admin offering prices, public price preview, paid booking checkout, and server-side country detection

## 1. Outcome

An administrator can define one price for one country or share one price across several countries. The customer never selects or submits a country. The API detects the customer's country from trusted request context and uses only the published price group that explicitly contains that country.

If the country cannot be detected, or the offering has no published price for that country, checkout stops before payment and displays:

> Pricing is not available in your country.

There is no Egypt default, first-price fallback, customer override, or automatic currency conversion.

## 2. Product Rules

1. A price group belongs to exactly one offering.
2. A price group has:
   - an administrator-facing name;
   - one currency;
   - one standard amount;
   - an optional early-booking amount and end date/time;
   - one or more ISO 3166-1 alpha-2 country codes;
   - `draft`, `published`, or `archived` status.
3. A price for a single country is represented by a normal group containing one country.
4. Within an offering, one country can belong to only one non-archived group. This stronger rule prevents a draft conflict from appearing only when publishing.
5. Amounts are stored in minor units and must be non-negative integers.
6. The early-booking amount and end date/time are either both set or both absent.
7. The early-booking amount must be lower than the standard amount.
8. Publishing a group requires at least one country and a valid three-letter currency.
9. Editing a group's countries is atomic: either every requested country is assigned or nothing changes.
10. Archiving a group removes it from public pricing and releases its country assignments for reuse. Existing booking/payment snapshots are unchanged.

## 3. Customer Experience

### 3.1 Country handling

- The booking flow contains no country input, country dropdown, or hidden customer-controlled country value.
- Public price-preview, booking, and payment contracts do not accept `countryCode`.
- The API resolves country independently for each relevant request.
- A submitted legacy `countryCode` property is ignored or rejected by strict validation; it never influences price selection.

### 3.2 Successful price resolution

For a paid offering:

1. Resolve the request country on the server.
2. Find the one published price group for the offering whose membership contains that exact country.
3. Apply early-booking pricing when its amount/end-date rule is active; otherwise apply the standard amount.
4. Return the resolved country, currency, amounts, discount, total, and group/price identifier.
5. Re-resolve the price during paid booking creation; do not trust the earlier preview.
6. Store the resolved country and monetary snapshot on the booking/payment records.

### 3.3 Unavailable pricing

For a paid offering, either of these conditions produces HTTP `422` with code `COUNTRY_PRICE_UNAVAILABLE`:

- the server cannot reliably detect the country; or
- no published price group explicitly contains the detected country.

The frontend must:

- show `Pricing is not available in your country.`;
- disable the action that continues to payment;
- avoid creating a paid hold or payment intent;
- keep the user free to select another offering or leave the flow.

No other country's price may be shown as a substitute.

### 3.4 Free and quote-only offerings

- Free bookings do not require a price group and are not blocked by missing country pricing.
- Quote-only offerings continue their existing lead/quote flow and do not expose public prices.
- When a country is detected, it may be stored as booking metadata, but it must not be accepted from the customer.

### 3.5 Offline locations

Location eligibility uses the same server-detected country. The UI must not restore a country selector. If an offering is offline-only and no eligible location exists for the detected country, show a dedicated unavailable-location message rather than silently showing locations from other countries.

## 4. Administrator Experience

Replace the current one-row-per-country price editor with a **Price groups** section on the offering edit page.

Each group editor contains:

- Group name, for example `GCC`, `Egypt`, or `Europe EUR`;
- Countries, as a searchable multi-select;
- Currency;
- Standard price;
- Optional early-booking price;
- Optional early-booking end date/time;
- Status;
- Save and Archive actions.

The country control must support both workflows without separate concepts:

- select one country to create an individual-country price;
- select several countries to share the same price.

The list view shows group name, countries, currency, standard amount, early-booking summary, and status. Country names should be displayed to administrators, while the API stores canonical uppercase two-letter codes.

If a selected country already belongs to another non-archived group for the same offering, saving fails with HTTP `409` and identifies the conflicting country/group. The administrator can remove it from the old group or archive the old group before assigning it again. The server must never silently steal the assignment.

## 5. Data Model

The existing `offering_prices` rows become price-group headers to minimize migration and preserve stable identifiers.

### 5.1 `offering_prices` changes

Add:

- `name varchar(120) not null`

Retain:

- `id`
- `offering_id`
- `currency`
- `base_amount_minor`
- `early_bird_amount_minor`
- `early_bird_ends_at`
- `status`
- timestamps

Keep the existing non-null `country_code` column only as a temporary compatibility field during rollout. Until it is removed, every group write must set it deterministically to the alphabetically first member country. New application reads must use the membership table; this compatibility value is never authoritative. A later cleanup migration can remove the legacy column and its old unique index after production verification.

### 5.2 New `offering_price_countries` table

Columns:

- `price_id uuid not null` → `offering_prices.id` with cascade delete;
- `offering_id uuid not null` → `offerings.id`;
- `country_code varchar(2) not null`;
- `active boolean not null default true`;
- `created_at timestamptz not null`.
- `updated_at timestamptz not null`.

Constraints and indexes:

- primary key `(price_id, country_code)`;
- partial unique `(offering_id, country_code) where active = true`;
- uppercase two-letter country-code check;
- index on `price_id`;
- index on `(offering_id, country_code)` for public lookup.

The duplicated `offering_id` exists to make the no-overlap invariant enforceable by the database. Repository transactions must verify that it matches the referenced price's offering.

### 5.3 Archive behavior

Archiving a group and deactivating its country-membership rows happen in one database transaction. The inactive rows preserve the archived group's historical country list while the partial unique index releases those countries for another group. If a country is later returned to the same group, its row is reactivated instead of duplicated. The audit log stores the before/after group, including the country list. Existing bookings already hold monetary snapshots, so releasing a country does not rewrite history.

## 6. Migration and Rollout

### 6.1 Preflight

Before backfill, detect any offering/country combination with multiple non-archived price rows, including rows that differ only by currency. The new model permits exactly one active group per offering/country, so migration must stop with the conflicting record IDs. It must not choose a winner silently.

### 6.2 Backfill

First add `name` as nullable (or with a safe temporary default), perform the backfill, then enforce `not null`. For every existing `offering_prices` row:

1. Set `name` to the country display name or existing country code when no name is available.
2. Insert one `offering_price_countries` membership from its legacy `country_code`; mark it active unless the source row is archived.
3. Preserve currency, amounts, early-booking settings, status, timestamps, and ID.

This converts every existing country price into a one-country group without changing public amounts.

### 6.3 Deployment order

1. Deploy the additive schema and successful backfill.
2. Deploy API code that reads memberships and writes groups transactionally.
3. Deploy the admin group editor and customer flow without country input.
4. Verify production requests and audit logs.
5. Remove legacy application compatibility code in a later release; do not drop the legacy column in the initial rollout.

All steps must be safe for a rolling deployment. During the compatibility window, the write adapter must populate the legacy `country_code` with the alphabetically first group country solely to satisfy the old non-null schema and old-code compatibility; it is not authoritative and must never be used for public selection after the API cutover.

## 7. API Contracts

### 7.1 Admin

Introduce price-group semantics while preserving the existing offering nesting:

- `GET /admin/offerings/:id/price-groups`
- `POST /admin/offerings/:id/price-groups`
- `PATCH /admin/offerings/:id/price-groups/:groupId`
- `DELETE /admin/offerings/:id/price-groups/:groupId` (archive)

Create/update body:

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

Validation normalizes country/currency codes to uppercase, removes duplicate countries inside the payload, and rejects an empty final country list. Create, update, membership replacement, archive, conflict checking, and audit writing each run transactionally.

The old `/prices` admin endpoints may remain as temporary compatibility aliases, but the new dashboard must use `/price-groups`. Their removal is a separate cleanup task.

### 7.2 Public price preview

`POST /public/booking/price-preview` accepts offering/booking context only. It has no `countryCode` field.

The response may expose `resolvedCountryCode` so the UI can explain currency/availability, but no public request may override it. `fallbackApplied` is removed or permanently omitted; fallback is no longer a supported behavior.

The current public offering payload exposes a list of published country prices. It must no longer be used as the pricing authority or sent as a complete price matrix. During rollout it should either omit `prices` or expose only the server-resolved public price for the current request. Checkout always uses the dedicated preview and server-side re-resolution.

### 7.3 Booking/payment

Public paid booking/payment bodies have no `countryCode`. The route supplies the server-detected country to the service. The service performs an exact membership lookup again inside the booking/payment workflow and stores the resulting snapshot.

Any preview-to-checkout price change follows the existing `PRICE_CHANGED` behavior; country-group support must not weaken that protection.

## 8. Country Detection and Trust Boundary

The existing resolver can use Cloudflare/Vercel country headers and GeoIP fallback, but forwarded headers are trustworthy only when the infrastructure establishes their source.

Production requirements:

1. Customer traffic reaches the API through Cloudflare/the configured reverse proxy.
2. The edge or Coolify proxy strips customer-supplied country headers before forwarding.
3. The application accepts `CF-IPCountry` or equivalent provider headers only when the request came through the configured trusted proxy path.
4. If no trusted provider country is available, use the server-side GeoIP lookup from the effective client IP.
5. If neither method gives a valid ISO country, pricing is unavailable; never default to `EG`.

The implementation must add a configurable trusted-proxy/provider policy rather than assuming any inbound `CF-IPCountry` header is genuine. Automated tests must demonstrate that an untrusted spoofed header cannot choose a cheaper price.

## 9. Concurrency and Consistency

- The database unique constraint is the final guard against overlapping country assignments.
- Group create/update catches unique violations and returns a stable `PRICE_COUNTRY_CONFLICT` response with conflicting codes.
- Membership replacement occurs in one transaction, deactivates removed rows, and upserts/reactivates requested rows while locking the group/current membership rows.
- Public price lookup joins active `offering_price_countries` rows to a `published` group and requires exactly one result.
- Paid booking creation rechecks availability and price; it never accepts amounts, currency, group ID, or country from the browser as authoritative.
- Bookings and payments retain their existing monetary snapshots, so later group edits affect only new bookings.

## 10. Error Semantics

| Condition | HTTP | Code | Customer/Admin behavior |
|---|---:|---|---|
| Country unknown or no matching published group | 422 | `COUNTRY_PRICE_UNAVAILABLE` | Block payment and show unavailable message |
| Country belongs to another active group | 409 | `PRICE_COUNTRY_CONFLICT` | Show conflicting countries/group in admin |
| Invalid country/currency/amount pair | 400 | Existing validation code | Highlight invalid fields |
| Early-booking pair invalid | 400 | Existing validation code | Explain that amount/date are paired and discount is lower |
| Price changes before payment | 409 | `PRICE_CHANGED` | Refresh price and require confirmation |

## 11. Testing Requirements

### Unit tests

- Manual customer country input cannot affect price selection.
- Exact detected-country membership selects the correct group.
- Unknown detection and missing membership return `COUNTRY_PRICE_UNAVAILABLE`.
- Egypt/first-row fallback is absent.
- Early-booking validation and calculation remain correct.
- Country lists normalize, deduplicate, and reject invalid codes.

### API/integration tests

- Create one-country and multi-country groups.
- Updating a group replaces memberships atomically.
- Two groups cannot claim the same country for one offering.
- The same country can be used by different offerings.
- Archiving releases countries and excludes the group from public pricing.
- Migration backfills every existing price without amount/ID loss.
- Migration preflight reports legacy country/currency conflicts.
- Paid booking re-resolves and stores the exact country/price snapshot.
- Spoofed public body/query country values are rejected or ignored.
- Untrusted forwarded country headers cannot select a price.

### Frontend tests

- Customer booking flow has no country input.
- Unavailable country pricing disables checkout and shows the approved message.
- Admin can edit one or several countries in a group.
- Conflict responses identify affected countries.
- Group list and early-booking labels are understandable without internal terms.

### Release verification

- API and Next.js type checks;
- targeted unit/integration suites;
- full lint/test suite;
- production builds;
- browser QA for admin group creation and public allowed/blocked checkout cases.

## 12. Compatibility With Future Booking Types

Price groups are attached to an offering, not to appointment slots. Therefore the same model supports appointments, courses, workshops, scheduled programs, and events. Scheduling decides what can be booked; the price group decides what a detected country pays. If a future offering needs tiered tickets, per-session overrides, taxes, or add-ons, those should be separate pricing layers and must not overload country membership.

## 13. Non-Goals

- Customer-selected billing country for price choice;
- exchange-rate conversion or automatic currency selection;
- tax/VAT calculation;
- coupons, bundles, tiers, or ticket classes;
- location selection by a manually entered country;
- changing historical booking/payment amounts;
- R2/media-storage changes.

## 14. Acceptance Criteria

The feature is complete when:

1. An admin can create a group for one or many countries and manage it from the offering page.
2. No customer-facing request or input controls country pricing.
3. A supported detected country receives its exact published group price.
4. An unsupported or unknown country cannot continue to payment and sees the approved message.
5. Country overlap is prevented transactionally and by a database constraint.
6. Existing prices are preserved as one-country groups, with conflicts reported rather than silently resolved.
7. Paid bookings store immutable resolved-country and money snapshots.
8. The behavior is covered by unit, integration, frontend, build, and browser QA checks.
