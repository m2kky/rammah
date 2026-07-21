import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getTestDatabase } from "../../test/db.js";
import {
  claimOutboxEvents,
  completeOutboxEvent,
  enqueueOutboxEvent,
  retryOrDeadLetterOutboxEvent,
} from "./outbox.repository.js";
import { MAX_OUTBOX_ERROR_LENGTH } from "./outbox.types.js";

const baseTime = new Date("2026-07-21T10:00:00.000Z");

const enqueue = async (
  idempotencyKey: string,
  availableAt: Date = baseTime,
) => {
  const context = getTestDatabase();
  return enqueueOutboxEvent(
    {
      topic: "future.integration.topic.v99",
      aggregateType: "booking",
      aggregateId: idempotencyKey,
      payload: { idempotencyKey },
      idempotencyKey,
      availableAt,
    },
    context.db,
  );
};

describe.sequential("transactional outbox repository", () => {
  it("defines only the four supported states", async () => {
    const { pool } = getTestDatabase();
    const result = await pool.query<{ enumlabel: string }>(
      `SELECT enumlabel
       FROM pg_enum
       JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
       WHERE pg_type.typname = 'outbox_state'
       ORDER BY pg_enum.enumsortorder`,
    );

    expect(result.rows.map(({ enumlabel }) => enumlabel)).toEqual([
      "queued",
      "processing",
      "completed",
      "dead_letter",
    ]);
  });

  it("enqueues extensible topics and enforces global idempotency keys", async () => {
    const context = getTestDatabase();
    const first = await enqueue("booking.confirmed:booking-1");

    expect(first).toMatchObject({
      topic: "future.integration.topic.v99",
      aggregateType: "booking",
      aggregateId: "booking.confirmed:booking-1",
      payload: { idempotencyKey: "booking.confirmed:booking-1" },
      idempotencyKey: "booking.confirmed:booking-1",
      state: "queued",
      attempts: 0,
    });
    await expect(enqueue("booking.confirmed:booking-1")).rejects.toThrow();

    const count = await context.db.execute<{ count: string }>(
      sql`SELECT count(*)::text AS count FROM outbox_events`,
    );
    expect(count.rows[0]?.count).toBe("1");
  });

  it("rolls an enqueue back with its surrounding Drizzle transaction", async () => {
    const context = getTestDatabase();
    const rollback = new Error("force rollback");

    await expect(
      context.db.transaction(async (tx) => {
        await enqueueOutboxEvent(
          {
            topic: "booking.created",
            aggregateType: "booking",
            aggregateId: "booking-rollback",
            payload: { bookingId: "booking-rollback" },
            idempotencyKey: "booking.created:booking-rollback",
          },
          tx,
        );
        throw rollback;
      }),
    ).rejects.toBe(rollback);

    const result = await context.db.execute<{ count: string }>(
      sql`SELECT count(*)::text AS count FROM outbox_events`,
    );
    expect(result.rows[0]?.count).toBe("0");
  });

  it("claims in available-at, created-at, id order", async () => {
    const context = getTestDatabase();
    const firstAvailable = await enqueue("ordered:available-first");
    const firstCreated = await enqueue("ordered:created-first");
    const tiedOne = await enqueue("ordered:tied-one");
    const tiedTwo = await enqueue("ordered:tied-two");
    const createdEarly = new Date("2026-07-21T09:00:00.000Z");
    const createdLate = new Date("2026-07-21T09:30:00.000Z");
    const availableEarly = new Date("2026-07-21T08:00:00.000Z");

    await context.pool.query(
      `UPDATE outbox_events
       SET available_at = CASE WHEN id = $1 THEN $2::timestamptz ELSE $3::timestamptz END,
           created_at = CASE
             WHEN id = $4 THEN $5::timestamptz
             WHEN id IN ($6, $7) THEN $8::timestamptz
             ELSE $9::timestamptz
           END`,
      [
        firstAvailable.id,
        availableEarly,
        baseTime,
        firstCreated.id,
        createdEarly,
        tiedOne.id,
        tiedTwo.id,
        createdLate,
        new Date("2026-07-21T09:45:00.000Z"),
      ],
    );

    const tiedIds = [tiedOne.id, tiedTwo.id].sort();
    const claimed = await claimOutboxEvents(
      { limit: 10, leaseDurationMs: 60_000, now: baseTime },
      context.db,
    );

    expect(claimed.map(({ id }) => id)).toEqual([
      firstAvailable.id,
      firstCreated.id,
      ...tiedIds,
    ]);
    expect(claimed.every(({ state, attempts, lockToken }) =>
      state === "processing" && attempts === 1 && Boolean(lockToken)
    )).toBe(true);
  });

  it("atomically prevents concurrent workers from claiming the same rows", async () => {
    const context = getTestDatabase();
    await Promise.all(
      Array.from({ length: 6 }, (_, index) => enqueue(`concurrent:${index}`)),
    );

    const [workerOne, workerTwo] = await Promise.all([
      claimOutboxEvents({ limit: 3, leaseDurationMs: 60_000, now: baseTime }, context.db),
      claimOutboxEvents({ limit: 3, leaseDurationMs: 60_000, now: baseTime }, context.db),
    ]);
    const workerOneIds = new Set(workerOne.map(({ id }) => id));

    expect(workerOne).toHaveLength(3);
    expect(workerTwo).toHaveLength(3);
    expect(workerTwo.every(({ id }) => !workerOneIds.has(id))).toBe(true);
    expect(new Set([...workerOneIds, ...workerTwo.map(({ id }) => id)]).size).toBe(6);
  });

  it("reclaims only expired processing leases and fences stale workers", async () => {
    const context = getTestDatabase();
    const event = await enqueue("lease:event");
    const [originalClaim] = await claimOutboxEvents(
      { limit: 1, leaseDurationMs: 60_000, now: baseTime },
      context.db,
    );

    expect(originalClaim?.id).toBe(event.id);
    expect(
      await claimOutboxEvents(
        { limit: 1, leaseDurationMs: 60_000, now: new Date(baseTime.getTime() + 59_999) },
        context.db,
      ),
    ).toEqual([]);

    const [reclaimed] = await claimOutboxEvents(
      { limit: 1, leaseDurationMs: 60_000, now: new Date(baseTime.getTime() + 60_001) },
      context.db,
    );
    expect(reclaimed).toMatchObject({ id: event.id, attempts: 2, state: "processing" });
    expect(reclaimed?.lockToken).not.toBe(originalClaim?.lockToken);

    expect(
      await completeOutboxEvent(
        { id: event.id, lockToken: originalClaim!.lockToken!, processedAt: baseTime },
        context.db,
      ),
    ).toBeNull();
    expect(
      await retryOrDeadLetterOutboxEvent(
        {
          id: event.id,
          lockToken: originalClaim!.lockToken!,
          error: "stale worker",
          retryAt: baseTime,
          maxAttempts: 3,
        },
        context.db,
      ),
    ).toBeNull();

    const completed = await completeOutboxEvent(
      {
        id: event.id,
        lockToken: reclaimed!.lockToken!,
        processedAt: new Date(baseTime.getTime() + 60_002),
      },
      context.db,
    );
    expect(completed).toMatchObject({ id: event.id, state: "completed", lockToken: null });
    expect(completed?.processedAt).toEqual(new Date(baseTime.getTime() + 60_002));
  });

  it("schedules retries, bounds errors, and dead-letters at the attempt threshold", async () => {
    const context = getTestDatabase();
    const event = await enqueue("retry:event");
    const [firstClaim] = await claimOutboxEvents(
      { limit: 1, leaseDurationMs: 60_000, now: baseTime },
      context.db,
    );
    const retryAt = new Date(baseTime.getTime() + 60_000);
    const longError = "x".repeat(MAX_OUTBOX_ERROR_LENGTH + 100);

    const retry = await retryOrDeadLetterOutboxEvent(
      {
        id: event.id,
        lockToken: firstClaim!.lockToken!,
        error: longError,
        retryAt,
        maxAttempts: 2,
      },
      context.db,
    );
    expect(retry).toMatchObject({ state: "queued", attempts: 1, lockToken: null });
    expect(retry?.availableAt).toEqual(retryAt);
    expect(retry?.lastError).toHaveLength(MAX_OUTBOX_ERROR_LENGTH);

    expect(
      await claimOutboxEvents(
        { limit: 1, leaseDurationMs: 60_000, now: new Date(retryAt.getTime() - 1) },
        context.db,
      ),
    ).toEqual([]);

    const [secondClaim] = await claimOutboxEvents(
      { limit: 1, leaseDurationMs: 60_000, now: retryAt },
      context.db,
    );
    expect(secondClaim).toMatchObject({ id: event.id, attempts: 2, state: "processing" });

    const deadLetter = await retryOrDeadLetterOutboxEvent(
      {
        id: event.id,
        lockToken: secondClaim!.lockToken!,
        error: "permanent after threshold",
        retryAt: new Date(retryAt.getTime() + 60_000),
        maxAttempts: 2,
        processedAt: retryAt,
      },
      context.db,
    );
    expect(deadLetter).toMatchObject({
      id: event.id,
      state: "dead_letter",
      attempts: 2,
      lockToken: null,
      lastError: "permanent after threshold",
    });
    expect(deadLetter?.processedAt).toEqual(retryAt);
    expect(
      await claimOutboxEvents(
        { limit: 1, leaseDurationMs: 60_000, now: new Date(retryAt.getTime() + 120_000) },
        context.db,
      ),
    ).toEqual([]);
  });
});
