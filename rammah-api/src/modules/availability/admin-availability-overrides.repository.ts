import { and, asc, eq, gte, lte, ne, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  availabilityOverrideModeEnum,
  globalAvailabilityOverrides,
} from "../../db/schema/index.js";

export type AvailabilityOverrideMode =
  (typeof availabilityOverrideModeEnum.enumValues)[number];
export type AdminAvailabilityOverrideInsert =
  typeof globalAvailabilityOverrides.$inferInsert;
export type AdminAvailabilityOverrideUpdate = Partial<
  Omit<AdminAvailabilityOverrideInsert, "id" | "createdAt">
>;
export type AdminAvailabilityOverrideFilters = {
  type?: AvailabilityOverrideMode;
  dateFrom?: string;
  dateTo?: string;
};

const adminAvailabilityOverrideSelect = {
  id: globalAvailabilityOverrides.id,
  date: globalAvailabilityOverrides.date,
  overrideMode: globalAvailabilityOverrides.overrideMode,
  startLocalTime: globalAvailabilityOverrides.startLocalTime,
  endLocalTime: globalAvailabilityOverrides.endLocalTime,
  reason: globalAvailabilityOverrides.reason,
  createdAt: globalAvailabilityOverrides.createdAt,
  updatedAt: globalAvailabilityOverrides.updatedAt,
};

export const findAdminAvailabilityOverrides = async (
  filters: AdminAvailabilityOverrideFilters = {},
) => {
  const conditions: SQL[] = [];
  if (filters.type) {
    conditions.push(eq(globalAvailabilityOverrides.overrideMode, filters.type));
  }
  if (filters.dateFrom) {
    conditions.push(gte(globalAvailabilityOverrides.date, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(globalAvailabilityOverrides.date, filters.dateTo));
  }

  let query = db
    .select(adminAvailabilityOverrideSelect)
    .from(globalAvailabilityOverrides)
    .$dynamic();
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  if (where) query = query.where(where);

  return query.orderBy(
    asc(globalAvailabilityOverrides.date),
    asc(globalAvailabilityOverrides.startLocalTime),
    asc(globalAvailabilityOverrides.endLocalTime),
    asc(globalAvailabilityOverrides.id),
  );
};

export type AdminAvailabilityOverrideRow = Awaited<
  ReturnType<typeof findAdminAvailabilityOverrides>
>[number];

export const findAdminAvailabilityOverrideById = async (id: string) => {
  const rows = await db
    .select(adminAvailabilityOverrideSelect)
    .from(globalAvailabilityOverrides)
    .where(eq(globalAvailabilityOverrides.id, id))
    .limit(1);
  return rows[0] ?? null;
};

export const findAdminAvailabilityOverridesForDate = async (
  date: string,
  excludeId?: string,
) =>
  db
    .select(adminAvailabilityOverrideSelect)
    .from(globalAvailabilityOverrides)
    .where(
      and(
        eq(globalAvailabilityOverrides.date, date),
        excludeId ? ne(globalAvailabilityOverrides.id, excludeId) : undefined,
      ),
    );

export const insertAdminAvailabilityOverride = async (
  input: AdminAvailabilityOverrideInsert,
) => {
  const rows = await db
    .insert(globalAvailabilityOverrides)
    .values(input)
    .returning({ id: globalAvailabilityOverrides.id });
  return rows[0] ? findAdminAvailabilityOverrideById(rows[0].id) : null;
};

export const updateAdminAvailabilityOverride = async (
  id: string,
  input: AdminAvailabilityOverrideUpdate,
) => {
  const rows = await db
    .update(globalAvailabilityOverrides)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(globalAvailabilityOverrides.id, id))
    .returning({ id: globalAvailabilityOverrides.id });
  return rows[0] ? findAdminAvailabilityOverrideById(rows[0].id) : null;
};

export const deleteAdminAvailabilityOverride = async (id: string) => {
  const rows = await db
    .delete(globalAvailabilityOverrides)
    .where(eq(globalAvailabilityOverrides.id, id))
    .returning({ id: globalAvailabilityOverrides.id });
  return rows[0] ?? null;
};
