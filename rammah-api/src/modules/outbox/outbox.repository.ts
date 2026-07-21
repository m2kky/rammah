import { sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { outboxEvents } from "../../db/schema/index.js";
import {
  MAX_OUTBOX_ERROR_LENGTH,
  type ClaimOutboxEventsInput,
  type CompleteOutboxEventInput,
  type EnqueueOutboxEventInput,
  type RetryOrDeadLetterOutboxEventInput,
} from "./outbox.types.js";

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type OutboxExecutor = Pick<typeof db, "execute" | "insert">;

const selectedColumns = sql`
  event.id AS "id",
  event.topic AS "topic",
  event.aggregate_type AS "aggregateType",
  event.aggregate_id AS "aggregateId",
  event.payload AS "payload",
  event.idempotency_key AS "idempotencyKey",
  event.state AS "state",
  event.attempts AS "attempts",
  event.available_at AS "availableAt",
  event.locked_at AS "lockedAt",
  event.lock_token AS "lockToken",
  event.processed_at AS "processedAt",
  event.last_error AS "lastError",
  event.created_at AS "createdAt"
`;

type RawOutboxEvent = Omit<OutboxEvent, "availableAt" | "lockedAt" | "processedAt" | "createdAt"> & {
  availableAt: Date | string;
  lockedAt: Date | string | null;
  processedAt: Date | string | null;
  createdAt: Date | string;
};

const dateFrom = (value: Date | string): Date => value instanceof Date ? value : new Date(value);
const nullableDateFrom = (value: Date | string | null): Date | null =>
  value === null ? null : dateFrom(value);

const rowsFrom = (result: unknown): OutboxEvent[] =>
  (result as { rows: RawOutboxEvent[] }).rows.map((row) => ({
    ...row,
    availableAt: dateFrom(row.availableAt),
    lockedAt: nullableDateFrom(row.lockedAt),
    processedAt: nullableDateFrom(row.processedAt),
    createdAt: dateFrom(row.createdAt),
  }));

const assertPositiveInteger = (value: number, name: string): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
};

const boundError = (error: string): string =>
  Array.from(error).slice(0, MAX_OUTBOX_ERROR_LENGTH).join("");

export const enqueueOutboxEvent = async (
  input: EnqueueOutboxEventInput,
  executor: OutboxExecutor = db,
): Promise<OutboxEvent> => {
  const rows = await executor
    .insert(outboxEvents)
    .values({
      topic: input.topic,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      availableAt: input.availableAt,
    })
    .returning();

  return rows[0]!;
};

export const claimOutboxEvents = async (
  input: ClaimOutboxEventsInput,
  executor: OutboxExecutor = db,
): Promise<OutboxEvent[]> => {
  assertPositiveInteger(input.limit, "limit");
  assertPositiveInteger(input.leaseDurationMs, "leaseDurationMs");
  const now = input.now ?? new Date();

  const result = await executor.execute(sql`
    WITH claimable AS (
      SELECT event.id
      FROM outbox_events AS event
      WHERE
        (event.state = 'queued'::outbox_state AND event.available_at <= ${now})
        OR (
          event.state = 'processing'::outbox_state
          AND event.locked_at IS NOT NULL
          AND event.locked_at <= (${now})::timestamptz - (${input.leaseDurationMs} * INTERVAL '1 millisecond')
        )
      ORDER BY event.available_at, event.created_at, event.id
      FOR UPDATE SKIP LOCKED
      LIMIT ${input.limit}
    ), claimed AS (
      UPDATE outbox_events AS event
      SET
        state = 'processing'::outbox_state,
        attempts = event.attempts + 1,
        locked_at = ${now},
        lock_token = gen_random_uuid(),
        processed_at = NULL
      FROM claimable
      WHERE event.id = claimable.id
      RETURNING ${selectedColumns}
    )
    SELECT *
    FROM claimed
    ORDER BY "availableAt", "createdAt", "id"
  `);

  return rowsFrom(result);
};

export const completeOutboxEvent = async (
  input: CompleteOutboxEventInput,
  executor: OutboxExecutor = db,
): Promise<OutboxEvent | null> => {
  const result = await executor.execute(sql`
    UPDATE outbox_events AS event
    SET
      state = 'completed'::outbox_state,
      locked_at = NULL,
      lock_token = NULL,
      processed_at = ${input.processedAt ?? new Date()},
      last_error = NULL
    WHERE
      event.id = ${input.id}
      AND event.state = 'processing'::outbox_state
      AND event.lock_token = ${input.lockToken}
    RETURNING ${selectedColumns}
  `);

  return rowsFrom(result)[0] ?? null;
};

export const retryOrDeadLetterOutboxEvent = async (
  input: RetryOrDeadLetterOutboxEventInput,
  executor: OutboxExecutor = db,
): Promise<OutboxEvent | null> => {
  assertPositiveInteger(input.maxAttempts, "maxAttempts");
  const processedAt = input.processedAt ?? new Date();
  const lastError = boundError(input.error);

  const result = await executor.execute(sql`
    UPDATE outbox_events AS event
    SET
      state = CASE
        WHEN event.attempts >= ${input.maxAttempts} THEN 'dead_letter'::outbox_state
        ELSE 'queued'::outbox_state
      END,
      available_at = CASE
        WHEN event.attempts >= ${input.maxAttempts} THEN event.available_at
        ELSE (${input.retryAt})::timestamptz
      END,
      locked_at = NULL,
      lock_token = NULL,
      processed_at = CASE
        WHEN event.attempts >= ${input.maxAttempts} THEN (${processedAt})::timestamptz
        ELSE NULL
      END,
      last_error = ${lastError}
    WHERE
      event.id = ${input.id}
      AND event.state = 'processing'::outbox_state
      AND event.lock_token = ${input.lockToken}
    RETURNING ${selectedColumns}
  `);

  return rowsFrom(result)[0] ?? null;
};
