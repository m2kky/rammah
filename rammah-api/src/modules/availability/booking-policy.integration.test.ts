import { and, desc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { auditLogs, siteSettings } from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import {
  getAdminBookingPolicy,
  updateAdminBookingPolicy,
} from "./booking-policy.service.js";

const now = new Date("2026-08-05T09:00:00.000Z");

describe.sequential("admin booking policy", () => {
  it("returns the safe default only when the singleton has not been created", async () => {
    await getTestDatabase().db.delete(siteSettings);

    await expect(getAdminBookingPolicy(now)).resolves.toEqual({
      bookingMinimumAdvanceDays: 1,
      bookingDefaultTimezone: "Africa/Cairo",
      localToday: "2026-08-05",
      earliestBookableDate: "2026-08-06",
      updatedAt: null,
    });
  });

  it("updates the singleton and writes one audit event in the same operation", async () => {
    await getTestDatabase().db.delete(siteSettings);

    const updated = await updateAdminBookingPolicy(
      {
        bookingMinimumAdvanceDays: 2,
        bookingDefaultTimezone: "Africa/Cairo",
      },
      { ipAddress: "127.0.0.1" },
      now,
    );

    expect(updated).toMatchObject({
      bookingMinimumAdvanceDays: 2,
      bookingDefaultTimezone: "Africa/Cairo",
      localToday: "2026-08-05",
      earliestBookableDate: "2026-08-07",
    });
    const settings = await getTestDatabase().db.select().from(siteSettings);
    expect(settings).toHaveLength(1);
    expect(settings[0]).toMatchObject({
      settingsKey: "global",
      bookingMinimumAdvanceDays: 2,
      bookingDefaultTimezone: "Africa/Cairo",
    });
    const logs = await getTestDatabase().db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "admin.booking_policy.update"),
          eq(auditLogs.resourceId, settings[0]!.id),
        ),
      )
      .orderBy(desc(auditLogs.createdAt));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      resourceType: "site_settings",
      ipAddress: "127.0.0.1",
      beforeSnapshot: {
        bookingMinimumAdvanceDays: 1,
        bookingDefaultTimezone: "Africa/Cairo",
      },
      afterSnapshot: {
        bookingMinimumAdvanceDays: 2,
        bookingDefaultTimezone: "Africa/Cairo",
      },
    });
  });

  it("rejects an invalid day range or timezone with field details", async () => {
    await expect(
      updateAdminBookingPolicy({
        bookingMinimumAdvanceDays: 0,
        bookingDefaultTimezone: "Cairo-ish",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      statusCode: 400,
      details: [
        { field: "bookingMinimumAdvanceDays" },
        { field: "bookingDefaultTimezone" },
      ],
    });
  });
});
