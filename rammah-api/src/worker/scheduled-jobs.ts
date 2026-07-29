import type { ScheduleDefinition } from "./scheduler.js";

const scheduledEvent = (topic: string) => ({
  topic,
  aggregateType: "system",
  aggregateId: "00000000-0000-4000-8000-000000000001",
  payload: {},
});

export const scheduledJobs: readonly ScheduleDefinition[] = [
  {
    name: "expire-holds",
    intervalMs: 2 * 60_000,
    buildEvent: () => scheduledEvent("maintenance.holds.expire"),
  },
  {
    name: "reconcile-payments",
    intervalMs: 15 * 60_000,
    buildEvent: () => scheduledEvent("maintenance.payments.reconcile"),
  },
  {
    name: "sync-calendar-busy",
    intervalMs: 5 * 60_000,
    buildEvent: () => scheduledEvent("calendar.busy.sync"),
  },
];
