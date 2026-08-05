# Global Booking Advance Days Design

**Status:** Approved
**Date:** 2026-08-05
**Related design:** `docs/superpowers/specs/2026-08-05-complete-cms-media-pages-design.md`

## Goal

Give administrators one global dashboard control for how many local calendar days customers must wait before they can book a session or recurring availability slot.

If the booking timezone's current date is Wednesday:

- `1` closes Wednesday and makes Thursday the earliest bookable date.
- `2` closes Wednesday and Thursday and makes Friday the earliest bookable date.

This is a calendar-date rule, not a rolling 24/48/72-hour duration.

## Repository Baseline

The code already implements part of this behavior through the environment variable `BOOKING_MINIMUM_NOTICE_MINUTES`:

- `rammah-api/src/modules/sessions/public-sessions.service.ts` filters fixed sessions.
- `rammah-api/src/modules/availability/availability-slots.service.ts` filters generated recurring slots.
- `rammah-api/src/modules/availability/slot-capacity.repository.ts` rechecks the rule during transactional capacity operations.
- `rammah-api/src/modules/availability/booking-policy.unit.test.ts` tests a rolling-minute boundary.

The existing implementation does not meet the approved behavior because:

1. It is controlled by deployment environment rather than the dashboard.
2. It measures elapsed minutes rather than calendar days in the booking timezone.
3. The same environment value is also used as the customer cancellation/change cutoff in `public-bookings.service.ts`.
4. Admin availability preview and admin rescheduling pass through the same minimum-notice enforcement as public customers.
5. Free and paid hold conversion re-enter the capacity function and can reject a hold that was valid when acquired.
6. Fixed-session date navigation only contains dates returned by the session API, so closed dates are not represented consistently with recurring availability.
7. The booking frontend initially requests only 14 recurring days and 90 fixed-session days, so a large advance-day value needs an explicit jump/range strategy.
8. `bookingDefaultTimezone` accepts any non-empty text even though calendar-day calculation requires a valid IANA timezone.

The implementation will reuse the existing `site_settings` row, CMS settings persistence/audit path, availability/session repositories, advisory capacity locks, owned slot holds, and admin/public booking screens. It will not introduce a second booking engine.

## Approved Behavior

### Calendar-Day Rule

The global setting is named `bookingMinimumAdvanceDays` and accepts an integer from `1` through `365`. The default is `1`.

The authoritative booking timezone remains `bookingDefaultTimezone`, defaulting to `Africa/Cairo`. It must be a valid IANA timezone.

For an injected server time `now`:

```text
localToday          = calendar date of now in bookingDefaultTimezone
earliestBookableDate = localToday + bookingMinimumAdvanceDays calendar days
slotLocalDate       = calendar date of slot.startsAt in bookingDefaultTimezone
bookable            = slotLocalDate >= earliestBookableDate
```

The comparison is inclusive. Every time on `earliestBookableDate` is eligible, subject to normal publication, rule, capacity, hold, booking, override, location, schedule-limit, and calendar-busy checks.

The calculation uses date keys in the configured timezone and calendar-day addition. It must not add `days * 24 hours`, because daylight-saving transitions and the approved product behavior are based on local dates.

### Coverage

The rule applies to customer actions across:

- Published fixed offering sessions.
- Recurring slots generated from availability rules.
- Slots created from available overrides.
- Free booking hold acquisition.
- Paid booking hold acquisition.
- A customer's target slot when rescheduling.

The rule does not prevent administrators from:

- Creating or publishing a fixed session inside the closed dates.
- Creating an availability override inside the closed dates.
- Viewing closed-date slots in admin availability preview.
- Manually rescheduling a booking into a closed date.

Admin override affects only the advance-day rule. Capacity, overlap, offering status, fixed-session identity, location, global schedule conflict, daily schedule limit, and calendar-busy validation remain mandatory.

### Cancellation and Existing-Booking Changes

The advance-day setting does not control whether an existing booking may be cancelled.

The current customer change cutoff becomes a separately named configuration value, `BOOKING_CHANGE_MINIMUM_NOTICE_MINUTES`, retaining its existing default of `1440` minutes. It controls whether the customer may start cancellation or rescheduling from the current booking. If rescheduling is allowed, the newly selected target date must also satisfy `bookingMinimumAdvanceDays`.

The public booking-status contract returns server-derived change permissions so the frontend does not display actions that the API will reject:

```ts
changePolicy: {
  canCancel: boolean;
  canReschedule: boolean;
  changeCutoffAt: string | null;
}
```

### Holds and In-Flight Bookings

The advance-day rule is authoritatively checked when a new slot hold is created.

An owned active hold is grandfathered until its existing expiry. Free and paid hold conversion must recheck:

- Hold ownership and status.
- Hold expiry.
- Slot/session identity.
- Offering publication and booking mode.
- Capacity.
- Booking and hold conflicts.
- Global schedule and daily limits.
- Calendar busy blocks.

Hold conversion does not recheck the advance-day rule. This prevents a valid checkout from failing after local midnight or after an administrator increases the setting. A converted paid booking and its payment callback, return, retry, reconciliation, email, and calendar work continue normally even if the policy later changes.

Releasing or expiring the hold removes this protection. Any new attempt must satisfy the current policy.

### Setting Changes

Saving a new value takes effect immediately for:

- New public availability/session reads.
- New holds.
- New customer reschedule targets.

Existing bookings, active holds, pending payments, and confirmed payment workflows remain valid.

If a customer has stale availability open and a policy change makes the selected date invalid, hold creation returns `409 SLOT_UNAVAILABLE` with safe policy details. The frontend clears the selection, refreshes both session and recurring availability, and shows the new earliest bookable date.

## Dashboard Experience

### Booking Policy Card

Add a **Booking policy** card at the top of `/admin/availability`. It becomes the single dashboard location for:

- `Minimum advance booking days` — integer input, minimum `1`, maximum `365`.
- `Booking timezone` — validated IANA timezone input/selector.

Helper text must explain the actual rule with a live example:

> If today is Wednesday and this is 2, customers can book from Friday.

The card shows the computed `earliestBookableDate` before save, disables save while invalid or pending, preserves input after an API error, and confirms the effective value and date after save.

Remove the editable booking-timezone field from CMS Site Settings so the same value is not controlled from two screens. The backend field remains on `site_settings`; only its dashboard ownership changes.

Every successful change uses the existing audit system with before and after snapshots. Viewer/editor permissions follow the existing admin authorization policy for availability/settings writes.

### Admin Availability Preview

Admin preview continues to show sessions and generated slots inside the closed dates. These rows keep their real capacity/availability status and add:

```ts
publicBookingPolicy: {
  bookable: boolean;
  reason: "minimum_advance_days" | null;
  earliestBookableDate: string;
}
```

The dashboard displays `Unavailable to customers until <date>` without pretending that the slot itself is blocked or deleting the underlying rule/session.

## Public Booking Experience

Public fixed-session and recurring-availability responses include the same safe policy summary:

```ts
bookingPolicy: {
  minimumAdvanceDays: number;
  timezone: string;
  localToday: string;
  earliestBookableDate: string;
}
```

Customer responses never expose deployment configuration or admin-only data.

The date rail behaves consistently for fixed sessions and recurring availability:

- Closed dates are visible as disabled dates with zero available times when they are inside the current rail.
- Selecting a closed date shows `No times available on this day` and the earliest bookable date.
- When the earliest bookable date is beyond the current 14-day rail, the empty state offers a `View first bookable date` action.
- That action moves the recurring query to a 14-day window starting on `earliestBookableDate` and the fixed-session query to its existing bounded window starting on that date.
- The UI never requests a range larger than the API's existing per-request limits.

The server still filters closed-date sessions and slots from customer-selectable results. Disabled calendar dates are produced from policy metadata, not by exposing otherwise private session rows.

The same policy metadata and date-window logic are reused by booking-status rescheduling.

## API and Data Design

### Persistence

Add to `site_settings`:

```ts
settingsKey: varchar("settings_key", { length: 32 })
  .notNull()
  .default("global"),
bookingMinimumAdvanceDays: integer("booking_minimum_advance_days")
  .notNull()
  .default(1)
```

Add a unique index and check constraint that allow exactly the `global` settings key, plus a database check constraint for `1 <= booking_minimum_advance_days <= 365`. The application currently treats `site_settings` as a singleton but the database does not enforce that assumption. A deployment preflight checks for duplicate existing rows before the migration; duplicates stop the rollout for explicit operator resolution instead of silently discarding settings. The migration backfills the canonical existing row with `settings_key = 'global'` and `booking_minimum_advance_days = 1`, preserving the current default intent while adopting the approved calendar-day semantics.

The settings repository returns a safe default policy of `{ minimumAdvanceDays: 1, timezone: "Africa/Cairo" }` only when the singleton settings row has not yet been created. Database failures are not converted into defaults; they remain observable request failures.

### Central Policy Module

Create one booking-policy module containing:

- IANA timezone validation.
- Pure calendar-date helpers with an injected `now`.
- Settings retrieval and serialization.
- Public/admin policy DTO builders.
- The authoritative slot-date eligibility decision.

Availability and session services must not duplicate date arithmetic.

Capacity enforcement receives an explicit policy context rather than a boolean:

```ts
type AdvancePolicyContext =
  | "public_hold"
  | "public_reschedule"
  | "active_hold_conversion"
  | "admin_reschedule";
```

`public_hold` and `public_reschedule` enforce the current calendar-day policy. `active_hold_conversion` and `admin_reschedule` bypass only that policy. Callers must select a context explicitly so a new capacity caller cannot accidentally inherit the wrong behavior.

### Admin API

Use a focused authenticated booking-policy contract rather than making the large CMS editor own operational booking settings:

- `GET /admin/booking-policy`
- `PATCH /admin/booking-policy`

The patch accepts both `bookingMinimumAdvanceDays` and `bookingDefaultTimezone`, validates them together, updates the existing `site_settings` row transactionally, and writes one audit event.

The existing CMS settings endpoint continues to return the timezone for compatibility during rollout but no longer presents it as an editable field in the CMS UI. After all callers use the booking-policy endpoint, its CMS payload may omit booking operational settings in a later cleanup.

### Public APIs

Extend, without creating parallel availability endpoints:

- `GET /public/availability-slots`
- `GET /public/sessions`
- Slot-hold creation conflict details.
- Public booking-status/change DTOs.

The server is authoritative. Client-supplied dates, timezone values, policy values, or an old availability response never bypass hold validation.

## Data Flow

```text
ADMIN POLICY WRITE
Admin Availability page
  -> validate days + IANA timezone
  -> PATCH /admin/booking-policy
  -> update singleton site_settings + audit snapshot
  -> return effective policy + earliestBookableDate

PUBLIC DISCOVERY
Booking/reschedule page
  -> public sessions + recurring availability
  -> central policy reads site_settings once per request
  -> compute localToday and earliestBookableDate
  -> return selectable results + policy metadata
  -> render closed dates and first-bookable-date guidance

AUTHORITATIVE ACQUISITION
Customer selects a time
  -> POST /public/slot-holds
  -> transaction locks target capacity
  -> read current policy and recheck target local date
  -> enforce all existing capacity/conflict checks
  -> create owned expiring hold or return SLOT_UNAVAILABLE

IN-FLIGHT COMPLETION
Owned active hold
  -> free confirmation or paid booking/payment session
  -> bypass advance-date recheck only
  -> recheck expiry, ownership, capacity, conflicts, and offering truth
  -> convert hold and continue existing booking/payment workflow
```

## Error Handling

- Days below `1`, above `365`, fractional, missing, or non-numeric return field-level `400 VALIDATION_ERROR`.
- Invalid or unsupported IANA timezone values return field-level `400 VALIDATION_ERROR`.
- A stale/closed target at hold creation returns `409 SLOT_UNAVAILABLE` and includes only `earliestBookableDate`, `minimumAdvanceDays`, and `timezone` in safe details.
- An expired or foreign hold remains `409 SLOT_UNAVAILABLE`; the response does not reveal ownership details.
- Policy-read database failure returns the normal observable server error and does not silently allow immediate booking.
- Admin save failure preserves the form and previous effective policy.
- Customer discovery failure preserves entered booking form data and offers retry.

## Performance and Consistency

- Read the single global policy once per availability/session request, not once per generated slot or fixed session.
- Reuse the loaded policy for all candidates in that response.
- Read the current policy inside the hold transaction so the hold decision and persisted hold share one authoritative instant.
- Lock the global settings row while acquiring a new hold. The policy update locks the same row, so a concurrent hold is serialized either entirely before the new policy or entirely after it; it cannot commit under an ambiguous mid-update policy.
- Do not add a long-lived process cache; dashboard changes must take effect immediately across API instances.
- Existing advisory locks remain the capacity concurrency boundary.
- Policy changes do not lock or rewrite sessions, rules, holds, bookings, or payments.

## Testing Strategy

Follow red-green-refactor for each behavior.

### Unit Tests

- Wednesday plus `1` yields Thursday; Wednesday plus `2` yields Friday.
- Any time on the earliest date is eligible.
- Any time on a closed date is ineligible.
- Local midnight changes the cutoff exactly once in `Africa/Cairo`.
- Calendar-day addition remains correct across Cairo daylight-saving transitions.
- Slot timestamps are compared after conversion to the global booking timezone.
- `1` and `365` are accepted; `0`, `366`, fractions, and invalid timezone strings are rejected.
- Each explicit capacity policy context enforces or bypasses only the advance-day check intended for it.
- Customer change cutoff remains controlled by `BOOKING_CHANGE_MINIMUM_NOTICE_MINUTES`.

### API Integration Tests

- Admin reads and updates the policy and an audit event captures before/after values.
- Public fixed sessions omit customer-selectable sessions on closed dates and include policy metadata.
- Public recurring availability returns no selectable slots on closed dates and includes policy metadata.
- Available overrides obey the same public policy.
- Admin preview still returns closed-date slots with `publicBookingPolicy.bookable = false`.
- A forged request cannot create a hold for a closed date.
- The exact earliest calendar date can create a hold for both fixed and recurring capacity paths.
- Raising the policy rejects new holds but allows already-owned active holds to convert in free and paid flows.
- Local midnight does not invalidate an active owned hold.
- Expired and released holds cannot use the grandfather rule.
- Public reschedule enforces the new target date; admin reschedule bypasses advance days but retains capacity/conflict checks.
- Cancellation/change eligibility is unchanged by editing advance days.
- Pending payment confirmation, callbacks, retries, and reconciliation remain valid after a policy change.

### Frontend Tests

- Booking Policy card loads, validates, saves, preserves errors, and previews the effective date.
- The CMS settings screen no longer duplicates booking timezone.
- Both fixed and recurring booking modes display closed dates consistently.
- A closed date shows no selectable times and states the earliest booking date.
- `View first bookable date` requests a bounded range starting at the policy date.
- A stale-selection conflict clears the selection, refreshes results, and preserves customer form answers.
- Booking-status controls use server-derived change permissions.
- Reschedule options reuse the booking policy and range behavior.

### Browser Verification

1. Set the policy to `1` in `Africa/Cairo`; verify today is closed and tomorrow is selectable.
2. Set it to `2`; verify today and tomorrow are closed and the following date is selectable.
3. Verify the same behavior for one fixed-session offering and one recurring-rule offering.
4. Acquire a hold, increase the policy, and complete both a free and paid test booking from the existing hold.
5. Verify a new hold for the now-closed date fails.
6. Verify customer reschedule is restricted and admin reschedule can override it.
7. Verify cancellation cutoff behavior did not change.

## Migration and Rollout

1. Preflight the singleton assumption, then add/backfill the global settings key and `booking_minimum_advance_days` with their unique/check constraints.
2. Add the central booking-policy module and focused admin endpoint.
3. Split `BOOKING_CHANGE_MINIMUM_NOTICE_MINUTES` from the advance-day policy while retaining a `1440` default for existing customer-change behavior.
4. Update discovery contracts before updating the frontend date rail.
5. Update capacity callers with explicit contexts, then add hold grandfathering.
6. Add the Availability-page policy card and remove the duplicate CMS timezone field.
7. Run free, paid, fixed-session, recurring-slot, reschedule, and cancellation regression suites.
8. Document the new environment name and run a production preflight that validates the stored timezone and day range.

The rollout does not cancel or rewrite existing sessions, rules, overrides, holds, bookings, or payments.

## What Already Exists and Will Be Reused

| Existing capability | Current location | Decision |
|---|---|---|
| Global settings persistence | `db/schema/index.ts`, `cms/admin-cms.routes.ts` | Reuse `site_settings`; add focused booking-policy API |
| Booking timezone | `site_settings.bookingDefaultTimezone` | Keep as source of truth; move dashboard ownership to Availability |
| Public fixed sessions | `modules/sessions/*` | Extend with central calendar policy and metadata |
| Recurring slots and overrides | `modules/availability/*` | Reuse generation; split admin/public policy filtering |
| Transactional capacity and advisory locks | `slot-capacity.repository.ts` | Preserve; add explicit advance-policy context |
| Owned expiring holds | `slot-holds*`, hold token tests | Preserve and grandfather valid active holds |
| Free/paid hold conversion | bookings/payments repositories | Preserve all checks except repeat advance-day enforcement |
| Admin audit log | CMS/availability admin services | Reuse for policy updates |
| Availability dashboard | `/admin/availability` and admin components | Add the Booking Policy card at the top |
| Customer booking date rail | `components/BookingFlow.tsx` | Extend for policy metadata, closed dates, and bounded jump |
| Customer rescheduling | `components/BookingStatus.tsx`, booking services | Reuse with server-derived permissions and policy-aware targets |

## Not in Scope

- Per-offering, per-session, per-location, or per-country advance-day overrides.
- Business-day-only calculations or holiday calendars.
- A maximum future booking horizon.
- Customer-specific timezone calculation; the global booking timezone is authoritative.
- Dashboard control for cancellation/reschedule cutoff in this delivery.
- Automatic cancellation of existing holds, pending payments, or bookings after a policy change.
- Creating bookings manually from the admin dashboard.
- Replacing the current availability/session/capacity engine.

## Acceptance Criteria

- An administrator can set `1–365` advance calendar days and a valid booking timezone from the Availability page.
- The saved setting applies globally and immediately to new customer discovery, holds, and reschedule targets.
- With Wednesday as local today, `1` first allows Thursday and `2` first allows Friday.
- Fixed sessions, recurring rules, and available overrides follow identical customer policy behavior.
- Closed dates show no customer-selectable times and clearly state the first bookable date.
- The API rejects forged or stale holds for closed dates.
- An owned active hold can complete until expiry even after midnight or a policy increase.
- Free and paid in-flight workflows continue safely after policy changes.
- Customer rescheduling follows advance days; admin rescheduling may bypass only this rule.
- Cancellation/change cutoff behavior remains independent and unchanged.
- Admin preview shows closed-date inventory without presenting it as publicly bookable.
- Policy changes are audited.
- Unit, integration, frontend, typecheck, lint, build, and browser verification pass.
