import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  bookingStatusEnum,
  bookings,
  calendarEvents,
  offlineLocations,
  offerings,
} from "../../db/schema/index.js";
import { withAvailableSlotCapacity } from "../availability/slot-capacity.repository.js";
import { attachCanonicalBookingTargets } from "./booking-target.repository.js";

export type BookingStatus = (typeof bookingStatusEnum.enumValues)[number];

export type AdminBookingFilters = {
  status?: BookingStatus;
  search?: string;
};

export type AdminBookingStatusUpdate = {
  status: BookingStatus;
  confirmedAt?: Date | null;
  cancelledAt?: Date | null;
};

const adminBookingSelect = {
  id: bookings.id,
  publicToken: bookings.publicToken,
  bookingReference: bookings.bookingReference,
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
  scheduledProgramId: bookings.scheduledProgramId,
  slotStartAt: bookings.slotStartAt,
  slotEndAt: bookings.slotEndAt,
  timezone: bookings.timezone,
  paymentRequired: bookings.paymentRequired,
  baseAmountMinor: bookings.baseAmountMinor,
  discountAmountMinor: bookings.discountAmountMinor,
  taxAmountMinor: bookings.taxAmountMinor,
  totalAmountMinor: bookings.totalAmountMinor,
  priceCurrency: bookings.priceCurrency,
  confirmedAt: bookings.confirmedAt,
  cancelledAt: bookings.cancelledAt,
  createdAt: bookings.createdAt,
  updatedAt: bookings.updatedAt,
  calendarEventId: calendarEvents.id,
  calendarStatus: calendarEvents.status,
  calendarExternalEventId: calendarEvents.externalEventId,
  calendarMeetUrl: calendarEvents.meetUrl,
  calendarLastError: calendarEvents.lastError,
  calendarUpdatedAt: calendarEvents.updatedAt,
};

export const findAdminBookings = async (filters: AdminBookingFilters = {}) => {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(bookings.status, filters.status));
  }

  if (filters.search?.trim()) {
    const searchPattern = `%${filters.search.trim()}%`;
    const searchCondition = or(
      ilike(bookings.customerFullName, searchPattern),
      ilike(bookings.customerEmail, searchPattern),
      ilike(bookings.bookingReference, searchPattern),
      ilike(offerings.title, searchPattern),
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  let query = db
    .select(adminBookingSelect)
    .from(bookings)
    .innerJoin(offerings, eq(bookings.offeringId, offerings.id))
    .leftJoin(offlineLocations, eq(bookings.locationId, offlineLocations.id))
    .leftJoin(
      calendarEvents,
      and(eq(calendarEvents.bookingId, bookings.id), eq(calendarEvents.provider, "google")),
    )
    .$dynamic();

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  if (where) {
    query = query.where(where);
  }

  return attachCanonicalBookingTargets(await query.orderBy(desc(bookings.createdAt)));
};

export type AdminBookingRow = Awaited<ReturnType<typeof findAdminBookings>>[number];

export const findAdminBookingById = async (id: string) => {
  const rows = await db
    .select(adminBookingSelect)
    .from(bookings)
    .innerJoin(offerings, eq(bookings.offeringId, offerings.id))
    .leftJoin(offlineLocations, eq(bookings.locationId, offlineLocations.id))
    .leftJoin(
      calendarEvents,
      and(eq(calendarEvents.bookingId, bookings.id), eq(calendarEvents.provider, "google")),
    )
    .where(eq(bookings.id, id))
    .limit(1);

  return (await attachCanonicalBookingTargets(rows))[0] ?? null;
};

export const updateAdminBookingStatus = async (
  id: string,
  input: AdminBookingStatusUpdate,
) => {
  const updatePayload: {
    status: BookingStatus;
    confirmedAt?: Date | null;
    cancelledAt?: Date | null;
    updatedAt: Date;
  } = {
    status: input.status,
    updatedAt: new Date(),
  };

  if (input.confirmedAt !== undefined) {
    updatePayload.confirmedAt = input.confirmedAt;
  }

  if (input.cancelledAt !== undefined) {
    updatePayload.cancelledAt = input.cancelledAt;
  }

  const rows = await db
    .update(bookings)
    .set(updatePayload)
    .where(eq(bookings.id, id))
    .returning({ id: bookings.id });

  if (!rows[0]) {
    return null;
  }

  return findAdminBookingById(id);
};

export const rescheduleAdminBookingWithinCapacity = async (input: {
  bookingId: string;
  offeringSessionId: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  policyContext: "public_reschedule" | "admin_reschedule";
}) =>
  db.transaction(async (tx) => {
    // Canonical reschedule order: booking row, target advisory lock, then fixed-session row.
    const bookingRows = await tx
      .select({
        id: bookings.id,
        offeringId: bookings.offeringId,
        offeringSessionId: bookings.offeringSessionId,
        status: bookings.status,
        slotStartAt: bookings.slotStartAt,
        slotEndAt: bookings.slotEndAt,
        timezone: bookings.timezone,
        confirmedAt: bookings.confirmedAt,
        updatedAt: bookings.updatedAt,
      })
      .from(bookings)
      .where(eq(bookings.id, input.bookingId))
      .for("update")
      .limit(1);
    const booking = bookingRows[0];

    if (!booking) return { outcome: "not_found" as const };
    if (!(["confirmed", "rescheduled"] as BookingStatus[]).includes(booking.status)) {
      return { outcome: "invalid_status" as const };
    }

    const updated = await withAvailableSlotCapacity(
      tx,
      {
        offeringId: booking.offeringId,
        offeringSessionId: input.offeringSessionId,
        scheduledProgramId: null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
      { policyContext: input.policyContext, excludeBookingId: booking.id },
      async ({ timezone: targetTimezone, now }) => {
        const timezone = (targetTimezone ?? input.timezone.trim()) || booking.timezone;
        const rows = await tx
          .update(bookings)
          .set({
            offeringSessionId: input.offeringSessionId,
            scheduledProgramId: null,
            slotStartAt: input.startsAt,
            slotEndAt: input.endsAt,
            timezone,
            status: "confirmed",
            confirmedAt: booking.confirmedAt ?? now,
            cancelledAt: null,
            updatedAt: now,
          })
          .where(eq(bookings.id, booking.id))
          .returning({ id: bookings.id });

        return {
          bookingId: rows[0]!.id,
          before: booking,
        };
      },
    );

    return updated
      ? { outcome: "updated" as const, ...updated }
      : { outcome: "unavailable" as const };
  });
