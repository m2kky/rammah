import { env } from "../../config/env.js";
import { instantToDateKey } from "../../shared/datetime/iana-wall-time.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  findPublicProgramCapacity,
  findPublicProgramOccurrences,
  findPublicPrograms,
  type PublicProgramRow,
} from "./public-programs.repository.js";

export type PublicProgramsInput = {
  offeringId?: string;
  dateFrom: string;
  dateTo: string;
  locale?: "en" | "ar";
};

const maxPreviewDays = 366;

const validationError = (message: string, field: string) =>
  new AppError({
    code: "VALIDATION_ERROR",
    message,
    statusCode: httpStatus.badRequest,
    details: [{ field, message }],
  });

const parseDate = (value: string, field: "dateFrom" | "dateTo") => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw validationError("Use YYYY-MM-DD format.", field);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw validationError("Use a valid calendar date.", field);
  }
  return date;
};

const assertRange = (input: PublicProgramsInput) => {
  const start = parseDate(input.dateFrom, "dateFrom");
  const end = parseDate(input.dateTo, "dateTo");
  if (start > end) throw validationError("dateFrom must be before dateTo.", "dateFrom");
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > maxPreviewDays) {
    throw validationError(`Program discovery supports up to ${maxPreviewDays} days.`, "dateTo");
  }
};

const locationDto = (row: {
  locationId: string | null;
  locationName: string | null;
  locationAddressLine1: string | null;
  locationAddressLine2: string | null;
  locationCity: string | null;
  locationCountryCode: string | null;
  locationMapUrl: string | null;
  locationInstructions: string | null;
}) =>
  row.locationId
    ? {
        id: row.locationId,
        name: row.locationName,
        addressLine1: row.locationAddressLine1,
        addressLine2: row.locationAddressLine2,
        city: row.locationCity,
        countryCode: row.locationCountryCode,
        mapUrl: row.locationMapUrl,
        instructions: row.locationInstructions,
      }
    : null;

const toPublicProgram = async (program: PublicProgramRow, now: Date) => {
  const [occurrences, counts] = await Promise.all([
    findPublicProgramOccurrences(program.id),
    findPublicProgramCapacity(program.id, now),
  ]);
  if (occurrences.length === 0) return null;
  const firstOccurrence = occurrences[0]!;
  if (
    firstOccurrence.startsAt.getTime() - now.getTime() <
    env.BOOKING_MINIMUM_NOTICE_MINUTES * 60_000
  ) {
    return null;
  }
  const remainingCapacity = Math.max(
    program.capacity - counts.bookedCount - counts.heldCount,
    0,
  );
  return {
    id: program.id,
    scheduledProgramId: program.id,
    title: program.title,
    offering: {
      id: program.offeringId,
      title: program.offeringTitle,
      slug: program.offeringSlug,
      bookingMode: program.offeringBookingMode,
    },
    timezone: program.timezone,
    attendanceMode: program.attendanceMode,
    location: locationDto(program),
    registrationOpensAt: program.registrationOpensAt?.toISOString() ?? null,
    registrationClosesAt: program.registrationClosesAt?.toISOString() ?? null,
    capacity: program.capacity,
    remainingCapacity,
    bookedCount: counts.bookedCount,
    heldCount: counts.heldCount,
    status: remainingCapacity > 0 ? ("available" as const) : ("full" as const),
    date: instantToDateKey(firstOccurrence.startsAt, firstOccurrence.timezone),
    startsAt: firstOccurrence.startsAt.toISOString(),
    endsAt: occurrences[occurrences.length - 1]!.endsAt.toISOString(),
    occurrences: occurrences.map((occurrence) => ({
      id: occurrence.id,
      date: instantToDateKey(occurrence.startsAt, occurrence.timezone),
      startsAt: occurrence.startsAt.toISOString(),
      endsAt: occurrence.endsAt.toISOString(),
      timezone: occurrence.timezone,
      attendanceMode: occurrence.attendanceMode,
      location: locationDto(occurrence),
      sortOrder: occurrence.sortOrder,
    })),
  };
};

export const listPublicPrograms = async (input: PublicProgramsInput) => {
  assertRange(input);
  const now = new Date();
  const rows = await findPublicPrograms(input.offeringId);
  const registrationOpen = rows.filter(
    (program) =>
      (!program.registrationOpensAt || program.registrationOpensAt <= now) &&
      (!program.registrationClosesAt || program.registrationClosesAt > now),
  );
  const hydrated = await Promise.all(registrationOpen.map((program) => toPublicProgram(program, now)));
  const programs = hydrated
    .filter((program): program is NonNullable<typeof program> => Boolean(program))
    .filter((program) => {
      const firstDate = program.occurrences[0]!.date;
      return firstDate >= input.dateFrom && firstDate <= input.dateTo;
    })
    .sort(
      (left, right) =>
        left.occurrences[0]!.startsAt.localeCompare(right.occurrences[0]!.startsAt) ||
        left.title.localeCompare(right.title) ||
        left.id.localeCompare(right.id),
    );
  return {
    offeringId: input.offeringId ?? null,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    locale: input.locale ?? "en",
    programs,
    generatedAt: now.toISOString(),
  };
};
