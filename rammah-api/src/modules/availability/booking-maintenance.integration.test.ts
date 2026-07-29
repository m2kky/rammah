import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  bookingSlotHolds,
  bookings,
  offerings,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import { expireStaleBookingHolds } from "./booking-maintenance.service.js";

it("expires stale holds and their pending-payment bookings", async () => {
  const { db } = getTestDatabase();
  const [offering] = await db
    .insert(offerings)
    .values({
      title: "Maintenance",
      slug: `maintenance-${crypto.randomUUID()}`,
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode: "paid",
      requiresPayment: true,
      durationMinutes: 60,
      capacity: 1,
      status: "published",
    })
    .returning();
  const [booking] = await db
    .insert(bookings)
    .values({
      offeringId: offering!.id,
      attendanceMode: "online",
      status: "pending_payment",
      customerFullName: "Pending Customer",
      customerEmail: "pending@example.test",
      slotStartAt: new Date("2031-01-01T10:00:00Z"),
      slotEndAt: new Date("2031-01-01T11:00:00Z"),
      paymentRequired: true,
    })
    .returning();
  await db.insert(bookingSlotHolds).values({
    offeringId: offering!.id,
    bookingId: booking!.id,
    status: "active",
    slotStartAt: booking!.slotStartAt!,
    slotEndAt: booking!.slotEndAt!,
    expiresAt: new Date("2030-01-01T00:00:00Z"),
  });

  await expect(expireStaleBookingHolds(new Date("2030-01-02T00:00:00Z"))).resolves.toBe(1);
  const [storedBooking] = await db
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, booking!.id));
  const [storedHold] = await db
    .select({ status: bookingSlotHolds.status })
    .from(bookingSlotHolds)
    .where(eq(bookingSlotHolds.bookingId, booking!.id));

  expect(storedBooking?.status).toBe("expired");
  expect(storedHold?.status).toBe("expired");
});
