# A2 Canonical Booking Schema Evidence

**Captured:** 2026-08-06

**Implementation head:** `386a170`

**Branch:** `codex/f0-contract-guard`

## Delivered Boundary

- `offerings.scheduling_mode` is persisted as `appointment` or `scheduled_program`; appointment duration/buffers and Program capacity are stored rather than inferred from legacy rows.
- Canonical global availability windows/overrides and Scheduled Programs/ordered occurrences exist in Drizzle and migration `0008_cultured_unus`.
- Holds and bookings have one exact canonical target: appointment timestamps or `scheduled_program_id`. Program callers cannot supply trusted timestamps.
- Program capacity uses a Program advisory lock, counts active holds plus blocking bookings, allows members of the same Program up to capacity, and treats other Program occurrences as part of the global coach schedule.
- Public/admin booking, payment, email, and Google Calendar projections resolve Program history through ordered, non-cancelled occurrences. Canonical DTOs expose the occurrence list; legacy single-window fields project the first occurrence only.

## Migration Evidence

| Item | Evidence |
| --- | --- |
| Migration | `0008_cultured_unus` |
| SQL SHA-256 | `cd5cf5cf3cf6d8bcd6d8bd9b8d7591d5bbbf1a4cb8b1a2ba97ffc179ef4d5a59` |
| Snapshot SHA-256 | `b231762cf6b8b715092e77166fbff64e2cfc11b9e63fee5cb183be414fad18cb` |
| Locked history | `0000` through `0008`; next prefix `0009` |
| Fresh migration | Guarded test database reset and migrated successfully at `127.0.0.1:55433` |
| Upgrade migration | `canonical-booking-upgrade.integration.test.ts` passed inside the complete integration suite |
| Scheduling preflight | Empty canonical database returned `ok: true` with no mixed-source, inconsistent-rule, or incompatible-global-schedule decisions |

The upgrade migration blocks ambiguous published mixed-source Offerings, inconsistent recurring duration/buffer/timezone rules, incompatible global schedules, unresolved booking targets, and invalid legacy intervals before writing canonical rows.

## Compatibility Expiry Boundary

- `/public/sessions` and `GET /admin/sessions` are deprecated read adapters over migrated Programs where the Program and compatibility occurrence retain the legacy session UUID.
- `POST`, `PATCH`, and `DELETE` legacy admin session operations return `409 CONFLICT`; new fixed schedules belong to Events & Programs.
- Legacy hold requests containing `offeringSessionId` are accepted only if that UUID resolves to the canonical Program adapter. The stored hold and resulting booking use `scheduledProgramId` with null slot columns.
- These adapters remain until A4 ships admin Program CRUD, `/public/programs`, and the multi-occurrence enrollment UI, and all known clients submit the canonical discriminated target. Historical `offering_session_id` values remain readable even after the request adapters are removed.

## Verification Results

| Area | Command | Result |
| --- | --- | --- |
| Migration lock | `npm --prefix rammah-api run db:migrations:preflight` | Passed; current `0008`, next `0009` |
| Fresh migration | `npm --prefix rammah-api run db:migrate:test` | Passed |
| Scheduling preflight | `npm --prefix rammah-api run db:scheduling:preflight` with guarded test env | Passed |
| OpenAPI contract | `npm --prefix rammah-api run openapi:check` | 2 tests passed |
| API integration | `npm --prefix rammah-api run test:integration` | 15 files, 142 tests passed |
| API unit | `npm --prefix rammah-api run test:unit` | 31 files, 110 tests passed |
| API booking regression | `npm --prefix rammah-api run test:regression:booking` | 6 tests passed |
| API typecheck | `npm --prefix rammah-api run typecheck` | Passed |
| Frontend unit | `npm --prefix rammah-next run test:unit` | 5 files, 17 tests passed |
| Frontend booking regression | `npm --prefix rammah-next run test:regression:booking` | 2 tests passed |
| Frontend typecheck/lint | `npm --prefix rammah-next run typecheck` and `lint` | Passed |
| Frontend production build | `npm --prefix rammah-next run build` | Next.js 16.2.1; 31 routes generated |
| Whitespace guard | `git diff --check` | Passed |

## Phase Commits

- `ba26f53` — scheduling migration preflight
- `e440c11` — canonical scheduling schema and migration
- `d371abf` — persisted Offering scheduling controls
- `3e946fe` — legacy Session-to-Program adapters
- `3474af4` — canonical hold and booking targets
- `386a170` — migrated Program booking projections

