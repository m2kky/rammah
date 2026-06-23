import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  findPublicSessions,
  findSessionActiveHolds,
  findSessionBlockingBookings,
  type PublicSessionRow,
} from "./public-sessions.repository.js";

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

const dateStart = (date: string) => new Date(`${date}T00:00:00`);

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const daysBetween = (start: Date, end: Date) =>
  Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

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
    rangeStart,
    rangeEnd: addDays(rangeEndDate, 1),
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
  const capacity = Math.max(session.capacity, 1);
  const remainingCapacity = Math.max(capacity - bookedCount - heldCount, 0);

  return {
    id: session.id,
    offering: {
      id: session.offeringId,
      title: session.offeringTitle,
      slug: session.offeringSlug,
    },
    date: toDateKey(session.startsAt),
    startsAt: session.startsAt.toISOString(),
    endsAt: session.endsAt.toISOString(),
    timezone: session.timezone,
    capacity,
    attendanceMode: session.attendanceMode,
    location: session.locationId
      ? {
          id: session.locationId,
          name: session.locationName,
          city: session.locationCity,
          countryCode: session.locationCountryCode,
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
  const sessions = await findPublicSessions({
    offeringId: input.offeringId,
    rangeStart: range.rangeStart,
    rangeEnd: range.rangeEnd,
  });

  const futureSessions = sessions.filter((session) => session.startsAt > now);

  return {
    offeringId: input.offeringId,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    sessions: await Promise.all(
      futureSessions.map((session) => toPublicSession(session, now)),
    ),
    generatedAt: now.toISOString(),
  };
};
