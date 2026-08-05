# F0.1 Baseline and Contract Guard Evidence

**Captured:** 2026-08-06

**Source commit:** `fe65dbf`

**Branch:** `codex/f0-contract-guard`

## Reproducible Green Baseline

| Area | Command | Result |
| --- | --- | --- |
| API unit | `npm --prefix rammah-api run test:unit` | 21 files, 79 tests passed after adding deterministic test-only env to `vitest.config.ts` |
| API typecheck | `npm --prefix rammah-api run typecheck` | Passed |
| API integration | `npm --prefix rammah-api run test:db:wait` then `npm --prefix rammah-api run test:integration` | Fresh reset/migration; 11 files, 129 tests passed |
| Frontend unit | `npm --prefix rammah-next run test:unit` | 3 files, 10 tests passed |
| Frontend typecheck | `npm --prefix rammah-next run typecheck` | Passed |
| Frontend lint | `npm --prefix rammah-next run lint` | Passed |
| Frontend build | `npm --prefix rammah-next run build` | Next.js 16.2.1 production build passed; 31 routes generated |

The first API unit run had 16 passing files and five suites that exited during import because required `DATABASE_URL` and `ADMIN_SESSION_SECRET` values were absent. A control run of the booking-policy test failed without those values and passed with them. Unit Vitest now supplies deterministic non-production values; production environment validation remains unchanged.

Docker Desktop and the `rammah-test` PostgreSQL service must be running for database commands. The integration global setup is authoritative: it connects only through the guarded test URL, resets the test schemas, applies every Drizzle migration, and resets again during teardown.

## Executable Contract Commands

```powershell
npm --prefix rammah-api run openapi:check
npm --prefix rammah-api run db:migrations:preflight
npm --prefix rammah-api run test:db:wait
npm --prefix rammah-api run db:migrate:test
```

- `openapi:check` compares every literal Express route mounted in `app.ts` with the OpenAPI method/path set. Establishing the guard found and corrected stale CMS item `GET` operations and two incorrect public Offering paths.
- `db:migrate:test` uses the same guarded reset/migrate helpers as integration global setup. It refuses non-test environments, remote hosts, wrong ports, query-parameter target overrides, and database names without the `_test` suffix.
- `db:migrations:preflight` verifies sequential journal indices/prefixes, exact journal/SQL/snapshot membership, and locked SHA-256 hashes. At capture time the current migration is `0007_flippant_molecule_man` and the next prefix is `0008`.

## Migration Lock Workflow

Before generating a migration, run `db:migrations:preflight`. After Drizzle generates the next journal entry:

1. Inspect the SQL and generated snapshot; do not edit or renumber existing history.
2. Append the new tag and SHA-256 hashes for its SQL and snapshot to `drizzle/meta/migration-lock.json`.
3. Run `db:migrations:preflight` again. It intentionally fails until every journal entry is locked.
4. Run `db:migrate:test` and the focused integration tests before review.

## Intentionally Red Booking Regressions

These suites are separate from the green unit/integration baseline. They capture the approved A1 target and must remain red until A1 changes production behavior:

```powershell
npm --prefix rammah-api run test:regression:booking
npm --prefix rammah-next run test:regression:booking
```

Observed failures:

- API process timezone `UTC` turns a Thursday Cairo `09:00` wall time into `09:00Z`; the correct instant is `06:00Z`. The split windows themselves contribute all 12 chronological slots, proving that row overwrite is not the root cause.
- `BookingFlow.tsx` has no explicit `schedulingMode`, gives fixed sessions precedence when any rows exist, and formats instants without the authoritative DTO timezone.

Slice A1 turns these suites green and then promotes the relevant tests into the normal regression baseline.
