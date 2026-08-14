import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import {
  archiveAdminAvailabilityWindow,
  deleteAdminAvailabilityWindow,
  findAdminAvailabilityWindowById,
  findAdminAvailabilityWindows,
  findPublishedWindowsForInvariant,
  insertAdminAvailabilityWindow,
  updateAdminAvailabilityWindow,
  type AdminAvailabilityWindowFilters,
  type AdminAvailabilityWindowRow,
  type AdminAvailabilityWindowUpdate,
  type AvailabilityWindowStatus,
} from "./admin-availability.repository.js";

export type AdminAvailabilityWindowInput = {
  weekday: number;
  startLocalTime: string;
  endLocalTime: string;
  status: AvailabilityWindowStatus;
};

export type AdminAvailabilityWindowPatchInput = Partial<AdminAvailabilityWindowInput>;

const removeUndefined = <T extends Record<string, unknown>>(input: T) =>
  Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;

const notFoundError = () =>
  new AppError({
    code: "NOT_FOUND",
    message: "Availability window was not found.",
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

const conflictError = (message: string) =>
  new AppError({ code: "CONFLICT", message, statusCode: httpStatus.conflict });

const allowedActionsFor = (status: AdminAvailabilityWindowRow["status"]) => ({
  edit: status !== "archived",
  archive: status === "published" || status === "scheduled",
  delete: status === "draft",
});

const toAdminAvailabilityWindow = (window: AdminAvailabilityWindowRow) => ({
  id: window.id,
  weekday: window.weekday,
  startLocalTime: window.startLocalTime.slice(0, 5),
  endLocalTime: window.endLocalTime.slice(0, 5),
  status: window.status,
  allowedActions: allowedActionsFor(window.status),
  createdAt: window.createdAt.toISOString(),
  updatedAt: window.updatedAt.toISOString(),
});

const timePattern = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const normalizeTime = (value: string, field: "startLocalTime" | "endLocalTime") => {
  const trimmed = value.trim();
  if (!timePattern.test(trimmed)) {
    throw validationError("Availability time is invalid.", [
      { field, message: "Use HH:MM or HH:MM:SS time." },
    ]);
  }
  const [hour, minute] = trimmed.split(":");
  return `${hour}:${minute}`;
};

const timeToMinutes = (value: string) => {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
};

const assertWindow = (input: { weekday: number; startLocalTime: string; endLocalTime: string }) => {
  if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) {
    throw validationError("Availability weekday is invalid.", [
      { field: "weekday", message: "Choose a weekday from 0 to 6." },
    ]);
  }

  if (timeToMinutes(input.startLocalTime) >= timeToMinutes(input.endLocalTime)) {
    throw validationError("Availability start time must be before end time.", [
      { field: "startLocalTime", message: "Start time must be before end time." },
    ]);
  }
};

const assertPublishedWindowInvariant = async (input: {
  weekday: number;
  startLocalTime: string;
  endLocalTime: string;
  status: AvailabilityWindowStatus;
  excludeId?: string;
}) => {
  if (input.status !== "published") return;

  const published = await findPublishedWindowsForInvariant(input.excludeId);
  const conflicts = published.filter(
    (window) =>
      window.weekday === input.weekday &&
      timeToMinutes(input.startLocalTime) < timeToMinutes(window.endLocalTime) &&
      timeToMinutes(input.endLocalTime) > timeToMinutes(window.startLocalTime),
  );

  if (conflicts.length > 0) {
    const conflictIds = conflicts.map(({ id }) => id).sort();
    throw validationError("Published availability windows cannot overlap.", [
      {
        field: "startLocalTime",
        message: `Conflicts with availability window IDs: ${conflictIds.join(", ")}.`,
      },
    ]);
  }
};

export const listAdminAvailabilityWindows = async (
  filters: AdminAvailabilityWindowFilters,
) => {
  const windows = await findAdminAvailabilityWindows(filters);
  return windows.map(toAdminAvailabilityWindow);
};

export const getAdminAvailabilityWindow = async (id: string) => {
  const window = await findAdminAvailabilityWindowById(id);
  if (!window) throw notFoundError();
  return toAdminAvailabilityWindow(window);
};

export const createAdminAvailabilityWindow = async (
  input: AdminAvailabilityWindowInput,
  auditContext?: AuditContext,
) => {
  if (input.status === "archived") {
    throw validationError("A new availability window cannot start archived.", [
      { field: "status", message: "Create it as Draft or Published." },
    ]);
  }
  const startLocalTime = normalizeTime(input.startLocalTime, "startLocalTime");
  const endLocalTime = normalizeTime(input.endLocalTime, "endLocalTime");
  assertWindow({ weekday: input.weekday, startLocalTime, endLocalTime });
  await assertPublishedWindowInvariant({ ...input, startLocalTime, endLocalTime });

  const window = await insertAdminAvailabilityWindow({
    weekday: input.weekday,
    startLocalTime,
    endLocalTime,
    status: input.status,
  });
  if (!window) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Availability window could not be created.",
      statusCode: httpStatus.internalServerError,
    });
  }

  const created = toAdminAvailabilityWindow(window);
  await writeAuditLog(auditContext, {
    action: "admin.availability_windows.create",
    resourceType: "availability_window",
    resourceId: created.id,
    beforeSnapshot: null,
    afterSnapshot: created,
  });
  return created;
};

export const updateAdminAvailabilityWindowById = async (
  id: string,
  input: AdminAvailabilityWindowPatchInput,
  auditContext?: AuditContext,
) => {
  const existing = await findAdminAvailabilityWindowById(id);
  if (!existing) throw notFoundError();
  if (!allowedActionsFor(existing.status).edit) {
    throw conflictError("Archived availability windows cannot be edited.");
  }

  const weekday = input.weekday ?? existing.weekday;
  const startLocalTime = input.startLocalTime === undefined
    ? existing.startLocalTime.slice(0, 5)
    : normalizeTime(input.startLocalTime, "startLocalTime");
  const endLocalTime = input.endLocalTime === undefined
    ? existing.endLocalTime.slice(0, 5)
    : normalizeTime(input.endLocalTime, "endLocalTime");
  const status = input.status ?? (existing.status as AvailabilityWindowStatus);
  if (existing.status === "published" && status === "draft") {
    throw conflictError(
      "A published availability window has history and cannot return to draft; archive it instead.",
    );
  }
  if (status === "archived") {
    throw conflictError("Use the archive action to archive an availability window.");
  }

  assertWindow({ weekday, startLocalTime, endLocalTime });
  await assertPublishedWindowInvariant({
    weekday,
    startLocalTime,
    endLocalTime,
    status,
    excludeId: id,
  });

  const before = toAdminAvailabilityWindow(existing);
  const updatePayload = removeUndefined<AdminAvailabilityWindowUpdate>({
    weekday: input.weekday,
    startLocalTime: input.startLocalTime === undefined ? undefined : startLocalTime,
    endLocalTime: input.endLocalTime === undefined ? undefined : endLocalTime,
    status: input.status,
  });
  const updated = await updateAdminAvailabilityWindow(id, updatePayload);
  if (!updated) throw notFoundError();

  const after = toAdminAvailabilityWindow(updated);
  await writeAuditLog(auditContext, {
    action: "admin.availability_windows.update",
    resourceType: "availability_window",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  return after;
};

export const deleteOrArchiveAdminAvailabilityWindowById = async (
  id: string,
  auditContext?: AuditContext,
) => {
  const existing = await findAdminAvailabilityWindowById(id);
  if (!existing) throw notFoundError();

  const before = toAdminAvailabilityWindow(existing);
  const allowedActions = allowedActionsFor(existing.status);

  if (allowedActions.delete) {
    const deleted = await deleteAdminAvailabilityWindow(id);
    if (!deleted) throw notFoundError();
    await writeAuditLog(auditContext, {
      action: "admin.availability_windows.delete",
      resourceType: "availability_window",
      resourceId: id,
      beforeSnapshot: before,
      afterSnapshot: null,
    });
    return { action: "deleted" as const, data: null };
  }

  if (allowedActions.archive) {
    const archived = await archiveAdminAvailabilityWindow(id);
    if (!archived) throw notFoundError();
    const after = toAdminAvailabilityWindow(archived);
    await writeAuditLog(auditContext, {
      action: "admin.availability_windows.archive",
      resourceType: "availability_window",
      resourceId: id,
      beforeSnapshot: before,
      afterSnapshot: after,
    });
    return { action: "archived" as const, data: after };
  }

  throw conflictError("This availability window cannot be deleted or archived.");
};
