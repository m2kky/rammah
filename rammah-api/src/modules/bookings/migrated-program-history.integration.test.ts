import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  bookings,
  offerings,
  payments,
  scheduledProgramOccurrences,
  scheduledPrograms,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import { findConfirmedBookingForCalendarSync } from "../calendar/google-calendar.repository.js";
import { findBookingEmailContextById } from "../emails/email.repository.js";
import { getAdminPayment } from "../payments/admin-payments.service.js";
import { getPublicBookingStatus } from "./public-bookings.service.js";

const occurrence = {
  startsAt: new Date("2032-10-05T07:00:00.000Z"),
  endsAt: new Date("2032-10-05T10:00:00.000Z"),
  timezone: "Africa/Cairo",
};
const secondOccurrence = {
  startsAt: new Date("2032-10-06T07:00:00.000Z"),
  endsAt: new Date("2032-10-06T10:00:00.000Z"),
  timezone: "Africa/Cairo",
};

const seedMigratedPaidBooking = async () => {
  const { db } = getTestDatabase();
  const [offering] = await db
    .insert(offerings)
    .values({
      title: "Migrated workshop",
      slug: `migrated-workshop-${randomUUID()}`,
      offeringType: "workshop",
      attendanceMode: "online",
      bookingMode: "paid",
      schedulingMode: "scheduled_program",
      durationMinutes: null,
      capacity: 20,
      requiresPayment: true,
      status: "published",
    })
    .returning();
  const programId = randomUUID();
  await db.insert(scheduledPrograms).values({
    id: programId,
    offeringId: offering!.id,
    title: "October workshop cohort",
    timezone: occurrence.timezone,
    attendanceMode: "online",
    capacity: 20,
    status: "published",
  });
  const [storedOccurrence] = await db
    .insert(scheduledProgramOccurrences)
    .values([
      {
        id: programId,
        scheduledProgramId: programId,
        ...occurrence,
        attendanceMode: "online",
        status: "scheduled",
      },
      {
        scheduledProgramId: programId,
        ...secondOccurrence,
        attendanceMode: "online",
        sortOrder: 1,
        status: "scheduled",
      },
      {
        scheduledProgramId: programId,
        startsAt: new Date("2032-10-04T07:00:00.000Z"),
        endsAt: new Date("2032-10-04T10:00:00.000Z"),
        timezone: occurrence.timezone,
        attendanceMode: "online",
        status: "cancelled",
      },
    ])
    .returning();
  const [booking] = await db
    .insert(bookings)
    .values({
      offeringId: offering!.id,
      scheduledProgramId: programId,
      attendanceMode: "online",
      status: "confirmed",
      customerFullName: "Migrated Customer",
      customerEmail: "migrated@example.test",
      timezone: occurrence.timezone,
      priceCurrency: "EGP",
      baseAmountMinor: 20_000,
      totalAmountMinor: 20_000,
      paymentRequired: true,
      confirmedAt: new Date(),
    })
    .returning();
  const [payment] = await db
    .insert(payments)
    .values({
      bookingId: booking!.id,
      provider: "kashier",
      providerPaymentId: `pay-${randomUUID()}`,
      status: "paid",
      currency: "EGP",
      amountMinor: 20_000,
      idempotencyKey: `migrated-${randomUUID()}`,
      paidAt: new Date(),
    })
    .returning();

  return { booking: booking!, payment: payment!, occurrence: storedOccurrence! };
};

const expectedTarget = (input: Awaited<ReturnType<typeof seedMigratedPaidBooking>>) => ({
  kind: "scheduled_program",
  scheduledProgramId: input.occurrence.scheduledProgramId,
  timezone: occurrence.timezone,
  occurrences: [
    {
      id: input.occurrence.id,
      startsAt: occurrence.startsAt.toISOString(),
      endsAt: occurrence.endsAt.toISOString(),
      timezone: occurrence.timezone,
    },
    {
      startsAt: secondOccurrence.startsAt.toISOString(),
      endsAt: secondOccurrence.endsAt.toISOString(),
      timezone: secondOccurrence.timezone,
    },
  ],
});

describe("migrated Program booking history", () => {
  it("resolves status, payment, email, and calendar consumers from occurrences", async () => {
    const seeded = await seedMigratedPaidBooking();

    await expect(getPublicBookingStatus(seeded.booking.publicToken)).resolves.toMatchObject({
      target: expectedTarget(seeded),
      slot: {
        startsAt: occurrence.startsAt.toISOString(),
        endsAt: occurrence.endsAt.toISOString(),
        timezone: occurrence.timezone,
      },
    });
    await expect(getAdminPayment(seeded.payment.id)).resolves.toMatchObject({
      booking: { target: expectedTarget(seeded) },
    });
    await expect(findBookingEmailContextById(seeded.booking.id)).resolves.toMatchObject({
      target: expect.objectContaining({
        kind: "scheduled_program",
        scheduledProgramId: seeded.occurrence.scheduledProgramId,
      }),
      slotStartAt: occurrence.startsAt,
      slotEndAt: occurrence.endsAt,
      timezone: occurrence.timezone,
    });
    await expect(findConfirmedBookingForCalendarSync(seeded.booking.id)).resolves.toMatchObject({
      target: expect.objectContaining({
        kind: "scheduled_program",
        scheduledProgramId: seeded.occurrence.scheduledProgramId,
      }),
      slotStartAt: occurrence.startsAt,
      slotEndAt: occurrence.endsAt,
      timezone: occurrence.timezone,
    });
  });
});
