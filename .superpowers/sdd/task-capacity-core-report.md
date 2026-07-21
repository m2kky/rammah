# Task 5A — SEC-03 capacity-core report

## Status

Implemented one PostgreSQL advisory-lock capacity primitive and transaction-bound public slot-hold creation for fixed sessions and recurring/generated slots. Added published-rule and available-override overlap validation plus forward-only migration `0005_brown_shadowcat.sql`.

Commit: this slice's commit, subject `feat(api): serialize public slot holds by capacity`.

## RED evidence

- Advisory key unit RED:
  - Command: `npm run test:unit -- src/shared/db/advisory-lock.unit.test.ts`
  - Result: exit 1; 1 failed suite because `./advisory-lock.js` did not exist.
- Atomic capacity PostgreSQL RED:
  - Command: `npm run test:integration -- src/modules/availability/slot-capacity.integration.test.ts`
  - Result: exit 1; 8 failed / 6 passed.
  - Observed failures: capacity-1 recurring persisted 15 successful requests, capacity-3 recurring persisted 20, capacity-1 fixed persisted 19, capacity-3 fixed persisted 20; `rescheduled` did not block; published external busy did not block; expiry was approximately 10 minutes instead of configured 15.
- Post-lock time refresh RED:
  - Command: `npm run test:integration -- src/modules/availability/slot-capacity.integration.test.ts -t "refreshes the active-hold cutoff"`
  - Result: exit 1; the request rejected after waiting behind a lock because the pre-lock timestamp still counted a hold that expired while waiting.
- Fixed-session `rescheduled` preview RED:
  - Command: `npm run test:integration -- src/modules/availability/slot-capacity.integration.test.ts -t "shows a fixed session as booked"`
  - Result: exit 1; preview returned `available`, `bookedCount: 0`, `remainingCapacity: 1`.
- Rule/override invariant PostgreSQL RED:
  - Command: `npm run test:integration -- src/modules/availability/availability-overlap.integration.test.ts`
  - Result: exit 1; 6 failed / 2 passed. Overlapping published rule create/update/publish, conflicting published timezone, and overlapping available override create/update were accepted; adjacent cases passed.
- Constraint/migration harness RED:
  - Command: `npm run test:integration -- src/db/capacity-constraints.integration.test.ts src/test/database-harness.integration.test.ts`
  - Result: exit 1; 19 failed / 3 passed. Eighteen invalid writes were accepted and the harness observed 5 rather than 6 migrations.

## GREEN evidence

- Advisory key unit GREEN:
  - Command: `npm run test:unit -- src/shared/db/advisory-lock.unit.test.ts`
  - Result: exit 0; 3/3 passed, including exact SHA-256 signed-int64 vectors and equivalent-UTC normalization.
- Atomic capacity initial GREEN:
  - Command: `npm run test:integration -- src/modules/availability/slot-capacity.integration.test.ts`
  - Result: exit 0; 14/14 passed before the additional post-lock cutoff, fixed preview, and buffer regression cases were added.
- Post-lock cutoff GREEN:
  - Command: `npm run test:integration -- src/modules/availability/slot-capacity.integration.test.ts -t "refreshes the active-hold cutoff"`
  - Result: exit 0; 1 passed / 14 skipped.
- Fixed preview and buffer semantics GREEN:
  - Command: `npm run test:integration -- src/modules/availability/slot-capacity.integration.test.ts -t "shows a fixed session as booked|matches generated buffer spacing"`
  - Result: exit 0; 2 passed / 15 skipped.
- Rule/override invariant GREEN:
  - Command: `npm run test:integration -- src/modules/availability/availability-overlap.integration.test.ts`
  - Result: exit 0; 8/8 passed.
- Constraint/migration harness GREEN:
  - Command: `npm run test:integration -- src/db/capacity-constraints.integration.test.ts src/test/database-harness.integration.test.ts`
  - Result: exit 0; 22/22 passed.
- Final focused PostgreSQL/migration gate:
  - Command: `npm run test:integration -- src/modules/availability/slot-capacity.integration.test.ts src/modules/availability/availability-overlap.integration.test.ts src/db/capacity-constraints.integration.test.ts src/test/database-harness.integration.test.ts`
  - Result: exit 0; 4 files, 47/47 tests passed.
- API unit gate:
  - First command `npm run test:unit` recorded 60 passed / 1 skipped and one existing `src/db/client.unit.test.ts` `beforeAll` hook timeout at 10 seconds under host load.
  - Bounded rerun command: `npm run test:unit -- --hookTimeout=30000 --testTimeout=30000`
  - Result: exit 0; 12 files, 61/61 tests passed.
- Typecheck: `npm run typecheck` — exit 0.
- Build: `npm run build` — exit 0.
- No payment callback security test was run.

## Implementation

- `src/shared/db/advisory-lock.ts`
  - Canonical identities `fixed:v1:<sessionId>` and `recurring:v1:<offeringId>:<starts ISO UTC>:<ends ISO UTC>`.
  - SHA-256 first eight bytes mapped with `Buffer.readBigInt64BE(0)` to JavaScript `bigint`.
  - `pg_advisory_xact_lock` acquisition scoped to the transaction.
- `src/modules/availability/slot-capacity.repository.ts`
  - Begins one transaction, acquires the per-target lock, refreshes `now`, re-reads target/configuration/capacity consumers/busy blocks, validates exact identity, inserts, and commits.
  - Fixed ordering is advisory lock followed by `offering_sessions FOR UPDATE`.
  - Counts `pending_payment`, `confirmed`, and `rescheduled`; counts only active, unexpired holds; counts overlaps on the actual generated interval without expanding buffers.
  - Returns unavailable for stale, unpublished, mismatched, exhausted, blocked, busy, or invalid-capacity targets.
- `slot-holds.repository.ts` accepts the transaction for hold insert; release behavior is unchanged.
- `slot-holds.service.ts` maps all unavailable outcomes to the existing generic `SLOT_UNAVAILABLE` response and uses `env.PAYMENT_HOLD_MINUTES`.
- Recurring slot construction reuses the current generator helpers, preserving current date/timezone and buffer spacing semantics.
- Public recurring and fixed previews now count `rescheduled` and no longer coerce capacity to 1.
- Admin rule validation rejects overlapping published rules on one offering/weekday and enforces one timezone across published rules for an offering; strict boundary adjacency passes.
- Admin available-override validation rejects same-offering/date overlap on create/update; strict boundary adjacency passes.

## Migration 0005

Generated with Drizzle; no edits were made to migrations `0000`–`0004`.

Validated checks:

- `offerings.capacity > 0`
- `offering_sessions.capacity > 0`
- `availability_rules.slot_duration_minutes > 0`
- both availability-rule buffers non-negative
- bookings: both slot timestamps null, or both non-null with start before end
- booking holds: start before end
- booking base/discount/tax/total minor amounts non-negative
- payment amount minor non-negative
- overrides: both timestamps null, or both non-null with start before end

Indexes:

- availability overrides by offering/date/type
- booking slot holds by session/status/expiry
- bookings by session/status

Fixture compatibility was checked before generation: the seed uses capacities 1 or 30 and does not seed invalid rule buffers/durations, booking/hold/override intervals, or negative booking/payment amounts. The clean PostgreSQL harness applied all six migrations successfully.

## Files

- New: `rammah-api/src/shared/db/advisory-lock.ts`
- New: `rammah-api/src/shared/db/advisory-lock.unit.test.ts`
- New: `rammah-api/src/modules/availability/slot-capacity.repository.ts`
- New: `rammah-api/src/modules/availability/slot-capacity.integration.test.ts`
- New: `rammah-api/src/modules/availability/availability-overlap.integration.test.ts`
- New: `rammah-api/src/db/capacity-constraints.integration.test.ts`
- New/generated: `rammah-api/drizzle/0005_brown_shadowcat.sql`, `rammah-api/drizzle/meta/0005_snapshot.json`
- Updated: availability slot/hold repositories and services, public session capacity preview, admin rule/override repositories and services, schema, Drizzle journal, migration harness assertion.

## Self-review

- Confirmed public creation no longer treats preview output as authorization.
- Confirmed fixed-session lock ordering, exact offering/session/interval validation, and future/published checks.
- Confirmed all recurring decisive reads occur after the advisory lock in the same transaction.
- Confirmed `now` and hold expiry are calculated after lock acquisition, preventing stale expiry decisions after lock waits.
- Confirmed active-hold predicates use `status = 'active' AND expires_at > now`.
- Confirmed strict overlap predicates allow exact adjacency.
- Confirmed no `number`, `hashtext()`, session-wide recurring lock, minute bucket, manual unlock, or hard-coded ten-minute expiry is used.
- Confirmed booking conversion, payment finalization, hold-token ownership, worker handlers, and admin-reschedule paths were not modified.
- `git diff --check` is clean.

## Concerns

- Published external busy blocks are global because the existing schema has no offering/calendar foreign key; this slice consistently applies every published overlapping busy block to both fixed and recurring holds.
- Rule/override overlap rejection follows the requested service/repository validation model. Migration 0005 does not introduce PostgreSQL exclusion constraints or broad offering/day locks.
