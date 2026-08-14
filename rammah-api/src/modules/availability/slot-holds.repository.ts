import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  bookingSlotHolds,
  offeringSessions,
  offerings,
  scheduledPrograms,
} from "../../db/schema/index.js";
import { verifySlotHoldToken } from "./slot-hold-token.js";

export type SlotHoldInsert = typeof bookingSlotHolds.$inferInsert;
export type SlotHoldTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const insertSlotHold = async (
  tx: SlotHoldTransaction,
  input: SlotHoldInsert,
) => {
  const rows = await tx
    .insert(bookingSlotHolds)
    .values(input)
    .returning({
      id: bookingSlotHolds.id,
      offeringId: bookingSlotHolds.offeringId,
      offeringSessionId: bookingSlotHolds.offeringSessionId,
      scheduledProgramId: bookingSlotHolds.scheduledProgramId,
      slotStartAt: bookingSlotHolds.slotStartAt,
      slotEndAt: bookingSlotHolds.slotEndAt,
      status: bookingSlotHolds.status,
      expiresAt: bookingSlotHolds.expiresAt,
      createdAt: bookingSlotHolds.createdAt,
    });

  return rows[0] ?? null;
};

export const lockOwnedSlotHold = async (
  tx: SlotHoldTransaction,
  id: string,
  holdToken: string | null | undefined,
) => {
  const rows = await tx
    .select({
      id: bookingSlotHolds.id,
      bookingId: bookingSlotHolds.bookingId,
      offeringId: bookingSlotHolds.offeringId,
      offeringSessionId: bookingSlotHolds.offeringSessionId,
      scheduledProgramId: bookingSlotHolds.scheduledProgramId,
      slotStartAt: bookingSlotHolds.slotStartAt,
      slotEndAt: bookingSlotHolds.slotEndAt,
      holdStatus: bookingSlotHolds.status,
      expiresAt: bookingSlotHolds.expiresAt,
      holdSecretHash: bookingSlotHolds.holdSecretHash,
      offeringTitle: offerings.title,
      offeringSlug: offerings.slug,
      offeringAttendanceMode: offerings.attendanceMode,
      sessionLocationId: offeringSessions.locationId,
      programLocationId: scheduledPrograms.locationId,
    })
    .from(bookingSlotHolds)
    .innerJoin(offerings, eq(bookingSlotHolds.offeringId, offerings.id))
    .leftJoin(
      offeringSessions,
      eq(bookingSlotHolds.offeringSessionId, offeringSessions.id),
    )
    .leftJoin(
      scheduledPrograms,
      eq(bookingSlotHolds.scheduledProgramId, scheduledPrograms.id),
    )
    .where(eq(bookingSlotHolds.id, id))
    .limit(1)
    .for("update", { of: bookingSlotHolds });
  const hold = rows[0] ?? null;

  return hold && verifySlotHoldToken(holdToken, hold.holdSecretHash) ? hold : null;
};

export const releaseSlotHold = async (
  id: string,
  holdToken: string | null | undefined,
) =>
  db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: bookingSlotHolds.id,
        status: bookingSlotHolds.status,
        expiresAt: bookingSlotHolds.expiresAt,
        holdSecretHash: bookingSlotHolds.holdSecretHash,
      })
      .from(bookingSlotHolds)
      .where(eq(bookingSlotHolds.id, id))
      .limit(1)
      .for("update");
    const hold = rows[0];

    if (!hold || !verifySlotHoldToken(holdToken, hold.holdSecretHash)) {
      return null;
    }

    if (hold.status === "released") {
      return { id: hold.id };
    }

    if (hold.status !== "active" || hold.expiresAt <= new Date()) {
      return null;
    }

    const releasedRows = await tx
      .update(bookingSlotHolds)
      .set({ status: "released" })
      .where(
        and(
          eq(bookingSlotHolds.id, hold.id),
          eq(bookingSlotHolds.status, "active"),
        ),
      )
      .returning({ id: bookingSlotHolds.id });

    return releasedRows[0] ?? null;
  });
