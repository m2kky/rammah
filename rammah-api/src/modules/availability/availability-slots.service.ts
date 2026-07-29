import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { env } from "../../config/env.js";
import {
  findActiveSlotHolds,
  findBlockingBookings,
  findPublishedSlotRules,
  findSlotOfferingById,
  findSlotOverrides,
  type ActiveSlotHoldRow,
  type BlockingBookingRow,
  type SlotOfferingRow,
  type SlotOverrideRow,
  type SlotRuleRow,
} from "./availability-slots.repository.js";

type SlotStatus = "available" | "blocked" | "booked" | "held";
export type SlotSource = "rule" | "available_override";

export type SlotCandidate = {
  date: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  availabilityRuleId: string | null;
  availabilityOverrideId: string | null;
  source: SlotSource;
};

type CalculatedSlot = {
  date: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: SlotStatus;
  source: SlotSource;
  availabilityRuleId: string | null;
  availabilityOverrideId: string | null;
  remainingCapacity: number;
  bookedCount: number;
  heldCount: number;
  blockedReason: string | null;
};

export type SlotPreviewInput = {
  offeringId: string;
  dateFrom: string;
  dateTo: string;
};

const millisecondsPerMinute = 60 * 1000;
const maxPreviewDays = 31;

const validationError = (
  message: string,
  details: Array<{ field?: string; message: string }> = [],
) =>
  new AppError({
    code: "VALIDATION_ERROR",
    message,
    statusCode: httpStatus.badRequest,
    details,
  });

const assertDate = (value: string, field: "dateFrom" | "dateTo") => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw validationError("Date range must use YYYY-MM-DD format.", [
      { field, message: "Use YYYY-MM-DD format." },
    ]);
  }

  const [, year, month, day] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) {
    throw validationError("Date range contains an invalid date.", [
      { field, message: "Use a valid calendar date." },
    ]);
  }

  return value;
};

const dateStart = (date: string) => new Date(`${date}T00:00:00`);

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

export const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const enumerateDates = (dateFrom: string, dateTo: string) => {
  const start = dateStart(dateFrom);
  const end = dateStart(dateTo);

  if (start > end) {
    throw validationError("Date range is invalid.", [
      { field: "dateFrom", message: "dateFrom must be before or equal to dateTo." },
    ]);
  }

  const dates: Date[] = [];
  let cursor = start;

  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  if (dates.length > maxPreviewDays) {
    throw validationError("Date range is too large.", [
      {
        field: "dateTo",
        message: `Slot preview supports up to ${maxPreviewDays} days.`,
      },
    ]);
  }

  return dates;
};

const normalizeTime = (value: string) => {
  const [hour = "0", minute = "0"] = value.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
};

const combineDateAndTime = (date: string, time: string) =>
  new Date(`${date}T${normalizeTime(time)}:00`);

const overlaps = (
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
) => leftStart < rightEnd && leftEnd > rightStart;

const generateSlotsInWindow = (input: {
  date: string;
  windowStart: Date;
  windowEnd: Date;
  timezone: string;
  slotDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  availabilityRuleId: string | null;
  availabilityOverrideId: string | null;
  source: SlotSource;
}) => {
  const slots: SlotCandidate[] = [];
  const slotDurationMs = input.slotDurationMinutes * millisecondsPerMinute;
  const bufferBeforeMs = input.bufferBeforeMinutes * millisecondsPerMinute;
  const bufferAfterMs = input.bufferAfterMinutes * millisecondsPerMinute;
  let startsAt = new Date(input.windowStart.getTime() + bufferBeforeMs);

  while (startsAt.getTime() + slotDurationMs + bufferAfterMs <= input.windowEnd.getTime()) {
    const endsAt = new Date(startsAt.getTime() + slotDurationMs);

    slots.push({
      date: input.date,
      startsAt,
      endsAt,
      timezone: input.timezone,
      availabilityRuleId: input.availabilityRuleId,
      availabilityOverrideId: input.availabilityOverrideId,
      source: input.source,
    });

    startsAt = new Date(endsAt.getTime() + bufferAfterMs + bufferBeforeMs);
  }

  return slots;
};

export const buildRuleSlots = (dates: Date[], rules: SlotRuleRow[]) =>
  dates.flatMap((date) => {
    const dateKey = toDateKey(date);
    const weekday = date.getDay();

    return rules
      .filter((rule) => rule.weekday === weekday)
      .flatMap((rule) =>
        generateSlotsInWindow({
          date: dateKey,
          windowStart: combineDateAndTime(dateKey, rule.startTime),
          windowEnd: combineDateAndTime(dateKey, rule.endTime),
          timezone: rule.timezone,
          slotDurationMinutes: rule.slotDurationMinutes,
          bufferBeforeMinutes: rule.bufferBeforeMinutes,
          bufferAfterMinutes: rule.bufferAfterMinutes,
          availabilityRuleId: rule.id,
          availabilityOverrideId: null,
          source: "rule",
        }),
      );
  });

export const buildAvailableOverrideSlots = (
  offering: SlotOfferingRow,
  overrides: SlotOverrideRow[],
) =>
  overrides
    .filter((override) => override.overrideType === "available" && override.startsAt && override.endsAt)
    .flatMap((override) =>
      generateSlotsInWindow({
        date: override.date,
        windowStart: override.startsAt as Date,
        windowEnd: override.endsAt as Date,
        timezone: override.ruleTimezone ?? "Africa/Cairo",
        slotDurationMinutes: override.ruleSlotDurationMinutes ?? offering.durationMinutes,
        bufferBeforeMinutes: override.ruleBufferBeforeMinutes ?? 0,
        bufferAfterMinutes: override.ruleBufferAfterMinutes ?? 0,
        availabilityRuleId: override.availabilityRuleId,
        availabilityOverrideId: override.id,
        source: "available_override",
      }),
    );

export const dedupeSlots = (slots: SlotCandidate[]) => {
  const slotMap = new Map<string, SlotCandidate>();

  for (const slot of slots) {
    const key = `${slot.startsAt.getTime()}-${slot.endsAt.getTime()}`;
    const existing = slotMap.get(key);

    if (!existing || slot.source === "available_override") {
      slotMap.set(key, slot);
    }
  }

  return [...slotMap.values()].sort(
    (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
  );
};

export const findBlockingOverride = (slot: SlotCandidate, overrides: SlotOverrideRow[]) =>
  overrides.find((override) => {
    if (override.overrideType !== "blocked" || override.date !== slot.date) {
      return false;
    }

    if (override.availabilityRuleId && override.availabilityRuleId !== slot.availabilityRuleId) {
      return false;
    }

    if (!override.startsAt && !override.endsAt) {
      return true;
    }

    if (!override.startsAt || !override.endsAt) {
      return false;
    }

    return overlaps(slot.startsAt, slot.endsAt, override.startsAt, override.endsAt);
  });

const countOverlaps = (
  slot: SlotCandidate,
  rows: Array<BlockingBookingRow | ActiveSlotHoldRow>,
) =>
  rows.filter((row) => {
    if (!row.slotStartAt || !row.slotEndAt) {
      return false;
    }

    return overlaps(slot.startsAt, slot.endsAt, row.slotStartAt, row.slotEndAt);
  }).length;

const calculateSlotStatus = (input: {
  slot: SlotCandidate;
  offering: SlotOfferingRow;
  overrides: SlotOverrideRow[];
  bookings: BlockingBookingRow[];
  holds: ActiveSlotHoldRow[];
}): CalculatedSlot => {
  const blockingOverride = findBlockingOverride(input.slot, input.overrides);
  const bookedCount = countOverlaps(input.slot, input.bookings);
  const heldCount = countOverlaps(input.slot, input.holds);
  const capacity = input.offering.capacity;
  const blockedReason = blockingOverride?.reason ?? null;
  let status: SlotStatus = "available";

  if (blockingOverride) {
    status = "blocked";
  } else if (bookedCount >= capacity) {
    status = "booked";
  } else if (bookedCount + heldCount >= capacity) {
    status = "held";
  }

  return {
    date: input.slot.date,
    startsAt: input.slot.startsAt.toISOString(),
    endsAt: input.slot.endsAt.toISOString(),
    timezone: input.slot.timezone,
    status,
    source: input.slot.source,
    availabilityRuleId: input.slot.availabilityRuleId,
    availabilityOverrideId: input.slot.availabilityOverrideId,
    remainingCapacity:
      status === "blocked" ? 0 : Math.max(capacity - bookedCount - heldCount, 0),
    bookedCount,
    heldCount,
    blockedReason,
  };
};

export const previewAvailabilitySlots = async (input: SlotPreviewInput) => {
  const dateFrom = assertDate(input.dateFrom, "dateFrom");
  const dateTo = assertDate(input.dateTo, "dateTo");
  const dates = enumerateDates(dateFrom, dateTo);
  const rangeStart = dateStart(dateFrom);
  const rangeEnd = addDays(dateStart(dateTo), 1);

  const offering = await findSlotOfferingById(input.offeringId);

  if (!offering) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const [rules, overrides, bookings, holds] = await Promise.all([
    findPublishedSlotRules(offering.id),
    findSlotOverrides(offering.id, dateFrom, dateTo),
    findBlockingBookings(offering.id, rangeStart, rangeEnd),
    findActiveSlotHolds(offering.id, rangeStart, rangeEnd, new Date()),
  ]);

  const candidates = dedupeSlots([
    ...buildRuleSlots(dates, rules),
    ...buildAvailableOverrideSlots(offering, overrides),
  ]).filter(
    (slot) =>
      slot.startsAt.getTime() - Date.now() >=
      env.BOOKING_MINIMUM_NOTICE_MINUTES * millisecondsPerMinute,
  );
  const calculatedSlots = candidates.map((slot) =>
    calculateSlotStatus({
      slot,
      offering,
      overrides,
      bookings,
      holds,
    }),
  );

  const days = dates.map((date) => {
    const dateKey = toDateKey(date);
    const slots = calculatedSlots.filter((slot) => slot.date === dateKey);

    return {
      date: dateKey,
      weekday: date.getDay(),
      slots,
      availableCount: slots.filter((slot) => slot.status === "available").length,
      totalCount: slots.length,
    };
  });

  return {
    offering: {
      id: offering.id,
      title: offering.title,
      slug: offering.slug,
      capacity: offering.capacity,
      durationMinutes: offering.durationMinutes,
      status: offering.status,
    },
    dateFrom,
    dateTo,
    days,
    availableCount: days.reduce((total, day) => total + day.availableCount, 0),
    totalCount: days.reduce((total, day) => total + day.totalCount, 0),
    generatedAt: new Date().toISOString(),
  };
};

export const previewPublicAvailabilitySlots = async (input: SlotPreviewInput) => {
  const preview = await previewAvailabilitySlots(input);

  if (preview.offering.status !== "published") {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  return preview;
};
