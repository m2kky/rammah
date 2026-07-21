# SEC-01 Implementer Report

## Outcome

Implemented SEC-01 on `codex/production-readiness` from clean `2d1004b`. Kashier callbacks now validate only signed canonical identity/status/evidence, reject invalid attempts without reserving provider event IDs, claim verified events with conflict-safe insertion, and resolve duplicates solely from stored event relationships and processing state. Public, admin, and callback-fallback reconciliation require present exact authoritative evidence and share deterministic conflict-safe event claims.

SEC-02 atomic event/payment/booking/outbox finalization remains deliberately out of scope. A verified event is still committed before the payment transition; if that transition fails, the event remains `pending` and a replay does not reapply it.

## Implementation

- `public-payments.service.ts`
  - rejects callbacks above 16 KiB UTF-8 before parsing or database/provider work;
  - consumes only `merchantOrderId`, `paymentStatus`, `transactionId` with signed `orderReference` fallback, `amount`, and `currency`;
  - never consumes callback `booking` or unsigned identity/status aliases;
  - rejects invalid signatures, unknown orders, and non-Kashier payments without event persistence or token disclosure;
  - requires exact safe minor-unit money and normalized three-letter currency for direct trust;
  - routes incomplete/conflicting signed callbacks through one immediate authoritative lookup and catches provider failure/timeout;
  - includes the required concise `ponytail:` boundary comment that JOB-01/07 replace the lookup with durable reconciliation;
  - returns tokens only through the matched payment/event booking relationship;
  - returns duplicate processing state from the stored event and never reapplies current callback/provider data.
- `public-payments.repository.ts`
  - returns complete stored event relationship/status data;
  - claims `(provider, provider_event_id)` with `ON CONFLICT DO NOTHING ... RETURNING`;
  - marks a claimed event `processed` with `processed_at` only after the trusted transition returns.
- `kashier.adapter.ts`
  - rejects duplicate occurrences of every official signature-payload key and `signature` before HMAC comparison or any callback database/provider work;
  - parses exact decimal money without signs, exponent notation, non-finite values, extra precision, or unsafe minor units;
  - always sends reconciliation with native `AbortSignal.timeout(5_000)`.
- `admin-payments.service.ts`
  - removes `null means match` behavior;
  - requires provider identity plus present exact amount/currency;
  - uses the shared deterministic reconciliation event shape and applies only the claim winner.
- `vitest.integration.config.ts`
  - adds deterministic non-secret Kashier merchant/key/secret/callback/return values only to the integration environment.
- `payment-callback-security.integration.test.ts`
  - adds one real-PostgreSQL suite with direct Drizzle fixtures, native fetch stubs, a default rejection guard against accidental Kashier network access, concurrency, and test-only triggers removed in `finally`.

No dependency, schema, migration, outbox, worker, frontend, workflow, production environment, lockfile, remote, Docker definition, or SEC-02 lock/transaction architecture changed.

## TDD and debugging evidence

Before any production edit, the initial focused real-PostgreSQL RED exited 1 with 4/4 expected failures:

1. forged callback reflected its callback-controlled token and persisted an event;
2. forged-then-valid with the same event ID returned the poisoned stored result;
3. missing amount/currency directly marked the payment paid;
4. a stored event replay used the current merchant order and disclosed/changed the second payment relationship.

After the minimal claim/trust-boundary implementation, those 4/4 passed. The expanded first matrix run produced 15 passes and 2 expected failures:

- Failed then paid stayed failed because a different callback payment identity correctly required authoritative reconciliation, while the reconciliation verifier incorrectly inherited the direct-callback identity-conflict restriction. The focused fix allowed exact authoritative identity to supersede callback identity; the test stubs that exact provider result.
- Drizzle wrapped the PostgreSQL trigger exception in its stable top-level failed-query error. The test was corrected to assert the wrapper while retaining the trigger-caused split failure and database-state assertions.

The next matrix run passed 17/17. A later duplicate-authoritative replay RED proved the callback returned `processed: false` for an already processed deterministic reconciliation event; the minimal fix loads the stored event status without reapplying. The initial expanded matrix passed 20/20.

### Independent-review remediation

Independent review found that signature construction consumed the first occurrence of a query key with `URLSearchParams.get()`, while stored event payload construction consumed the last occurrence with `Object.fromEntries()`. An attacker could append a duplicate canonical field, preserve a valid signature over the first value, and persist attacker-controlled financial evidence from the last value.

The focused real-PostgreSQL RED covered 22 scenarios: appended and prepended duplicates for all ten official signature-payload keys (`paymentStatus`, `cardDataToken`, `maskedCard`, `merchantOrderId`, `orderId`, `cardBrand`, `orderReference`, `transactionId`, `amount`, and `currency`) plus `signature`. Before the fix, all 22 signatures verified and all 22 callbacks processed. The minimal verifier fix rejects any of those keys when `getAll(key).length > 1`, before signature acceptance, event lookup, payment lookup, or provider reconciliation. A separate test closes the application database pool before exercising all 22 scenarios; all callbacks still return the invalid result and fetch remains untouched, proving the earliest-boundary behavior. The focused GREEN passed 22/22, including every prior valid callback/replay/concurrency case.

## Required matrix coverage

The focused suite covers:

1. first forged callback ignored with no event, transition, or callback token;
2. forged then valid with the same event ID;
3. forged then valid with different event IDs;
4. cross-payment forged replay isolation and stored-token resolution;
5. identical replay with one stored event and stored processed outcome;
6. two concurrent identical callbacks with one conflict-safe claim;
7. unknown order and non-Kashier payment rejection;
8. missing/wrong amount, exponent, extra precision, missing/wrong/malformed currency, missing event identity, unknown status, and alias-only identity/status rejection without callback-event poisoning;
9. stored tokens on valid, duplicate, incomplete, and invalid-evidence paths;
10. failed then paid and paid-terminal against later failed;
11. complete exact authoritative fallback, callback identity conflict, provider failure, and real native five-second abort behavior;
12. missing amount in public reconciliation and missing currency in admin reconciliation;
13. split-commit failure using a test-only PostgreSQL trigger, pending event persistence, and non-reapplying replay;
14. oversized callback rejection before provider/database work;
15. signed `orderReference` canonical fallback and public/admin duplicate reconciliation non-reapplication.
16. appended and prepended duplicates for every official signature key plus `signature`, with no event, transition, token, database lookup, or provider fetch; a normal single ignored `booking` parameter remains accepted.

## Database safety and teardown

Before lifecycle work:

- pinned Compose rendering resolved project `rammah-test`, sole service `postgres-test`, `55433:5432`, and tmpfs `/var/lib/postgresql/data`;
- no listener existed on `55433`;
- development `rammah-postgres` was healthy on `55432`.

Only `npm run test:db:wait --workspace=rammah-api` started the test service. Inspection confirmed container labels `com.docker.compose.project=rammah-test` and `com.docker.compose.service=postgres-test`, healthy status, port `55433`, and tmpfs storage. Before stop, the exact sole labeled container was revalidated. Only `npm run test:db:stop --workspace=rammah-api` stopped it.

After the focused suite and root integration, direct PostgreSQL queries returned public table count `0` and Drizzle schema count `0`. Final inspection found no `rammah-test` resources or `55433` listener, while development `rammah-postgres` remained healthy on `55432`.

## Verification evidence

- Focused payment integration pass 1: 1 file, 20 tests passed, exit 0.
- Focused payment integration pass 2 against the same service: 1 file, 20 tests passed, exit 0.
- Root `npm run test:integration`: 2 files, 22 tests passed, exit 0.
- Independent-review duplicate-field RED: 1 file, 1 expected failure; all 22 duplicate scenarios verified and processed before the fix.
- Independent-review duplicate-field GREEN: 1 file, 1 test passed with 21 skipped, exit 0.
- Independent-review closed-pool no-database GREEN: 1 file, 1 test passed with 21 skipped, exit 0.
- Final focused payment integration: 1 file, 22 tests passed, exit 0.
- Final root `npm run test:integration`: 2 files, 24 tests passed, exit 0.
- Root `npm run test:unit` with the disposable database stopped: 5 files, 39 tests passed, exit 0.
- Root `npm run typecheck`: API and Next workspaces passed, exit 0.
- Root `npm run lint`: passed, exit 0.
- Root `npm run build`: API TypeScript build and Next 16.2.1 production build passed; 31/31 static pages generated, exit 0.
- `git diff --check`: exit 0.
- Lock/scope audit: root `package-lock.json` has no Git diff; no dependency manifest, schema, migration, Docker definition, workflow, frontend, production configuration, or remote changed.

## Self-review

Reviewed the full production and test diff against all 14 binding decisions, the independent-review finding, and the SEC-01/SEC-02 plan boundary. Duplicate signed fields are rejected inside the verifier before any stateful work, while a single ignored `booking` parameter remains compatible. Invalid attempts never insert callback events. Direct and reconciliation claims start pending; only the insert winner transitions state; processed marking follows the transition. Duplicate event paths read stored state/relationships and never trust current callback/provider values. Callback amount/currency and authoritative amount/currency are present and exact. Provider identity is required, direct identity conflicts reconcile, paid remains terminal, and the test-only failure triggers are always removed in `finally`.

The deliberate remaining split commit is documented and exercised; SEC-02 owns its transactional replacement.

## Commit

`fix(api): harden Kashier callback replay`

## Concerns

None within SEC-01 scope.
