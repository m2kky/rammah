import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "../../db/client.js";
import { bookingSlotHolds, bookings } from "../../db/schema/index.js";

export const expireStaleBookingHolds = async (now = new Date()) =>
  db.transaction(async (tx) => {
    const expired = await tx
      .update(bookingSlotHolds)
      .set({ status: "expired" })
      .where(
        and(
          eq(bookingSlotHolds.status, "active"),
          lte(bookingSlotHolds.expiresAt, now),
        ),
      )
      .returning({ bookingId: bookingSlotHolds.bookingId });
    const bookingIds = expired
      .map((hold) => hold.bookingId)
      .filter((bookingId): bookingId is string => Boolean(bookingId));

    if (bookingIds.length) {
      await tx
        .update(bookings)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            inArray(bookings.id, bookingIds),
            eq(bookings.status, "pending_payment"),
          ),
        );
    }

    return expired.length;
  });
