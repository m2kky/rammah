# A5 Global Booking Advance Days — Evidence

## Delivered

- One audited global policy at `/admin/booking-policy` for `1–365` minimum advance
  calendar days and a validated IANA booking timezone.
- Singleton `site_settings` enforcement through migration `0010_overconfident_miracleman`,
  including duplicate-row refusal, a global settings key, and database range constraints.
- Central timezone-aware calendar-date policy shared by recurring availability, available
  overrides, fixed compatibility sessions, Programs, transactional holds, and customer
  rescheduling.
- Explicit capacity contexts for public holds, public rescheduling, active-hold conversion,
  and admin rescheduling. Owned active free and paid holds remain valid after a policy change.
- Independent customer change cutoff through
  `BOOKING_CHANGE_MINIMUM_NOTICE_MINUTES`, including server-derived cancellation and
  rescheduling permissions on booking status.
- Safe stale-selection conflict metadata with only the first bookable date, advance days,
  and timezone.
- Availability-dashboard policy card with live date example and effective-date feedback;
  duplicate CMS timezone editing was removed.
- Admin availability inventory remains visible inside closed dates and is annotated as
  unavailable to customers without changing its real capacity status.
- Public appointment and Program date rails show policy-closed dates, bounded first-date
  navigation, retryable discovery, and selection refresh without clearing customer answers.
- Booking-status rescheduling reuses the same policy metadata and bounded range behavior.
- Production preflight validates the stored singleton policy and reports invalid settings as
  a deployment failure.

## Migration Evidence

- Migration preflight: `current=0010_overconfident_miracleman`, `nextPrefix=0011`.
- Guarded PostgreSQL test database reset and migration passed on `127.0.0.1:55433`.
- Upgrade coverage confirms the existing settings row is backfilled with `global` and one
  advance day, singleton/range constraints work, and duplicate legacy rows stop migration.
- Local production preflight completed with zero failures and reported
  `BOOKING_POLICY` valid at `1 day(s), Africa/Cairo`.

## Verification Evidence

- API unit suite: 34 files, 123 tests passed.
- API integration suite after final review: 24 files, 178 tests passed.
- API booking regression: 1 file, 7 tests passed.
- API typecheck and production build passed.
- OpenAPI contract: 2 tests passed.
- Next unit suite after final review: 7 files, 25 tests passed.
- Next booking regression: 1 file, 2 tests passed.
- Next typecheck and full lint passed on Next 16.2.1.
- Next production build passed and generated 32 application routes.
- Migration preflight, guarded database reset/migration, and stored-policy production
  preflight passed.

## Compatibility Boundary

- The advance-day policy affects new public discovery, holds, and customer reschedule
  targets immediately.
- It does not rewrite Programs, availability rules, overrides, holds, pending payments, or
  confirmed bookings.
- Admin rescheduling bypasses only advance days; capacity and schedule conflicts remain
  authoritative.
- Customer cancellation eligibility remains governed only by the independent change cutoff.
