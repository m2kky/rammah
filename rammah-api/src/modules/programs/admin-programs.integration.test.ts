import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  bookings,
  externalCalendarBusyBlocks,
  offerings,
  scheduledPrograms,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import {
  createAdminProgram,
  deleteOrArchiveAdminProgramById,
  publishAdminProgramById,
  updateAdminProgramById,
} from "./admin-programs.service.js";

const seedOffering = async (status: "draft" | "published" = "published") => {
  const { db } = getTestDatabase();
  const [offering] = await db
    .insert(offerings)
    .values({
      title: "Leadership program",
      slug: `leadership-${crypto.randomUUID()}`,
      offeringType: "course",
      attendanceMode: "online",
      bookingMode: "free",
      schedulingMode: "scheduled_program",
      durationMinutes: null,
      status,
    })
    .returning();
  return offering!;
};

const inputFor = (offeringId: string) => ({
  offeringId,
  title: "August leadership cohort",
  timezone: "Africa/Cairo",
  attendanceMode: "online" as const,
  locationId: null,
  capacity: 12,
  registrationOpensAt: "2030-07-01T00:00:00.000Z",
  registrationClosesAt: "2030-08-09T00:00:00.000Z",
  occurrences: [
    {
      startsAt: "2030-08-12T16:00:00.000Z",
      endsAt: "2030-08-12T18:00:00.000Z",
      timezone: "Africa/Cairo",
      attendanceMode: "online" as const,
      locationId: null,
      status: "scheduled" as const,
    },
    {
      startsAt: "2030-08-10T16:00:00.000Z",
      endsAt: "2030-08-10T18:00:00.000Z",
      timezone: "Africa/Cairo",
      attendanceMode: "online" as const,
      locationId: null,
      status: "scheduled" as const,
    },
  ],
});

describe.sequential("admin Programs", () => {
  it("creates a draft Program and returns occurrences in chronological order", async () => {
    const offering = await seedOffering();

    const program = await createAdminProgram(inputFor(offering.id));

    expect(program.status).toBe("draft");
    expect(program.occurrences.map(({ startsAt }) => startsAt)).toEqual([
      "2030-08-10T16:00:00.000Z",
      "2030-08-12T16:00:00.000Z",
    ]);
    expect(program.capacity).toEqual({ total: 12, booked: 0, held: 0, remaining: 12 });
    expect(program.allowedActions).toEqual({ edit: true, publish: true, archive: false, delete: true });
  });

  it("validates IANA timezones and the registration deadline against the first occurrence", async () => {
    const offering = await seedOffering();

    await expect(
      createAdminProgram({ ...inputFor(offering.id), timezone: "Cairo-ish" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      createAdminProgram({
        ...inputFor(offering.id),
        registrationClosesAt: "2030-08-11T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("publishes only against a published scheduled-program Offering", async () => {
    const draftOffering = await seedOffering("draft");
    const program = await createAdminProgram(inputFor(draftOffering.id));

    await expect(publishAdminProgramById(program.id)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    const { db } = getTestDatabase();
    await db.update(offerings).set({ status: "published" }).where(eq(offerings.id, draftOffering.id));
    await expect(publishAdminProgramById(program.id)).resolves.toMatchObject({
      status: "published",
      allowedActions: { edit: true, publish: false, archive: true, delete: false },
    });
  });

  it("blocks publication when an occurrence conflicts with the coach calendar", async () => {
    const offering = await seedOffering();
    const program = await createAdminProgram(inputFor(offering.id));
    const { db } = getTestDatabase();
    await db.insert(externalCalendarBusyBlocks).values({
      startsAt: new Date("2030-08-10T17:00:00.000Z"),
      endsAt: new Date("2030-08-10T19:00:00.000Z"),
      status: "published",
    });

    await expect(publishAdminProgramById(program.id)).rejects.toMatchObject({
      code: "SCHEDULE_CONFLICT",
    });
  });

  it("requires published schedule edits to remain conflict-free", async () => {
    const offering = await seedOffering();
    const program = await createAdminProgram(inputFor(offering.id));
    const published = await publishAdminProgramById(program.id);
    const appointmentOffering = await getTestDatabase().db
      .insert(offerings)
      .values({
        title: "Appointment",
        slug: `appointment-${crypto.randomUUID()}`,
        offeringType: "coaching",
        attendanceMode: "online",
        bookingMode: "free",
        schedulingMode: "appointment",
        durationMinutes: 60,
        status: "published",
      })
      .returning();
    await getTestDatabase().db.insert(bookings).values({
      offeringId: appointmentOffering[0]!.id,
      attendanceMode: "online",
      status: "confirmed",
      customerFullName: "Busy client",
      customerEmail: "busy@example.test",
      slotStartAt: new Date("2030-08-14T16:00:00.000Z"),
      slotEndAt: new Date("2030-08-14T17:00:00.000Z"),
      timezone: "Africa/Cairo",
    });

    await expect(
      updateAdminProgramById(published.id, {
        occurrences: [
          ...published.occurrences,
          {
            startsAt: "2030-08-14T16:00:00.000Z",
            endsAt: "2030-08-14T18:00:00.000Z",
            timezone: "Africa/Cairo",
            attendanceMode: "online",
            locationId: null,
            status: "scheduled",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "SCHEDULE_CONFLICT" });
  });

  it("deletes an unused draft and archives a Program with enrollment history", async () => {
    const offering = await seedOffering();
    const unused = await createAdminProgram(inputFor(offering.id));
    await expect(deleteOrArchiveAdminProgramById(unused.id)).resolves.toMatchObject({ action: "deleted" });

    const used = await createAdminProgram(inputFor(offering.id));
    await getTestDatabase().db.insert(bookings).values({
      offeringId: offering.id,
      scheduledProgramId: used.id,
      attendanceMode: "online",
      status: "confirmed",
      customerFullName: "Enrolled client",
      customerEmail: "enrolled@example.test",
      timezone: "Africa/Cairo",
    });
    await expect(deleteOrArchiveAdminProgramById(used.id)).resolves.toMatchObject({
      action: "archived",
      data: { status: "archived" },
    });
    const [stored] = await getTestDatabase().db
      .select()
      .from(scheduledPrograms)
      .where(eq(scheduledPrograms.id, used.id));
    expect(stored?.status).toBe("archived");
  });
});
