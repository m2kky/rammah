# A5 Global Booking Advance Days Implementation

## Goal

Replace the deployment-controlled rolling-minute notice rule with one dashboard-owned, timezone-aware calendar-day policy that applies consistently to appointments and Programs while preserving active holds and the independent customer-change cutoff.

## Delivery Sequence

1. Add pure policy tests for Cairo date arithmetic, DST, inclusive earliest-date behavior, validation, and explicit enforcement contexts.
2. Add the `site_settings` singleton key and `booking_minimum_advance_days` through migration `0010`, including duplicate-row preflight and fresh/upgrade tests.
3. Add the central policy repository/service and authenticated `/admin/booking-policy` read/write contract with audit logging.
4. Extend public appointment and Program discovery with one policy read per request and safe metadata; keep admin preview inventory visible with customer-bookability annotations.
5. Replace capacity callers with explicit contexts: `public_hold`, `public_reschedule`, `active_hold_conversion`, and `admin_reschedule`.
6. Enforce the policy inside new hold transactions while grandfathering owned active hold conversion.
7. Split `BOOKING_CHANGE_MINIMUM_NOTICE_MINUTES` from discovery/acquisition policy and expose server-derived booking change permissions.
8. Add the Availability booking-policy card, remove duplicate CMS timezone editing, and add public closed-date/earliest-date navigation.
9. Run migration, unit, integration, booking/payment regression, Next, and production-build gates; record evidence and commit A5 independently.

## Fixed Contracts

- `bookingMinimumAdvanceDays` is an integer from 1 through 365, default 1.
- `bookingDefaultTimezone` is a valid IANA timezone, default `Africa/Cairo`.
- The earliest bookable local date is `localToday + minimumAdvanceDays` calendar days.
- All times on the earliest local date are eligible; elapsed hours are irrelevant.
- New public holds and customer reschedule targets enforce the policy.
- Admin reschedule and conversion of an owned active hold bypass only advance days.
- Cancellation/change eligibility uses `BOOKING_CHANGE_MINIMUM_NOTICE_MINUTES`, default 1440.
- Policy reads and writes are not process-cached and serialize on the singleton settings row.
- Public stale-selection conflicts expose only the safe policy summary.

## Verification Gate

- Wednesday + 1 opens Thursday; Wednesday + 2 opens Friday in Cairo.
- Recurring windows, available overrides, and Programs expose identical policy metadata and filtering.
- Admin preview shows closed-date inventory with `publicBookingPolicy.bookable = false`.
- Policy changes reject stale new acquisitions but do not invalidate active owned holds or payment completion.
- Full API unit/integration/booking regression and Next unit/typecheck/lint/build pass.
