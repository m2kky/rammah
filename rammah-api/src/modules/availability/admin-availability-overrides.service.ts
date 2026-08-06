import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import {
  deleteAdminAvailabilityOverride,
  findAdminAvailabilityOverrideById,
  findAdminAvailabilityOverrides,
  findAdminAvailabilityOverridesForDate,
  insertAdminAvailabilityOverride,
  updateAdminAvailabilityOverride,
  type AdminAvailabilityOverrideFilters,
  type AdminAvailabilityOverrideRow,
  type AdminAvailabilityOverrideUpdate,
  type AvailabilityOverrideMode,
} from "./admin-availability-overrides.repository.js";

export type AdminAvailabilityOverrideInput = {
  date: string;
  type: AvailabilityOverrideMode;
  startLocalTime?: string | null;
  endLocalTime?: string | null;
  reason?: string | null;
};
export type AdminAvailabilityOverridePatchInput =
  Partial<AdminAvailabilityOverrideInput>;

const removeUndefined = <T extends Record<string, unknown>>(input: T) =>
  Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;

const notFoundError = () =>
  new AppError({
    code: "NOT_FOUND",
    message: "Availability override was not found.",
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

const toAdminAvailabilityOverride = (override: AdminAvailabilityOverrideRow) => ({
  id: override.id,
  date: override.date,
  type: override.overrideMode,
  startLocalTime: override.startLocalTime?.slice(0, 5) ?? null,
  endLocalTime: override.endLocalTime?.slice(0, 5) ?? null,
  reason: override.reason,
  createdAt: override.createdAt.toISOString(),
  updatedAt: override.updatedAt.toISOString(),
});

const assertDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw validationError("Date must use YYYY-MM-DD format.", [
      { field: "date", message: "Use YYYY-MM-DD format." },
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
    throw validationError("Date is invalid.", [
      { field: "date", message: "Use a valid calendar date." },
    ]);
  }
  return value;
};

const timePattern = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const normalizeOptionalTime = (
  value: string | null | undefined,
  field: "startLocalTime" | "endLocalTime",
) => {
  if (value === undefined || value === null || value.trim() === "") return value ?? null;
  const trimmed = value.trim();
  if (!timePattern.test(trimmed)) {
    throw validationError("Availability override time is invalid.", [
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

const normalizeReason = (value: string | null | undefined) => {
  if (value === undefined || value === null) return value;
  return value.trim() || null;
};

const assertOverrideInvariant = async (input: {
  date: string;
  type: AvailabilityOverrideMode;
  startLocalTime: string | null;
  endLocalTime: string | null;
  excludeId?: string;
}) => {
  if (input.type === "available") {
    if (!input.startLocalTime || !input.endLocalTime) {
      throw validationError("Available overrides require a start and end time.", [
        { field: "startLocalTime", message: "Provide both local start and end times." },
      ]);
    }
    if (timeToMinutes(input.startLocalTime) >= timeToMinutes(input.endLocalTime)) {
      throw validationError("Override start time must be before end time.", [
        { field: "startLocalTime", message: "Start time must be before end time." },
      ]);
    }
  } else if (input.startLocalTime || input.endLocalTime) {
    throw validationError("A closed date cannot include an available time window.", [
      { field: "type", message: "Remove the times or choose Available window." },
    ]);
  }

  const existing = await findAdminAvailabilityOverridesForDate(input.date, input.excludeId);
  if (input.type === "unavailable" && existing.length > 0) {
    throw validationError("A closed date cannot be combined with other overrides.", [
      { field: "date", message: "Remove the other overrides for this date first." },
    ]);
  }
  const closed = existing.find(({ overrideMode }) => overrideMode === "unavailable");
  if (closed) {
    throw validationError("This date is already closed.", [
      { field: "date", message: `Remove closed-date override ${closed.id} first.` },
    ]);
  }
  if (input.type === "available" && input.startLocalTime && input.endLocalTime) {
    const conflicts = existing.filter(
      (override) =>
        override.overrideMode === "available" &&
        override.startLocalTime &&
        override.endLocalTime &&
        timeToMinutes(input.startLocalTime!) < timeToMinutes(override.endLocalTime) &&
        timeToMinutes(input.endLocalTime!) > timeToMinutes(override.startLocalTime),
    );
    if (conflicts.length > 0) {
      throw validationError("Available override windows cannot overlap.", [
        {
          field: "startLocalTime",
          message: `Conflicts with override IDs: ${conflicts.map(({ id }) => id).sort().join(", ")}.`,
        },
      ]);
    }
  }
};

export const listAdminAvailabilityOverrides = async (
  filters: AdminAvailabilityOverrideFilters,
) => {
  if (filters.dateFrom) assertDate(filters.dateFrom);
  if (filters.dateTo) assertDate(filters.dateTo);
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    throw validationError("Date range is invalid.", [
      { field: "dateFrom", message: "dateFrom must be before or equal to dateTo." },
    ]);
  }
  return (await findAdminAvailabilityOverrides(filters)).map(toAdminAvailabilityOverride);
};

export const getAdminAvailabilityOverride = async (id: string) => {
  const override = await findAdminAvailabilityOverrideById(id);
  if (!override) throw notFoundError();
  return toAdminAvailabilityOverride(override);
};

export const createAdminAvailabilityOverride = async (
  input: AdminAvailabilityOverrideInput,
  auditContext?: AuditContext,
) => {
  const date = assertDate(input.date);
  const startLocalTime = normalizeOptionalTime(input.startLocalTime, "startLocalTime") ?? null;
  const endLocalTime = normalizeOptionalTime(input.endLocalTime, "endLocalTime") ?? null;
  await assertOverrideInvariant({
    date,
    type: input.type,
    startLocalTime,
    endLocalTime,
  });
  const override = await insertAdminAvailabilityOverride({
    date,
    overrideMode: input.type,
    startLocalTime,
    endLocalTime,
    reason: normalizeReason(input.reason) ?? null,
  });
  if (!override) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Availability override could not be created.",
      statusCode: httpStatus.internalServerError,
    });
  }
  const created = toAdminAvailabilityOverride(override);
  await writeAuditLog(auditContext, {
    action: "admin.global_availability_overrides.create",
    resourceType: "global_availability_override",
    resourceId: created.id,
    beforeSnapshot: null,
    afterSnapshot: created,
  });
  return created;
};

export const updateAdminAvailabilityOverrideById = async (
  id: string,
  input: AdminAvailabilityOverridePatchInput,
  auditContext?: AuditContext,
) => {
  const existing = await findAdminAvailabilityOverrideById(id);
  if (!existing) throw notFoundError();

  const date = input.date === undefined ? existing.date : assertDate(input.date);
  const type = input.type ?? existing.overrideMode;
  let startLocalTime = input.startLocalTime === undefined
    ? existing.startLocalTime?.slice(0, 5) ?? null
    : normalizeOptionalTime(input.startLocalTime, "startLocalTime") ?? null;
  let endLocalTime = input.endLocalTime === undefined
    ? existing.endLocalTime?.slice(0, 5) ?? null
    : normalizeOptionalTime(input.endLocalTime, "endLocalTime") ?? null;
  if (type === "unavailable") {
    startLocalTime = null;
    endLocalTime = null;
  }
  await assertOverrideInvariant({ date, type, startLocalTime, endLocalTime, excludeId: id });

  const before = toAdminAvailabilityOverride(existing);
  const updatePayload = removeUndefined<AdminAvailabilityOverrideUpdate>({
    date: input.date === undefined ? undefined : date,
    overrideMode: input.type,
    startLocalTime:
      input.startLocalTime === undefined && input.type === undefined ? undefined : startLocalTime,
    endLocalTime:
      input.endLocalTime === undefined && input.type === undefined ? undefined : endLocalTime,
    reason: normalizeReason(input.reason),
  });
  const updated = await updateAdminAvailabilityOverride(id, updatePayload);
  if (!updated) throw notFoundError();
  const after = toAdminAvailabilityOverride(updated);
  await writeAuditLog(auditContext, {
    action: "admin.global_availability_overrides.update",
    resourceType: "global_availability_override",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  return after;
};

export const deleteAdminAvailabilityOverrideById = async (
  id: string,
  auditContext?: AuditContext,
) => {
  const existing = await findAdminAvailabilityOverrideById(id);
  if (!existing) throw notFoundError();
  const before = toAdminAvailabilityOverride(existing);
  if (!(await deleteAdminAvailabilityOverride(id))) throw notFoundError();
  await writeAuditLog(auditContext, {
    action: "admin.global_availability_overrides.delete",
    resourceType: "global_availability_override",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: null,
  });
};
