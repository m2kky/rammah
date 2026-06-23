import { and, asc, eq, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  availabilityRules,
  contentStatusEnum,
  offerings,
} from "../../db/schema/index.js";

export type ContentStatus = (typeof contentStatusEnum.enumValues)[number];
export type AdminAvailabilityRuleInsert = typeof availabilityRules.$inferInsert;
export type AdminAvailabilityRuleUpdate = Partial<
  Omit<AdminAvailabilityRuleInsert, "id" | "createdAt">
>;

export type AdminAvailabilityRuleFilters = {
  offeringId?: string;
  status?: ContentStatus;
};

const adminAvailabilityRuleSelect = {
  id: availabilityRules.id,
  offeringId: availabilityRules.offeringId,
  offeringTitle: offerings.title,
  offeringSlug: offerings.slug,
  weekday: availabilityRules.weekday,
  startTime: availabilityRules.startTime,
  endTime: availabilityRules.endTime,
  timezone: availabilityRules.timezone,
  slotDurationMinutes: availabilityRules.slotDurationMinutes,
  bufferBeforeMinutes: availabilityRules.bufferBeforeMinutes,
  bufferAfterMinutes: availabilityRules.bufferAfterMinutes,
  status: availabilityRules.status,
  createdAt: availabilityRules.createdAt,
  updatedAt: availabilityRules.updatedAt,
};

export const findAdminAvailabilityRules = async (
  filters: AdminAvailabilityRuleFilters = {},
) => {
  const conditions: SQL[] = [];

  if (filters.offeringId) {
    conditions.push(eq(availabilityRules.offeringId, filters.offeringId));
  }

  if (filters.status) {
    conditions.push(eq(availabilityRules.status, filters.status));
  }

  let query = db
    .select(adminAvailabilityRuleSelect)
    .from(availabilityRules)
    .innerJoin(offerings, eq(availabilityRules.offeringId, offerings.id))
    .$dynamic();

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  if (where) {
    query = query.where(where);
  }

  return query.orderBy(
    asc(offerings.title),
    asc(availabilityRules.weekday),
    asc(availabilityRules.startTime),
  );
};

export type AdminAvailabilityRuleRow = Awaited<
  ReturnType<typeof findAdminAvailabilityRules>
>[number];

export const findAdminAvailabilityRuleById = async (id: string) => {
  const rows = await db
    .select(adminAvailabilityRuleSelect)
    .from(availabilityRules)
    .innerJoin(offerings, eq(availabilityRules.offeringId, offerings.id))
    .where(eq(availabilityRules.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const findOfferingForAvailability = async (id: string) => {
  const rows = await db
    .select({ id: offerings.id })
    .from(offerings)
    .where(eq(offerings.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const insertAdminAvailabilityRule = async (
  input: AdminAvailabilityRuleInsert,
) => {
  const rows = await db
    .insert(availabilityRules)
    .values(input)
    .returning({ id: availabilityRules.id });

  return rows[0] ? findAdminAvailabilityRuleById(rows[0].id) : null;
};

export const updateAdminAvailabilityRule = async (
  id: string,
  input: AdminAvailabilityRuleUpdate,
) => {
  const rows = await db
    .update(availabilityRules)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(availabilityRules.id, id))
    .returning({ id: availabilityRules.id });

  return rows[0] ? findAdminAvailabilityRuleById(rows[0].id) : null;
};

export const archiveAdminAvailabilityRule = async (id: string) => {
  const rows = await db
    .update(availabilityRules)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(eq(availabilityRules.id, id))
    .returning({ id: availabilityRules.id });

  return rows[0] ?? null;
};
