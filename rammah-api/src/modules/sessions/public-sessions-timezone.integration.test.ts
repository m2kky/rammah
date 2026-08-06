import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "../../config/env.js";
import {
  availabilityWindows,
  bookings,
  offerings,
  scheduledProgramOccurrences,
  scheduledPrograms,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import { createSlotHold } from "../availability/slot-holds.service.js";
import { listAdminSessions } from "./admin-sessions.service.js";
import { listPublicOfferingSessions } from "./public-sessions.service.js";

const originalProcessTimezone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "UTC";
});

afterAll(() => {
  if (originalProcessTimezone === undefined) {
    delete process.env.TZ;
    return;
  }

  process.env.TZ = originalProcessTimezone;
});

const seedRecurringBoundaryTarget = async () => {
  const { db } = getTestDatabase();
  const [offering] = await db
    .insert(offerings)
    .values({
      title: "Recurring timezone boundary",
      slug: `recurring-timezone-boundary-${crypto.randomUUID()}`,
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode: "free",
      durationMinutes: 60,
      capacity: 1,
      status: "published",
    })
    .returning();

  await db.insert(availabilityWindows).values({
    weekday: 2,
    startLocalTime: "00:30:00",
    endLocalTime: "01:30:00",
    status: "published",
  });

  return offering!;
};

describe("public fixed-session timezone grouping", () => {
  it("includes and groups a Cairo after-midnight session by its local calendar date", async () => {
    const { db } = getTestDatabase();
    const [offering] = await db
      .insert(offerings)
      .values({
        title: "Timezone boundary",
        slug: `timezone-boundary-${crypto.randomUUID()}`,
        offeringType: "coaching",
        attendanceMode: "online",
        bookingMode: "free",
        durationMinutes: 60,
        capacity: 1,
        status: "published",
      })
      .returning();

    const legacySessionId = crypto.randomUUID();
    await db
      .update(offerings)
      .set({ schedulingMode: "scheduled_program", durationMinutes: null })
      .where(eq(offerings.id, offering!.id));
    await db.insert(scheduledPrograms).values({
      id: legacySessionId,
      offeringId: offering!.id,
      title: "Timezone boundary",
      timezone: "Africa/Cairo",
      capacity: 1,
      attendanceMode: "online",
      status: "published",
    });
    await db.insert(scheduledProgramOccurrences).values({
      id: legacySessionId,
      scheduledProgramId: legacySessionId,
      startsAt: new Date("2030-08-12T21:30:00.000Z"),
      endsAt: new Date("2030-08-12T22:30:00.000Z"),
      timezone: "Africa/Cairo",
      attendanceMode: "online",
      status: "scheduled",
    });
    await db.insert(bookings).values({
      offeringId: offering!.id,
      scheduledProgramId: legacySessionId,
      attendanceMode: "online",
      status: "confirmed",
      customerFullName: "Program attendee",
      customerEmail: "program-attendee@example.test",
      slotStartAt: null,
      slotEndAt: null,
      timezone: "Africa/Cairo",
    });

    const result = await listPublicOfferingSessions({
      offeringId: offering!.id,
      dateFrom: "2030-08-13",
      dateTo: "2030-08-13",
    });

    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]).toMatchObject({
      date: "2030-08-13",
      startsAt: "2030-08-12T21:30:00.000Z",
      timezone: "Africa/Cairo",
      scheduledProgramId: legacySessionId,
      status: "booked",
      bookedCount: 1,
      remainingCapacity: 0,
    });

    const adminSessions = await listAdminSessions({ offeringId: offering!.id });
    expect(adminSessions).toHaveLength(1);
    expect(adminSessions[0]).toMatchObject({
      id: legacySessionId,
      scheduledProgramId: legacySessionId,
      startsAt: "2030-08-12T21:30:00.000Z",
    });
  });

  it("accepts an advertised recurring slot whose Cairo date starts on the previous UTC day", async () => {
    const offering = await seedRecurringBoundaryTarget();

    await expect(
      createSlotHold({
        offeringId: offering.id,
        startsAt: "2030-08-12T21:30:00.000Z",
        endsAt: "2030-08-12T22:30:00.000Z",
      }),
    ).resolves.toMatchObject({
      startsAt: "2030-08-12T21:30:00.000Z",
      endsAt: "2030-08-12T22:30:00.000Z",
    });
  });

  it("applies the daily schedule limit to the Cairo date rather than the UTC date", async () => {
    const { db } = getTestDatabase();
    const targetOffering = await seedRecurringBoundaryTarget();

    for (let index = 0; index < env.BOOKING_DAILY_LIMIT; index += 1) {
      const [bookedOffering] = await db
        .insert(offerings)
        .values({
          title: `Previous Cairo day ${index}`,
          slug: `previous-cairo-day-${index}-${crypto.randomUUID()}`,
          offeringType: "coaching",
          attendanceMode: "online",
          bookingMode: "free",
          durationMinutes: 30,
          capacity: 1,
          status: "published",
        })
        .returning();
      const hour = String(7 + index).padStart(2, "0");

      await db.insert(bookings).values({
        offeringId: bookedOffering!.id,
        attendanceMode: "online",
        status: "confirmed",
        customerFullName: `Previous Cairo day ${index}`,
        customerEmail: `previous-${index}-${crypto.randomUUID()}@example.test`,
        slotStartAt: new Date(`2030-08-12T${hour}:00:00.000Z`),
        slotEndAt: new Date(`2030-08-12T${hour}:30:00.000Z`),
        timezone: "Africa/Cairo",
      });
    }

    await expect(
      createSlotHold({
        offeringId: targetOffering.id,
        startsAt: "2030-08-12T21:30:00.000Z",
        endsAt: "2030-08-12T22:30:00.000Z",
      }),
    ).resolves.toMatchObject({ status: "active" });
  });
});
