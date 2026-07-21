# SEC-03B — atomic admin reschedule capacity report

## Status

Implemented admin booking reschedule on the SEC-03A serialized capacity primitive. The decisive booking lock, target lock, capacity re-read, and schedule update now commit or roll back in one PostgreSQL transaction.

Commit: this slice's commit, subject `fix(api): serialize admin reschedules by capacity`.

## RED evidence

- Command: `npm run test:integration -- src/modules/bookings/admin-bookings-capacity.integration.test.ts`
- Result: exit 1; 4 failed / 4 passed.
- Observed failures:
  - recurring capacity 1 admitted 19 of 20 concurrent moves instead of exactly 1;
  - fixed-session capacity 1 admitted 19 of 20 concurrent moves instead of exactly 1;
  - recurring capacity 3 admitted all 20 concurrent moves instead of exactly 3;
  - an active hold plus a `rescheduled` booking did not exhaust capacity 2.
- The already-correct rollback, current-booking exclusion/source release, same-booking final invariant, and unrelated-target behavior passed before production changes.

## GREEN evidence

- Focused admin plus existing public capacity PostgreSQL gate:
  - Command: `npm run test:integration -- src/modules/bookings/admin-bookings-capacity.integration.test.ts src/modules/availability/slot-capacity.integration.test.ts`
  - Result: exit 0; 2 files, 25/25 tests passed.
- API unit gate:
  - Command: `npm run test:unit`
  - Result: exit 0; 12 files, 61/61 tests passed.
- Typecheck: `npm run typecheck` — exit 0.
- Build: `npm run build` — exit 0.
- `git diff --check` passed.
- The payment callback security integration test was not run.

## Implementation

- `slot-capacity.repository.ts` now exports the one transaction-bound `withAvailableSlotCapacity` mutation API used by both public hold creation and admin reschedule.
- The shared primitive keeps the existing canonical target locks and all post-lock checks: published/future/exact target, availability rules and buffers, blocking overrides, published busy blocks, active unexpired holds, and `pending_payment`/`confirmed`/`rescheduled` bookings.
- It accepts one moving-booking exclusion, applied identically to fixed and recurring capacity counts.
- `rescheduleAdminBookingWithinCapacity` starts a transaction by locking the booking row `FOR UPDATE`, then acquires the target advisory lock (and fixed-session row lock where applicable), revalidates status/capacity, and updates the booking in the same transaction.
- The documented deterministic reschedule lock order is booking row -> target advisory lock -> fixed-session row.
- The service preserves the existing not-found, invalid-status, and `SLOT_UNAVAILABLE` outcomes. Google Calendar, email, and audit calls remain outside the transaction.
- Removed the old duplicated preview/count/update reschedule path.

## Tests added

- 20-way recurring and fixed races at capacity 1 prove exactly one target occupant and no lost booking rows.
- A 20-way recurring race at capacity 3 proves exactly three target occupants.
- Competing moves of one booking leave exactly one valid final target.
- An unrelated recurring target progresses while another target's advisory lock is held.
- The moving booking is excluded from its own pool and its source is reusable after commit.
- Buffered non-candidates, blocked, busy, full, unpublished, and past targets reject without schedule mutation.
- Active holds and `rescheduled` bookings consume capacity.

## Files

- Updated: `rammah-api/src/modules/availability/slot-capacity.repository.ts`
- Updated: `rammah-api/src/modules/bookings/admin-bookings.repository.ts`
- Updated: `rammah-api/src/modules/bookings/admin-bookings.service.ts`
- New: `rammah-api/src/modules/bookings/admin-bookings-capacity.integration.test.ts`

## Concerns

- Calendar and reschedule-email calls are still synchronous after commit and can finish out of order for two rapid moves of the same booking. The planned durable Calendar/email outbox handlers must replace those calls; no provider behavior was added in this slice.
- Published external busy blocks remain global because the existing schema has no offering/calendar ownership key, matching SEC-03A behavior.

## Reviewer follow-up: fixed capacity 3

- Added the missing 20-way fixed-session capacity-3 regression test. It asserts exactly 3 fulfilled moves, 17 `SLOT_UNAVAILABLE` rejections, exactly 3 persisted target occupants, and all 20 source booking rows retained.
- RED sensitivity check: after adding the test, a temporary local mutation changed the fixed-session admission ceiling from `session.capacity` to `1`.
  - Command: `npm run test:integration -- src/modules/bookings/admin-bookings-capacity.integration.test.ts -t "fixed-session moves at capacity 3"`
  - Result: exit 1; expected 3 fulfilled but observed 1.
- The temporary mutation was reverted completely before GREEN; this follow-up contains no production-code change.
- Focused GREEN: the same targeted command passed 1/1.
- Final capacity GREEN:
  - Command: `npm run test:integration -- src/modules/bookings/admin-bookings-capacity.integration.test.ts src/modules/availability/slot-capacity.integration.test.ts`
  - Result: exit 0; 2 files, 26/26 tests passed.
- API unit: 61/61 passed. Typecheck and build passed. No security integration test was run.
