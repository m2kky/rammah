import { and, asc, eq, ne, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import { availabilityWindows } from "../../db/schema/index.js";

export type AvailabilityWindowStatus = "draft" | "published" | "archived";
export type AdminAvailabilityWindowInsert = typeof availabilityWindows.$inferInsert;
export type AdminAvailabilityWindowUpdate = Partial<
  Omit<AdminAvailabilityWindowInsert, "id" | "createdAt">
>;

export type AdminAvailabilityWindowFilters = {
  status?: AvailabilityWindowStatus;
  weekday?: number;
};

const adminAvailabilityWindowSelect = {
  id: availabilityWindows.id,
  weekday: availabilityWindows.weekday,
  startLocalTime: availabilityWindows.startLocalTime,
  endLocalTime: availabilityWindows.endLocalTime,
  status: availabilityWindows.status,
  createdAt: availabilityWindows.createdAt,
  updatedAt: availabilityWindows.updatedAt,
};

export const findAdminAvailabilityWindows = async (
  filters: AdminAvailabilityWindowFilters = {},
) => {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(availabilityWindows.status, filters.status));
  }

  if (filters.weekday !== undefined) {
    conditions.push(eq(availabilityWindows.weekday, filters.weekday));
  }

  let query = db.select(adminAvailabilityWindowSelect).from(availabilityWindows).$dynamic();
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  if (where) {
    query = query.where(where);
  }

  return query.orderBy(
    asc(availabilityWindows.weekday),
    asc(availabilityWindows.startLocalTime),
    asc(availabilityWindows.endLocalTime),
    asc(availabilityWindows.id),
  );
};

export type AdminAvailabilityWindowRow = Awaited<
  ReturnType<typeof findAdminAvailabilityWindows>
>[number];

export const findAdminAvailabilityWindowById = async (id: string) => {
  const rows = await db
    .select(adminAvailabilityWindowSelect)
    .from(availabilityWindows)
    .where(eq(availabilityWindows.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const findPublishedWindowsForInvariant = async (excludeId?: string) =>
  db
    .select(adminAvailabilityWindowSelect)
    .from(availabilityWindows)
    .where(
      and(
        eq(availabilityWindows.status, "published"),
        excludeId ? ne(availabilityWindows.id, excludeId) : undefined,
      ),
    );

export const insertAdminAvailabilityWindow = async (
  input: AdminAvailabilityWindowInsert,
) => {
  const rows = await db
    .insert(availabilityWindows)
    .values(input)
    .returning({ id: availabilityWindows.id });

  return rows[0] ? findAdminAvailabilityWindowById(rows[0].id) : null;
};

export const updateAdminAvailabilityWindow = async (
  id: string,
  input: AdminAvailabilityWindowUpdate,
) => {
  const rows = await db
    .update(availabilityWindows)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(availabilityWindows.id, id))
    .returning({ id: availabilityWindows.id });

  return rows[0] ? findAdminAvailabilityWindowById(rows[0].id) : null;
};

export const deleteAdminAvailabilityWindow = async (id: string) => {
  const rows = await db
    .delete(availabilityWindows)
    .where(eq(availabilityWindows.id, id))
    .returning({ id: availabilityWindows.id });

  return rows[0] ?? null;
};

export const archiveAdminAvailabilityWindow = async (id: string) => {
  const rows = await db
    .update(availabilityWindows)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(availabilityWindows.id, id))
    .returning({ id: availabilityWindows.id });

  return rows[0] ? findAdminAvailabilityWindowById(rows[0].id) : null;
};
