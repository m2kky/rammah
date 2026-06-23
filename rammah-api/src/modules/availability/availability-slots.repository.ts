import { and, eq, gt, gte, inArray, lt, lte } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  availabilityOverrides,
  availabilityRules,
  bookingSlotHolds,
  bookings,
  offerings,
} from "../../db/schema/index.js";

export type SlotOfferingRow = {
  id: string;
  title: string;
  slug: string;
  durationMinutes: number;
  capacity: number;
  status: "draft" | "published" | "scheduled" | "archived";
};

export const findSlotOfferingById = async (id: string) => {
  const rows = await db
    .select({
      id: offerings.id,
      title: offerings.title,
      slug: offerings.slug,
      durationMinutes: offerings.durationMinutes,
      capacity: offerings.capacity,
      status: offerings.status,
    })
    .from(offerings)
    .where(eq(offerings.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const findPublishedSlotRules = async (offeringId: string) => {
  return db
    .select({
      id: availabilityRules.id,
      offeringId: availabilityRules.offeringId,
      weekday: availabilityRules.weekday,
      startTime: availabilityRules.startTime,
      endTime: availabilityRules.endTime,
      timezone: availabilityRules.timezone,
      slotDurationMinutes: availabilityRules.slotDurationMinutes,
      bufferBeforeMinutes: availabilityRules.bufferBeforeMinutes,
      bufferAfterMinutes: availabilityRules.bufferAfterMinutes,
      status: availabilityRules.status,
    })
    .from(availabilityRules)
    .where(
      and(
        eq(availabilityRules.offeringId, offeringId),
        eq(availabilityRules.status, "published"),
      ),
    );
};

export type SlotRuleRow = Awaited<ReturnType<typeof findPublishedSlotRules>>[number];

export const findSlotOverrides = async (
  offeringId: string,
  dateFrom: string,
  dateTo: string,
) => {
  return db
    .select({
      id: availabilityOverrides.id,
      availabilityRuleId: availabilityOverrides.availabilityRuleId,
      offeringId: availabilityOverrides.offeringId,
      date: availabilityOverrides.date,
      overrideType: availabilityOverrides.overrideType,
      startsAt: availabilityOverrides.startsAt,
      endsAt: availabilityOverrides.endsAt,
      reason: availabilityOverrides.reason,
      ruleWeekday: availabilityRules.weekday,
      ruleTimezone: availabilityRules.timezone,
      ruleSlotDurationMinutes: availabilityRules.slotDurationMinutes,
      ruleBufferBeforeMinutes: availabilityRules.bufferBeforeMinutes,
      ruleBufferAfterMinutes: availabilityRules.bufferAfterMinutes,
    })
    .from(availabilityOverrides)
    .leftJoin(availabilityRules, eq(availabilityOverrides.availabilityRuleId, availabilityRules.id))
    .where(
      and(
        eq(availabilityOverrides.offeringId, offeringId),
        gte(availabilityOverrides.date, dateFrom),
        lte(availabilityOverrides.date, dateTo),
      ),
    );
};

export type SlotOverrideRow = Awaited<ReturnType<typeof findSlotOverrides>>[number];

export const findBlockingBookings = async (
  offeringId: string,
  rangeStart: Date,
  rangeEnd: Date,
) => {
  return db
    .select({
      id: bookings.id,
      slotStartAt: bookings.slotStartAt,
      slotEndAt: bookings.slotEndAt,
      status: bookings.status,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.offeringId, offeringId),
        inArray(bookings.status, ["pending_payment", "confirmed"]),
        lt(bookings.slotStartAt, rangeEnd),
        gt(bookings.slotEndAt, rangeStart),
      ),
    );
};

export type BlockingBookingRow = Awaited<ReturnType<typeof findBlockingBookings>>[number];

export const findActiveSlotHolds = async (
  offeringId: string,
  rangeStart: Date,
  rangeEnd: Date,
  now: Date,
) => {
  return db
    .select({
      id: bookingSlotHolds.id,
      slotStartAt: bookingSlotHolds.slotStartAt,
      slotEndAt: bookingSlotHolds.slotEndAt,
      status: bookingSlotHolds.status,
      expiresAt: bookingSlotHolds.expiresAt,
    })
    .from(bookingSlotHolds)
    .where(
      and(
        eq(bookingSlotHolds.offeringId, offeringId),
        eq(bookingSlotHolds.status, "active"),
        gt(bookingSlotHolds.expiresAt, now),
        lt(bookingSlotHolds.slotStartAt, rangeEnd),
        gt(bookingSlotHolds.slotEndAt, rangeStart),
      ),
    );
};

export type ActiveSlotHoldRow = Awaited<ReturnType<typeof findActiveSlotHolds>>[number];
