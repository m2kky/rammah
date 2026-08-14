# Canonical Booking Schema and Compatibility Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist one explicit scheduling mode per Offering, introduce canonical Scheduled Programs and global availability storage, migrate legacy fixed sessions losslessly, and keep existing booking/payment flows operational through a bounded compatibility adapter.

**Architecture:** One serialized Drizzle migration owns every A2 schema and data change. Canonical target identity is `appointment` versus `scheduled_program`; legacy `offeringSessionId` remains only as an adapter key during the rollout. Existing public sessions and booking flows continue through compatibility projections while A3/A4 build the final global Availability and Programs editors.

**Tech Stack:** Node.js 24.14.0, TypeScript 5.7, Express 4, Drizzle ORM/PostgreSQL, Zod, Vitest 4, React/Next.js 16.2.1.

## Global Constraints

- Run `npm --prefix rammah-api run db:migrations:preflight` before generating the migration; current prefix must be `0007` and Drizzle alone assigns the next prefix.
- Never edit or renumber migrations `0000` through `0007`; add the new SQL/snapshot hashes to `drizzle/migration-lock.json` only after reviewing the generated migration.
- Do not generate another product migration until A2 fresh and upgrade migration gates pass.
- A mixed Offering with future published fixed sessions and published recurring rules must fail preflight with its Offering ID; never infer its canonical mode.
- Preserve customer identity, booking references, payment amounts/status, audit history, hold ownership, calendar IDs and completed history.
- Keep `/public/sessions` and legacy `offeringSessionId` read/request support only as documented compatibility adapters.
- Reject ambiguous and nonexistent IANA wall times; never shift them silently.
- Follow red-green-refactor and commit each task independently.

---

### Task 1: Scheduling migration analysis and blocker contract

**Files:**
- Create: `rammah-api/src/modules/scheduling/scheduling-migration-preflight.ts`
- Create: `rammah-api/src/modules/scheduling/scheduling-migration-preflight.unit.test.ts`
- Create: `rammah-api/src/scripts/scheduling-migration-preflight.ts`
- Modify: `rammah-api/package.json`

**Interfaces:**
- Produces: `classifyLegacyOfferingSources(rows): LegacySchedulingDecision[]`.
- Produces: `inspectLegacySchedulingMigration(pool): Promise<SchedulingMigrationReport>`.
- Produces: package command `db:scheduling:preflight`.

- [x] **Step 1: Write the failing pure classification tests**

```ts
expect(classifyLegacyOfferingSources([{ offeringId: "a", hasRules: true, hasSessions: false }]))
  .toEqual([{ offeringId: "a", schedulingMode: "appointment", blocked: false }]);
expect(classifyLegacyOfferingSources([{ offeringId: "b", hasRules: false, hasSessions: true }]))
  .toEqual([{ offeringId: "b", schedulingMode: "scheduled_program", blocked: false }]);
expect(classifyLegacyOfferingSources([{ offeringId: "c", hasRules: true, hasSessions: true }]))
  .toEqual([{ offeringId: "c", schedulingMode: null, blocked: true }]);
```

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm --prefix rammah-api exec -- vitest run --config vitest.config.ts src/modules/scheduling/scheduling-migration-preflight.unit.test.ts`

Expected: FAIL because the classifier does not exist.

- [x] **Step 3: Implement the classifier and database report**

Use one grouped SQL query over `offerings`, published `availability_rules`, and future published `offering_sessions`. Add report sections for mixed sources, inconsistent rule duration/buffers per Offering, and incompatible published global window sets across Offerings. The script exits non-zero and prints exact Offering IDs when any blocker exists.

- [x] **Step 4: Add and verify the command**

Add:

```json
"db:scheduling:preflight": "tsx src/scripts/scheduling-migration-preflight.ts"
```

Run the focused unit test and `npm --prefix rammah-api run typecheck`; both must pass.

- [x] **Step 5: Commit**

```powershell
git add rammah-api/package.json rammah-api/src/modules/scheduling rammah-api/src/scripts/scheduling-migration-preflight.ts
git commit -m "test: add scheduling migration preflight"
```

### Task 2: Canonical schema and single A2 migration

**Files:**
- Modify: `rammah-api/src/db/schema/index.ts`
- Create: `rammah-api/src/db/canonical-booking-target.unit.test.ts`
- Create: `rammah-api/drizzle/0008_<drizzle-generated-name>.sql`
- Create: `rammah-api/drizzle/meta/0008_snapshot.json`
- Modify: `rammah-api/drizzle/meta/_journal.json`
- Modify: `rammah-api/drizzle/migration-lock.json`
- Modify: `rammah-api/src/test/database-harness.integration.test.ts`
- Create: `rammah-api/src/test/canonical-booking-upgrade.integration.test.ts`

**Interfaces:**
- Produces: `schedulingModeEnum = pgEnum("scheduling_mode", ["appointment", "scheduled_program"])`.
- Produces: `availabilityWindows`, `globalAvailabilityOverrides`, `scheduledPrograms`, and `scheduledProgramOccurrences` Drizzle tables.
- Produces: nullable `bookings.scheduledProgramId` and `bookingSlotHolds.scheduledProgramId` with exact canonical target checks.

- [x] **Step 1: Write failing schema/upgrade assertions**

Assert that a fresh schema has all four canonical tables and that the migration count becomes `9`. In the upgrade test, apply migrations `0000`-`0007` inside a transaction, seed one session-only Offering with booking/hold/payment rows, apply migration `0008`, and assert:

```ts
expect(program.id).toBe(legacySession.id);
expect(occurrence.scheduledProgramId).toBe(program.id);
expect(migratedBooking.scheduledProgramId).toBe(program.id);
expect(migratedBooking.offeringSessionId).toBe(legacySession.id);
expect(migratedBooking.slotStartAt).toBeNull();
```

Add a second transaction that seeds both active sources and expects the A2 migration to reject with the Offering ID.

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm --prefix rammah-api exec -- vitest run --config vitest.integration.config.ts src/test/canonical-booking-upgrade.integration.test.ts
```

Expected: FAIL because canonical tables/columns and migration `0008` do not exist.

- [x] **Step 3: Add canonical Drizzle schema**

Add Offering fields `schedulingMode`, nullable `durationMinutes`, `bufferBeforeMinutes`, and `bufferAfterMinutes`. Add checks equivalent to:

```sql
buffer_before_minutes >= 0 AND buffer_after_minutes >= 0
AND ((scheduling_mode = 'appointment' AND duration_minutes IS NOT NULL AND duration_minutes > 0)
  OR scheduling_mode = 'scheduled_program')
```

Create global window/override tables with local `HH:MM` values, Scheduled Programs with registration bounds/capacity, and occurrences with ordered instants plus calendar/Meet identity.

- [x] **Step 4: Generate exactly one migration and review it**

Run:

```powershell
npm --prefix rammah-api run db:migrations:preflight
npm --prefix rammah-api run db:generate
```

Expected: Drizzle creates journal index/prefix `0008` only.

- [x] **Step 5: Add guarded data migration SQL to the new migration**

The new migration must:

1. Raise an exception listing mixed-source Offering IDs.
2. Raise on inconsistent rule duration/buffer truth or incompatible published global schedules.
3. Backfill Offering mode/buffers/duration.
4. Deduplicate legacy recurring windows into global windows without deleting legacy rows.
5. Insert one Program and one occurrence per legacy fixed session using the legacy session UUID for both compatibility identities.
6. Backfill `scheduled_program_id` on fixed bookings/holds, retain `offering_session_id`, and null canonical slot timestamps.
7. Add canonical target constraints only after backfill.

- [x] **Step 6: Lock and verify migration history**

Append the exact SQL/snapshot SHA-256 hashes to `migration-lock.json`, then run:

```powershell
npm --prefix rammah-api run db:migrations:preflight
npm --prefix rammah-api run db:migrate:test
```

Expected: current prefix `0008`, next prefix `0009`, and a clean fresh migration.

- [x] **Step 7: Run upgrade tests and commit**

```powershell
git add rammah-api/src/db rammah-api/drizzle rammah-api/src/test
git commit -m "feat: add canonical scheduling schema"
```

### Task 3: Persisted Offering scheduling contract

**Files:**
- Modify: `rammah-api/src/modules/offerings/offerings.types.ts`
- Modify: `rammah-api/src/modules/offerings/offerings.mapper.ts`
- Modify: `rammah-api/src/modules/offerings/offerings.repository.ts`
- Modify: `rammah-api/src/modules/offerings/offerings.service.ts`
- Modify: `rammah-api/src/modules/offerings/admin-offerings.repository.ts`
- Modify: `rammah-api/src/modules/offerings/admin-offerings.service.ts`
- Modify: `rammah-api/src/modules/offerings/admin-offerings.routes.ts`
- Create: `rammah-api/src/modules/offerings/offering-scheduling-mode.unit.test.ts`
- Modify: `rammah-next/lib/api/offerings.ts`
- Modify: `rammah-next/lib/api/admin.ts`
- Modify: `rammah-next/components/admin/AdminOfferingEditor.tsx`

**Interfaces:**
- Consumes: persisted `offerings.schedulingMode`, buffers, and nullable duration.
- Produces: admin/public DTO fields `schedulingMode`, `durationMinutes`, `capacity`, `bufferBeforeMinutes`, `bufferAfterMinutes`.

- [x] **Step 1: Write failing validation tests**

Cover appointment duration, non-negative buffers, scheduled-program nullable duration, independence from `offeringType`/`bookingMode`, and a blocked mode change when incompatible future dependencies exist.

- [x] **Step 2: Run focused tests and verify RED**

Run the Offering unit test; expected failures are missing persisted fields and missing blocker validation.

- [x] **Step 3: Replace the A1 compatibility projection**

Read mode/time-independent fields directly from `offerings`. Remove `findPublicOfferingSchedulingSources` from the public booking-config path. Keep the migration preflight module as the only legacy-source classifier.

- [x] **Step 4: Add admin validation and editor controls**

Use exact choices:

```ts
type SchedulingMode = "appointment" | "scheduled_program";
```

Show duration/capacity-per-time/buffers for appointments and default seats for scheduled programs. Preserve the existing commercial booking mode fields.

- [x] **Step 5: Verify and commit**

Run API/frontend unit tests, both typechecks, frontend lint, and commit as `feat: persist offering scheduling mode`.

### Task 4: Legacy sessions as one-occurrence Program adapters

**Files:**
- Create: `rammah-api/src/modules/programs/program-compatibility.repository.ts`
- Create: `rammah-api/src/modules/programs/program-compatibility.service.ts`
- Create: `rammah-api/src/modules/programs/program-compatibility.unit.test.ts`
- Modify: `rammah-api/src/modules/sessions/public-sessions.repository.ts`
- Modify: `rammah-api/src/modules/sessions/public-sessions.service.ts`
- Modify: `rammah-api/src/modules/sessions/admin-sessions.repository.ts`
- Modify: `rammah-api/src/modules/sessions/admin-sessions.service.ts`

**Interfaces:**
- Produces: `resolveLegacySessionTarget({ offeringId, offeringSessionId }): Promise<{ scheduledProgramId: string; occurrence: CanonicalOccurrence } | null>`.
- Produces: deprecated session DTOs sourced from canonical Programs/occurrences and including `scheduledProgramId`.

- [x] **Step 1: Write failing compatibility tests**

Verify a migrated legacy session ID resolves to exactly one Program/occurrence, the deprecated public list remains sorted/grouped by occurrence timezone, and an unknown/unmigrated session ID is rejected.

- [x] **Step 2: Implement read-only dual reads**

Canonical Program/occurrence rows are authoritative. Legacy session IDs are accepted only when the Program/occurrence IDs match the migration mapping. Do not create new `offering_sessions` rows after A2.

- [x] **Step 3: Keep admin compatibility bounded**

Existing `/admin/sessions` reads through the adapter. Writes return a conflict response directing callers to the future Events & Programs editor; A4 replaces the screen and route.

- [x] **Step 4: Verify and commit**

Run session compatibility unit/integration tests and commit as `refactor: map legacy sessions to programs`.

### Task 5: Canonical hold and booking target conversion

**Files:**
- Modify: `rammah-api/src/modules/availability/slot-holds.routes.ts`
- Modify: `rammah-api/src/modules/availability/slot-holds.service.ts`
- Modify: `rammah-api/src/modules/availability/slot-holds.repository.ts`
- Modify: `rammah-api/src/modules/availability/slot-capacity.repository.ts`
- Modify: `rammah-api/src/shared/db/advisory-lock.ts`
- Modify: `rammah-api/src/modules/bookings/public-bookings.repository.ts`
- Modify: `rammah-api/src/modules/bookings/public-bookings.service.ts`
- Modify: `rammah-api/src/modules/payments/public-payments.repository.ts`
- Modify: `rammah-api/src/modules/payments/public-payments.service.ts`
- Modify: `rammah-next/lib/api/bookings.ts`
- Create: `rammah-api/src/modules/bookings/canonical-target-compatibility.integration.test.ts`

**Interfaces:**
- Produces discriminated `CreateHoldRequest.target` for canonical callers.
- Accepts legacy `offeringSessionId` only after `resolveLegacySessionTarget` succeeds.
- Produces canonical hold response target `{ kind, scheduledProgramId, startsAt, endsAt, timezone }`.

- [x] **Step 1: Write failing conversion/capacity tests**

Cover mode mismatch, legacy adapter success, unrecognized legacy ID rejection, exact Program capacity under parallel holds, and active-hold free/paid conversion after canonical slot columns become null.

- [x] **Step 2: Add Program advisory lock and capacity path**

Use one lock key derived from `scheduledProgramId`. Capacity counts active Program holds and `pending_payment|confirmed|rescheduled` Program bookings. Joining the same Program is allowed until capacity; its own occurrences do not self-conflict.

- [x] **Step 3: Convert free and paid booking writers**

Copy the hold's canonical target into the booking. Never trust client timestamps for a Program. Preserve existing owned hold-token, idempotency and payment-finalization behavior.

- [x] **Step 4: Verify and commit**

Run focused booking/payment integration matrices, then commit as `feat: use canonical booking targets`.

### Task 6: Compatibility projections for calendar, email, admin and public status

**Files:**
- Modify: `rammah-api/src/modules/bookings/public-bookings.repository.ts`
- Modify: `rammah-api/src/modules/bookings/admin-bookings.repository.ts`
- Modify: `rammah-api/src/modules/payments/admin-payments.repository.ts`
- Modify: `rammah-api/src/modules/payments/public-payments.repository.ts`
- Modify: `rammah-api/src/modules/calendar/google-calendar.repository.ts`
- Modify: `rammah-api/src/modules/calendar/google-calendar.service.ts`
- Modify: `rammah-api/src/modules/emails/email.repository.ts`
- Modify: `rammah-api/src/modules/emails/email.service.ts`
- Modify: `rammah-next/components/BookingFlow.tsx`
- Modify: `rammah-next/components/BookingStatus.tsx`

**Interfaces:**
- Produces one canonical booking target DTO with ordered `occurrences` for Program bookings.
- Compatibility projections use occurrence instants/timezone when legacy consumers still require a single start/end.

- [x] **Step 1: Write failing migrated-history tests**

Seed a migrated paid booking and assert payment detail, booking status, email payload and calendar reconciliation resolve without `bookings.slotStartAt`/`slotEndAt`.

- [x] **Step 2: Join canonical target data in repositories**

Appointment projections use booking slot columns. Program projections use ordered non-cancelled occurrences and Program timezone/location/capacity. Never manufacture appointment timestamps for Program API responses.

- [x] **Step 3: Keep A1 frontend deterministic**

`BookingFlow.tsx` continues to branch only on persisted `schedulingMode`. Until A4 replaces cards with `/public/programs`, scheduled-program selection consumes the deprecated session adapter and submits the returned canonical Program ID.

- [x] **Step 4: Verify and commit**

Run booking status, payment finalization, callback, calendar and email tests; commit as `fix: resolve migrated program bookings`.

### Task 7: A2 integrated gate and handoff

**Files:**
- Modify: `rammah-api/src/modules/openapi/openapi.routes.ts`
- Modify: `docs/superpowers/plans/2026-08-06-f0-contract-guard-baseline.md`
- Create: `docs/superpowers/plans/2026-08-06-a2-canonical-booking-evidence.md`

**Interfaces:**
- Consumes every A2 contract and migration from Tasks 1-6.
- Produces evidence and the stable schema boundary consumed by A3, A4, B1 and D1.

- [x] **Step 1: Run the complete migration gate**

```powershell
npm --prefix rammah-api run db:migrations:preflight
npm --prefix rammah-api run db:migrate:test
npm --prefix rammah-api run test:integration
```

Expected: fresh migration, upgrade migration, legacy compatibility, booking/payment/calendar/email and capacity suites all pass.

- [x] **Step 2: Run complete API/frontend verification**

```powershell
npm --prefix rammah-api run test:unit
npm --prefix rammah-api run test:regression:booking
npm --prefix rammah-api run typecheck
npm --prefix rammah-api run openapi:check
npm --prefix rammah-next run test:unit
npm --prefix rammah-next run test:regression:booking
npm --prefix rammah-next run typecheck
npm --prefix rammah-next run lint
npm --prefix rammah-next run build
git diff --check
```

Expected: zero failures and a Next 16.2.1 production build.

- [x] **Step 3: Record evidence and commit**

Document migration prefix/hash, preflight behavior, legacy compatibility expiry boundary and exact test counts. Commit as `docs: record canonical booking migration evidence`.

## Self-Review

- Spec coverage: explicit Offering mode, global window base schema, Programs/occurrences, canonical target checks, mixed-source preflight, one-session migration, legacy request/read compatibility and historical booking/payment resolution each have an owning task.
- Scope boundary: A3 owns final global Availability CRUD/preview semantics; A4 owns complete Programs CRUD/discovery and multi-occurrence enrollment UX; A5 owns minimum-advance enforcement. A2 creates their stable schema and compatibility foundation only.
- Placeholder scan: every task names exact files, interfaces, verification commands and commit boundaries; no unresolved implementation markers remain.
- Type consistency: `scheduledProgramId`, `schedulingMode`, `schedulingTimezone`, `bufferBeforeMinutes`, `bufferAfterMinutes` and discriminated target names are identical across schema, API and frontend tasks.
