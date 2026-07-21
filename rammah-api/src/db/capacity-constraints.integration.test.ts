import { describe, expect, it } from "vitest";
import {
  availabilityOverrides,
  availabilityRules,
  bookingSlotHolds,
  bookings,
  offeringSessions,
  offerings,
  payments,
} from "./schema/index.js";
import { getTestDatabase } from "../test/db.js";

const seedOffering = async () => {
  const { db } = getTestDatabase();
  const [offering] = await db
    .insert(offerings)
    .values({
      title: "Constraint parent",
      slug: `constraint-${crypto.randomUUID()}`,
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode: "free",
      durationMinutes: 60,
      capacity: 1,
      status: "published",
    })
    .returning();
  return offering!;
};

const seedBooking = async () => {
  const { db } = getTestDatabase();
  const offering = await seedOffering();
  const [booking] = await db
    .insert(bookings)
    .values({
      offeringId: offering.id,
      attendanceMode: "online",
      customerFullName: "Constraint Test",
      customerEmail: `${crypto.randomUUID()}@example.test`,
      timezone: "Africa/Cairo",
    })
    .returning();
  return { offering, booking: booking! };
};

describe.sequential("capacity-core database constraints", () => {
  it("rejects non-positive offering capacity", async () => {
    const { db } = getTestDatabase();
    await expect(
      db.insert(offerings).values({
        title: "Invalid capacity",
        slug: `invalid-capacity-${crypto.randomUUID()}`,
        offeringType: "coaching",
        attendanceMode: "online",
        bookingMode: "free",
        durationMinutes: 60,
        capacity: 0,
      }),
    ).rejects.toThrow();
  });

  it("rejects non-positive fixed-session capacity", async () => {
    const { db } = getTestDatabase();
    const offering = await seedOffering();
    await expect(
      db.insert(offeringSessions).values({
        offeringId: offering.id,
        startsAt: new Date("2030-08-05T07:00:00.000Z"),
        endsAt: new Date("2030-08-05T08:00:00.000Z"),
        capacity: 0,
        attendanceMode: "online",
      }),
    ).rejects.toThrow();
  });

  it.each([
    ["slot duration", { slotDurationMinutes: 0 }],
    ["buffer before", { bufferBeforeMinutes: -1 }],
    ["buffer after", { bufferAfterMinutes: -1 }],
  ] as const)("rejects invalid rule %s", async (_label, invalid) => {
    const { db } = getTestDatabase();
    const offering = await seedOffering();
    await expect(
      db.insert(availabilityRules).values({
        offeringId: offering.id,
        weekday: 1,
        startTime: "09:00",
        endTime: "11:00",
        timezone: "Africa/Cairo",
        slotDurationMinutes: 60,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        ...invalid,
      }),
    ).rejects.toThrow();
  });

  it("permits the historical both-null booking interval", async () => {
    await expect(seedBooking()).resolves.toBeDefined();
  });

  it.each([
    [new Date("2030-08-05T08:00:00.000Z"), new Date("2030-08-05T08:00:00.000Z")],
    [new Date("2030-08-05T09:00:00.000Z"), new Date("2030-08-05T08:00:00.000Z")],
    [new Date("2030-08-05T08:00:00.000Z"), null],
    [null, new Date("2030-08-05T09:00:00.000Z")],
  ])("rejects an invalid booking interval", async (slotStartAt, slotEndAt) => {
    const { db } = getTestDatabase();
    const offering = await seedOffering();
    await expect(
      db.insert(bookings).values({
        offeringId: offering.id,
        attendanceMode: "online",
        customerFullName: "Invalid interval",
        customerEmail: `${crypto.randomUUID()}@example.test`,
        slotStartAt,
        slotEndAt,
        timezone: "Africa/Cairo",
      }),
    ).rejects.toThrow();
  });

  it("rejects an invalid hold interval", async () => {
    const { db } = getTestDatabase();
    const offering = await seedOffering();
    const instant = new Date("2030-08-05T08:00:00.000Z");
    await expect(
      db.insert(bookingSlotHolds).values({
        offeringId: offering.id,
        slotStartAt: instant,
        slotEndAt: instant,
        expiresAt: new Date("2030-08-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  it.each([
    [new Date("2030-08-05T08:00:00.000Z"), new Date("2030-08-05T08:00:00.000Z")],
    [new Date("2030-08-05T08:00:00.000Z"), null],
    [null, new Date("2030-08-05T09:00:00.000Z")],
  ])("rejects an invalid override window", async (startsAt, endsAt) => {
    const { db } = getTestDatabase();
    const offering = await seedOffering();
    await expect(
      db.insert(availabilityOverrides).values({
        offeringId: offering.id,
        date: "2030-08-05",
        overrideType: "blocked",
        startsAt,
        endsAt,
      }),
    ).rejects.toThrow();
  });

  it("permits a both-null override window", async () => {
    const { db } = getTestDatabase();
    const offering = await seedOffering();
    await expect(
      db.insert(availabilityOverrides).values({
        offeringId: offering.id,
        date: "2030-08-05",
        overrideType: "blocked",
        startsAt: null,
        endsAt: null,
      }),
    ).resolves.toBeDefined();
  });

  it.each([
    ["baseAmountMinor", { baseAmountMinor: -1 }],
    ["discountAmountMinor", { discountAmountMinor: -1 }],
    ["taxAmountMinor", { taxAmountMinor: -1 }],
    ["totalAmountMinor", { totalAmountMinor: -1 }],
  ] as const)("rejects negative booking %s", async (_field, invalid) => {
    const { db } = getTestDatabase();
    const offering = await seedOffering();
    await expect(
      db.insert(bookings).values({
        offeringId: offering.id,
        attendanceMode: "online",
        customerFullName: "Invalid money",
        customerEmail: `${crypto.randomUUID()}@example.test`,
        timezone: "Africa/Cairo",
        ...invalid,
      }),
    ).rejects.toThrow();
  });

  it("rejects a negative payment amount", async () => {
    const { db } = getTestDatabase();
    const { booking } = await seedBooking();
    await expect(
      db.insert(payments).values({
        bookingId: booking.id,
        provider: "mock",
        currency: "EGP",
        amountMinor: -1,
      }),
    ).rejects.toThrow();
  });
});
