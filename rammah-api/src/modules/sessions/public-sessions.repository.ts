import { and, eq, gt, gte, inArray, lt } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  bookingSlotHolds,
  bookings,
  offlineLocations,
  offerings,
  scheduledProgramOccurrences,
  scheduledPrograms,
} from "../../db/schema/index.js";

const publicSessionSelect = {
  id: scheduledProgramOccurrences.id,
  scheduledProgramId: scheduledPrograms.id,
  offeringId: scheduledPrograms.offeringId,
  offeringTitle: offerings.title,
  offeringSlug: offerings.slug,
  offeringStatus: offerings.status,
  offeringBookingMode: offerings.bookingMode,
  offeringRequiresPayment: offerings.requiresPayment,
  offeringQuoteOnly: offerings.quoteOnly,
  startsAt: scheduledProgramOccurrences.startsAt,
  endsAt: scheduledProgramOccurrences.endsAt,
  timezone: scheduledProgramOccurrences.timezone,
  capacity: scheduledPrograms.capacity,
  attendanceMode: scheduledProgramOccurrences.attendanceMode,
  locationId: scheduledProgramOccurrences.locationId,
  locationName: offlineLocations.name,
  locationAddressLine1: offlineLocations.addressLine1,
  locationAddressLine2: offlineLocations.addressLine2,
  locationCity: offlineLocations.city,
  locationCountryCode: offlineLocations.countryCode,
  locationMapUrl: offlineLocations.mapUrl,
  locationInstructions: offlineLocations.instructions,
  status: scheduledPrograms.status,
};

export const findPublicSessions = async (input: {
  offeringId: string;
  rangeStart: Date;
  rangeEnd: Date;
}) =>
  db
    .select(publicSessionSelect)
    .from(scheduledPrograms)
    .innerJoin(
      scheduledProgramOccurrences,
      eq(scheduledProgramOccurrences.scheduledProgramId, scheduledPrograms.id),
    )
    .innerJoin(offerings, eq(scheduledPrograms.offeringId, offerings.id))
    .leftJoin(
      offlineLocations,
      eq(scheduledProgramOccurrences.locationId, offlineLocations.id),
    )
    .where(
      and(
        eq(scheduledPrograms.offeringId, input.offeringId),
        eq(scheduledPrograms.status, "published"),
        eq(scheduledProgramOccurrences.status, "scheduled"),
        eq(scheduledProgramOccurrences.id, scheduledPrograms.id),
        eq(offerings.status, "published"),
        gte(scheduledProgramOccurrences.startsAt, input.rangeStart),
        lt(scheduledProgramOccurrences.startsAt, input.rangeEnd),
      ),
    )
    .orderBy(scheduledProgramOccurrences.startsAt);

export type PublicSessionRow = Awaited<
  ReturnType<typeof findPublicSessions>
>[number];

export const findPublicSessionById = async (input: {
  id: string;
  offeringId: string;
}) => {
  const rows = await db
    .select(publicSessionSelect)
    .from(scheduledPrograms)
    .innerJoin(
      scheduledProgramOccurrences,
      eq(scheduledProgramOccurrences.scheduledProgramId, scheduledPrograms.id),
    )
    .innerJoin(offerings, eq(scheduledPrograms.offeringId, offerings.id))
    .leftJoin(
      offlineLocations,
      eq(scheduledProgramOccurrences.locationId, offlineLocations.id),
    )
    .where(
      and(
        eq(scheduledPrograms.id, input.id),
        eq(scheduledProgramOccurrences.id, input.id),
        eq(scheduledPrograms.offeringId, input.offeringId),
        eq(scheduledPrograms.status, "published"),
        eq(scheduledProgramOccurrences.status, "scheduled"),
        eq(offerings.status, "published"),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
};

export const findSessionBlockingBookings = async (sessionId: string) =>
  db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.scheduledProgramId, sessionId),
        inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
      ),
    );

export const findSessionActiveHolds = async (sessionId: string, now: Date) =>
  db
    .select({ id: bookingSlotHolds.id })
    .from(bookingSlotHolds)
    .where(
      and(
        eq(bookingSlotHolds.scheduledProgramId, sessionId),
        eq(bookingSlotHolds.status, "active"),
        gt(bookingSlotHolds.expiresAt, now),
      ),
    );
