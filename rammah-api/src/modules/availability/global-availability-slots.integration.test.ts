import { describe, expect, it } from "vitest";
import {
  availabilityWindows,
  bookings,
  globalAvailabilityOverrides,
  offerings,
  scheduledProgramOccurrences,
  scheduledPrograms,
  siteSettings,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import { previewAvailabilitySlots } from "./availability-slots.service.js";

const seedSettings = async () => {
  const { db } = getTestDatabase();
  await db.insert(siteSettings).values({
    siteName: "Rammah",
    bookingDefaultTimezone: "Africa/Cairo",
  });
};

const seedOffering = async (
  values: Partial<typeof offerings.$inferInsert> = {},
) => {
  const { db } = getTestDatabase();
  const [offering] = await db
    .insert(offerings)
    .values({
      title: "Global appointment",
      slug: `global-appointment-${crypto.randomUUID()}`,
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode: "free",
      schedulingMode: "appointment",
      durationMinutes: 60,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      capacity: 1,
      status: "published",
      ...values,
    })
    .returning();
  return offering!;
};

const seedThursdayWindows = async () => {
  const { db } = getTestDatabase();
  await db.insert(availabilityWindows).values([
    {
      weekday: 4,
      startLocalTime: "09:00",
      endLocalTime: "13:00",
      status: "published",
    },
    {
      weekday: 4,
      startLocalTime: "14:00",
      endLocalTime: "22:00",
      status: "published",
    },
  ]);
};

describe.sequential("global appointment slot preview", () => {
  it("combines all global windows and derives slot controls from the Offering", async () => {
    await seedSettings();
    const offering = await seedOffering();
    await seedThursdayWindows();

    const preview = await previewAvailabilitySlots({
      offeringId: offering.id,
      dateFrom: "2030-08-08",
      dateTo: "2030-08-08",
    });

    expect(preview.timezone).toBe("Africa/Cairo");
    expect(preview.days[0]?.slots).toHaveLength(12);
    expect(preview.days[0]?.slots.map(({ startsAt }) => startsAt)).toEqual(
      [...preview.days[0]!.slots].map(({ startsAt }) => startsAt).sort(),
    );
  });

  it("closes a complete local date with an unavailable override", async () => {
    const { db } = getTestDatabase();
    await seedSettings();
    const offering = await seedOffering();
    await seedThursdayWindows();
    await db.insert(globalAvailabilityOverrides).values({
      date: "2030-08-08",
      overrideMode: "unavailable",
      reason: "Holiday",
    });

    const preview = await previewAvailabilitySlots({
      offeringId: offering.id,
      dateFrom: "2030-08-08",
      dateTo: "2030-08-08",
    });

    expect(preview.days[0]?.slots).toEqual([]);
  });

  it("rejects preview for a scheduled-program Offering", async () => {
    await seedSettings();
    const offering = await seedOffering({
      schedulingMode: "scheduled_program",
      durationMinutes: null,
    });

    await expect(
      previewAvailabilitySlots({
        offeringId: offering.id,
        dateFrom: "2030-08-08",
        dateTo: "2030-08-08",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("shows published Program occurrences as read-only blockers", async () => {
    const { db } = getTestDatabase();
    await seedSettings();
    const appointment = await seedOffering();
    const programOffering = await seedOffering({
      title: "Workshop",
      schedulingMode: "scheduled_program",
      durationMinutes: null,
    });
    await seedThursdayWindows();
    const [program] = await db
      .insert(scheduledPrograms)
      .values({
        offeringId: programOffering.id,
        title: "Leadership workshop",
        timezone: "Africa/Cairo",
        attendanceMode: "online",
        capacity: 20,
        status: "published",
      })
      .returning();
    await db.insert(scheduledProgramOccurrences).values([
      {
        scheduledProgramId: program!.id,
        startsAt: new Date("2030-08-08T06:00:00.000Z"),
        endsAt: new Date("2030-08-08T07:00:00.000Z"),
        timezone: "Africa/Cairo",
        attendanceMode: "online",
      },
      {
        scheduledProgramId: program!.id,
        startsAt: new Date("2030-08-07T06:00:00.000Z"),
        endsAt: new Date("2030-08-07T07:00:00.000Z"),
        timezone: "Africa/Cairo",
        attendanceMode: "online",
      },
    ]);

    const preview = await previewAvailabilitySlots({
      offeringId: appointment.id,
      dateFrom: "2030-08-08",
      dateTo: "2030-08-08",
    });

    expect(preview.programBlockers).toEqual([
      expect.objectContaining({
        programId: program!.id,
        title: "Leadership workshop",
        readOnly: true,
      }),
    ]);
    expect(preview.days[0]?.slots[0]).toMatchObject({
      status: "blocked",
      blockedReason: "Program: Leadership workshop",
    });
  });

  it("blocks a different overlapping appointment schedule group globally", async () => {
    const { db } = getTestDatabase();
    await seedSettings();
    const selected = await seedOffering();
    const occupiedOffering = await seedOffering({ title: "Occupied appointment" });
    await seedThursdayWindows();
    await db.insert(bookings).values({
      bookingReference: `BK-${crypto.randomUUID().slice(0, 12)}`,
      offeringId: occupiedOffering.id,
      attendanceMode: "online",
      slotStartAt: new Date("2030-08-08T06:00:00.000Z"),
      slotEndAt: new Date("2030-08-08T07:00:00.000Z"),
      timezone: "Africa/Cairo",
      customerFullName: "Test Customer",
      customerEmail: "test@example.com",
      status: "confirmed",
    });

    const preview = await previewAvailabilitySlots({
      offeringId: selected.id,
      dateFrom: "2030-08-08",
      dateTo: "2030-08-08",
    });

    expect(preview.days[0]?.slots[0]).toMatchObject({
      status: "blocked",
      blockedReason: "Another appointment is scheduled at this time.",
    });
  });
});
