import { and, desc, eq, gt, ilike, inArray, lt, ne, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  bookingSlotHolds,
  bookingStatusEnum,
  bookings,
  calendarEvents,
  offlineLocations,
  offeringSessions,
  offerings,
} from "../../db/schema/index.js";

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

  return query.orderBy(desc(bookings.createdAt));
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

  return rows[0] ?? null;
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

export const findAdminBookingScheduleContextById = async (id: string) => {
  const rows = await db
    .select({
      id: bookings.id,
      offeringId: bookings.offeringId,
      offeringSessionId: bookings.offeringSessionId,
      status: bookings.status,
      slotStartAt: bookings.slotStartAt,
      slotEndAt: bookings.slotEndAt,
      timezone: bookings.timezone,
      confirmedAt: bookings.confirmedAt,
      offeringCapacity: offerings.capacity,
      offeringDurationMinutes: offerings.durationMinutes,
      offeringStatus: offerings.status,
    })
    .from(bookings)
    .innerJoin(offerings, eq(bookings.offeringId, offerings.id))
    .where(eq(bookings.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const findRescheduleSessionById = async (input: {
  sessionId: string;
  offeringId: string;
}) => {
  const rows = await db
    .select({
      id: offeringSessions.id,
      offeringId: offeringSessions.offeringId,
      startsAt: offeringSessions.startsAt,
      endsAt: offeringSessions.endsAt,
      timezone: offeringSessions.timezone,
      capacity: offeringSessions.capacity,
      status: offeringSessions.status,
    })
    .from(offeringSessions)
    .where(
      and(
        eq(offeringSessions.id, input.sessionId),
        eq(offeringSessions.offeringId, input.offeringId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
};

export const countBlockingBookingsForSlot = async (input: {
  bookingId: string;
  offeringId: string;
  offeringSessionId?: string | null;
  startsAt: Date;
  endsAt: Date;
}) => {
  const conditions: SQL[] = [
    ne(bookings.id, input.bookingId),
    eq(bookings.offeringId, input.offeringId),
    inArray(bookings.status, ["pending_payment", "confirmed"]),
    lt(bookings.slotStartAt, input.endsAt),
    gt(bookings.slotEndAt, input.startsAt),
  ];

  if (input.offeringSessionId) {
    conditions.push(eq(bookings.offeringSessionId, input.offeringSessionId));
  }

  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(...conditions));

  return rows.length;
};

export const countActiveHoldsForSlot = async (input: {
  offeringId: string;
  offeringSessionId?: string | null;
  startsAt: Date;
  endsAt: Date;
}) => {
  const conditions: SQL[] = [
    eq(bookingSlotHolds.offeringId, input.offeringId),
    eq(bookingSlotHolds.status, "active"),
    gt(bookingSlotHolds.expiresAt, new Date()),
    lt(bookingSlotHolds.slotStartAt, input.endsAt),
    gt(bookingSlotHolds.slotEndAt, input.startsAt),
  ];

  if (input.offeringSessionId) {
    conditions.push(eq(bookingSlotHolds.offeringSessionId, input.offeringSessionId));
  }

  const rows = await db
    .select({ id: bookingSlotHolds.id })
    .from(bookingSlotHolds)
    .where(and(...conditions));

  return rows.length;
};

export const updateAdminBookingSchedule = async (input: {
  bookingId: string;
  offeringSessionId?: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  confirmedAt?: Date | null;
}) => {
  const rows = await db
    .update(bookings)
    .set({
      offeringSessionId: input.offeringSessionId ?? null,
      slotStartAt: input.startsAt,
      slotEndAt: input.endsAt,
      timezone: input.timezone,
      status: "confirmed",
      confirmedAt: input.confirmedAt ?? new Date(),
      cancelledAt: null,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, input.bookingId))
    .returning({ id: bookings.id });

  return rows[0] ? findAdminBookingById(rows[0].id) : null;
};
