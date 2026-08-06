# A3 Global Availability Evidence

Date: 2026-08-06  
Branch: `codex/f0-contract-guard`  
Merge status: not merged

## Delivered behavior

- `/admin/availability-windows` now manages global weekly working-hours windows.
- Multiple published windows on one weekday combine in stable chronological order; overlap is rejected and adjacency is allowed.
- `allowedActions` drives permanent deletion for unused drafts and archival for published/history-bearing windows.
- Global date overrides use local dates and local times: a complete closed date or one or more non-overlapping extra available windows.
- Public/admin slot generation and transactional hold validation use the same global windows and overrides.
- The selected appointment Offering supplies duration, capacity, buffer-before, and buffer-after values.
- Scheduled-Program Offerings are rejected by appointment preview.
- Published Program occurrences, external calendar busy blocks, and different appointment schedule groups block the global coach calendar.
- Availability preview exposes Program occurrences as read-only blockers and formats times in the authoritative timezone.
- Offering and pricing labels explain appointment capacity, default Program seats, Standard price, and Early-booking price.
- Early-booking amount and expiry are required together, and the discounted amount must be lower than the Standard price in both API and dashboard behavior.

## Verification

- API unit: 32 files, 114 tests passed.
- API integration: 16 files, 148 tests passed.
- API focused A3 integration: 2 files, 14 tests passed after final review adjustments.
- API booking regression: 1 file, 7 tests passed.
- API typecheck and production build passed.
- OpenAPI contract: 2 tests passed; mounted routes match the document.
- Frontend unit: 5 files, 17 tests passed.
- Frontend booking regression: 1 file, 2 tests passed.
- Frontend typecheck, lint, and Next.js 16.2.1 production build passed with 31 routes.
- Migration preflight: current `0008_cultured_unus`, next `0009`.
- Guarded test database reset and migration passed on `127.0.0.1:55433`.
- Scheduling migration preflight passed with no mixed or incompatible legacy sources on the clean migrated database.
- `git diff --check` passed.

## Migration boundary proof

A3 did not modify `rammah-api/drizzle/**` or `rammah-api/src/db/schema/index.ts`. The next product migration prefix remains available for CMS B1 as required by the approved roadmap.
