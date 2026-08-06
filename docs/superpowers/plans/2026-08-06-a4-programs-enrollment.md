# A4 — Events, Programs, and Enrollment Implementation Plan

## Outcome

Replace the deprecated one-session editor with one canonical Program model for events,
workshops, webinars, and course cohorts. A customer enrolls once in the complete Program,
which may contain one or many ordered occurrences.

## Contract

- Admin CRUD lives at `/admin/programs`; `/admin/sessions` remains read-only compatibility.
- A Program can only use a published `scheduled_program` Offering when published.
- Publication requires at least one scheduled occurrence, valid IANA timezones, capacity,
  registration-window ordering, and no global schedule conflict.
- Public discovery lives at `/public/programs` and returns only published, bookable Programs
  with ordered active occurrences and live capacity.
- Holds and bookings use the existing canonical `scheduledProgramId` target, so free/paid
  payment, calendar, email, and idempotency flows are reused.
- Draft Programs without enrollment history may be deleted; otherwise DELETE archives.
- No schema migration is introduced in A4; A2 already created the canonical tables.

## Implementation checkpoints

1. Add failing service/integration tests for validation, ordering, publication, conflicts,
   live capacity, and multi-occurrence enrollment.
2. Implement admin and public Program repositories, services, routes, and OpenAPI contract.
3. Update the admin UI, navigation, Sessions redirect, public booking flow, and payment copy.
4. Run focused tests, full API/frontend gates, migration preflight, and record evidence.
5. Commit A4 independently. Do not merge the feature branch.
