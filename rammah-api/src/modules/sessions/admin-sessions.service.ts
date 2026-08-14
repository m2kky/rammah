import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  findAdminSessionById,
  findAdminSessions,
  type AdminSessionFilters,
  type AdminSessionRow,
  type AttendanceMode,
  type ContentStatus,
} from "./admin-sessions.repository.js";

export type AdminSessionInput = {
  offeringId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: number;
  attendanceMode: AttendanceMode;
  locationId?: string | null;
  googleCalendarEventId?: string | null;
  status: ContentStatus;
};

export type AdminSessionPatchInput = Partial<AdminSessionInput>;
export type AdminSessionListFilters = Omit<AdminSessionFilters, "dateFrom" | "dateTo"> & {
  dateFrom?: string;
  dateTo?: string;
};

const notFoundError = () =>
  new AppError({
    code: "NOT_FOUND",
    message: "Session was not found.",
    statusCode: httpStatus.notFound,
  });

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

const parseOptionalTimestamp = (
  value: string | undefined,
  field: "dateFrom" | "dateTo",
) => {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw validationError("Date filter is invalid.", [
      { field, message: "Use an ISO timestamp." },
    ]);
  }

  return date;
};

const toAdminSession = (session: AdminSessionRow) => ({
  id: session.id,
  scheduledProgramId: session.scheduledProgramId,
  offering: {
    id: session.offeringId,
    title: session.offeringTitle,
    slug: session.offeringSlug,
    attendanceMode: session.offeringAttendanceMode,
  },
  startsAt: session.startsAt.toISOString(),
  endsAt: session.endsAt.toISOString(),
  timezone: session.timezone,
  capacity: session.capacity,
  attendanceMode: session.attendanceMode,
  location: session.locationId
    ? {
        id: session.locationId,
        name: session.locationName,
        city: session.locationCity,
        countryCode: session.locationCountryCode,
      }
    : null,
  googleCalendarEventId: session.googleCalendarEventId,
  status: session.status,
  createdAt: session.createdAt.toISOString(),
  updatedAt: session.updatedAt.toISOString(),
});

const legacyWriteConflict = () =>
  new AppError({
    code: "CONFLICT",
    message: "Legacy sessions are read-only after the scheduling migration.",
    statusCode: httpStatus.conflict,
    details: [
      {
        field: "session",
        message: "Create and manage fixed schedules from Events & Programs.",
      },
    ],
  });

export const listAdminSessions = async (filters: AdminSessionListFilters) => {
  const sessions = await findAdminSessions({
    offeringId: filters.offeringId,
    locationId: filters.locationId,
    attendanceMode: filters.attendanceMode,
    status: filters.status,
    dateFrom: parseOptionalTimestamp(filters.dateFrom, "dateFrom"),
    dateTo: parseOptionalTimestamp(filters.dateTo, "dateTo"),
  });

  return sessions.map(toAdminSession);
};

export const getAdminSession = async (id: string) => {
  const session = await findAdminSessionById(id);
  if (!session) throw notFoundError();
  return toAdminSession(session);
};

export const createAdminSession = async (
  _input: AdminSessionInput,
  _auditContext?: unknown,
): Promise<never> => {
  throw legacyWriteConflict();
};

export const updateAdminSessionById = async (
  _id: string,
  _input: AdminSessionPatchInput,
  _auditContext?: unknown,
): Promise<never> => {
  throw legacyWriteConflict();
};

export const archiveAdminSessionById = async (
  _id: string,
  _auditContext?: unknown,
): Promise<never> => {
  throw legacyWriteConflict();
};
