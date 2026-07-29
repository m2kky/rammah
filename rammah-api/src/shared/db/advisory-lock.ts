import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

type AdvisoryLockExecutor = {
  execute(query: ReturnType<typeof sql>): PromiseLike<unknown>;
};

const capacityLockKey = (identity: string) =>
  createHash("sha256").update(identity, "utf8").digest().readBigInt64BE(0);

export const bookingScheduleLockKeys = (input: {
  startsAt: Date;
  endsAt: Date;
}) => {
  const bucketMs = 15 * 60_000;
  const firstBucket = Math.floor(input.startsAt.getTime() / bucketMs);
  const lastBucket = Math.floor((input.endsAt.getTime() - 1) / bucketMs);

  // ponytail: 15-minute buckets match the smallest supported slot and avoid a resource-calendar subsystem.
  return Array.from(
    { length: Math.max(0, lastBucket - firstBucket + 1) },
    (_, index) => capacityLockKey(`booking-bucket:v1:${firstBucket + index}`),
  ).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
};

export const fixedSessionCapacityIdentity = (offeringSessionId: string) =>
  `fixed:v1:${offeringSessionId}`;

export const recurringSlotCapacityIdentity = (input: {
  offeringId: string;
  startsAt: Date;
  endsAt: Date;
}) =>
  `recurring:v1:${input.offeringId}:${input.startsAt.toISOString()}:${input.endsAt.toISOString()}`;

export const fixedSessionCapacityLockKey = (offeringSessionId: string) =>
  capacityLockKey(fixedSessionCapacityIdentity(offeringSessionId));

export const recurringSlotCapacityLockKey = (input: {
  offeringId: string;
  startsAt: Date;
  endsAt: Date;
}) => capacityLockKey(recurringSlotCapacityIdentity(input));

export const acquireCapacityLock = async (
  executor: AdvisoryLockExecutor,
  key: bigint,
) => {
  await executor.execute(sql`SELECT pg_advisory_xact_lock(${key.toString()}::bigint)`);
};

export const acquireCapacityLocks = async (
  executor: AdvisoryLockExecutor,
  keys: readonly bigint[],
) => {
  if (!keys.length) return;
  const values = sql.join(keys.map((key) => sql`${key.toString()}::bigint`), sql`, `);
  await executor.execute(sql`
    SELECT pg_advisory_xact_lock(lock_key)
    FROM (
      SELECT unnest(ARRAY[${values}]) AS lock_key
      ORDER BY lock_key
    ) ordered_locks
  `);
};
