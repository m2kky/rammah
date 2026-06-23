import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import {
  findAdminAvailabilityRuleById,
  findOfferingForAvailability,
} from "./admin-availability.repository.js";
import {
  deleteAdminAvailabilityOverride,
  findAdminAvailabilityOverrideById,
  findAdminAvailabilityOverrides,
  insertAdminAvailabilityOverride,
  updateAdminAvailabilityOverride,
  type AdminAvailabilityOverrideFilters,
  type AdminAvailabilityOverrideInsert,
  type AdminAvailabilityOverrideRow,
  type AdminAvailabilityOverrideUpdate,
  type OverrideType,
} from "./admin-availability-overrides.repository.js";

export type AdminAvailabilityOverrideInput = {
  offeringId: string;
  availabilityRuleId?: string | null;
  date: string;
  overrideType: OverrideType;
  startsAt?: string | null;
  endsAt?: string | null;
  reason?: string | null;
};

export type AdminAvailabilityOverridePatchInput =
  Partial<AdminAvailabilityOverrideInput>;

const removeUndefined = <T extends Record<string, unknown>>(input: T) =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

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

const toIsoStringOrNull = (value: Date | null) =>
  value ? value.toISOString() : null;

const toAdminAvailabilityOverride = (override: AdminAvailabilityOverrideRow) => {
  if (!override.offeringId) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Availability override is missing an offering.",
      statusCode: httpStatus.internalServerError,
    });
  }

  return {
    id: override.id,
    offering: {
      id: override.offeringId,
      title: override.offeringTitle,
      slug: override.offeringSlug,
    },
    availabilityRule: override.availabilityRuleId
      ? {
          id: override.availabilityRuleId,
          weekday: override.ruleWeekday,
          startTime: override.ruleStartTime,
          endTime: override.ruleEndTime,
        }
      : null,
    date: override.date,
    overrideType: override.overrideType,
    startsAt: toIsoStringOrNull(override.startsAt),
    endsAt: toIsoStringOrNull(override.endsAt),
    reason: override.reason,
    createdAt: override.createdAt.toISOString(),
    updatedAt: override.updatedAt.toISOString(),
  };
};

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

const parseTimestamp = (
  value: string | null | undefined,
  field: "startsAt" | "endsAt",
) => {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw validationError("Timestamp is invalid.", [
      { field, message: "Use an ISO timestamp." },
    ]);
  }

  return date;
};

const assertTarget = async (input: {
  offeringId: string;
  availabilityRuleId?: string | null;
}) => {
  const offering = await findOfferingForAvailability(input.offeringId);

  if (!offering) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (!input.availabilityRuleId) {
    return;
  }

  const rule = await findAdminAvailabilityRuleById(input.availabilityRuleId);

  if (!rule) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Availability rule was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (rule.offeringId !== input.offeringId) {
    throw validationError("Availability rule does not belong to the selected offering.", [
      {
        field: "availabilityRuleId",
        message: "Select a rule for the same offering.",
      },
    ]);
  }
};

const assertOverrideWindow = (input: {
  overrideType: OverrideType;
  startsAt: Date | null;
  endsAt: Date | null;
}) => {
  if (input.overrideType === "available" && (!input.startsAt || !input.endsAt)) {
    throw validationError("Available overrides require a start and end time.", [
      {
        field: "startsAt",
        message: "Start and end timestamps are required for available overrides.",
      },
    ]);
  }

  if ((input.startsAt && !input.endsAt) || (!input.startsAt && input.endsAt)) {
    throw validationError("Override window must include both start and end.", [
      {
        field: "startsAt",
        message: "Provide both start and end timestamps, or leave both empty.",
      },
    ]);
  }

  if (input.startsAt && input.endsAt && input.startsAt >= input.endsAt) {
    throw validationError("Override start must be before end.", [
      {
        field: "startsAt",
        message: "Start timestamp must be before end timestamp.",
      },
    ]);
  }
};

const normalizeReason = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const reason = value.trim();
  return reason ? reason : null;
};

export const listAdminAvailabilityOverrides = async (
  filters: AdminAvailabilityOverrideFilters,
) => {
  if (filters.dateFrom) {
    assertDate(filters.dateFrom);
  }

  if (filters.dateTo) {
    assertDate(filters.dateTo);
  }

  const overrides = await findAdminAvailabilityOverrides(filters);
  return overrides.map(toAdminAvailabilityOverride);
};

export const getAdminAvailabilityOverride = async (id: string) => {
  const override = await findAdminAvailabilityOverrideById(id);

  if (!override) {
    throw notFoundError();
  }

  return toAdminAvailabilityOverride(override);
};

export const createAdminAvailabilityOverride = async (
  input: AdminAvailabilityOverrideInput,
  auditContext?: AuditContext,
) => {
  const date = assertDate(input.date);
  const startsAt = parseTimestamp(input.startsAt, "startsAt") ?? null;
  const endsAt = parseTimestamp(input.endsAt, "endsAt") ?? null;

  await assertTarget({
    offeringId: input.offeringId,
    availabilityRuleId: input.availabilityRuleId,
  });
  assertOverrideWindow({
    overrideType: input.overrideType,
    startsAt,
    endsAt,
  });

  const override = await insertAdminAvailabilityOverride({
    offeringId: input.offeringId,
    availabilityRuleId: input.availabilityRuleId ?? null,
    date,
    overrideType: input.overrideType,
    startsAt,
    endsAt,
    reason: normalizeReason(input.reason) ?? null,
  });

  if (!override) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Availability override could not be created.",
      statusCode: httpStatus.internalServerError,
    });
  }

  const createdOverride = toAdminAvailabilityOverride(override);

  await writeAuditLog(auditContext, {
    action: "admin.availability_overrides.create",
    resourceType: "availability_override",
    resourceId: createdOverride.id,
    beforeSnapshot: null,
    afterSnapshot: createdOverride,
  });

  return createdOverride;
};

export const updateAdminAvailabilityOverrideById = async (
  id: string,
  input: AdminAvailabilityOverridePatchInput,
  auditContext?: AuditContext,
) => {
  const existingOverride = await findAdminAvailabilityOverrideById(id);

  if (!existingOverride) {
    throw notFoundError();
  }

  if (!existingOverride.offeringId) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Availability override is missing an offering.",
      statusCode: httpStatus.internalServerError,
    });
  }

  const offeringId = input.offeringId ?? existingOverride.offeringId;
  const availabilityRuleId =
    input.availabilityRuleId !== undefined
      ? input.availabilityRuleId
      : existingOverride.availabilityRuleId;
  const date = input.date !== undefined ? assertDate(input.date) : existingOverride.date;
  const overrideType = input.overrideType ?? existingOverride.overrideType;
  const startsAt =
    input.startsAt !== undefined
      ? parseTimestamp(input.startsAt, "startsAt")
      : existingOverride.startsAt;
  const endsAt =
    input.endsAt !== undefined
      ? parseTimestamp(input.endsAt, "endsAt")
      : existingOverride.endsAt;

  await assertTarget({
    offeringId,
    availabilityRuleId,
  });
  assertOverrideWindow({
    overrideType,
    startsAt: startsAt ?? null,
    endsAt: endsAt ?? null,
  });

  const beforeOverride = toAdminAvailabilityOverride(existingOverride);
  const updatePayload = removeUndefined<AdminAvailabilityOverrideUpdate>({
    offeringId: input.offeringId,
    availabilityRuleId: input.availabilityRuleId,
    date: input.date !== undefined ? date : undefined,
    overrideType: input.overrideType,
    startsAt,
    endsAt,
    reason: normalizeReason(input.reason),
  });

  const updatedOverride = await updateAdminAvailabilityOverride(id, updatePayload);

  if (!updatedOverride) {
    throw notFoundError();
  }

  const afterOverride = toAdminAvailabilityOverride(updatedOverride);

  await writeAuditLog(auditContext, {
    action: "admin.availability_overrides.update",
    resourceType: "availability_override",
    resourceId: afterOverride.id,
    beforeSnapshot: beforeOverride,
    afterSnapshot: afterOverride,
  });

  return afterOverride;
};

export const deleteAdminAvailabilityOverrideById = async (
  id: string,
  auditContext?: AuditContext,
) => {
  const existingOverride = await findAdminAvailabilityOverrideById(id);

  if (!existingOverride) {
    throw notFoundError();
  }

  const beforeOverride = toAdminAvailabilityOverride(existingOverride);
  const deletedOverride = await deleteAdminAvailabilityOverride(id);

  if (!deletedOverride) {
    throw notFoundError();
  }

  await writeAuditLog(auditContext, {
    action: "admin.availability_overrides.delete",
    resourceType: "availability_override",
    resourceId: id,
    beforeSnapshot: beforeOverride,
    afterSnapshot: null,
  });
};
