import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { enqueueOutboxEvent } from "../modules/outbox/outbox.repository.js";
import { getTestDatabase } from "../test/db.js";
import { createDurableScheduler } from "./scheduler.js";

describe.sequential("durable scheduler PostgreSQL integration", () => {
  it("makes repeated callbacks for one time bucket durable exactly once", async () => {
    const context = getTestDatabase();
    const scheduler = createDurableScheduler({
      enqueue: (input) => enqueueOutboxEvent(input, context.db),
      definitions: [{
        name: "integration-example",
        intervalMs: 60_000,
        buildEvent: (scheduledFor) => ({
          topic: "integration.schedule.example",
          aggregateType: "schedule",
          aggregateId: scheduledFor.toISOString(),
          payload: { scheduledFor: scheduledFor.toISOString() },
        }),
      }],
    });
    const now = new Date("2026-07-21T12:34:56.000Z");

    await scheduler.runDue(now);
    await scheduler.runDue(now);

    const result = await context.db.execute<{ count: string }>(sql`
      SELECT count(*)::text AS count
      FROM outbox_events
      WHERE idempotency_key = 'schedule:integration-example:2026-07-21T12:34:00.000Z'
    `);
    expect(result.rows[0]?.count).toBe("1");
  });
});
