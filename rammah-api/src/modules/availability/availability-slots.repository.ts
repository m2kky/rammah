import { and, asc, eq, gt, gte, inArray, lt, lte } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  availabilityWindows,
  bookingSlotHolds,
  bookings,
  externalCalendarBusyBlocks,
  globalAvailabilityOverrides,
  offerings,
  scheduledProgramOccurrences,
  scheduledPrograms,
  siteSettings,
} from "../../db/schema/index.js";

export type SlotOfferingRow = {
  id: string;
  title: string;
  slug: string;
  schedulingMode: "appointment" | "scheduled_program";
  durationMinutes: number | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  capacity: number;
  status: "draft" | "published" | "scheduled" | "archived";
};

export const findSlotOfferingById = async (id: string) => {
  const rows = await db
    .select({
      id: offerings.id,
      title: offerings.title,
      slug: offerings.slug,
      schedulingMode: offerings.schedulingMode,
      durationMinutes: offerings.durationMinutes,
      bufferBeforeMinutes: offerings.bufferBeforeMinutes,
      bufferAfterMinutes: offerings.bufferAfterMinutes,
      capacity: offerings.capacity,
      status: offerings.status,
    })
    .from(offerings)
    .where(eq(offerings.id, id))
    .limit(1);
  return rows[0] ?? null;
};

export const findAvailabilityTimezone = async () => {
  const rows = await db
    .select({ timezone: siteSettings.bookingDefaultTimezone })
    .from(siteSettings)
    .orderBy(asc(siteSettings.createdAt), asc(siteSettings.id))
    .limit(1);
  return rows[0]?.timezone ?? "Africa/Cairo";
};

export const findPublishedAvailabilityWindows = async () =>
  db
    .select({
      id: availabilityWindows.id,
      weekday: availabilityWindows.weekday,
      startLocalTime: availabilityWindows.startLocalTime,
      endLocalTime: availabilityWindows.endLocalTime,
      status: availabilityWindows.status,
    })
    .from(availabilityWindows)
    .where(eq(availabilityWindows.status, "published"))
    .orderBy(
      asc(availabilityWindows.weekday),
      asc(availabilityWindows.startLocalTime),
      asc(availabilityWindows.endLocalTime),
      asc(availabilityWindows.id),
    );

export type SlotWindowRow = Awaited<
  ReturnType<typeof findPublishedAvailabilityWindows>
>[number];

export const findGlobalAvailabilityOverrides = async (
  dateFrom: string,
  dateTo: string,
) =>
  db
    .select({
      id: globalAvailabilityOverrides.id,
      date: globalAvailabilityOverrides.date,
      overrideMode: globalAvailabilityOverrides.overrideMode,
      startLocalTime: globalAvailabilityOverrides.startLocalTime,
      endLocalTime: globalAvailabilityOverrides.endLocalTime,
      reason: globalAvailabilityOverrides.reason,
    })
    .from(globalAvailabilityOverrides)
    .where(
      and(
        gte(globalAvailabilityOverrides.date, dateFrom),
        lte(globalAvailabilityOverrides.date, dateTo),
      ),
    )
    .orderBy(
      asc(globalAvailabilityOverrides.date),
      asc(globalAvailabilityOverrides.startLocalTime),
      asc(globalAvailabilityOverrides.endLocalTime),
      asc(globalAvailabilityOverrides.id),
    );

export type SlotOverrideRow = Awaited<
  ReturnType<typeof findGlobalAvailabilityOverrides>
>[number];

export const findBlockingBookings = async (rangeStart: Date, rangeEnd: Date) =>
  db
    .select({
      id: bookings.id,
      offeringId: bookings.offeringId,
      slotStartAt: bookings.slotStartAt,
      slotEndAt: bookings.slotEndAt,
      status: bookings.status,
    })
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
        lt(bookings.slotStartAt, rangeEnd),
        gt(bookings.slotEndAt, rangeStart),
      ),
    );

export type BlockingBookingRow = Awaited<ReturnType<typeof findBlockingBookings>>[number];

export const findActiveSlotHolds = async (
  rangeStart: Date,
  rangeEnd: Date,
  now: Date,
) =>
  db
    .select({
      id: bookingSlotHolds.id,
      offeringId: bookingSlotHolds.offeringId,
      slotStartAt: bookingSlotHolds.slotStartAt,
      slotEndAt: bookingSlotHolds.slotEndAt,
      status: bookingSlotHolds.status,
      expiresAt: bookingSlotHolds.expiresAt,
    })
    .from(bookingSlotHolds)
    .where(
      and(
        eq(bookingSlotHolds.status, "active"),
        gt(bookingSlotHolds.expiresAt, now),
        lt(bookingSlotHolds.slotStartAt, rangeEnd),
        gt(bookingSlotHolds.slotEndAt, rangeStart),
      ),
    );

export type ActiveSlotHoldRow = Awaited<ReturnType<typeof findActiveSlotHolds>>[number];

export const findPublishedProgramBlockers = async (
  rangeStart: Date,
  rangeEnd: Date,
) =>
  db
    .select({
      occurrenceId: scheduledProgramOccurrences.id,
      programId: scheduledPrograms.id,
      title: scheduledPrograms.title,
      startsAt: scheduledProgramOccurrences.startsAt,
      endsAt: scheduledProgramOccurrences.endsAt,
      timezone: scheduledProgramOccurrences.timezone,
    })
    .from(scheduledProgramOccurrences)
    .innerJoin(
      scheduledPrograms,
      eq(scheduledProgramOccurrences.scheduledProgramId, scheduledPrograms.id),
    )
    .where(
      and(
        eq(scheduledPrograms.status, "published"),
        eq(scheduledProgramOccurrences.status, "scheduled"),
        lt(scheduledProgramOccurrences.startsAt, rangeEnd),
        gt(scheduledProgramOccurrences.endsAt, rangeStart),
      ),
    )
    .orderBy(
      asc(scheduledProgramOccurrences.startsAt),
      asc(scheduledProgramOccurrences.endsAt),
      asc(scheduledProgramOccurrences.id),
    );

export type ProgramBlockerRow = Awaited<
  ReturnType<typeof findPublishedProgramBlockers>
>[number];

export const findExternalBusyBlocks = async (rangeStart: Date, rangeEnd: Date) =>
  db
    .select({
      id: externalCalendarBusyBlocks.id,
      startsAt: externalCalendarBusyBlocks.startsAt,
      endsAt: externalCalendarBusyBlocks.endsAt,
      provider: externalCalendarBusyBlocks.provider,
    })
    .from(externalCalendarBusyBlocks)
    .where(
      and(
        eq(externalCalendarBusyBlocks.status, "published"),
        lt(externalCalendarBusyBlocks.startsAt, rangeEnd),
        gt(externalCalendarBusyBlocks.endsAt, rangeStart),
      ),
    );

export type ExternalBusyBlockRow = Awaited<ReturnType<typeof findExternalBusyBlocks>>[number];
