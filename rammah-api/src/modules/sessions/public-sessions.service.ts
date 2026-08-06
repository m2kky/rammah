import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { instantToDateKey } from "../../shared/datetime/iana-wall-time.js";
import {
  findPublicSessions,
  findSessionActiveHolds,
  findSessionBlockingBookings,
  type PublicSessionRow,
} from "./public-sessions.repository.js";
import {
  isEligibleBookingTarget,
  toPublicBookingPolicy,
} from "../availability/booking-policy.js";
import { getCurrentBookingPolicy } from "../availability/booking-policy.service.js";

export type PublicSessionsInput = {
  offeringId: string;
  dateFrom: string;
  dateTo: string;
};

const maxPreviewDays = 92;

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

const daysBetween = (start: Date, end: Date) =>
  Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

const assertRange = (input: { dateFrom: string; dateTo: string }) => {
  const dateFrom = assertDate(input.dateFrom, "dateFrom");
  const dateTo = assertDate(input.dateTo, "dateTo");
  const rangeStart = dateStart(dateFrom);
  const rangeEndDate = dateStart(dateTo);

  if (rangeStart > rangeEndDate) {
    throw validationError("Date range is invalid.", [
      { field: "dateFrom", message: "dateFrom must be before or equal to dateTo." },
    ]);
  }

  if (daysBetween(rangeStart, rangeEndDate) > maxPreviewDays) {
    throw validationError("Date range is too large.", [
      { field: "dateTo", message: `Session preview supports up to ${maxPreviewDays} days.` },
    ]);
  }

  return {
    dateFrom,
    dateTo,
    rangeStart: addDays(rangeStart, -1),
    rangeEnd: addDays(rangeEndDate, 2),
  };
};

const getSessionCounts = async (sessionId: string, now: Date) => {
  const [bookings, holds] = await Promise.all([
    findSessionBlockingBookings(sessionId),
    findSessionActiveHolds(sessionId, now),
  ]);

  return {
    bookedCount: bookings.length,
    heldCount: holds.length,
  };
};

const toPublicSession = async (session: PublicSessionRow, now: Date) => {
  const { bookedCount, heldCount } = await getSessionCounts(session.id, now);
  const capacity = session.capacity;
  const remainingCapacity = Math.max(capacity - bookedCount - heldCount, 0);

  return {
    id: session.id,
    scheduledProgramId: session.scheduledProgramId,
    offering: {
      id: session.offeringId,
      title: session.offeringTitle,
      slug: session.offeringSlug,
    },
    date: instantToDateKey(session.startsAt, session.timezone),
    startsAt: session.startsAt.toISOString(),
    endsAt: session.endsAt.toISOString(),
    timezone: session.timezone,
    capacity,
    attendanceMode: session.attendanceMode,
    location: session.locationId
      ? {
          id: session.locationId,
          name: session.locationName,
          addressLine1: session.locationAddressLine1,
          addressLine2: session.locationAddressLine2,
          city: session.locationCity,
          countryCode: session.locationCountryCode,
          mapUrl: session.locationMapUrl,
          instructions: session.locationInstructions,
        }
      : null,
    status: remainingCapacity > 0 ? "available" : "booked",
    remainingCapacity,
    bookedCount,
    heldCount,
  };
};

export const listPublicOfferingSessions = async (input: PublicSessionsInput) => {
  const range = assertRange(input);
  const now = new Date();
  const [sessions, bookingPolicy] = await Promise.all([
    findPublicSessions({
      offeringId: input.offeringId,
      rangeStart: range.rangeStart,
      rangeEnd: range.rangeEnd,
    }),
    getCurrentBookingPolicy(now),
  ]);
  const futureSessions = sessions.filter((session) => {
    const localDate = instantToDateKey(session.startsAt, session.timezone);

    return (
      isEligibleBookingTarget(session.startsAt, bookingPolicy) &&
      localDate >= range.dateFrom &&
      localDate <= range.dateTo
    );
  });
  const publicSessions = await Promise.all(
    futureSessions.map((session) => toPublicSession(session, now)),
  );
  publicSessions.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );

  return {
    offeringId: input.offeringId,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    bookingPolicy: toPublicBookingPolicy(bookingPolicy),
    sessions: publicSessions,
    generatedAt: now.toISOString(),
  };
};
