import {
  instantToDateKey,
  wallTimeToInstant,
} from "../../shared/datetime/iana-wall-time.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  findActiveSlotHolds,
  findAvailabilityTimezone,
  findBlockingBookings,
  findExternalBusyBlocks,
  findGlobalAvailabilityOverrides,
  findPublishedAvailabilityWindows,
  findPublishedProgramBlockers,
  findSlotOfferingById,
  type ActiveSlotHoldRow,
  type BlockingBookingRow,
  type ExternalBusyBlockRow,
  type ProgramBlockerRow,
  type SlotOfferingRow,
  type SlotOverrideRow,
  type SlotWindowRow,
} from "./availability-slots.repository.js";
import {
  isEligibleBookingTarget,
  toAdminPublicBookingPolicy,
  toPublicBookingPolicy,
} from "./booking-policy.js";
import { getCurrentBookingPolicy } from "./booking-policy.service.js";

type SlotStatus = "available" | "blocked" | "booked" | "held";
export type SlotSource = "window" | "available_override";

export type SlotCandidate = {
  date: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  availabilityWindowId: string | null;
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
  availabilityWindowId: string | null;
  availabilityOverrideId: string | null;
  remainingCapacity: number;
  bookedCount: number;
  heldCount: number;
  blockedReason: string | null;
  publicBookingPolicy: {
    bookable: boolean;
    reason: "minimum_advance_days" | null;
    earliestBookableDate: string;
  };
};

const toPublicSlot = (slot: CalculatedSlot): Omit<CalculatedSlot, "publicBookingPolicy"> => ({
  date: slot.date,
  startsAt: slot.startsAt,
  endsAt: slot.endsAt,
  timezone: slot.timezone,
  status: slot.status,
  source: slot.source,
  availabilityWindowId: slot.availabilityWindowId,
  availabilityOverrideId: slot.availabilityOverrideId,
  remainingCapacity: slot.remainingCapacity,
  bookedCount: slot.bookedCount,
  heldCount: slot.heldCount,
  blockedReason: slot.blockedReason,
});

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

const dateStart = (date: string) => new Date(`${date}T00:00:00.000Z`);
const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
};

export const toDateKey = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
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
      { field: "dateTo", message: `Slot preview supports up to ${maxPreviewDays} days.` },
    ]);
  }
  return dates;
};

const normalizeTime = (value: string) => {
  const [hour = "0", minute = "0"] = value.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
};
const combineDateAndTime = (date: string, time: string, timezone: string) =>
  wallTimeToInstant({ date, time: `${normalizeTime(time)}:00`, timezone });

const overlaps = (
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
) => leftStart < rightEnd && leftEnd > rightStart;

const exactTarget = (
  slot: SlotCandidate,
  row: { slotStartAt: Date | null; slotEndAt: Date | null },
) =>
  row.slotStartAt?.getTime() === slot.startsAt.getTime() &&
  row.slotEndAt?.getTime() === slot.endsAt.getTime();

const generateSlotsInWindow = (input: {
  date: string;
  windowStart: Date;
  windowEnd: Date;
  timezone: string;
  offering: SlotOfferingRow;
  availabilityWindowId: string | null;
  availabilityOverrideId: string | null;
  source: SlotSource;
}) => {
  if (input.offering.durationMinutes === null) return [];
  const slots: SlotCandidate[] = [];
  const slotDurationMs = input.offering.durationMinutes * millisecondsPerMinute;
  const bufferBeforeMs = input.offering.bufferBeforeMinutes * millisecondsPerMinute;
  const bufferAfterMs = input.offering.bufferAfterMinutes * millisecondsPerMinute;
  let startsAt = new Date(input.windowStart.getTime() + bufferBeforeMs);

  while (startsAt.getTime() + slotDurationMs + bufferAfterMs <= input.windowEnd.getTime()) {
    const endsAt = new Date(startsAt.getTime() + slotDurationMs);
    slots.push({
      date: input.date,
      startsAt,
      endsAt,
      timezone: input.timezone,
      availabilityWindowId: input.availabilityWindowId,
      availabilityOverrideId: input.availabilityOverrideId,
      source: input.source,
    });
    startsAt = new Date(endsAt.getTime() + bufferAfterMs + bufferBeforeMs);
  }
  return slots;
};

export const buildWindowSlots = (
  dates: Date[],
  windows: SlotWindowRow[],
  offering: SlotOfferingRow,
  timezone: string,
) =>
  dates.flatMap((date) => {
    const dateKey = toDateKey(date);
    const weekday = date.getUTCDay();
    return windows
      .filter((window) => window.weekday === weekday)
      .flatMap((window) =>
        generateSlotsInWindow({
          date: dateKey,
          windowStart: combineDateAndTime(dateKey, window.startLocalTime, timezone),
          windowEnd: combineDateAndTime(dateKey, window.endLocalTime, timezone),
          timezone,
          offering,
          availabilityWindowId: window.id,
          availabilityOverrideId: null,
          source: "window",
        }),
      );
  });

export const buildAvailableOverrideSlots = (
  offering: SlotOfferingRow,
  overrides: SlotOverrideRow[],
  timezone: string,
) =>
  overrides
    .filter(
      (override) =>
        override.overrideMode === "available" &&
        override.startLocalTime &&
        override.endLocalTime,
    )
    .flatMap((override) =>
      generateSlotsInWindow({
        date: override.date,
        windowStart: combineDateAndTime(override.date, override.startLocalTime!, timezone),
        windowEnd: combineDateAndTime(override.date, override.endLocalTime!, timezone),
        timezone,
        offering,
        availabilityWindowId: null,
        availabilityOverrideId: override.id,
        source: "available_override",
      }),
    );

export const dedupeSlots = (slots: SlotCandidate[]) => {
  const slotMap = new Map<string, SlotCandidate>();
  for (const slot of slots) {
    const key = `${slot.startsAt.getTime()}-${slot.endsAt.getTime()}-${slot.timezone}`;
    const existing = slotMap.get(key);
    if (!existing || slot.source === "available_override") slotMap.set(key, slot);
  }
  return [...slotMap.values()].sort(
    (left, right) =>
      left.startsAt.getTime() - right.startsAt.getTime() ||
      left.endsAt.getTime() - right.endsAt.getTime() ||
      (left.availabilityWindowId ?? left.availabilityOverrideId ?? "").localeCompare(
        right.availabilityWindowId ?? right.availabilityOverrideId ?? "",
      ),
  );
};

export const findBlockingOverride = (
  slot: SlotCandidate,
  overrides: SlotOverrideRow[],
) =>
  overrides.find(
    (override) =>
      override.overrideMode === "unavailable" && override.date === slot.date,
  );

const intervalOverlapsSlot = (
  slot: SlotCandidate,
  row: { slotStartAt: Date | null; slotEndAt: Date | null },
) =>
  Boolean(
    row.slotStartAt &&
      row.slotEndAt &&
      overlaps(slot.startsAt, slot.endsAt, row.slotStartAt, row.slotEndAt),
  );

const calculateSlotStatus = (input: {
  slot: SlotCandidate;
  offering: SlotOfferingRow;
  bookings: BlockingBookingRow[];
  holds: ActiveSlotHoldRow[];
  programs: ProgramBlockerRow[];
  busyBlocks: ExternalBusyBlockRow[];
}): Omit<CalculatedSlot, "publicBookingPolicy"> => {
  const sameTargetBookings = input.bookings.filter(
    (row) => row.offeringId === input.offering.id && exactTarget(input.slot, row),
  );
  const sameTargetHolds = input.holds.filter(
    (row) => row.offeringId === input.offering.id && exactTarget(input.slot, row),
  );
  const conflictingAppointment = [...input.bookings, ...input.holds].find(
    (row) => intervalOverlapsSlot(input.slot, row) &&
      !(row.offeringId === input.offering.id && exactTarget(input.slot, row)),
  );
  const program = input.programs.find((row) =>
    overlaps(input.slot.startsAt, input.slot.endsAt, row.startsAt, row.endsAt),
  );
  const busyBlock = input.busyBlocks.find((row) =>
    overlaps(input.slot.startsAt, input.slot.endsAt, row.startsAt, row.endsAt),
  );
  const bookedCount = sameTargetBookings.length;
  const heldCount = sameTargetHolds.length;
  let status: SlotStatus = "available";
  let blockedReason: string | null = null;

  if (program) {
    status = "blocked";
    blockedReason = `Program: ${program.title}`;
  } else if (busyBlock) {
    status = "blocked";
    blockedReason = "External calendar is busy at this time.";
  } else if (conflictingAppointment) {
    status = "blocked";
    blockedReason = "Another appointment is scheduled at this time.";
  } else if (bookedCount >= input.offering.capacity) {
    status = "booked";
  } else if (bookedCount + heldCount >= input.offering.capacity) {
    status = "held";
  }

  return {
    date: input.slot.date,
    startsAt: input.slot.startsAt.toISOString(),
    endsAt: input.slot.endsAt.toISOString(),
    timezone: input.slot.timezone,
    status,
    source: input.slot.source,
    availabilityWindowId: input.slot.availabilityWindowId,
    availabilityOverrideId: input.slot.availabilityOverrideId,
    remainingCapacity:
      status === "blocked" ? 0 : Math.max(input.offering.capacity - bookedCount - heldCount, 0),
    bookedCount,
    heldCount,
    blockedReason,
  };
};

export const previewAvailabilitySlots = async (input: SlotPreviewInput) => {
  const dateFrom = assertDate(input.dateFrom, "dateFrom");
  const dateTo = assertDate(input.dateTo, "dateTo");
  const dates = enumerateDates(dateFrom, dateTo);
  const rangeStart = addDays(dateStart(dateFrom), -1);
  const rangeEnd = addDays(dateStart(dateTo), 2);
  const offering = await findSlotOfferingById(input.offeringId);
  if (!offering) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering was not found.",
      statusCode: httpStatus.notFound,
    });
  }
  if (offering.schedulingMode !== "appointment" || offering.durationMinutes === null) {
    throw validationError("Availability preview requires a regular appointment Offering.", [
      { field: "offeringId", message: "Choose an Offering with appointment scheduling." },
    ]);
  }

  const now = new Date();
  const [timezone, windows, overrides, bookings, holds, programs, busyBlocks, bookingPolicy] =
    await Promise.all([
      findAvailabilityTimezone(),
      findPublishedAvailabilityWindows(),
      findGlobalAvailabilityOverrides(dateFrom, dateTo),
      findBlockingBookings(rangeStart, rangeEnd),
      findActiveSlotHolds(rangeStart, rangeEnd, now),
      findPublishedProgramBlockers(rangeStart, rangeEnd),
      findExternalBusyBlocks(rangeStart, rangeEnd),
      getCurrentBookingPolicy(now),
    ]);
  const closedDates = new Set(
    overrides
      .filter(({ overrideMode }) => overrideMode === "unavailable")
      .map(({ date }) => date),
  );
  const candidates = dedupeSlots([
    ...buildWindowSlots(dates, windows, offering, timezone),
    ...buildAvailableOverrideSlots(offering, overrides, timezone),
  ])
    .filter((slot) => !closedDates.has(slot.date));
  const calculatedSlots = candidates.map((slot) =>
    ({
      ...calculateSlotStatus({ slot, offering, bookings, holds, programs, busyBlocks }),
      publicBookingPolicy: toAdminPublicBookingPolicy(slot.startsAt, bookingPolicy),
    }),
  );
  const visiblePrograms = programs.filter((program) => {
    const startDate = instantToDateKey(program.startsAt, timezone);
    const inclusiveEnd = new Date(program.endsAt.getTime() - 1);
    const endDate = instantToDateKey(inclusiveEnd, timezone);
    return startDate <= dateTo && endDate >= dateFrom;
  });
  const days = dates.map((date) => {
    const dateKey = toDateKey(date);
    const slots = calculatedSlots.filter((slot) => slot.date === dateKey);
    return {
      date: dateKey,
      weekday: date.getUTCDay(),
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
      schedulingMode: offering.schedulingMode,
      capacity: offering.capacity,
      durationMinutes: offering.durationMinutes,
      bufferBeforeMinutes: offering.bufferBeforeMinutes,
      bufferAfterMinutes: offering.bufferAfterMinutes,
      status: offering.status,
    },
    timezone,
    dateFrom,
    dateTo,
    bookingPolicy: toPublicBookingPolicy(bookingPolicy),
    days,
    programBlockers: visiblePrograms.map((program) => ({
      occurrenceId: program.occurrenceId,
      programId: program.programId,
      title: program.title,
      startsAt: program.startsAt.toISOString(),
      endsAt: program.endsAt.toISOString(),
      timezone: program.timezone,
      readOnly: true as const,
    })),
    availableCount: days.reduce((total, day) => total + day.availableCount, 0),
    totalCount: days.reduce((total, day) => total + day.totalCount, 0),
    generatedAt: now.toISOString(),
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
  const days = preview.days.map((day) => {
    const slots = day.slots
      .filter(({ publicBookingPolicy }) => publicBookingPolicy.bookable)
      .map(toPublicSlot);
    return {
      ...day,
      slots,
      availableCount: slots.filter(({ status }) => status === "available").length,
      totalCount: slots.length,
    };
  });
  return {
    ...preview,
    days,
    availableCount: days.reduce((total, day) => total + day.availableCount, 0),
    totalCount: days.reduce((total, day) => total + day.totalCount, 0),
  };
};
