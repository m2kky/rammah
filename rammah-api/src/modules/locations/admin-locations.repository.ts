import { and, asc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import { contentStatusEnum, offlineLocations } from "../../db/schema/index.js";

export type ContentStatus = (typeof contentStatusEnum.enumValues)[number];
export type AdminLocationInsert = typeof offlineLocations.$inferInsert;
export type AdminLocationUpdate = Partial<
  Omit<AdminLocationInsert, "id" | "createdAt">
>;

export type AdminLocationFilters = {
  status?: ContentStatus;
  search?: string;
};

const adminLocationSelect = {
  id: offlineLocations.id,
  name: offlineLocations.name,
  addressLine1: offlineLocations.addressLine1,
  addressLine2: offlineLocations.addressLine2,
  city: offlineLocations.city,
  countryCode: offlineLocations.countryCode,
  mapUrl: offlineLocations.mapUrl,
  instructions: offlineLocations.instructions,
  status: offlineLocations.status,
  createdAt: offlineLocations.createdAt,
  updatedAt: offlineLocations.updatedAt,
};

export const findAdminLocations = async (
  filters: AdminLocationFilters = {},
) => {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(offlineLocations.status, filters.status));
  }

  const search = filters.search?.trim();
  if (search) {
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        ilike(offlineLocations.name, searchPattern),
        ilike(offlineLocations.addressLine1, searchPattern),
        ilike(offlineLocations.city, searchPattern),
        ilike(offlineLocations.countryCode, searchPattern),
      )!,
    );
  }

  let query = db.select(adminLocationSelect).from(offlineLocations).$dynamic();
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  if (where) {
    query = query.where(where);
  }

  return query.orderBy(
    asc(offlineLocations.status),
    asc(offlineLocations.countryCode),
    asc(offlineLocations.city),
    asc(offlineLocations.name),
  );
};

export type AdminLocationRow = Awaited<
  ReturnType<typeof findAdminLocations>
>[number];

export const findAdminLocationById = async (id: string) => {
  const rows = await db
    .select(adminLocationSelect)
    .from(offlineLocations)
    .where(eq(offlineLocations.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const insertAdminLocation = async (input: AdminLocationInsert) => {
  const rows = await db
    .insert(offlineLocations)
    .values(input)
    .returning({ id: offlineLocations.id });

  return rows[0] ? findAdminLocationById(rows[0].id) : null;
};

export const updateAdminLocation = async (
  id: string,
  input: AdminLocationUpdate,
) => {
  const rows = await db
    .update(offlineLocations)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(offlineLocations.id, id))
    .returning({ id: offlineLocations.id });

  return rows[0] ? findAdminLocationById(rows[0].id) : null;
};

export const archiveAdminLocation = async (id: string) =>
  updateAdminLocation(id, { status: "archived" });
