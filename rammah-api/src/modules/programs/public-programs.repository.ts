import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  bookingSlotHolds,
  bookings,
  offlineLocations,
  offerings,
  scheduledProgramOccurrences,
  scheduledPrograms,
} from "../../db/schema/index.js";

const publicProgramSelect = {
  id: scheduledPrograms.id,
  offeringId: scheduledPrograms.offeringId,
  offeringTitle: offerings.title,
  offeringSlug: offerings.slug,
  offeringBookingMode: offerings.bookingMode,
  title: scheduledPrograms.title,
  timezone: scheduledPrograms.timezone,
  attendanceMode: scheduledPrograms.attendanceMode,
  locationId: scheduledPrograms.locationId,
  locationName: offlineLocations.name,
  locationAddressLine1: offlineLocations.addressLine1,
  locationAddressLine2: offlineLocations.addressLine2,
  locationCity: offlineLocations.city,
  locationCountryCode: offlineLocations.countryCode,
  locationMapUrl: offlineLocations.mapUrl,
  locationInstructions: offlineLocations.instructions,
  capacity: scheduledPrograms.capacity,
  registrationOpensAt: scheduledPrograms.registrationOpensAt,
  registrationClosesAt: scheduledPrograms.registrationClosesAt,
};

export const findPublicPrograms = async (offeringId?: string) => {
  const conditions = [
    eq(scheduledPrograms.status, "published"),
    eq(offerings.status, "published"),
    eq(offerings.schedulingMode, "scheduled_program"),
  ];
  if (offeringId) conditions.push(eq(scheduledPrograms.offeringId, offeringId));
  return db
    .select(publicProgramSelect)
    .from(scheduledPrograms)
    .innerJoin(offerings, eq(scheduledPrograms.offeringId, offerings.id))
    .leftJoin(offlineLocations, eq(scheduledPrograms.locationId, offlineLocations.id))
    .where(and(...conditions));
};

export type PublicProgramRow = Awaited<ReturnType<typeof findPublicPrograms>>[number];

export const findPublicProgramOccurrences = async (programId: string) =>
  db
    .select({
      id: scheduledProgramOccurrences.id,
      startsAt: scheduledProgramOccurrences.startsAt,
      endsAt: scheduledProgramOccurrences.endsAt,
      timezone: scheduledProgramOccurrences.timezone,
      attendanceMode: scheduledProgramOccurrences.attendanceMode,
      locationId: scheduledProgramOccurrences.locationId,
      locationName: offlineLocations.name,
      locationAddressLine1: offlineLocations.addressLine1,
      locationAddressLine2: offlineLocations.addressLine2,
      locationCity: offlineLocations.city,
      locationCountryCode: offlineLocations.countryCode,
      locationMapUrl: offlineLocations.mapUrl,
      locationInstructions: offlineLocations.instructions,
      sortOrder: scheduledProgramOccurrences.sortOrder,
    })
    .from(scheduledProgramOccurrences)
    .leftJoin(offlineLocations, eq(scheduledProgramOccurrences.locationId, offlineLocations.id))
    .where(
      and(
        eq(scheduledProgramOccurrences.scheduledProgramId, programId),
        eq(scheduledProgramOccurrences.status, "scheduled"),
      ),
    )
    .orderBy(
      asc(scheduledProgramOccurrences.startsAt),
      asc(scheduledProgramOccurrences.sortOrder),
      asc(scheduledProgramOccurrences.id),
    );

export const findPublicProgramCapacity = async (programId: string, now: Date) => {
  const [bookingRows, holdRows] = await Promise.all([
    db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.scheduledProgramId, programId),
          inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
        ),
      ),
    db
      .select({ id: bookingSlotHolds.id })
      .from(bookingSlotHolds)
      .where(
        and(
          eq(bookingSlotHolds.scheduledProgramId, programId),
          eq(bookingSlotHolds.status, "active"),
          gt(bookingSlotHolds.expiresAt, now),
        ),
      ),
  ]);
  return { bookedCount: bookingRows.length, heldCount: holdRows.length };
};
