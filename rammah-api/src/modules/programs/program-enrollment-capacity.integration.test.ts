import { describe, expect, it } from "vitest";
import {
  bookings,
  offerings,
  scheduledProgramOccurrences,
  scheduledPrograms,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import { createSlotHold } from "../availability/slot-holds.service.js";
import { buildPublicBookingCalendar } from "../bookings/public-bookings.service.js";

const seedProgram = async (input: {
  capacity: number;
  startsAt: string;
  endsAt: string;
  secondStartsAt?: string;
  secondEndsAt?: string;
}) => {
  const { db } = getTestDatabase();
  const [offering] = await db.insert(offerings).values({
    title: "Enrollment target",
    slug: `enrollment-${crypto.randomUUID()}`,
    offeringType: "course",
    attendanceMode: "online",
    bookingMode: "free",
    schedulingMode: "scheduled_program",
    durationMinutes: null,
    status: "published",
  }).returning();
  const [program] = await db.insert(scheduledPrograms).values({
    offeringId: offering!.id,
    title: "Complete cohort",
    timezone: "Africa/Cairo",
    attendanceMode: "online",
    capacity: input.capacity,
    status: "published",
  }).returning();
  await db.insert(scheduledProgramOccurrences).values([
    {
      scheduledProgramId: program!.id,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      timezone: "Africa/Cairo",
      attendanceMode: "online",
      sortOrder: 0,
    },
    ...(input.secondStartsAt && input.secondEndsAt
      ? [{
          scheduledProgramId: program!.id,
          startsAt: new Date(input.secondStartsAt),
          endsAt: new Date(input.secondEndsAt),
          timezone: "Africa/Cairo",
          attendanceMode: "online" as const,
          sortOrder: 1,
        }]
      : []),
  ]);
  return { offering: offering!, program: program! };
};

describe.sequential("canonical Program enrollment capacity", () => {
  it("uses one hold and one seat for the complete multi-occurrence Program", async () => {
    const { offering, program } = await seedProgram({
      capacity: 1,
      startsAt: "2030-10-10T16:00:00.000Z",
      endsAt: "2030-10-10T18:00:00.000Z",
      secondStartsAt: "2030-10-12T16:00:00.000Z",
      secondEndsAt: "2030-10-12T18:00:00.000Z",
    });
    const input = {
      offeringId: offering.id,
      target: { kind: "scheduled_program" as const, scheduledProgramId: program.id },
    };

    await expect(createSlotHold(input)).resolves.toMatchObject({
      scheduledProgramId: program.id,
      target: {
        kind: "scheduled_program",
        startsAt: "2030-10-10T16:00:00.000Z",
        endsAt: "2030-10-12T18:00:00.000Z",
      },
    });
    await expect(createSlotHold(input)).rejects.toMatchObject({ code: "PROGRAM_FULL" });
  });

  it("rejects enrollment when another published Program already blocks an occurrence", async () => {
    const first = await seedProgram({
      capacity: 4,
      startsAt: "2030-11-10T16:00:00.000Z",
      endsAt: "2030-11-10T18:00:00.000Z",
    });
    await seedProgram({
      capacity: 4,
      startsAt: "2030-11-10T17:00:00.000Z",
      endsAt: "2030-11-10T19:00:00.000Z",
    });

    await expect(
      createSlotHold({
        offeringId: first.offering.id,
        target: { kind: "scheduled_program", scheduledProgramId: first.program.id },
      }),
    ).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
  });

  it("downloads one calendar containing every occurrence in the enrollment", async () => {
    const { offering, program } = await seedProgram({
      capacity: 4,
      startsAt: "2030-12-10T16:00:00.000Z",
      endsAt: "2030-12-10T18:00:00.000Z",
      secondStartsAt: "2030-12-12T16:00:00.000Z",
      secondEndsAt: "2030-12-12T18:00:00.000Z",
    });
    const [booking] = await getTestDatabase().db.insert(bookings).values({
      offeringId: offering.id,
      scheduledProgramId: program.id,
      attendanceMode: "online",
      status: "confirmed",
      customerFullName: "Calendar customer",
      customerEmail: "calendar@example.test",
      timezone: "Africa/Cairo",
    }).returning();

    const calendar = await buildPublicBookingCalendar(booking!.publicToken);

    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(calendar).toContain("DTSTART:20301210T160000Z");
    expect(calendar).toContain("DTSTART:20301212T160000Z");
  });
});
