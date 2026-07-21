import { and, eq, gt } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  bookingAnswers,
  bookingSlotHolds,
  bookings,
  offlineLocations,
  offeringLocations,
  offerings,
} from "../../db/schema/index.js";
import { withAvailableSlotCapacity } from "../availability/slot-capacity.repository.js";
import { verifySlotHoldToken } from "../availability/slot-hold-token.js";
import { lockOwnedSlotHold } from "../availability/slot-holds.repository.js";

export type PublicBookingAnswerInput = {
  fieldId?: string | null;
  fieldKey: string;
  label: string;
  value?: string | null;
};

export type CreateFreeBookingInput = {
  holdId: string;
  holdToken: string | null | undefined;
  attendanceMode?: "online" | "offline" | "hybrid";
  locationId?: string | null;
  customerFullName: string;
  customerEmail: string;
  customerPhone?: string | null;
  countryCode?: string | null;
  timezone: string;
  answers: PublicBookingAnswerInput[];
};

export const findPublicBookingHoldContextById = async (
  holdId: string,
  holdToken: string | null | undefined,
) => {
  const rows = await db
    .select({
      id: bookingSlotHolds.id,
      offeringId: bookingSlotHolds.offeringId,
      offeringSessionId: bookingSlotHolds.offeringSessionId,
      offeringAttendanceMode: offerings.attendanceMode,
      holdStatus: bookingSlotHolds.status,
      expiresAt: bookingSlotHolds.expiresAt,
      holdSecretHash: bookingSlotHolds.holdSecretHash,
    })
    .from(bookingSlotHolds)
    .innerJoin(offerings, eq(bookingSlotHolds.offeringId, offerings.id))
    .where(eq(bookingSlotHolds.id, holdId))
    .limit(1);

  const row = rows[0] ?? null;
  if (!row || !verifySlotHoldToken(holdToken, row.holdSecretHash)) {
    return null;
  }

  const { holdSecretHash: _holdSecretHash, ...context } = row;
  return context;
};

const bookingSelect = {
  id: bookings.id,
  publicToken: bookings.publicToken,
  offeringId: bookings.offeringId,
  locationId: bookings.locationId,
  attendanceMode: bookings.attendanceMode,
  status: bookings.status,
  customerFullName: bookings.customerFullName,
  customerEmail: bookings.customerEmail,
  customerPhone: bookings.customerPhone,
  countryCode: bookings.countryCode,
  slotStartAt: bookings.slotStartAt,
  slotEndAt: bookings.slotEndAt,
  timezone: bookings.timezone,
  paymentRequired: bookings.paymentRequired,
  confirmedAt: bookings.confirmedAt,
  createdAt: bookings.createdAt,
  updatedAt: bookings.updatedAt,
};

export const createFreeBookingFromHold = async (input: CreateFreeBookingInput) =>
  db.transaction(async (tx) => {
    const hold = await lockOwnedSlotHold(tx, input.holdId, input.holdToken);

    if (!hold) {
      return { booking: null, hold: null, converted: false, rejection: "hold_unavailable" } as const;
    }

    if (hold.holdStatus === "converted" && hold.bookingId) {
      const bookingRows = await tx
        .select(bookingSelect)
        .from(bookings)
        .where(eq(bookings.id, hold.bookingId))
        .limit(1);
      const booking = bookingRows[0] ?? null;

      if (!booking || booking.paymentRequired) {
        return { booking: null, hold, converted: false, rejection: "hold_unavailable" } as const;
      }

      return { booking, hold, converted: true, rejection: null } as const;
    }

    if (hold.holdStatus !== "active" || hold.expiresAt <= new Date()) {
      return { booking: null, hold, converted: false, rejection: "hold_unavailable" } as const;
    }

    const result = await withAvailableSlotCapacity(
      tx,
      {
        offeringId: hold.offeringId,
        offeringSessionId: hold.offeringSessionId,
        startsAt: hold.slotStartAt,
        endsAt: hold.slotEndAt,
      },
      { excludeHoldId: hold.id },
      async ({ now, offering, sessionLocationId }) => {
        const currentHold = {
          ...hold,
          offeringTitle: offering.title,
          offeringSlug: offering.slug,
          offeringAttendanceMode: offering.attendanceMode,
          sessionLocationId,
        };

        if (
          offering.bookingMode !== "free" ||
          offering.requiresPayment ||
          offering.quoteOnly
        ) {
          return {
            booking: null,
            hold: currentHold,
            converted: false,
            rejection: "offering_not_free",
          } as const;
        }

        const attendanceMode = input.attendanceMode ?? offering.attendanceMode;
        if (
          offering.attendanceMode !== "hybrid" &&
          attendanceMode !== offering.attendanceMode
        ) {
          return {
            booking: null,
            hold: currentHold,
            converted: false,
            rejection: "attendance_mode",
          } as const;
        }

        const bookingRows = await tx
          .insert(bookings)
          .values({
            offeringId: hold.offeringId,
            offeringSessionId: hold.offeringSessionId,
            locationId: sessionLocationId ?? input.locationId ?? null,
            attendanceMode,
            status: "confirmed",
            customerFullName: input.customerFullName,
            customerEmail: input.customerEmail,
            customerPhone: input.customerPhone ?? null,
            countryCode: input.countryCode ?? null,
            slotStartAt: hold.slotStartAt,
            slotEndAt: hold.slotEndAt,
            timezone: input.timezone,
            paymentRequired: false,
            confirmedAt: now,
          })
          .returning(bookingSelect);
        const booking = bookingRows[0] ?? null;

        if (!booking) {
          throw new Error("Booking insert did not return a row.");
        }

        if (input.answers.length > 0) {
          await tx.insert(bookingAnswers).values(
            input.answers.map((answer) => ({
              bookingId: booking.id,
              fieldId: answer.fieldId ?? null,
              fieldKeySnapshot: answer.fieldKey,
              labelSnapshot: answer.label,
              value: answer.value ?? null,
            })),
          );
        }

        const convertedRows = await tx
          .update(bookingSlotHolds)
          .set({ status: "converted", bookingId: booking.id })
          .where(
            and(
              eq(bookingSlotHolds.id, hold.id),
              eq(bookingSlotHolds.status, "active"),
              gt(bookingSlotHolds.expiresAt, now),
            ),
          )
          .returning({ id: bookingSlotHolds.id });

        if (!convertedRows[0]) {
          throw new Error("Slot hold could not be converted.");
        }

        return { booking, hold: currentHold, converted: true, rejection: null } as const;
      },
    );

    return (
      result ?? {
        booking: null,
        hold,
        converted: false,
        rejection: "hold_unavailable",
      }
    );
  });

export const findPublicBookingByToken = async (publicToken: string) => {
  const rows = await db
    .select({
      id: bookings.id,
      publicToken: bookings.publicToken,
      offeringId: bookings.offeringId,
      offeringTitle: offerings.title,
      offeringSlug: offerings.slug,
      locationId: bookings.locationId,
      locationName: offlineLocations.name,
      locationCity: offlineLocations.city,
      locationCountryCode: offlineLocations.countryCode,
      attendanceMode: bookings.attendanceMode,
      status: bookings.status,
      customerFullName: bookings.customerFullName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      countryCode: bookings.countryCode,
      slotStartAt: bookings.slotStartAt,
      slotEndAt: bookings.slotEndAt,
      timezone: bookings.timezone,
      paymentRequired: bookings.paymentRequired,
      confirmedAt: bookings.confirmedAt,
      cancelledAt: bookings.cancelledAt,
      createdAt: bookings.createdAt,
      updatedAt: bookings.updatedAt,
    })
    .from(bookings)
    .innerJoin(offerings, eq(bookings.offeringId, offerings.id))
    .leftJoin(offlineLocations, eq(bookings.locationId, offlineLocations.id))
    .where(eq(bookings.publicToken, publicToken))
    .limit(1);

  return rows[0] ?? null;
};

export const findPublicBookableLocationById = async (input: {
  offeringId: string;
  locationId: string;
}) => {
  const linkedRows = await db
    .select({ id: offlineLocations.id })
    .from(offeringLocations)
    .innerJoin(offlineLocations, eq(offeringLocations.locationId, offlineLocations.id))
    .where(
      and(
        eq(offeringLocations.offeringId, input.offeringId),
        eq(offeringLocations.locationId, input.locationId),
        eq(offlineLocations.status, "published"),
      ),
    )
    .limit(1);

  if (linkedRows[0]) return linkedRows[0];

  const hasScopedLocations = await db
    .select({ id: offeringLocations.id })
    .from(offeringLocations)
    .where(eq(offeringLocations.offeringId, input.offeringId))
    .limit(1);

  if (hasScopedLocations[0]) return null;

  const fallbackRows = await db
    .select({ id: offlineLocations.id })
    .from(offlineLocations)
    .where(and(eq(offlineLocations.id, input.locationId), eq(offlineLocations.status, "published")))
    .limit(1);

  return fallbackRows[0] ?? null;
};
