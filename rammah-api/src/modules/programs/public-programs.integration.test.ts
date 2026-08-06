import { describe, expect, it, vi } from "vitest";
import {
  bookingSlotHolds,
  bookings,
  offerings,
  scheduledProgramOccurrences,
  scheduledPrograms,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import { listPublicPrograms } from "./public-programs.service.js";

const seedPublicProgram = async (capacity = 2) => {
  const { db } = getTestDatabase();
  const [offering] = await db.insert(offerings).values({
    title: "Public course",
    slug: `public-course-${crypto.randomUUID()}`,
    offeringType: "course",
    attendanceMode: "online",
    bookingMode: "free",
    schedulingMode: "scheduled_program",
    durationMinutes: null,
    status: "published",
  }).returning();
  const [program] = await db.insert(scheduledPrograms).values({
    offeringId: offering!.id,
    title: "September cohort",
    timezone: "Africa/Cairo",
    attendanceMode: "online",
    capacity,
    registrationOpensAt: new Date("2030-08-01T00:00:00.000Z"),
    registrationClosesAt: new Date("2030-09-01T00:00:00.000Z"),
    status: "published",
  }).returning();
  await db.insert(scheduledProgramOccurrences).values([
    {
      scheduledProgramId: program!.id,
      startsAt: new Date("2030-09-12T16:00:00.000Z"),
      endsAt: new Date("2030-09-12T18:00:00.000Z"),
      timezone: "Africa/Cairo",
      attendanceMode: "online",
      sortOrder: 1,
    },
    {
      scheduledProgramId: program!.id,
      startsAt: new Date("2030-09-10T16:00:00.000Z"),
      endsAt: new Date("2030-09-10T18:00:00.000Z"),
      timezone: "Africa/Cairo",
      attendanceMode: "online",
      sortOrder: 0,
    },
  ]);
  return { offering: offering!, program: program! };
};

describe.sequential("public Programs", () => {
  it("returns one enrollment target with ordered occurrences and live capacity", async () => {
    vi.setSystemTime(new Date("2030-08-15T10:00:00.000Z"));
    const { offering, program } = await seedPublicProgram(2);
    const { db } = getTestDatabase();
    await db.insert(bookings).values({
      offeringId: offering.id,
      scheduledProgramId: program.id,
      attendanceMode: "online",
      status: "confirmed",
      customerFullName: "First seat",
      customerEmail: "seat@example.test",
      timezone: "Africa/Cairo",
    });
    await db.insert(bookingSlotHolds).values({
      offeringId: offering.id,
      scheduledProgramId: program.id,
      status: "expired",
      expiresAt: new Date("2030-08-15T09:00:00.000Z"),
    });

    const result = await listPublicPrograms({
      offeringId: offering.id,
      dateFrom: "2030-09-01",
      dateTo: "2030-09-30",
      locale: "ar",
    });

    expect(result.programs).toHaveLength(1);
    expect(result.programs[0]).toMatchObject({
      id: program.id,
      status: "available",
      remainingCapacity: 1,
      bookedCount: 1,
      heldCount: 0,
    });
    expect(result.programs[0]!.occurrences.map(({ startsAt }) => startsAt)).toEqual([
      "2030-09-10T16:00:00.000Z",
      "2030-09-12T16:00:00.000Z",
    ]);
  });

  it("marks a Program full when bookings and active holds consume capacity", async () => {
    vi.setSystemTime(new Date("2030-08-15T10:00:00.000Z"));
    const { offering, program } = await seedPublicProgram(1);
    await getTestDatabase().db.insert(bookingSlotHolds).values({
      offeringId: offering.id,
      scheduledProgramId: program.id,
      status: "active",
      expiresAt: new Date("2030-08-15T10:10:00.000Z"),
    });

    const result = await listPublicPrograms({
      offeringId: offering.id,
      dateFrom: "2030-09-01",
      dateTo: "2030-09-30",
      locale: "en",
    });
    expect(result.programs[0]).toMatchObject({ status: "full", remainingCapacity: 0 });
  });

  it("excludes Programs before registration opens or after registration closes", async () => {
    const { offering } = await seedPublicProgram();
    vi.setSystemTime(new Date("2030-07-15T10:00:00.000Z"));
    await expect(listPublicPrograms({
      offeringId: offering.id,
      dateFrom: "2030-09-01",
      dateTo: "2030-09-30",
      locale: "en",
    })).resolves.toMatchObject({ programs: [] });

    vi.setSystemTime(new Date("2030-09-02T10:00:00.000Z"));
    await expect(listPublicPrograms({
      offeringId: offering.id,
      dateFrom: "2030-09-01",
      dateTo: "2030-09-30",
      locale: "en",
    })).resolves.toMatchObject({ programs: [] });
  });
});
