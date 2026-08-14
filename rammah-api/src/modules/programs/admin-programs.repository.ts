import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  bookingSlotHolds,
  bookings,
  externalCalendarBusyBlocks,
  offlineLocations,
  offerings,
  scheduledProgramOccurrences,
  scheduledPrograms,
} from "../../db/schema/index.js";

export type ProgramStatus = "draft" | "published" | "archived";
export type ProgramAttendanceMode = "online" | "offline" | "hybrid";
export type OccurrenceStatus = "scheduled" | "cancelled";

export type AdminProgramFilters = {
  offeringId?: string;
  status?: ProgramStatus;
  search?: string;
};

export type ProgramOccurrenceWrite = {
  id?: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  attendanceMode: ProgramAttendanceMode;
  locationId: string | null;
  sortOrder: number;
  status: OccurrenceStatus;
};

export type ProgramWrite = {
  offeringId: string;
  title: string;
  timezone: string;
  attendanceMode: ProgramAttendanceMode;
  locationId: string | null;
  capacity: number;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
};

const programSelect = {
  id: scheduledPrograms.id,
  offeringId: scheduledPrograms.offeringId,
  offeringTitle: offerings.title,
  offeringSlug: offerings.slug,
  offeringStatus: offerings.status,
  offeringSchedulingMode: offerings.schedulingMode,
  offeringBookingMode: offerings.bookingMode,
  title: scheduledPrograms.title,
  timezone: scheduledPrograms.timezone,
  attendanceMode: scheduledPrograms.attendanceMode,
  locationId: scheduledPrograms.locationId,
  locationName: offlineLocations.name,
  capacity: scheduledPrograms.capacity,
  registrationOpensAt: scheduledPrograms.registrationOpensAt,
  registrationClosesAt: scheduledPrograms.registrationClosesAt,
  status: scheduledPrograms.status,
  createdAt: scheduledPrograms.createdAt,
  updatedAt: scheduledPrograms.updatedAt,
};

export const findAdminPrograms = async (filters: AdminProgramFilters = {}) => {
  const conditions: SQL[] = [];
  if (filters.offeringId) conditions.push(eq(scheduledPrograms.offeringId, filters.offeringId));
  if (filters.status) conditions.push(eq(scheduledPrograms.status, filters.status));
  if (filters.search?.trim()) {
    const pattern = `%${filters.search.trim()}%`;
    conditions.push(or(ilike(scheduledPrograms.title, pattern), ilike(offerings.title, pattern))!);
  }

  let query = db
    .select(programSelect)
    .from(scheduledPrograms)
    .innerJoin(offerings, eq(scheduledPrograms.offeringId, offerings.id))
    .leftJoin(offlineLocations, eq(scheduledPrograms.locationId, offlineLocations.id))
    .$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(scheduledPrograms.updatedAt), asc(scheduledPrograms.title));
};

export type AdminProgramRow = Awaited<ReturnType<typeof findAdminPrograms>>[number];

export const findAdminProgramById = async (id: string) => {
  const rows = await db
    .select(programSelect)
    .from(scheduledPrograms)
    .innerJoin(offerings, eq(scheduledPrograms.offeringId, offerings.id))
    .leftJoin(offlineLocations, eq(scheduledPrograms.locationId, offlineLocations.id))
    .where(eq(scheduledPrograms.id, id))
    .limit(1);
  return rows[0] ?? null;
};

export const findProgramOccurrences = async (programId: string) =>
  db
    .select({
      id: scheduledProgramOccurrences.id,
      scheduledProgramId: scheduledProgramOccurrences.scheduledProgramId,
      startsAt: scheduledProgramOccurrences.startsAt,
      endsAt: scheduledProgramOccurrences.endsAt,
      timezone: scheduledProgramOccurrences.timezone,
      attendanceMode: scheduledProgramOccurrences.attendanceMode,
      locationId: scheduledProgramOccurrences.locationId,
      locationName: offlineLocations.name,
      sortOrder: scheduledProgramOccurrences.sortOrder,
      googleCalendarEventId: scheduledProgramOccurrences.googleCalendarEventId,
      meetUrl: scheduledProgramOccurrences.meetUrl,
      status: scheduledProgramOccurrences.status,
      createdAt: scheduledProgramOccurrences.createdAt,
      updatedAt: scheduledProgramOccurrences.updatedAt,
    })
    .from(scheduledProgramOccurrences)
    .leftJoin(offlineLocations, eq(scheduledProgramOccurrences.locationId, offlineLocations.id))
    .where(eq(scheduledProgramOccurrences.scheduledProgramId, programId))
    .orderBy(
      asc(scheduledProgramOccurrences.startsAt),
      asc(scheduledProgramOccurrences.sortOrder),
      asc(scheduledProgramOccurrences.id),
    );

export type ProgramOccurrenceRow = Awaited<ReturnType<typeof findProgramOccurrences>>[number];

const blockingBookingStatuses = ["pending_payment", "confirmed", "rescheduled"] as const;

export const findProgramCapacityCounts = async (programId: string, now = new Date()) => {
  const [bookingRows, holdRows, historyRows] = await Promise.all([
    db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.scheduledProgramId, programId),
          inArray(bookings.status, [...blockingBookingStatuses]),
        ),
      ),
    db
      .select({ id: bookingSlotHolds.id })
      .from(bookingSlotHolds)
      .where(
        and(
          eq(bookingSlotHolds.scheduledProgramId, programId),
          eq(bookingSlotHolds.status, "active"),
          gt(bookingSlotHolds.expiresAt, now),
        ),
      ),
    db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.scheduledProgramId, programId))
      .limit(1),
  ]);
  return {
    booked: bookingRows.length,
    held: holdRows.length,
    hasHistory: historyRows.length > 0,
  };
};

export const findProgramOffering = async (id: string) => {
  const rows = await db
    .select({
      id: offerings.id,
      title: offerings.title,
      slug: offerings.slug,
      status: offerings.status,
      schedulingMode: offerings.schedulingMode,
      attendanceMode: offerings.attendanceMode,
      bookingMode: offerings.bookingMode,
    })
    .from(offerings)
    .where(eq(offerings.id, id))
    .limit(1);
  return rows[0] ?? null;
};

export const findProgramLocation = async (id: string) => {
  const rows = await db
    .select({ id: offlineLocations.id, name: offlineLocations.name, status: offlineLocations.status })
    .from(offlineLocations)
    .where(eq(offlineLocations.id, id))
    .limit(1);
  return rows[0] ?? null;
};

export type ProgramScheduleConflict = {
  kind: "program" | "appointment_booking" | "appointment_hold" | "external_busy";
  id: string;
  startsAt: Date;
  endsAt: Date;
};

export const findProgramScheduleConflicts = async (
  programId: string | undefined,
  occurrences: Array<{ startsAt: Date; endsAt: Date }>,
  now = new Date(),
) => {
  if (occurrences.length === 0) return [] as ProgramScheduleConflict[];
  const [programRows, bookingRows, holdRows, busyRows] = await Promise.all([
    db
      .select({
        id: scheduledProgramOccurrences.id,
        startsAt: scheduledProgramOccurrences.startsAt,
        endsAt: scheduledProgramOccurrences.endsAt,
      })
      .from(scheduledProgramOccurrences)
      .innerJoin(
        scheduledPrograms,
        eq(scheduledProgramOccurrences.scheduledProgramId, scheduledPrograms.id),
      )
      .where(
        and(
          eq(scheduledPrograms.status, "published"),
          eq(scheduledProgramOccurrences.status, "scheduled"),
          programId ? ne(scheduledPrograms.id, programId) : undefined,
        ),
      ),
    db
      .select({ id: bookings.id, startsAt: bookings.slotStartAt, endsAt: bookings.slotEndAt })
      .from(bookings)
      .where(inArray(bookings.status, [...blockingBookingStatuses])),
    db
      .select({ id: bookingSlotHolds.id, startsAt: bookingSlotHolds.slotStartAt, endsAt: bookingSlotHolds.slotEndAt })
      .from(bookingSlotHolds)
      .where(
        and(
          eq(bookingSlotHolds.status, "active"),
          gt(bookingSlotHolds.expiresAt, now),
        ),
      ),
    db
      .select({ id: externalCalendarBusyBlocks.id, startsAt: externalCalendarBusyBlocks.startsAt, endsAt: externalCalendarBusyBlocks.endsAt })
      .from(externalCalendarBusyBlocks)
      .where(eq(externalCalendarBusyBlocks.status, "published")),
  ]);
  const candidates: ProgramScheduleConflict[] = [
    ...programRows.map((row) => ({ kind: "program" as const, ...row })),
    ...bookingRows
      .filter((row): row is typeof row & { startsAt: Date; endsAt: Date } => Boolean(row.startsAt && row.endsAt))
      .map((row) => ({ kind: "appointment_booking" as const, ...row })),
    ...holdRows
      .filter((row): row is typeof row & { startsAt: Date; endsAt: Date } => Boolean(row.startsAt && row.endsAt))
      .map((row) => ({ kind: "appointment_hold" as const, ...row })),
    ...busyRows.map((row) => ({ kind: "external_busy" as const, ...row })),
  ];

  return candidates.filter((candidate) =>
    occurrences.some(
      (occurrence) =>
        occurrence.startsAt < candidate.endsAt && occurrence.endsAt > candidate.startsAt,
    ),
  );
};

export const insertAdminProgram = async (
  input: ProgramWrite,
  occurrences: ProgramOccurrenceWrite[],
) => {
  const id = await db.transaction(async (tx) => {
    const [program] = await tx
      .insert(scheduledPrograms)
      .values({
        offeringId: input.offeringId,
        title: input.title,
        timezone: input.timezone,
        attendanceMode: input.attendanceMode,
        locationId: input.locationId,
        capacity: input.capacity,
        registrationOpensAt: input.registrationOpensAt,
        registrationClosesAt: input.registrationClosesAt,
        status: "draft",
      })
      .returning({ id: scheduledPrograms.id });
    if (!program) return null;
    if (occurrences.length > 0) {
      await tx.insert(scheduledProgramOccurrences).values(
        occurrences.map(({ id: _id, ...occurrence }) => ({
          ...occurrence,
          scheduledProgramId: program.id,
        })),
      );
    }
    return program.id;
  });
  return id ? findAdminProgramById(id) : null;
};

export const updateAdminProgram = async (
  id: string,
  input: Partial<ProgramWrite>,
  occurrences: ProgramOccurrenceWrite[] | undefined,
  preserveOccurrenceHistory: boolean,
) => {
  const updatedId = await db.transaction(async (tx) => {
    const [program] = await tx
      .update(scheduledPrograms)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(scheduledPrograms.id, id))
      .returning({ id: scheduledPrograms.id });
    if (!program) return null;
    if (occurrences) {
      const existing = await tx
        .select({ id: scheduledProgramOccurrences.id })
        .from(scheduledProgramOccurrences)
        .where(eq(scheduledProgramOccurrences.scheduledProgramId, id));
      const existingIds = new Set(existing.map((row) => row.id));
      const retainedIds = new Set<string>();
      for (const occurrence of occurrences) {
        const { id: occurrenceId, ...values } = occurrence;
        if (occurrenceId && existingIds.has(occurrenceId)) {
          retainedIds.add(occurrenceId);
          await tx
            .update(scheduledProgramOccurrences)
            .set({ ...values, updatedAt: new Date() })
            .where(
              and(
                eq(scheduledProgramOccurrences.id, occurrenceId),
                eq(scheduledProgramOccurrences.scheduledProgramId, id),
              ),
            );
        } else {
          await tx.insert(scheduledProgramOccurrences).values({
            ...values,
            scheduledProgramId: id,
          });
        }
      }
      const removedIds = existing.map(({ id: existingId }) => existingId).filter((existingId) => !retainedIds.has(existingId));
      if (removedIds.length > 0) {
        if (preserveOccurrenceHistory) {
          await tx
            .update(scheduledProgramOccurrences)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(inArray(scheduledProgramOccurrences.id, removedIds));
        } else {
          await tx.delete(scheduledProgramOccurrences).where(inArray(scheduledProgramOccurrences.id, removedIds));
        }
      }
    }
    return program.id;
  });
  return updatedId ? findAdminProgramById(updatedId) : null;
};

export const setAdminProgramStatus = async (id: string, status: ProgramStatus) => {
  const rows = await db
    .update(scheduledPrograms)
    .set({ status, updatedAt: new Date() })
    .where(eq(scheduledPrograms.id, id))
    .returning({ id: scheduledPrograms.id });
  return rows[0] ? findAdminProgramById(rows[0].id) : null;
};

export const deleteAdminProgram = async (id: string) => {
  const rows = await db.transaction(async (tx) => {
    await tx
      .delete(scheduledProgramOccurrences)
      .where(eq(scheduledProgramOccurrences.scheduledProgramId, id));
    return tx.delete(scheduledPrograms).where(eq(scheduledPrograms.id, id)).returning({ id: scheduledPrograms.id });
  });
  return rows[0] ?? null;
};
