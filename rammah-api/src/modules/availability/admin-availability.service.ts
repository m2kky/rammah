import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import {
  archiveAdminAvailabilityRule,
  findAdminAvailabilityRuleById,
  findAdminAvailabilityRules,
  findOfferingForAvailability,
  findPublishedRulesForInvariant,
  insertAdminAvailabilityRule,
  updateAdminAvailabilityRule,
  type AdminAvailabilityRuleFilters,
  type AdminAvailabilityRuleInsert,
  type AdminAvailabilityRuleRow,
  type AdminAvailabilityRuleUpdate,
} from "./admin-availability.repository.js";

export type AdminAvailabilityRuleInput = {
  offeringId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string;
  slotDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  status: AdminAvailabilityRuleInsert["status"];
};

export type AdminAvailabilityRulePatchInput = Partial<AdminAvailabilityRuleInput>;

const removeUndefined = <T extends Record<string, unknown>>(input: T) =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

const notFoundError = () =>
  new AppError({
    code: "NOT_FOUND",
    message: "Availability rule was not found.",
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

const toAdminAvailabilityRule = (rule: AdminAvailabilityRuleRow) => ({
  id: rule.id,
  offering: {
    id: rule.offeringId,
    title: rule.offeringTitle,
    slug: rule.offeringSlug,
  },
  weekday: rule.weekday,
  startTime: rule.startTime,
  endTime: rule.endTime,
  timezone: rule.timezone,
  slotDurationMinutes: rule.slotDurationMinutes,
  bufferBeforeMinutes: rule.bufferBeforeMinutes,
  bufferAfterMinutes: rule.bufferAfterMinutes,
  status: rule.status,
  createdAt: rule.createdAt.toISOString(),
  updatedAt: rule.updatedAt.toISOString(),
});

const normalizeTime = (value: string) => {
  const [hour = "", minute = ""] = value.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
};

const timeToMinutes = (value: string) => {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
};

const assertOfferingExists = async (offeringId: string) => {
  const offering = await findOfferingForAvailability(offeringId);

  if (!offering) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering was not found.",
      statusCode: httpStatus.notFound,
    });
  }
};

const assertTimeWindow = (input: {
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
}) => {
  const startMinutes = timeToMinutes(input.startTime);
  const endMinutes = timeToMinutes(input.endTime);

  if (startMinutes >= endMinutes) {
    throw validationError("Availability start time must be before end time.", [
        {
          field: "startTime",
          message: "Start time must be before end time.",
        },
      ]);
  }

  if (input.slotDurationMinutes > endMinutes - startMinutes) {
    throw validationError("Slot duration cannot exceed the availability window.", [
        {
          field: "slotDurationMinutes",
          message: "Slot duration must fit inside the start/end window.",
        },
      ]);
  }
};

const assertPublishedRuleInvariant = async (input: {
  offeringId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string;
  status: AdminAvailabilityRuleInsert["status"];
  excludeId?: string;
}) => {
  if (input.status !== "published") {
    return;
  }

  const publishedRules = await findPublishedRulesForInvariant(
    input.offeringId,
    input.excludeId,
  );
  const timezoneConflict = publishedRules.find(
    (rule) => rule.timezone !== input.timezone,
  );

  if (timezoneConflict) {
    throw validationError("Published availability rules must use one timezone.", [
      {
        field: "timezone",
        message: "Use the timezone already published for this offering.",
      },
    ]);
  }

  const startMinutes = timeToMinutes(input.startTime);
  const endMinutes = timeToMinutes(input.endTime);
  const overlap = publishedRules.find(
    (rule) =>
      rule.weekday === input.weekday &&
      startMinutes < timeToMinutes(rule.endTime) &&
      endMinutes > timeToMinutes(rule.startTime),
  );

  if (overlap) {
    throw validationError("Published availability rules cannot overlap.", [
      {
        field: "startTime",
        message: "Choose a window that does not overlap another published rule.",
      },
    ]);
  }
};

export const listAdminAvailabilityRules = async (
  filters: AdminAvailabilityRuleFilters,
) => {
  const rules = await findAdminAvailabilityRules(filters);
  return rules.map(toAdminAvailabilityRule);
};

export const getAdminAvailabilityRule = async (id: string) => {
  const rule = await findAdminAvailabilityRuleById(id);

  if (!rule) {
    throw notFoundError();
  }

  return toAdminAvailabilityRule(rule);
};

export const createAdminAvailabilityRule = async (
  input: AdminAvailabilityRuleInput,
  auditContext?: AuditContext,
) => {
  await assertOfferingExists(input.offeringId);

  const startTime = normalizeTime(input.startTime);
  const endTime = normalizeTime(input.endTime);
  assertTimeWindow({
    startTime,
    endTime,
    slotDurationMinutes: input.slotDurationMinutes,
  });
  const timezone = input.timezone.trim();
  await assertPublishedRuleInvariant({
    offeringId: input.offeringId,
    weekday: input.weekday,
    startTime,
    endTime,
    timezone,
    status: input.status,
  });

  const rule = await insertAdminAvailabilityRule({
    offeringId: input.offeringId,
    weekday: input.weekday,
    startTime,
    endTime,
    timezone,
    slotDurationMinutes: input.slotDurationMinutes,
    bufferBeforeMinutes: input.bufferBeforeMinutes,
    bufferAfterMinutes: input.bufferAfterMinutes,
    status: input.status,
  });

  if (!rule) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Availability rule could not be created.",
      statusCode: httpStatus.internalServerError,
    });
  }

  const createdRule = toAdminAvailabilityRule(rule);

  await writeAuditLog(auditContext, {
    action: "admin.availability_rules.create",
    resourceType: "availability_rule",
    resourceId: createdRule.id,
    beforeSnapshot: null,
    afterSnapshot: createdRule,
  });

  return createdRule;
};

export const updateAdminAvailabilityRuleById = async (
  id: string,
  input: AdminAvailabilityRulePatchInput,
  auditContext?: AuditContext,
) => {
  const existingRule = await findAdminAvailabilityRuleById(id);

  if (!existingRule) {
    throw notFoundError();
  }

  if (input.offeringId !== undefined) {
    await assertOfferingExists(input.offeringId);
  }

  const startTime =
    input.startTime !== undefined ? normalizeTime(input.startTime) : existingRule.startTime;
  const endTime =
    input.endTime !== undefined ? normalizeTime(input.endTime) : existingRule.endTime;
  const slotDurationMinutes =
    input.slotDurationMinutes ?? existingRule.slotDurationMinutes;
  const offeringId = input.offeringId ?? existingRule.offeringId;
  const weekday = input.weekday ?? existingRule.weekday;
  const timezone = input.timezone?.trim() ?? existingRule.timezone;
  const status = input.status ?? existingRule.status;

  assertTimeWindow({
    startTime,
    endTime,
    slotDurationMinutes,
  });
  await assertPublishedRuleInvariant({
    offeringId,
    weekday,
    startTime,
    endTime,
    timezone,
    status,
    excludeId: id,
  });

  const beforeRule = toAdminAvailabilityRule(existingRule);
  const updatePayload = removeUndefined<AdminAvailabilityRuleUpdate>({
    offeringId: input.offeringId,
    weekday: input.weekday,
    startTime: input.startTime !== undefined ? startTime : undefined,
    endTime: input.endTime !== undefined ? endTime : undefined,
    timezone: input.timezone !== undefined ? timezone : undefined,
    slotDurationMinutes: input.slotDurationMinutes,
    bufferBeforeMinutes: input.bufferBeforeMinutes,
    bufferAfterMinutes: input.bufferAfterMinutes,
    status: input.status,
  });

  const updatedRule = await updateAdminAvailabilityRule(id, updatePayload);

  if (!updatedRule) {
    throw notFoundError();
  }

  const afterRule = toAdminAvailabilityRule(updatedRule);

  await writeAuditLog(auditContext, {
    action: "admin.availability_rules.update",
    resourceType: "availability_rule",
    resourceId: afterRule.id,
    beforeSnapshot: beforeRule,
    afterSnapshot: afterRule,
  });

  return afterRule;
};

export const archiveAdminAvailabilityRuleById = async (
  id: string,
  auditContext?: AuditContext,
) => {
  const existingRule = await findAdminAvailabilityRuleById(id);

  if (!existingRule) {
    throw notFoundError();
  }

  const beforeRule = toAdminAvailabilityRule(existingRule);
  const archivedRule = await archiveAdminAvailabilityRule(id);

  if (!archivedRule) {
    throw notFoundError();
  }

  const afterRule = await getAdminAvailabilityRule(id);

  await writeAuditLog(auditContext, {
    action: "admin.availability_rules.archive",
    resourceType: "availability_rule",
    resourceId: id,
    beforeSnapshot: beforeRule,
    afterSnapshot: afterRule,
  });
};
