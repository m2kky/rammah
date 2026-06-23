import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import {
  archiveAdminSession,
  findAdminSessionById,
  findAdminSessions,
  findLocationForSession,
  findOfferingForSession,
  insertAdminSession,
  updateAdminSession,
  type AdminSessionFilters,
  type AdminSessionInsert,
  type AdminSessionRow,
  type AdminSessionUpdate,
  type AttendanceMode,
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
  status: AdminSessionInsert["status"];
};

export type AdminSessionPatchInput = Partial<AdminSessionInput>;
export type AdminSessionListFilters = Omit<AdminSessionFilters, "dateFrom" | "dateTo"> & {
  dateFrom?: string;
  dateTo?: string;
};

const removeUndefined = <T extends Record<string, unknown>>(input: T) =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

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

const normalizeOptionalText = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = value.trim();
  return normalized ? normalized : null;
};

const parseTimestamp = (value: string, field: "startsAt" | "endsAt") => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw validationError("Timestamp is invalid.", [
      { field, message: "Use an ISO timestamp." },
    ]);
  }

  return date;
};

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

const toIsoStringOrNull = (value: Date | null) =>
  value ? value.toISOString() : null;

const toAdminSession = (session: AdminSessionRow) => ({
  id: session.id,
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

const assertOffering = async (input: {
  offeringId: string;
  attendanceMode: AttendanceMode;
}) => {
  const offering = await findOfferingForSession(input.offeringId);

  if (!offering) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (
    offering.attendanceMode !== "hybrid" &&
    offering.attendanceMode !== input.attendanceMode
  ) {
    throw validationError("Session attendance mode is not available for this offering.", [
      {
        field: "attendanceMode",
        message: `Use ${offering.attendanceMode} for this offering, or set the offering to hybrid.`,
      },
    ]);
  }
};

const assertLocation = async (input: {
  attendanceMode: AttendanceMode;
  locationId?: string | null;
}) => {
  if (input.attendanceMode === "online") {
    return;
  }

  if (!input.locationId) {
    throw validationError("Offline and hybrid sessions require a location.", [
      {
        field: "locationId",
        message: "Select an offline location for this session.",
      },
    ]);
  }

  const location = await findLocationForSession(input.locationId);

  if (!location) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Location was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (location.status === "archived") {
    throw validationError("Archived locations cannot be assigned to sessions.", [
      {
        field: "locationId",
        message: "Select an active location.",
      },
    ]);
  }
};

const assertSessionWindow = (input: { startsAt: Date; endsAt: Date }) => {
  if (input.startsAt >= input.endsAt) {
    throw validationError("Session start must be before end.", [
      {
        field: "startsAt",
        message: "Start timestamp must be before end timestamp.",
      },
    ]);
  }
};

const normalizeSessionLocationId = (input: {
  attendanceMode: AttendanceMode;
  locationId?: string | null;
}) => (input.attendanceMode === "online" ? null : input.locationId ?? null);

export const listAdminSessions = async (
  filters: AdminSessionListFilters,
) => {
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

  if (!session) {
    throw notFoundError();
  }

  return toAdminSession(session);
};

export const createAdminSession = async (
  input: AdminSessionInput,
  auditContext?: AuditContext,
) => {
  const startsAt = parseTimestamp(input.startsAt, "startsAt");
  const endsAt = parseTimestamp(input.endsAt, "endsAt");
  assertSessionWindow({ startsAt, endsAt });

  await assertOffering({
    offeringId: input.offeringId,
    attendanceMode: input.attendanceMode,
  });
  await assertLocation({
    attendanceMode: input.attendanceMode,
    locationId: input.locationId,
  });

  const session = await insertAdminSession({
    offeringId: input.offeringId,
    startsAt,
    endsAt,
    timezone: input.timezone.trim() || "Africa/Cairo",
    capacity: input.capacity,
    attendanceMode: input.attendanceMode,
    locationId: normalizeSessionLocationId(input),
    googleCalendarEventId: normalizeOptionalText(input.googleCalendarEventId) ?? null,
    status: input.status,
  });

  if (!session) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Session could not be created.",
      statusCode: httpStatus.internalServerError,
    });
  }

  const createdSession = toAdminSession(session);

  await writeAuditLog(auditContext, {
    action: "admin.sessions.create",
    resourceType: "offering_session",
    resourceId: createdSession.id,
    beforeSnapshot: null,
    afterSnapshot: createdSession,
  });

  return createdSession;
};

export const updateAdminSessionById = async (
  id: string,
  input: AdminSessionPatchInput,
  auditContext?: AuditContext,
) => {
  const existingSession = await findAdminSessionById(id);

  if (!existingSession) {
    throw notFoundError();
  }

  const startsAt =
    input.startsAt !== undefined
      ? parseTimestamp(input.startsAt, "startsAt")
      : existingSession.startsAt;
  const endsAt =
    input.endsAt !== undefined
      ? parseTimestamp(input.endsAt, "endsAt")
      : existingSession.endsAt;
  const attendanceMode = input.attendanceMode ?? existingSession.attendanceMode;
  const offeringId = input.offeringId ?? existingSession.offeringId;
  const locationId =
    input.locationId !== undefined ? input.locationId : existingSession.locationId;

  assertSessionWindow({ startsAt, endsAt });
  await assertOffering({ offeringId, attendanceMode });
  await assertLocation({ attendanceMode, locationId });

  const beforeSession = toAdminSession(existingSession);
  const updatePayload = removeUndefined<AdminSessionUpdate>({
    offeringId: input.offeringId,
    startsAt: input.startsAt !== undefined ? startsAt : undefined,
    endsAt: input.endsAt !== undefined ? endsAt : undefined,
    timezone: input.timezone?.trim(),
    capacity: input.capacity,
    attendanceMode: input.attendanceMode,
    locationId:
      input.attendanceMode !== undefined || input.locationId !== undefined
        ? normalizeSessionLocationId({ attendanceMode, locationId })
        : undefined,
    googleCalendarEventId: normalizeOptionalText(input.googleCalendarEventId),
    status: input.status,
  });

  const updatedSession = await updateAdminSession(id, updatePayload);

  if (!updatedSession) {
    throw notFoundError();
  }

  const afterSession = toAdminSession(updatedSession);

  await writeAuditLog(auditContext, {
    action: "admin.sessions.update",
    resourceType: "offering_session",
    resourceId: afterSession.id,
    beforeSnapshot: beforeSession,
    afterSnapshot: afterSession,
  });

  return afterSession;
};

export const archiveAdminSessionById = async (
  id: string,
  auditContext?: AuditContext,
) => {
  const existingSession = await findAdminSessionById(id);

  if (!existingSession) {
    throw notFoundError();
  }

  const beforeSession = toAdminSession(existingSession);
  const archivedSession = await archiveAdminSession(id);

  if (!archivedSession) {
    throw notFoundError();
  }

  const afterSession = toAdminSession(archivedSession);

  await writeAuditLog(auditContext, {
    action: "admin.sessions.archive",
    resourceType: "offering_session",
    resourceId: id,
    beforeSnapshot: beforeSession,
    afterSnapshot: afterSession,
  });
};
