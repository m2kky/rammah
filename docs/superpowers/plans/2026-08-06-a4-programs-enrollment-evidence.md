# A4 — Events, Programs, and Enrollment Evidence

## Delivered

- Canonical admin Program CRUD, publication, safe delete/archive, conflict reporting, and
  live booked/held/remaining capacity at `/admin/programs`.
- One-off and multi-occurrence Program editor at `/admin/programs`; legacy
  `/admin/sessions` redirects to the canonical screen.
- Public Program discovery at `/public/programs` with registration windows, deterministic
  occurrence order, open/full state, and canonical `scheduledProgramId` enrollment.
- Program-level atomic holds: one hold and one booking consume one seat across the complete
  occurrence schedule. Full races return `PROGRAM_FULL`; schedule conflicts return
  `SCHEDULE_CONFLICT`.
- Program occurrences block the global coach calendar independent of enrollment count.
- Publishing/updating a Program syncs one Google Calendar/Meet event per occurrence;
  customer enrollments do not create duplicate coach events. Calendar retry and visible
  per-occurrence sync state are available in the Program dashboard.
- Booking status, confirmation email context, downloadable ICS, and payment detail expose
  the Program title and complete ordered occurrence schedule, including Meet/location data.
- Payment-ledger helper copy now explains its operational purpose and where Standard and
  Early-booking prices are configured.
- No A4 schema migration; the A2 canonical Program tables remain the source of truth.

## Verification

- API unit suite: 33 files, 116 tests passed.
- API full integration suite: 19 files, 160 tests passed.
- API post-review focused integration: 4 files, 13 tests passed.
- API booking regression: 1 file, 7 tests passed.
- API typecheck, build, and OpenAPI contract: passed.
- Frontend unit suite: 5 files, 17 tests passed.
- Frontend booking regression: 1 file, 2 tests passed.
- Frontend typecheck, lint, and Next 16.2.1 production build: passed; 32 routes generated,
  including `/admin/programs` and `/admin/sessions`.
- Migration preflight: current `0008`, next `0009`.
- Guarded test database reset/migration: passed on `127.0.0.1:55433`.
- Scheduling migration preflight: `ok: true`, no mixed sources or inconsistent schedules.
- `git diff --check`: passed.
