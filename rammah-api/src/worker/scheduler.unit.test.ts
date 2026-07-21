import { describe, expect, it, vi } from "vitest";
import { createDurableScheduler } from "./scheduler.js";

describe("durable scheduler", () => {
  it("enqueues deterministic bucket keys and treats duplicate keys as success", async () => {
    const duplicate = Object.assign(new Error("duplicate"), {
      code: "23505",
      constraint: "outbox_events_idempotency_unique",
    });
    const enqueue = vi.fn()
      .mockResolvedValueOnce({ id: "event-1" })
      .mockRejectedValueOnce(duplicate);
    const scheduler = createDurableScheduler({
      enqueue,
      definitions: [{
        name: "example-hourly",
        intervalMs: 60 * 60 * 1_000,
        buildEvent: (scheduledFor) => ({
          topic: "example.hourly",
          aggregateType: "schedule",
          aggregateId: scheduledFor.toISOString(),
          payload: { scheduledFor: scheduledFor.toISOString() },
        }),
      }],
    });
    const now = new Date("2026-07-21T12:47:13.000Z");

    await scheduler.runDue(now);
    await scheduler.runDue(now);

    expect(enqueue).toHaveBeenNthCalledWith(1, {
      topic: "example.hourly",
      aggregateType: "schedule",
      aggregateId: "2026-07-21T12:00:00.000Z",
      payload: { scheduledFor: "2026-07-21T12:00:00.000Z" },
      availableAt: new Date("2026-07-21T12:00:00.000Z"),
      idempotencyKey: "schedule:example-hourly:2026-07-21T12:00:00.000Z",
    });
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it("does not hide non-duplicate enqueue failures", async () => {
    const scheduler = createDurableScheduler({
      enqueue: vi.fn().mockRejectedValue(new Error("database unavailable")),
      definitions: [{
        name: "example",
        intervalMs: 1_000,
        buildEvent: () => ({
          topic: "example",
          aggregateType: "schedule",
          aggregateId: "example",
          payload: {},
        }),
      }],
    });

    await expect(scheduler.runDue(new Date(0))).rejects.toThrow("database unavailable");
  });

  it("does not hide unique violations from other constraints", async () => {
    const otherUniqueViolation = Object.assign(new Error("other duplicate"), {
      code: "23505",
      constraint: "some_other_unique_constraint",
    });
    const scheduler = createDurableScheduler({
      enqueue: vi.fn().mockRejectedValue(otherUniqueViolation),
      definitions: [{
        name: "example",
        intervalMs: 1_000,
        buildEvent: () => ({
          topic: "example",
          aggregateType: "schedule",
          aggregateId: "example",
          payload: {},
        }),
      }],
    });

    await expect(scheduler.runDue(new Date(0))).rejects.toBe(otherUniqueViolation);
  });
});
