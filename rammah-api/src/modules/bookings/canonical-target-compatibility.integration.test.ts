import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  availabilityRules,
  bookingSlotHolds,
  bookings,
  offeringPrices,
  offeringPriceCountries,
  offeringSessions,
  offerings,
  scheduledProgramOccurrences,
  scheduledPrograms,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import { createSlotHold } from "../availability/slot-holds.service.js";
import { createPaidBookingFromHold } from "../payments/public-payments.repository.js";
import { createFreeBookingFromHold } from "./public-bookings.repository.js";

const startsAt = new Date("2032-08-12T07:00:00.000Z");
const endsAt = new Date("2032-08-12T10:00:00.000Z");

const seedOffering = async (input: {
  schedulingMode: "appointment" | "scheduled_program";
  bookingMode?: "free" | "paid";
  capacity?: number;
}) => {
  const { db } = getTestDatabase();
  const bookingMode = input.bookingMode ?? "free";
  const [offering] = await db
    .insert(offerings)
    .values({
      title: `Canonical ${input.schedulingMode}`,
      slug: `canonical-${input.schedulingMode}-${randomUUID()}`,
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode,
      schedulingMode: input.schedulingMode,
      durationMinutes: input.schedulingMode === "appointment" ? 60 : null,
      capacity: input.capacity ?? 1,
      requiresPayment: bookingMode === "paid",
      status: "published",
    })
    .returning();

  if (bookingMode === "paid") {
    const [price] = await db.insert(offeringPrices).values({
      offeringId: offering!.id,
      name: "Egypt",
      countryCode: "EG",
      currency: "EGP",
      baseAmountMinor: 10_000,
      status: "published",
    }).returning({ id: offeringPrices.id });
    await db.insert(offeringPriceCountries).values({
      priceId: price!.id,
      offeringId: offering!.id,
      countryCode: "EG",
      active: true,
    });
  }

  return offering!;
};

const seedProgram = async (input: {
  bookingMode?: "free" | "paid";
  capacity?: number;
  legacyAdapter?: boolean;
}) => {
  const { db } = getTestDatabase();
  const offering = await seedOffering({
    schedulingMode: "scheduled_program",
    bookingMode: input.bookingMode,
    capacity: input.capacity,
  });
  const programId = randomUUID();
  const [program] = await db
    .insert(scheduledPrograms)
    .values({
      id: programId,
      offeringId: offering.id,
      title: "Canonical Program",
      timezone: "Africa/Cairo",
      attendanceMode: "online",
      capacity: input.capacity ?? 1,
      status: "published",
    })
    .returning();
  await db.insert(scheduledProgramOccurrences).values([
    {
      id: input.legacyAdapter ? programId : randomUUID(),
      scheduledProgramId: programId,
      startsAt,
      endsAt,
      timezone: "Africa/Cairo",
      attendanceMode: "online",
      status: "scheduled",
    },
    {
      scheduledProgramId: programId,
      startsAt: new Date("2032-08-13T07:00:00.000Z"),
      endsAt: new Date("2032-08-13T10:00:00.000Z"),
      timezone: "Africa/Cairo",
      attendanceMode: "online",
      sortOrder: 1,
      status: "scheduled",
    },
  ]);

  if (input.legacyAdapter) {
    await db.insert(offeringSessions).values({
      id: programId,
      offeringId: offering.id,
      startsAt,
      endsAt,
      timezone: "Africa/Cairo",
      capacity: input.capacity ?? 1,
      attendanceMode: "online",
      status: "published",
    });
  }

  return { offering, program: program! };
};

const programTarget = (offeringId: string, scheduledProgramId: string) => ({
  offeringId,
  target: {
    kind: "scheduled_program" as const,
    scheduledProgramId,
  },
});

const expectUnavailable = async (promise: Promise<unknown>) => {
  await expect(promise).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
};

describe("canonical hold and booking targets", () => {
  it("rejects a target whose kind does not match the Offering scheduling mode", async () => {
    const { db } = getTestDatabase();
    const offering = await seedOffering({ schedulingMode: "scheduled_program" });
    await db.insert(availabilityRules).values({
      offeringId: offering.id,
      weekday: startsAt.getDay(),
      startTime: "09:00",
      endTime: "13:00",
      timezone: "Africa/Cairo",
      slotDurationMinutes: 60,
      status: "published",
    });

    await expectUnavailable(
      createSlotHold({
        offeringId: offering.id,
        target: {
          kind: "appointment",
          startsAt: startsAt.toISOString(),
          endsAt: new Date("2032-08-12T08:00:00.000Z").toISOString(),
        },
      }),
    );
  });

  it("maps a recognized legacy session without trusting its timestamps", async () => {
    const { offering, program } = await seedProgram({ legacyAdapter: true });
    const hold = await createSlotHold({
      offeringId: offering.id,
      offeringSessionId: program.id,
      startsAt: "2035-01-01T00:00:00.000Z",
      endsAt: "2035-01-01T01:00:00.000Z",
    });

    expect(hold.target).toEqual({
      kind: "scheduled_program",
      scheduledProgramId: program.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date("2032-08-13T10:00:00.000Z").toISOString(),
      timezone: "Africa/Cairo",
    });
  });

  it("rejects an unrecognized legacy session ID", async () => {
    const offering = await seedOffering({ schedulingMode: "scheduled_program" });
    await expectUnavailable(
      createSlotHold({
        offeringId: offering.id,
        offeringSessionId: randomUUID(),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      }),
    );
  });

  it("serializes parallel Program holds at the exact Program capacity", async () => {
    const { offering, program } = await seedProgram({ capacity: 2 });
    const attempts = await Promise.allSettled([
      createSlotHold(programTarget(offering.id, program.id)),
      createSlotHold(programTarget(offering.id, program.id)),
      createSlotHold(programTarget(offering.id, program.id)),
    ]);

    expect(attempts.filter(({ status }) => status === "fulfilled")).toHaveLength(2);
    expect(attempts.filter(({ status }) => status === "rejected")).toHaveLength(1);
  });

  it("treats Program occurrences as part of the global appointment schedule", async () => {
    const { db } = getTestDatabase();
    const programTargetSeed = await seedProgram({ capacity: 2 });
    await createSlotHold(
      programTarget(programTargetSeed.offering.id, programTargetSeed.program.id),
    );
    const appointmentOffering = await seedOffering({ schedulingMode: "appointment" });
    await db.insert(availabilityRules).values({
      offeringId: appointmentOffering.id,
      weekday: startsAt.getDay(),
      startTime: "09:00",
      endTime: "13:00",
      timezone: "Africa/Cairo",
      slotDurationMinutes: 60,
      status: "published",
    });

    await expectUnavailable(
      createSlotHold({
        offeringId: appointmentOffering.id,
        target: {
          kind: "appointment",
          startsAt: startsAt.toISOString(),
          endsAt: new Date("2032-08-12T08:00:00.000Z").toISOString(),
        },
      }),
    );
  });

  it.each(["free", "paid"] as const)(
    "copies a canonical Program hold into a %s booking with null slot columns",
    async (bookingMode) => {
      const { db } = getTestDatabase();
      const { offering, program } = await seedProgram({ bookingMode });
      const hold = await createSlotHold(programTarget(offering.id, program.id));

      if (bookingMode === "free") {
        await createFreeBookingFromHold({
          holdId: hold.id,
          holdToken: hold.holdToken,
          attendanceMode: "online",
          customerFullName: "Canonical Free",
          customerEmail: "canonical-free@example.test",
          timezone: "UTC",
          answers: [],
        });
      } else {
        const [price] = await db
          .select({ id: offeringPrices.id })
          .from(offeringPrices)
          .where(eq(offeringPrices.offeringId, offering.id));
        await createPaidBookingFromHold({
          holdId: hold.id,
          holdToken: hold.holdToken,
          attendanceMode: "online",
          customerFullName: "Canonical Paid",
          customerEmail: "canonical-paid@example.test",
          timezone: "UTC",
          answers: [],
          detectedCountryCode: "EG",
          expectedPrice: {
            priceId: price!.id,
            countryCode: "EG",
            currency: "EGP",
            baseAmountMinor: 10_000,
            discountAmountMinor: 0,
            taxAmountMinor: 0,
            totalAmountMinor: 10_000,
          },
          payment: {
            provider: "mock",
            idempotencyKey: `canonical-${randomUUID()}`,
          },
        });
      }

      const [storedHold] = await db
        .select()
        .from(bookingSlotHolds)
        .where(eq(bookingSlotHolds.id, hold.id));
      const [booking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.scheduledProgramId, program.id));

      expect(storedHold).toMatchObject({
        scheduledProgramId: program.id,
        slotStartAt: null,
        slotEndAt: null,
        status: "converted",
      });
      expect(booking).toMatchObject({
        scheduledProgramId: program.id,
        slotStartAt: null,
        slotEndAt: null,
        timezone: "Africa/Cairo",
      });
    },
  );
});
