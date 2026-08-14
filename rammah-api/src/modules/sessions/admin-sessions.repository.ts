import { and, asc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  attendanceModeEnum,
  contentStatusEnum,
  offlineLocations,
  offerings,
  scheduledProgramOccurrences,
  scheduledPrograms,
} from "../../db/schema/index.js";

export type AttendanceMode = (typeof attendanceModeEnum.enumValues)[number];
export type ContentStatus = (typeof contentStatusEnum.enumValues)[number];

export type AdminSessionFilters = {
  offeringId?: string;
  locationId?: string;
  attendanceMode?: AttendanceMode;
  status?: ContentStatus;
  dateFrom?: Date;
  dateTo?: Date;
};

const adminSessionSelect = {
  id: scheduledProgramOccurrences.id,
  scheduledProgramId: scheduledPrograms.id,
  offeringId: scheduledPrograms.offeringId,
  offeringTitle: offerings.title,
  offeringSlug: offerings.slug,
  offeringAttendanceMode: offerings.attendanceMode,
  startsAt: scheduledProgramOccurrences.startsAt,
  endsAt: scheduledProgramOccurrences.endsAt,
  timezone: scheduledProgramOccurrences.timezone,
  capacity: scheduledPrograms.capacity,
  attendanceMode: scheduledProgramOccurrences.attendanceMode,
  locationId: scheduledProgramOccurrences.locationId,
  locationName: offlineLocations.name,
  locationCity: offlineLocations.city,
  locationCountryCode: offlineLocations.countryCode,
  googleCalendarEventId: scheduledProgramOccurrences.googleCalendarEventId,
  status: scheduledPrograms.status,
  createdAt: scheduledPrograms.createdAt,
  updatedAt: scheduledPrograms.updatedAt,
};

export const findAdminSessions = async (
  filters: AdminSessionFilters = {},
) => {
  const conditions: SQL[] = [];

  if (filters.offeringId) {
    conditions.push(eq(scheduledPrograms.offeringId, filters.offeringId));
  }

  if (filters.locationId) {
    conditions.push(eq(scheduledProgramOccurrences.locationId, filters.locationId));
  }

  if (filters.attendanceMode) {
    conditions.push(eq(scheduledProgramOccurrences.attendanceMode, filters.attendanceMode));
  }

  if (filters.status) {
    conditions.push(eq(scheduledPrograms.status, filters.status));
  }

  if (filters.dateFrom) {
    conditions.push(gte(scheduledProgramOccurrences.startsAt, filters.dateFrom));
  }

  if (filters.dateTo) {
    conditions.push(lte(scheduledProgramOccurrences.startsAt, filters.dateTo));
  }

  const query = db
    .select(adminSessionSelect)
    .from(scheduledPrograms)
    .innerJoin(
      scheduledProgramOccurrences,
      eq(scheduledProgramOccurrences.scheduledProgramId, scheduledPrograms.id),
    )
    .innerJoin(offerings, eq(scheduledPrograms.offeringId, offerings.id))
    .leftJoin(
      offlineLocations,
      eq(scheduledProgramOccurrences.locationId, offlineLocations.id),
    )
    .$dynamic();

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return query
    .where(
      where
        ? and(where, eq(scheduledProgramOccurrences.id, scheduledPrograms.id))
        : eq(scheduledProgramOccurrences.id, scheduledPrograms.id),
    )
    .orderBy(asc(scheduledProgramOccurrences.startsAt), asc(offerings.title));
};

export type AdminSessionRow = Awaited<
  ReturnType<typeof findAdminSessions>
>[number];

export const findAdminSessionById = async (id: string) => {
  const rows = await db
    .select(adminSessionSelect)
    .from(scheduledPrograms)
    .innerJoin(
      scheduledProgramOccurrences,
      eq(scheduledProgramOccurrences.scheduledProgramId, scheduledPrograms.id),
    )
    .innerJoin(offerings, eq(scheduledPrograms.offeringId, offerings.id))
    .leftJoin(
      offlineLocations,
      eq(scheduledProgramOccurrences.locationId, offlineLocations.id),
    )
    .where(
      and(
        eq(scheduledPrograms.id, id),
        eq(scheduledProgramOccurrences.id, id),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
};
