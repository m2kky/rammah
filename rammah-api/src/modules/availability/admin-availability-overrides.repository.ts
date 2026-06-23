import { and, asc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  availabilityOverrides,
  availabilityRules,
  offerings,
  overrideTypeEnum,
} from "../../db/schema/index.js";

export type OverrideType = (typeof overrideTypeEnum.enumValues)[number];
export type AdminAvailabilityOverrideInsert = typeof availabilityOverrides.$inferInsert;
export type AdminAvailabilityOverrideUpdate = Partial<
  Omit<AdminAvailabilityOverrideInsert, "id" | "createdAt">
>;

export type AdminAvailabilityOverrideFilters = {
  offeringId?: string;
  availabilityRuleId?: string;
  overrideType?: OverrideType;
  dateFrom?: string;
  dateTo?: string;
};

const adminAvailabilityOverrideSelect = {
  id: availabilityOverrides.id,
  availabilityRuleId: availabilityOverrides.availabilityRuleId,
  offeringId: availabilityOverrides.offeringId,
  offeringTitle: offerings.title,
  offeringSlug: offerings.slug,
  ruleWeekday: availabilityRules.weekday,
  ruleStartTime: availabilityRules.startTime,
  ruleEndTime: availabilityRules.endTime,
  date: availabilityOverrides.date,
  overrideType: availabilityOverrides.overrideType,
  startsAt: availabilityOverrides.startsAt,
  endsAt: availabilityOverrides.endsAt,
  reason: availabilityOverrides.reason,
  createdAt: availabilityOverrides.createdAt,
  updatedAt: availabilityOverrides.updatedAt,
};

export const findAdminAvailabilityOverrides = async (
  filters: AdminAvailabilityOverrideFilters = {},
) => {
  const conditions: SQL[] = [];

  if (filters.offeringId) {
    conditions.push(eq(availabilityOverrides.offeringId, filters.offeringId));
  }

  if (filters.availabilityRuleId) {
    conditions.push(eq(availabilityOverrides.availabilityRuleId, filters.availabilityRuleId));
  }

  if (filters.overrideType) {
    conditions.push(eq(availabilityOverrides.overrideType, filters.overrideType));
  }

  if (filters.dateFrom) {
    conditions.push(gte(availabilityOverrides.date, filters.dateFrom));
  }

  if (filters.dateTo) {
    conditions.push(lte(availabilityOverrides.date, filters.dateTo));
  }

  let query = db
    .select(adminAvailabilityOverrideSelect)
    .from(availabilityOverrides)
    .innerJoin(offerings, eq(availabilityOverrides.offeringId, offerings.id))
    .leftJoin(availabilityRules, eq(availabilityOverrides.availabilityRuleId, availabilityRules.id))
    .$dynamic();

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  if (where) {
    query = query.where(where);
  }

  return query.orderBy(
    asc(availabilityOverrides.date),
    asc(availabilityOverrides.startsAt),
    asc(offerings.title),
  );
};

export type AdminAvailabilityOverrideRow = Awaited<
  ReturnType<typeof findAdminAvailabilityOverrides>
>[number];

export const findAdminAvailabilityOverrideById = async (id: string) => {
  const rows = await db
    .select(adminAvailabilityOverrideSelect)
    .from(availabilityOverrides)
    .innerJoin(offerings, eq(availabilityOverrides.offeringId, offerings.id))
    .leftJoin(availabilityRules, eq(availabilityOverrides.availabilityRuleId, availabilityRules.id))
    .where(eq(availabilityOverrides.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const insertAdminAvailabilityOverride = async (
  input: AdminAvailabilityOverrideInsert,
) => {
  const rows = await db
    .insert(availabilityOverrides)
    .values(input)
    .returning({ id: availabilityOverrides.id });

  return rows[0] ? findAdminAvailabilityOverrideById(rows[0].id) : null;
};

export const updateAdminAvailabilityOverride = async (
  id: string,
  input: AdminAvailabilityOverrideUpdate,
) => {
  const rows = await db
    .update(availabilityOverrides)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(availabilityOverrides.id, id))
    .returning({ id: availabilityOverrides.id });

  return rows[0] ? findAdminAvailabilityOverrideById(rows[0].id) : null;
};

export const deleteAdminAvailabilityOverride = async (id: string) => {
  const rows = await db
    .delete(availabilityOverrides)
    .where(eq(availabilityOverrides.id, id))
    .returning({ id: availabilityOverrides.id });

  return rows[0] ?? null;
};
