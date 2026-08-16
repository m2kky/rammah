import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  availabilityWindows,
  bookingSlotHolds,
  bookings,
  offeringPrices,
  offerings,
  payments,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import { createSlotHold } from "../availability/slot-holds.service.js";
import {
  archiveAdminOfferingPriceById,
  createAdminOfferingPrice,
  updateAdminOfferingPriceById,
} from "../offerings/admin-offerings.service.js";
import type { ExpectedPrice } from "../pricing/pricing-resolution.js";
import { previewPublicOfferingPrice } from "../pricing/public-price-preview.service.js";
import { submitPaidBooking } from "./public-payments.service.js";

const seedTarget = async (countryCodes = ["EG"], date = "2031-06-02") => {
  const { db } = getTestDatabase();
  const targetSlot = {
    startsAt: new Date(`${date}T10:00:00`),
    endsAt: new Date(`${date}T11:00:00`),
  };
  const [offering] = await db
    .insert(offerings)
    .values({
      title: "Atomic paid pricing",
      slug: `atomic-paid-${crypto.randomUUID()}`,
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode: "paid",
      schedulingMode: "appointment",
      durationMinutes: 60,
      capacity: 1,
      requiresPayment: true,
      status: "published",
    })
    .returning();
  await db.insert(availabilityWindows).values({
    weekday: targetSlot.startsAt.getDay(),
    startLocalTime: "10:00",
    endLocalTime: "12:00",
    status: "published",
  });
  const group = await createAdminOfferingPrice(offering!.id, {
    name: "Egypt",
    countryCodes,
    currency: "EGP",
    baseAmountMinor: 25_000,
    status: "published",
  });
  const hold = await createSlotHold({
    offeringId: offering!.id,
    startsAt: targetSlot.startsAt.toISOString(),
    endsAt: targetSlot.endsAt.toISOString(),
  });
  const preview = await previewPublicOfferingPrice({
    offeringId: offering!.id,
    detectedCountryCode: countryCodes[0],
  });
  return { offering: offering!, group, hold, expectedPrice: preview.expectedPrice };
};

const submitInput = (
  hold: { id: string; holdToken: string },
  expectedPrice: ExpectedPrice,
  detectedCountryCode: string | null = "EG",
) => ({
  holdId: hold.id,
  holdToken: hold.holdToken,
  attendanceMode: "online" as const,
  customer: {
    fullName: "Atomic Customer",
    email: "atomic@example.test",
  },
  detectedCountryCode,
  expectedPrice,
  timezone: "Africa/Cairo",
  answers: [],
});

const countsFor = async (offeringId: string) => {
  const { db } = getTestDatabase();
  const [bookingRows, paymentRows] = await Promise.all([
    db.select().from(bookings).where(eq(bookings.offeringId, offeringId)),
    db
      .select({ id: payments.id })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(eq(bookings.offeringId, offeringId)),
  ]);
  return { bookings: bookingRows, payments: paymentRows };
};

describe.sequential("atomic paid country pricing", () => {
  it("returns the current seven-field price and preserves the same hold on mismatch", async () => {
    const target = await seedTarget();
    const mismatched = { ...target.expectedPrice, totalAmountMinor: 24_999 };

    await expect(
      submitPaidBooking(submitInput(target.hold, mismatched)),
    ).rejects.toMatchObject({
      code: "PRICE_CHANGED",
      statusCode: 409,
      meta: { currentPrice: { expectedPrice: target.expectedPrice } },
    });
    const [hold] = await getTestDatabase().db
      .select()
      .from(bookingSlotHolds)
      .where(eq(bookingSlotHolds.id, target.hold.id));
    expect(hold).toMatchObject({ status: "active", bookingId: null });
    expect(await countsFor(target.offering.id)).toEqual({ bookings: [], payments: [] });
  });

  it("releases an owned active hold when its detected country becomes unavailable", async () => {
    const target = await seedTarget();
    await archiveAdminOfferingPriceById(target.offering.id, target.group.id);

    await expect(
      submitPaidBooking(submitInput(target.hold, target.expectedPrice)),
    ).rejects.toMatchObject({ code: "COUNTRY_PRICE_UNAVAILABLE", statusCode: 422 });
    const [hold] = await getTestDatabase().db
      .select()
      .from(bookingSlotHolds)
      .where(eq(bookingSlotHolds.id, target.hold.id));
    expect(hold).toMatchObject({ status: "released", bookingId: null });
    expect(await countsFor(target.offering.id)).toEqual({ bookings: [], payments: [] });
  });

  it("replays a converted hold before country, group, or expectation changes", async () => {
    const target = await seedTarget();
    const first = await submitPaidBooking(
      submitInput(target.hold, target.expectedPrice),
    );
    await archiveAdminOfferingPriceById(target.offering.id, target.group.id);

    const replay = await submitPaidBooking(
      submitInput(
        target.hold,
        { ...target.expectedPrice, priceId: crypto.randomUUID(), totalAmountMinor: 1 },
        null,
      ),
    );
    expect(replay.booking.id).toBe(first.booking.id);
    expect(replay.payment.id).toBe(first.payment.id);
    expect(await countsFor(target.offering.id)).toMatchObject({
      bookings: [expect.objectContaining({
        id: first.booking.id,
        offeringPriceId: target.group.id,
        countryCode: "EG",
        totalAmountMinor: 25_000,
      })],
      payments: [{ id: first.payment.id }],
    });
  });

  it("serializes a concurrent admin edit with confirmation without mixed snapshots", async () => {
    const target = await seedTarget();
    const [editResult, bookingResult] = await Promise.allSettled([
      updateAdminOfferingPriceById(target.offering.id, target.group.id, {
        baseAmountMinor: 30_000,
      }),
      submitPaidBooking(submitInput(target.hold, target.expectedPrice)),
    ]);
    expect(editResult.status).toBe("fulfilled");

    const stored = await countsFor(target.offering.id);
    if (bookingResult.status === "fulfilled") {
      expect(stored.bookings).toEqual([
        expect.objectContaining({
          offeringPriceId: target.group.id,
          baseAmountMinor: 25_000,
          totalAmountMinor: 25_000,
        }),
      ]);
      expect(stored.payments).toHaveLength(1);
    } else {
      expect(bookingResult.reason).toMatchObject({
        code: "PRICE_CHANGED",
        meta: {
          currentPrice: {
            expectedPrice: expect.objectContaining({
              priceId: target.group.id,
              baseAmountMinor: 30_000,
              totalAmountMinor: 30_000,
            }),
          },
        },
      });
      expect(stored).toEqual({ bookings: [], payments: [] });
    }
  });

  it("cannot attach a price group from another offering", async () => {
    const first = await seedTarget();
    const second = await seedTarget(["SA"], "2031-06-03");
    const foreignExpectation = {
      ...first.expectedPrice,
      priceId: second.group.id,
    };

    await expect(
      submitPaidBooking(submitInput(first.hold, foreignExpectation)),
    ).rejects.toMatchObject({ code: "PRICE_CHANGED", statusCode: 409 });
    expect(await countsFor(first.offering.id)).toEqual({ bookings: [], payments: [] });

    const [foreignHeader] = await getTestDatabase().db
      .select()
      .from(offeringPrices)
      .where(
        and(
          eq(offeringPrices.id, second.group.id),
          eq(offeringPrices.offeringId, second.offering.id),
        ),
      );
    expect(foreignHeader).toBeTruthy();
  });
});
