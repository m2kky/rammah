import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import {
  availabilityWindows,
  bookings,
  offeringPriceCountries,
  offeringPrices,
  offerings,
  siteSettings,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import { createFreeBookingFromHold } from "../bookings/public-bookings.repository.js";
import { rescheduleAdminBookingById } from "../bookings/admin-bookings.service.js";
import { reschedulePublicBooking } from "../bookings/public-bookings.service.js";
import { createPaidBookingFromHold } from "../payments/public-payments.repository.js";
import { createSlotHold } from "./slot-holds.service.js";

const now = new Date("2026-08-05T09:00:00.000Z");
const thursday = {
  startsAt: "2026-08-06T06:00:00.000Z",
  endsAt: "2026-08-06T07:00:00.000Z",
};
const friday = {
  startsAt: "2026-08-07T06:00:00.000Z",
  endsAt: "2026-08-07T07:00:00.000Z",
};

const seedTarget = async (minimumAdvanceDays: number, bookingMode: "free" | "paid" = "free") => {
  const { db } = getTestDatabase();
  const [settings] = await db.insert(siteSettings).values({
    siteName: "Rammah",
    bookingDefaultTimezone: "Africa/Cairo",
    bookingMinimumAdvanceDays: minimumAdvanceDays,
  }).returning();
  const [offering] = await db.insert(offerings).values({
    title: "Policy appointment",
    slug: `policy-appointment-${crypto.randomUUID()}`,
    offeringType: "coaching",
    attendanceMode: "online",
    bookingMode,
    requiresPayment: bookingMode === "paid",
    schedulingMode: "appointment",
    durationMinutes: 60,
    capacity: 1,
    status: "published",
  }).returning();
  await db.insert(availabilityWindows).values([
    { weekday: 4, startLocalTime: "09:00", endLocalTime: "10:00", status: "published" },
    { weekday: 5, startLocalTime: "09:00", endLocalTime: "10:00", status: "published" },
  ]);
  let priceId: string | null = null;
  if (bookingMode === "paid") {
    const [price] = await db.insert(offeringPrices).values({
      offeringId: offering!.id,
      name: "Egypt",
      countryCode: "EG",
      currency: "EGP",
      baseAmountMinor: 10_000,
      status: "published",
    }).returning({ id: offeringPrices.id });
    priceId = price!.id;
    await db.insert(offeringPriceCountries).values({
      priceId,
      offeringId: offering!.id,
      countryCode: "EG",
      active: true,
    });
  }
  return { settings: settings!, offering: offering!, priceId };
};

describe.sequential("transactional advance-day policy", () => {
  it("rejects a forged closed-date hold with safe policy metadata and accepts the first open date", async () => {
    vi.setSystemTime(now);
    const { offering } = await seedTarget(2);

    await expect(createSlotHold({ offeringId: offering.id, ...thursday })).rejects.toMatchObject({
      code: "SLOT_UNAVAILABLE",
      statusCode: 409,
      meta: {
        earliestBookableDate: "2026-08-07",
        minimumAdvanceDays: 2,
        timezone: "Africa/Cairo",
      },
    });
    await expect(createSlotHold({ offeringId: offering.id, ...friday })).resolves.toMatchObject({
      status: "active",
      startsAt: friday.startsAt,
    });
  });

  it("grandfathers an owned active hold after the policy increases", async () => {
    vi.setSystemTime(now);
    const { db } = getTestDatabase();
    const { settings, offering } = await seedTarget(1);
    const hold = await createSlotHold({ offeringId: offering.id, ...thursday });

    await db.update(siteSettings)
      .set({ bookingMinimumAdvanceDays: 2 })
      .where(eq(siteSettings.id, settings.id));
    await expect(
      createFreeBookingFromHold({
        holdId: hold.id,
        holdToken: hold.holdToken,
        attendanceMode: "online",
        customerFullName: "Grandfathered customer",
        customerEmail: "grandfathered@example.test",
        timezone: "Africa/Cairo",
        answers: [],
      }),
    ).resolves.toMatchObject({ converted: true, rejection: null });
    await expect(createSlotHold({ offeringId: offering.id, ...thursday })).rejects.toMatchObject({
      code: "SLOT_UNAVAILABLE",
    });
  });

  it("also grandfathers paid conversion after the policy increases", async () => {
    vi.setSystemTime(now);
    const { db } = getTestDatabase();
    const { settings, offering, priceId } = await seedTarget(1, "paid");
    const hold = await createSlotHold({ offeringId: offering.id, ...thursday });
    await db.update(siteSettings)
      .set({ bookingMinimumAdvanceDays: 2 })
      .where(eq(siteSettings.id, settings.id));

    await expect(createPaidBookingFromHold({
      holdId: hold.id,
      holdToken: hold.holdToken,
      attendanceMode: "online",
      customerFullName: "Grandfathered paid customer",
      customerEmail: "grandfathered-paid@example.test",
      timezone: "Africa/Cairo",
      answers: [],
      detectedCountryCode: "EG",
      expectedPrice: {
        priceId: priceId!,
        countryCode: "EG",
        currency: "EGP",
        baseAmountMinor: 10_000,
        discountAmountMinor: 0,
        taxAmountMinor: 0,
        totalAmountMinor: 10_000,
      },
      payment: {
        provider: "kashier",
        idempotencyKey: `policy-paid-${crypto.randomUUID()}`,
      },
    })).resolves.toMatchObject({
      booking: expect.objectContaining({ status: "pending_payment" }),
      payment: expect.objectContaining({ status: "pending" }),
      rejection: null,
    });
  });

  it("enforces customer reschedule targets while admin reschedule bypasses only advance days", async () => {
    vi.setSystemTime(now);
    const { db } = getTestDatabase();
    const { offering } = await seedTarget(2);
    const [booking] = await db.insert(bookings).values({
      offeringId: offering.id,
      attendanceMode: "online",
      status: "confirmed",
      customerFullName: "Reschedule customer",
      customerEmail: "reschedule@example.test",
      slotStartAt: new Date("2026-08-10T06:00:00.000Z"),
      slotEndAt: new Date("2026-08-10T07:00:00.000Z"),
      timezone: "Africa/Cairo",
      confirmedAt: now,
    }).returning();
    const target = {
      startsAt: thursday.startsAt,
      endsAt: thursday.endsAt,
      timezone: "Africa/Cairo",
    };

    await expect(reschedulePublicBooking(booking!.publicToken, target)).rejects.toMatchObject({
      code: "SLOT_UNAVAILABLE",
    });
    await expect(rescheduleAdminBookingById(booking!.id, target)).resolves.toMatchObject({
      slot: { startsAt: thursday.startsAt },
    });
  });
});
