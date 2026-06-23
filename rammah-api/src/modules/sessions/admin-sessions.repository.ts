import { and, asc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  attendanceModeEnum,
  contentStatusEnum,
  offlineLocations,
  offeringSessions,
  offerings,
} from "../../db/schema/index.js";

export type AttendanceMode = (typeof attendanceModeEnum.enumValues)[number];
export type ContentStatus = (typeof contentStatusEnum.enumValues)[number];
export type AdminSessionInsert = typeof offeringSessions.$inferInsert;
export type AdminSessionUpdate = Partial<
  Omit<AdminSessionInsert, "id" | "createdAt">
>;

export type AdminSessionFilters = {
  offeringId?: string;
  locationId?: string;
  attendanceMode?: AttendanceMode;
  status?: ContentStatus;
  dateFrom?: Date;
  dateTo?: Date;
};

const adminSessionSelect = {
  id: offeringSessions.id,
  offeringId: offeringSessions.offeringId,
  offeringTitle: offerings.title,
  offeringSlug: offerings.slug,
  offeringAttendanceMode: offerings.attendanceMode,
  startsAt: offeringSessions.startsAt,
  endsAt: offeringSessions.endsAt,
  timezone: offeringSessions.timezone,
  capacity: offeringSessions.capacity,
  attendanceMode: offeringSessions.attendanceMode,
  locationId: offeringSessions.locationId,
  locationName: offlineLocations.name,
  locationCity: offlineLocations.city,
  locationCountryCode: offlineLocations.countryCode,
  googleCalendarEventId: offeringSessions.googleCalendarEventId,
  status: offeringSessions.status,
  createdAt: offeringSessions.createdAt,
  updatedAt: offeringSessions.updatedAt,
};

export const findAdminSessions = async (
  filters: AdminSessionFilters = {},
) => {
  const conditions: SQL[] = [];

  if (filters.offeringId) {
    conditions.push(eq(offeringSessions.offeringId, filters.offeringId));
  }

  if (filters.locationId) {
    conditions.push(eq(offeringSessions.locationId, filters.locationId));
  }

  if (filters.attendanceMode) {
    conditions.push(eq(offeringSessions.attendanceMode, filters.attendanceMode));
  }

  if (filters.status) {
    conditions.push(eq(offeringSessions.status, filters.status));
  }

  if (filters.dateFrom) {
    conditions.push(gte(offeringSessions.startsAt, filters.dateFrom));
  }

  if (filters.dateTo) {
    conditions.push(lte(offeringSessions.startsAt, filters.dateTo));
  }

  let query = db
    .select(adminSessionSelect)
    .from(offeringSessions)
    .innerJoin(offerings, eq(offeringSessions.offeringId, offerings.id))
    .leftJoin(offlineLocations, eq(offeringSessions.locationId, offlineLocations.id))
    .$dynamic();

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  if (where) {
    query = query.where(where);
  }

  return query.orderBy(asc(offeringSessions.startsAt), asc(offerings.title));
};

export type AdminSessionRow = Awaited<
  ReturnType<typeof findAdminSessions>
>[number];

export const findAdminSessionById = async (id: string) => {
  const rows = await db
    .select(adminSessionSelect)
    .from(offeringSessions)
    .innerJoin(offerings, eq(offeringSessions.offeringId, offerings.id))
    .leftJoin(offlineLocations, eq(offeringSessions.locationId, offlineLocations.id))
    .where(eq(offeringSessions.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const findOfferingForSession = async (id: string) => {
  const rows = await db
    .select({
      id: offerings.id,
      attendanceMode: offerings.attendanceMode,
    })
    .from(offerings)
    .where(eq(offerings.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const findLocationForSession = async (id: string) => {
  const rows = await db
    .select({
      id: offlineLocations.id,
      status: offlineLocations.status,
    })
    .from(offlineLocations)
    .where(eq(offlineLocations.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const insertAdminSession = async (input: AdminSessionInsert) => {
  const rows = await db
    .insert(offeringSessions)
    .values(input)
    .returning({ id: offeringSessions.id });

  return rows[0] ? findAdminSessionById(rows[0].id) : null;
};

export const updateAdminSession = async (
  id: string,
  input: AdminSessionUpdate,
) => {
  const rows = await db
    .update(offeringSessions)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(offeringSessions.id, id))
    .returning({ id: offeringSessions.id });

  return rows[0] ? findAdminSessionById(rows[0].id) : null;
};

export const archiveAdminSession = async (id: string) =>
  updateAdminSession(id, { status: "archived" });
