import { and, eq, gt, gte, inArray, lt } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  bookingSlotHolds,
  bookings,
  offlineLocations,
  offeringSessions,
  offerings,
} from "../../db/schema/index.js";

const publicSessionSelect = {
  id: offeringSessions.id,
  offeringId: offeringSessions.offeringId,
  offeringTitle: offerings.title,
  offeringSlug: offerings.slug,
  offeringStatus: offerings.status,
  offeringBookingMode: offerings.bookingMode,
  offeringRequiresPayment: offerings.requiresPayment,
  offeringQuoteOnly: offerings.quoteOnly,
  startsAt: offeringSessions.startsAt,
  endsAt: offeringSessions.endsAt,
  timezone: offeringSessions.timezone,
  capacity: offeringSessions.capacity,
  attendanceMode: offeringSessions.attendanceMode,
  locationId: offeringSessions.locationId,
  locationName: offlineLocations.name,
  locationAddressLine1: offlineLocations.addressLine1,
  locationAddressLine2: offlineLocations.addressLine2,
  locationCity: offlineLocations.city,
  locationCountryCode: offlineLocations.countryCode,
  locationMapUrl: offlineLocations.mapUrl,
  locationInstructions: offlineLocations.instructions,
  status: offeringSessions.status,
};

export const findPublicSessions = async (input: {
  offeringId: string;
  rangeStart: Date;
  rangeEnd: Date;
}) =>
  db
    .select(publicSessionSelect)
    .from(offeringSessions)
    .innerJoin(offerings, eq(offeringSessions.offeringId, offerings.id))
    .leftJoin(offlineLocations, eq(offeringSessions.locationId, offlineLocations.id))
    .where(
      and(
        eq(offeringSessions.offeringId, input.offeringId),
        eq(offeringSessions.status, "published"),
        eq(offerings.status, "published"),
        gte(offeringSessions.startsAt, input.rangeStart),
        lt(offeringSessions.startsAt, input.rangeEnd),
      ),
    )
    .orderBy(offeringSessions.startsAt);

export type PublicSessionRow = Awaited<
  ReturnType<typeof findPublicSessions>
>[number];

export const findPublicSessionById = async (input: {
  id: string;
  offeringId: string;
}) => {
  const rows = await db
    .select(publicSessionSelect)
    .from(offeringSessions)
    .innerJoin(offerings, eq(offeringSessions.offeringId, offerings.id))
    .leftJoin(offlineLocations, eq(offeringSessions.locationId, offlineLocations.id))
    .where(
      and(
        eq(offeringSessions.id, input.id),
        eq(offeringSessions.offeringId, input.offeringId),
        eq(offeringSessions.status, "published"),
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
        eq(bookings.offeringSessionId, sessionId),
        inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
      ),
    );

export const findSessionActiveHolds = async (sessionId: string, now: Date) =>
  db
    .select({ id: bookingSlotHolds.id })
    .from(bookingSlotHolds)
    .where(
      and(
        eq(bookingSlotHolds.offeringSessionId, sessionId),
        eq(bookingSlotHolds.status, "active"),
        gt(bookingSlotHolds.expiresAt, now),
      ),
    );
