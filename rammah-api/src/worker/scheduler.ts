import type { EnqueueOutboxEventInput } from "../modules/outbox/outbox.types.js";

type ScheduledEvent = Omit<EnqueueOutboxEventInput, "availableAt" | "idempotencyKey">;

export interface ScheduleDefinition {
  name: string;
  intervalMs: number;
  buildEvent(scheduledFor: Date): ScheduledEvent;
}

interface SchedulerDependencies {
  enqueue(input: EnqueueOutboxEventInput): Promise<unknown>;
  definitions: readonly ScheduleDefinition[];
  isDuplicateError?: (error: unknown) => boolean;
}

const isPostgresDuplicate = (error: unknown): boolean => {
  let current = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth += 1) {
    if (
      "code" in current
      && current.code === "23505"
      && "constraint" in current
      && current.constraint === "outbox_events_idempotency_unique"
    ) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
};

export const createDurableScheduler = ({
  enqueue,
  definitions,
  isDuplicateError = isPostgresDuplicate,
}: SchedulerDependencies) => ({
  async runDue(now: Date): Promise<void> {
    for (const definition of definitions) {
      const bucketTime = Math.floor(now.getTime() / definition.intervalMs) * definition.intervalMs;
      const scheduledFor = new Date(bucketTime);
      const event = definition.buildEvent(scheduledFor);
      try {
        await enqueue({
          ...event,
          availableAt: scheduledFor,
          idempotencyKey: `schedule:${definition.name}:${scheduledFor.toISOString()}`,
        });
      } catch (error) {
        if (!isDuplicateError(error)) {
          throw error;
        }
      }
    }
  },
});
