# A3 Global Availability Implementation Plan

**Goal:** Make global working windows and date overrides the only source used to generate appointment slots, while keeping appointment duration, capacity, and buffers on the selected Offering.

**Migration boundary:** A2 already created and populated `availability_windows` and created `global_availability_overrides`. A3 must not generate another Drizzle migration; the next product migration remains reserved for CMS B1.

**Status:** Complete on `codex/f0-contract-guard`; verified and ready for its stage commit. No merge has been performed.

## Task 1: Global availability contracts — complete

- Replace the admin availability repository/service contract with global `availability_windows` CRUD.
- Return windows in weekday/start/end/id order.
- Validate local times and reject overlapping published windows while allowing adjacency.
- Return truthful `allowedActions` values.
- Permanently delete unused drafts; archive published/historical rows.
- Convert admin date overrides to the global local-date/local-time contract.
- Cover list/create/update/delete/archive and overlap behavior with integration tests.

## Task 2: Offering-derived slot generation — complete

- Read the temporary authoritative timezone from `site_settings.booking_default_timezone` until A5 introduces the booking-policy contract.
- Generate slots from published global windows and available global overrides.
- Use the appointment Offering's duration, capacity, and buffers.
- Reject slot preview for `scheduled_program` Offerings.
- Preserve deterministic chronological ordering across multiple same-weekday windows.
- Treat published Program occurrences and different appointment schedule groups as global blockers.
- Cover split-window generation, override precedence, Offering controls, and global conflicts.

## Task 3: Availability dashboard and clearer Offering labels — complete

- Update the admin API client to the global DTOs and `/admin/availability-windows` endpoint.
- Remove Offering, slot length, timezone, and buffer inputs from weekly working hours.
- Use local-time global date override inputs.
- Require one appointment Offering for calendar preview and show Program occurrences as read-only blockers.
- Render Delete versus Archive from `allowedActions`.
- Rename Capacity, Base amount, and Early bird labels and add concise helper text.
- Validate early-booking amount/expiry rules in the dashboard and API.

## Task 4: Contract, build, and migration gates — complete

- Update OpenAPI paths and contract tests.
- Run API integration/unit tests, frontend tests, typecheck, lint, and Next.js production build.
- Re-run fresh migration, upgrade migration preflight, and scheduling preflight to prove A3 added no schema drift.
- Record A3 evidence and commit the completed stage without merging.
