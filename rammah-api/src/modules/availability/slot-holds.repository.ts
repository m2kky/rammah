import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { bookingSlotHolds } from "../../db/schema/index.js";

export type SlotHoldInsert = typeof bookingSlotHolds.$inferInsert;

export const insertSlotHold = async (input: SlotHoldInsert) => {
  const rows = await db
    .insert(bookingSlotHolds)
    .values(input)
    .returning({
      id: bookingSlotHolds.id,
      offeringId: bookingSlotHolds.offeringId,
      offeringSessionId: bookingSlotHolds.offeringSessionId,
      slotStartAt: bookingSlotHolds.slotStartAt,
      slotEndAt: bookingSlotHolds.slotEndAt,
      status: bookingSlotHolds.status,
      expiresAt: bookingSlotHolds.expiresAt,
      createdAt: bookingSlotHolds.createdAt,
    });

  return rows[0] ?? null;
};

export type SlotHoldRow = Awaited<ReturnType<typeof insertSlotHold>>;

export const releaseSlotHold = async (id: string) => {
  const rows = await db
    .update(bookingSlotHolds)
    .set({
      status: "released",
    })
    .where(eq(bookingSlotHolds.id, id))
    .returning({
      id: bookingSlotHolds.id,
    });

  return rows[0] ?? null;
};
