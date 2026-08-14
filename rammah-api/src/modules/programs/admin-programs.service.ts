import { Temporal } from "@js-temporal/polyfill";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import { syncGoogleCalendarEventsForProgram } from "../calendar/google-calendar.service.js";
import {
  deleteAdminProgram,
  findAdminProgramById,
  findAdminPrograms,
  findProgramCapacityCounts,
  findProgramLocation,
  findProgramOccurrences,
  findProgramOffering,
  findProgramScheduleConflicts,
  insertAdminProgram,
  setAdminProgramStatus,
  updateAdminProgram,
  type AdminProgramFilters,
  type AdminProgramRow,
  type OccurrenceStatus,
  type ProgramAttendanceMode,
  type ProgramOccurrenceWrite,
  type ProgramStatus,
  type ProgramWrite,
} from "./admin-programs.repository.js";

export type AdminProgramOccurrenceInput = {
  id?: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  attendanceMode: ProgramAttendanceMode;
  locationId?: string | null;
  status?: OccurrenceStatus;
};

export type AdminProgramInput = {
  offeringId: string;
  title: string;
  timezone: string;
  attendanceMode: ProgramAttendanceMode;
  locationId?: string | null;
  capacity: number;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  occurrences: AdminProgramOccurrenceInput[];
};

export type AdminProgramPatchInput = Partial<AdminProgramInput>;

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

const conflictError = (message: string, details: Array<{ field?: string; message: string }> = []) =>
  new AppError({ code: "CONFLICT", message, statusCode: httpStatus.conflict, details });

const scheduleConflictError = (
  message: string,
  details: Array<{ field?: string; message: string }> = [],
) => new AppError({ code: "SCHEDULE_CONFLICT", message, statusCode: httpStatus.conflict, details });

const notFoundError = () =>
  new AppError({
    code: "NOT_FOUND",
    message: "Program was not found.",
    statusCode: httpStatus.notFound,
  });

const assertIanaTimezone = (timezone: string, field: string) => {
  try {
    Temporal.Now.zonedDateTimeISO(timezone);
  } catch {
    throw validationError("Program timezone is invalid.", [
      { field, message: "Use a valid IANA timezone such as Africa/Cairo." },
    ]);
  }
};

const parseTimestamp = (value: string | null | undefined, field: string) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw validationError("Program timestamp is invalid.", [
      { field, message: "Use an ISO timestamp." },
    ]);
  }
  return parsed;
};

const normalizeOccurrences = (
  occurrences: AdminProgramOccurrenceInput[],
): ProgramOccurrenceWrite[] => {
  const normalized = occurrences.map((occurrence, index) => {
    assertIanaTimezone(occurrence.timezone, `occurrences.${index}.timezone`);
    const startsAt = parseTimestamp(occurrence.startsAt, `occurrences.${index}.startsAt`)!;
    const endsAt = parseTimestamp(occurrence.endsAt, `occurrences.${index}.endsAt`)!;
    if (startsAt >= endsAt) {
      throw validationError("Occurrence start must be before its end.", [
        {
          field: `occurrences.${index}.startsAt`,
          message: "Start timestamp must be before end timestamp.",
        },
      ]);
    }
    return {
      id: occurrence.id,
      startsAt,
      endsAt,
      timezone: occurrence.timezone.trim(),
      attendanceMode: occurrence.attendanceMode,
      locationId: occurrence.locationId ?? null,
      sortOrder: index,
      status: occurrence.status ?? "scheduled",
    };
  });
  normalized.sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
  return normalized.map((occurrence, index) => ({ ...occurrence, sortOrder: index }));
};

const assertNoInternalOverlap = (occurrences: ProgramOccurrenceWrite[]) => {
  const active = occurrences.filter(({ status }) => status === "scheduled");
  for (let index = 1; index < active.length; index += 1) {
    if (active[index]!.startsAt < active[index - 1]!.endsAt) {
      throw validationError("Program occurrences cannot overlap each other.", [
        { field: `occurrences.${index}.startsAt`, message: "Choose a non-overlapping time." },
      ]);
    }
  }
};

const assertAttendanceLocation = async (
  mode: ProgramAttendanceMode,
  locationId: string | null,
  field: string,
  requirePublished: boolean,
) => {
  if (mode !== "online" && !locationId) {
    throw validationError("Offline and hybrid scheduling requires a location.", [
      { field, message: "Select a location." },
    ]);
  }
  if (!locationId) return;
  const location = await findProgramLocation(locationId);
  if (!location || (requirePublished && location.status !== "published")) {
    throw validationError("Program location is not available.", [
      { field, message: requirePublished ? "Select a published location." : "Select an existing location." },
    ]);
  }
};

type ResolvedProgram = ProgramWrite & {
  occurrences: ProgramOccurrenceWrite[];
};

const assertProgram = async (
  program: ResolvedProgram,
  options: { publishing: boolean; programId?: string },
) => {
  if (!program.title.trim()) {
    throw validationError("Program title is required.", [{ field: "title", message: "Enter a title." }]);
  }
  if (!Number.isInteger(program.capacity) || program.capacity < 1) {
    throw validationError("Program capacity must be at least one.", [
      { field: "capacity", message: "Enter a whole number of at least 1." },
    ]);
  }
  assertIanaTimezone(program.timezone, "timezone");
  assertNoInternalOverlap(program.occurrences);
  await assertAttendanceLocation(
    program.attendanceMode,
    program.locationId,
    "locationId",
    options.publishing,
  );
  for (const [index, occurrence] of program.occurrences.entries()) {
    await assertAttendanceLocation(
      occurrence.attendanceMode,
      occurrence.locationId,
      `occurrences.${index}.locationId`,
      options.publishing,
    );
  }

  const offering = await findProgramOffering(program.offeringId);
  if (!offering || offering.schedulingMode !== "scheduled_program") {
    throw validationError("Programs require a scheduled-program Offering.", [
      { field: "offeringId", message: "Select an Offering whose scheduling mode is Events / Programs." },
    ]);
  }
  if (options.publishing && offering.status !== "published") {
    throw validationError("A Program can only be published with a published Offering.", [
      { field: "offeringId", message: "Publish the Offering first." },
    ]);
  }

  if (
    program.registrationOpensAt &&
    program.registrationClosesAt &&
    program.registrationOpensAt >= program.registrationClosesAt
  ) {
    throw validationError("Registration close must be after registration open.", [
      { field: "registrationClosesAt", message: "Choose a later timestamp." },
    ]);
  }
  const active = program.occurrences.filter(({ status }) => status === "scheduled");
  if (options.publishing && active.length === 0) {
    throw validationError("Add at least one scheduled occurrence before publishing.", [
      { field: "occurrences", message: "Add a scheduled occurrence." },
    ]);
  }
  if (
    program.registrationClosesAt &&
    active[0] &&
    program.registrationClosesAt >= active[0].startsAt
  ) {
    throw validationError("Registration must close before the first occurrence starts.", [
      { field: "registrationClosesAt", message: "Choose a timestamp before the first occurrence." },
    ]);
  }

  if (options.publishing) {
    const conflicts = await findProgramScheduleConflicts(options.programId, active);
    if (conflicts.length > 0) {
      throw scheduleConflictError("The Program schedule conflicts with the coach calendar.", [
        {
          field: "occurrences",
          message: `Resolve conflicts: ${conflicts.map(({ kind, id }) => `${kind}:${id}`).join(", ")}.`,
        },
      ]);
    }
  }
};

const allowedActionsFor = (status: AdminProgramRow["status"], hasHistory: boolean) => ({
  edit: status !== "archived",
  publish: status === "draft",
  archive: status === "published" || (status === "draft" && hasHistory),
  delete: status === "draft" && !hasHistory,
});

const toAdminProgram = async (program: AdminProgramRow) => {
  const [occurrences, counts] = await Promise.all([
    findProgramOccurrences(program.id),
    findProgramCapacityCounts(program.id),
  ]);
  const active = occurrences.filter(({ status }) => status === "scheduled");
  const conflicts = program.status === "archived"
    ? []
    : await findProgramScheduleConflicts(program.id, active);
  return {
    id: program.id,
    offering: {
      id: program.offeringId,
      title: program.offeringTitle,
      slug: program.offeringSlug,
      status: program.offeringStatus,
      schedulingMode: program.offeringSchedulingMode,
      bookingMode: program.offeringBookingMode,
    },
    title: program.title,
    timezone: program.timezone,
    attendanceMode: program.attendanceMode,
    location: program.locationId ? { id: program.locationId, name: program.locationName } : null,
    capacity: {
      total: program.capacity,
      booked: counts.booked,
      held: counts.held,
      remaining: Math.max(program.capacity - counts.booked - counts.held, 0),
    },
    registrationOpensAt: program.registrationOpensAt?.toISOString() ?? null,
    registrationClosesAt: program.registrationClosesAt?.toISOString() ?? null,
    status: program.status,
    occurrences: occurrences.map((occurrence) => ({
      id: occurrence.id,
      startsAt: occurrence.startsAt.toISOString(),
      endsAt: occurrence.endsAt.toISOString(),
      timezone: occurrence.timezone,
      attendanceMode: occurrence.attendanceMode,
      location: occurrence.locationId
        ? { id: occurrence.locationId, name: occurrence.locationName }
        : null,
      locationId: occurrence.locationId,
      sortOrder: occurrence.sortOrder,
      googleCalendarEventId: occurrence.googleCalendarEventId,
      meetUrl: occurrence.meetUrl,
      status: occurrence.status,
    })),
    conflicts: conflicts.map((conflict) => ({
      kind: conflict.kind,
      resourceId: conflict.id,
      startsAt: conflict.startsAt.toISOString(),
      endsAt: conflict.endsAt.toISOString(),
    })),
    allowedActions: allowedActionsFor(program.status, counts.hasHistory),
    createdAt: program.createdAt.toISOString(),
    updatedAt: program.updatedAt.toISOString(),
  };
};

const rowToResolved = async (program: AdminProgramRow): Promise<ResolvedProgram> => {
  const occurrences = await findProgramOccurrences(program.id);
  return {
    offeringId: program.offeringId,
    title: program.title,
    timezone: program.timezone,
    attendanceMode: program.attendanceMode,
    locationId: program.locationId,
    capacity: program.capacity,
    registrationOpensAt: program.registrationOpensAt,
    registrationClosesAt: program.registrationClosesAt,
    occurrences: occurrences.map((occurrence) => ({
      id: occurrence.id,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      timezone: occurrence.timezone,
      attendanceMode: occurrence.attendanceMode,
      locationId: occurrence.locationId,
      sortOrder: occurrence.sortOrder,
      status: occurrence.status,
    })),
  };
};

export const listAdminPrograms = async (filters: AdminProgramFilters = {}) => {
  const programs = await findAdminPrograms(filters);
  return Promise.all(programs.map(toAdminProgram));
};

export const getAdminProgram = async (id: string) => {
  const program = await findAdminProgramById(id);
  if (!program) throw notFoundError();
  return toAdminProgram(program);
};

export const createAdminProgram = async (
  input: AdminProgramInput,
  auditContext?: AuditContext,
) => {
  const resolved: ResolvedProgram = {
    offeringId: input.offeringId,
    title: input.title.trim(),
    timezone: input.timezone.trim(),
    attendanceMode: input.attendanceMode,
    locationId: input.locationId ?? null,
    capacity: input.capacity,
    registrationOpensAt: parseTimestamp(input.registrationOpensAt, "registrationOpensAt"),
    registrationClosesAt: parseTimestamp(input.registrationClosesAt, "registrationClosesAt"),
    occurrences: normalizeOccurrences(input.occurrences),
  };
  await assertProgram(resolved, { publishing: false });
  const created = await insertAdminProgram(resolved, resolved.occurrences);
  if (!created) {
    throw new AppError({ code: "INTERNAL_ERROR", message: "Program could not be created.", statusCode: 500 });
  }
  const data = await toAdminProgram(created);
  await writeAuditLog(auditContext, {
    action: "admin.programs.create",
    resourceType: "scheduled_program",
    resourceId: data.id,
    beforeSnapshot: null,
    afterSnapshot: data,
  });
  return data;
};

export const updateAdminProgramById = async (
  id: string,
  input: AdminProgramPatchInput,
  auditContext?: AuditContext,
) => {
  const existing = await findAdminProgramById(id);
  if (!existing) throw notFoundError();
  if (existing.status === "archived") throw conflictError("Archived Programs cannot be edited.");
  const current = await rowToResolved(existing);
  const next: ResolvedProgram = {
    offeringId: input.offeringId ?? current.offeringId,
    title: input.title?.trim() ?? current.title,
    timezone: input.timezone?.trim() ?? current.timezone,
    attendanceMode: input.attendanceMode ?? current.attendanceMode,
    locationId: input.locationId === undefined ? current.locationId : input.locationId,
    capacity: input.capacity ?? current.capacity,
    registrationOpensAt:
      input.registrationOpensAt === undefined
        ? current.registrationOpensAt
        : parseTimestamp(input.registrationOpensAt, "registrationOpensAt"),
    registrationClosesAt:
      input.registrationClosesAt === undefined
        ? current.registrationClosesAt
        : parseTimestamp(input.registrationClosesAt, "registrationClosesAt"),
    occurrences:
      input.occurrences === undefined
        ? current.occurrences
        : normalizeOccurrences(input.occurrences),
  };
  await assertProgram(next, { publishing: existing.status === "published", programId: id });
  const counts = await findProgramCapacityCounts(id);
  const before = await toAdminProgram(existing);
  const updated = await updateAdminProgram(
    id,
    {
      offeringId: next.offeringId,
      title: next.title,
      timezone: next.timezone,
      attendanceMode: next.attendanceMode,
      locationId: next.locationId,
      capacity: next.capacity,
      registrationOpensAt: next.registrationOpensAt,
      registrationClosesAt: next.registrationClosesAt,
    },
    input.occurrences === undefined ? undefined : next.occurrences,
    existing.status === "published" || counts.hasHistory,
  );
  if (!updated) throw notFoundError();
  if (existing.status === "published") {
    await syncGoogleCalendarEventsForProgram(id);
  }
  const after = await toAdminProgram(updated);
  await writeAuditLog(auditContext, {
    action: "admin.programs.update",
    resourceType: "scheduled_program",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  return after;
};

export const publishAdminProgramById = async (id: string, auditContext?: AuditContext) => {
  const existing = await findAdminProgramById(id);
  if (!existing) throw notFoundError();
  if (existing.status !== "draft") {
    throw conflictError("Only a draft Program can be published.");
  }
  const resolved = await rowToResolved(existing);
  await assertProgram(resolved, { publishing: true, programId: id });
  const before = await toAdminProgram(existing);
  const updated = await setAdminProgramStatus(id, "published");
  if (!updated) throw notFoundError();
  await syncGoogleCalendarEventsForProgram(id);
  const after = await toAdminProgram(updated);
  await writeAuditLog(auditContext, {
    action: "admin.programs.publish",
    resourceType: "scheduled_program",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  return after;
};

export const deleteOrArchiveAdminProgramById = async (
  id: string,
  auditContext?: AuditContext,
) => {
  const existing = await findAdminProgramById(id);
  if (!existing) throw notFoundError();
  const counts = await findProgramCapacityCounts(id);
  const before = await toAdminProgram(existing);
  if (existing.status === "draft" && !counts.hasHistory) {
    const deleted = await deleteAdminProgram(id);
    if (!deleted) throw notFoundError();
    await writeAuditLog(auditContext, {
      action: "admin.programs.delete",
      resourceType: "scheduled_program",
      resourceId: id,
      beforeSnapshot: before,
      afterSnapshot: null,
    });
    return { action: "deleted" as const, data: null };
  }
  if (existing.status === "archived") {
    throw conflictError("This Program is already archived.");
  }
  const archived = await setAdminProgramStatus(id, "archived");
  if (!archived) throw notFoundError();
  await syncGoogleCalendarEventsForProgram(id);
  const after = await toAdminProgram(archived);
  await writeAuditLog(auditContext, {
    action: "admin.programs.archive",
    resourceType: "scheduled_program",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  return { action: "archived" as const, data: after };
};

export const retryAdminProgramCalendarById = async (
  id: string,
  auditContext?: AuditContext,
) => {
  const existing = await findAdminProgramById(id);
  if (!existing) throw notFoundError();
  if (existing.status !== "published" && existing.status !== "archived") {
    throw conflictError("Publish the Program before syncing its calendar occurrences.");
  }
  const calendarSync = await syncGoogleCalendarEventsForProgram(id);
  const data = await getAdminProgram(id);
  await writeAuditLog(auditContext, {
    action: "admin.programs.calendar_retry",
    resourceType: "scheduled_program",
    resourceId: id,
    beforeSnapshot: null,
    afterSnapshot: { calendarSync },
  });
  return { data, calendarSync };
};

export type { AdminProgramFilters, ProgramStatus };
