import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

type AdvisoryLockExecutor = {
  execute(query: ReturnType<typeof sql>): PromiseLike<unknown>;
};

const capacityLockKey = (identity: string) =>
  createHash("sha256").update(identity, "utf8").digest().readBigInt64BE(0);

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
