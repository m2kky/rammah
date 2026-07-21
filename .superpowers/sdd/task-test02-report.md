# TEST-02 Implementer Report

## Outcome

Implemented a disposable real-PostgreSQL integration harness for the API. Local and CI-oriented integration runs now use a dedicated PostgreSQL 16 Alpine service, guarded test-only connection helpers, fresh Drizzle migrations, per-test truncation, deterministic Vitest environment defaults, and teardown that removes both application and migration schema state after pass or failure.

No production database configuration, domain repository, dependency, lockfile, CI workflow, remote, or development PostgreSQL resource was changed.

## Implementation

- Added `rammah-api/docker-compose.test.yml` with Compose project `rammah-test`, service `postgres-test`, test-only credentials/database `rammah_test`, host port `55433`, healthcheck, no fixed container name, and tmpfs-backed PostgreSQL data.
- Added `rammah-api/src/test/db.ts` with the canonical default URL, `TEST_DATABASE_URL` override resolution that never consults `DATABASE_URL`, URL/environment safety guards, guarded connect/close, full public/Drizzle schema reset, Drizzle migration, public-table truncation, and a seed callback. The reviewed guard rejects every URL search parameter before connection/query, requires loopback port `55433`, and requires the exact `postgres-test:5432` service authority.
- Added global integration setup/teardown and per-suite setup. Every run performs guarded fresh schema reset and all migrations; every test truncates application data; global teardown resets both public and Drizzle schemas even when tests fail.
- Configured integration Vitest with `NODE_ENV=test`, matching test `TEST_DATABASE_URL`/`DATABASE_URL`, deterministic non-secret defaults, one worker, and disabled file parallelism. Unit configuration remains separate and DB-free.
- Added a real harness test proving the validated active connection's derived database name, all four recorded Drizzle migrations, Drizzle write/read behavior, and cleanup between tests. The name assertion supports any valid `*_test` CI override instead of hardcoding `rammah_test`.
- Added `test:db:start`, `test:db:wait`, and `test:db:stop` scripts with explicit CLI `--project-name rammah-test`, without changing the existing root integration delegation or existing scripts.

## Safety evidence

- Before starting or modifying the disposable database, the resolved URL was explicitly validated as `postgres://rammah_test:rammah_test@127.0.0.1:55433/rammah_test` with `NODE_ENV=test`.
- Pre-start inspection showed the existing development project `rammah-api` and container `rammah-postgres` healthy on `55432`; no listener existed on `55433`.
- `docker compose -f rammah-api/docker-compose.test.yml config` exited 0 and resolved only project `rammah-test`, service `postgres-test`, published port `55433`, and tmpfs storage.
- `npm run test:db:wait --workspace=rammah-api` exited 0; only `rammah-test-postgres-test-1` was created and it became healthy.
- An explicit unsafe override targeting `127.0.0.1:55432/rammah` exited 1 before connection with `Refusing local test database outside port 55433: 55432`.
- Before cleanup, the project name and sole service were revalidated. `npm run test:db:stop --workspace=rammah-api` exited 0 and removed only the disposable test container/network/storage. Afterwards no `rammah-test` container or `55433` listener remained, while `rammah-postgres` remained healthy on `55432`.
- Independent-review hostile-environment verification set `COMPOSE_PROJECT_NAME=hostile-project` for both start/wait and stop. CLI rendering remained project `rammah-test`; the created container labels were `com.docker.compose.project=rammah-test` and `com.docker.compose.service=postgres-test`; `hostile-project` stayed empty before and after; the pinned stop removed only `rammah-test`.

## TDD evidence

- Retained TEST-01 RED: root `npm run test:integration` exited 1 with `No test files found`; no test Compose file or DB harness helpers existed.
- Guard RED: focused unit execution exited 1 because `./db.js` did not exist.
- Guard GREEN: focused unit execution passed all guard cases after minimal implementation. A subsequent explicit-undefined `NODE_ENV` case caught an ambient-environment fallback; root-cause diagnosis identified the default parameter and the guard was changed to require the passed environment. The test then passed.
- IPv6 loopback RED/GREEN: the added `[::1]` case first failed as a remote host, confirming WHATWG URL bracket normalization; adding the normalized loopback host made it pass.
- Harness RED: the new integration suite exited 1 with two expected `getTestDatabase is not a function` failures before connect/migrate/setup existed.
- Harness GREEN: after the Compose/helper/setup implementation, one integration file and two tests passed against real PostgreSQL.
- Independent-review URL/port RED: six query-parameter variants (`host`, percent-encoded `host`, case-variant `HOST`, `port`, `dbname`, and `sslmode`) reached the fake destructive query; missing/wrong Compose service ports were accepted. Together with the three unpinned script tests, the focused run exited 1 with 11 expected failures.
- Independent-review URL/port GREEN: the minimal guard rejects any URL search string and revalidates before destructive work; it requires explicit `postgres-test:5432`. The focused run passed 29/29 tests, proving query-param rejection happens before the fake pool query.
- Database-name helper RED/GREEN: two tests first failed because `getTestDatabaseName` did not exist, then passed after adding the validating percent-decoding helper. A case probe established that WHATWG preserves host case for the PostgreSQL custom scheme, so the exact allowlist deliberately rejects `POSTGRES-TEST` rather than broadening authority.
- Final unit result with the database stopped: four files and 34 tests passed. Guard tests cover the default and CI-local URLs; missing/invalid/non-PostgreSQL URLs; remote and case-variant hosts; URL query parameters including encoded/case variants; exact loopback/Compose ports; `rammah`, `postgres`, and wrong suffix databases; non-test environments; the dev port; and guard rechecks on reset, migration, and truncation helpers.

## Real PostgreSQL and teardown evidence

- First integration run against the healthy disposable service: exit 0; one file/two tests passed after fresh reset and all migrations.
- Direct post-run query: `current_database = rammah_test`, public table count `0`, and Drizzle schema absent, proving global teardown removed application and migration state.
- Second integration run against the same service: exit 0; one file/two tests passed after another fresh reset/migration cycle.
- Intentional failing probe: wrote a marker row, then failed its assertion; Vitest exited 1 with one intentional failure. A direct post-failure query showed zero public tables, no marker table, and no Drizzle schema.
- The temporary failing probe file was removed. The immediately following root `npm run test:integration` exited 0 with one file/two tests, proving the next run began clean.
- With the test service stopped, integration exited 1 clearly with `Unable to connect to the guarded test database at 127.0.0.1:55433` caused by `ECONNREFUSED`; no development fallback occurred.
- Independent-review fresh verification repeated two integration passes against the same hostile-environment-started `rammah-test` service; both passed 2/2, and the first teardown again left zero public tables and no Drizzle schema. A fresh intentional failing-write probe exited 1; post-failure inspection again showed zero public tables, no marker table, and no Drizzle schema; the immediately following root integration run passed 2/2.

## Second independent-review remediation

- Root cause: `resolveTestDatabaseUrl` trimmed `TEST_DATABASE_URL` for the harness, but `vitest.integration.config.ts` copied the raw override into `DATABASE_URL`. A whitespace-wrapped URL is parsed by installed `pg-connection-string` as the relative host `base`, so the application could target a different database than the harness. The database-name helper also used `decodeURIComponent`, whereas installed `pg-connection-string` uses `decodeURI` semantics for the database path.
- DB-free RED: focused tests produced five expected failures: raw whitespace remained in both config variables, an unsafe development-port override was accepted before integration setup, and `%2F`, `%3F`, and `%23` names disagreed with pg. A direct installed-parser probe confirmed pg keeps those reserved encodings but decodes `%63` to `c`.
- GREEN: `configureIntegrationTestEnvironment` composes the existing resolver and safety guard, then assigns the same trimmed, validated URL to both `TEST_DATABASE_URL` and `DATABASE_URL`; the integration Vitest config calls this one helper. `assertSafeTestDatabaseUrl` and `getTestDatabaseName` now use `decodeURI`, so the suffix guard and reported name match pg's actual target. No raw `DATABASE_URL`, dependency, lockfile, domain code, or service configuration is consulted or changed.
- A temporary config-import test exposed a TypeScript `rootDir` failure. A second helper-specific RED (missing helper) and GREEN retained the same DB-free behavior without importing a root config file from `src` tests.
- Focused GREEN passed 2 files/7 tests. Root typecheck and lint passed; a real root integration run with `TEST_DATABASE_URL` wrapped in leading/trailing spaces passed 1 file/2 tests through the canonical helper. The pinned `rammah-test` Compose service was validated as `postgres-test` on `55433` before start and removed after verification; development `rammah-postgres` remained healthy on `55432`.

## Final gates and repository evidence

- `npm run test:unit` — exit 0 with five files/39 tests while the disposable database was stopped.
- `npm run typecheck` — exit 0 for API and Next workspaces.
- `npm run lint` — exit 0.
- `npm run build` — exit 0; API TypeScript build and Next 16.2.1 production build completed, generating 31/31 static pages.
- Root `npm run test:integration` — exit 0 while the disposable service was healthy, using the unchanged root workspace delegation.
- `npm run clean` — exit 0 after verification, removing generated build/coverage artifacts only.
- Root `package-lock.json` is byte-for-byte unchanged from the parent commit. Structural audit found lockfile version 3, Vitest `4.1.10`, coverage-v8 `4.1.10`, and all eight `@next/swc-*` entries. Root `package.json` retains the `eslint-plugin-react-hooks: 7.0.1` override.
- `git diff --cached --check` — exit 0 before commit.
- Final Compose inspection found no test container/service/storage; final Git status is clean.

## Self-review

Reviewed all ten changed files and the complete amended diff against every binding decision and all four independent-review findings. Destructive reset/truncate/migration paths re-run the guard immediately before database work. URL search parameters cannot override the validated authority because all are rejected before pool construction/query. Local URLs cannot target any port except `55433`; the exact lowercase `postgres-test` host must use explicit port `5432`; database names must end exactly `_test`. Reset drops both public and Drizzle schemas, per-test isolation truncates public application tables only, teardown is returned from Vitest global setup, and unavailable/unsafe database failures occur before tests rather than falling through to development configuration.

The Compose project name prevents its stop command from sharing lifecycle scope with the development Compose project. Storage is tmpfs-only, the service has no fixed container name, and cleanup did not touch the existing `rammah-postgres` container.

## Commit

`test(api): add disposable PostgreSQL harness` (amended after both independent reviews)

## Concerns

None.
