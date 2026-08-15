import { describe, expect, it } from "vitest";
import { scheduledJobs } from "./scheduled-jobs.js";

describe("scheduled worker jobs", () => {
  it("schedules holds, payment reconciliation, calendar busy sync, and CMS publishing", () => {
    expect(
      scheduledJobs.map((definition) => ({
        name: definition.name,
        intervalMs: definition.intervalMs,
        topic: definition.buildEvent(new Date()).topic,
      })),
    ).toEqual([
      { name: "expire-holds", intervalMs: 2 * 60_000, topic: "maintenance.holds.expire" },
      {
        name: "reconcile-payments",
        intervalMs: 15 * 60_000,
        topic: "maintenance.payments.reconcile",
      },
      { name: "sync-calendar-busy", intervalMs: 5 * 60_000, topic: "calendar.busy.sync" },
      { name: "publish-due-cms", intervalMs: 60_000, topic: "cms.publish-due" },
    ]);
  });
});
