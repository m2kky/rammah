import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  offlineLocations,
  scheduledProgramOccurrences,
  scheduledPrograms,
} from "../../db/schema/index.js";

export type CanonicalBookingOccurrence = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  attendanceMode: "online" | "offline" | "hybrid";
  meetUrl: string | null;
  location: {
    id: string;
    name: string;
    city: string | null;
    countryCode: string;
  } | null;
};

export type CanonicalBookingTarget =
  | {
      kind: "appointment";
      scheduledProgramId: null;
      startsAt: Date;
      endsAt: Date;
      timezone: string;
      occurrences: [];
    }
  | {
      kind: "scheduled_program";
      scheduledProgramId: string;
      title: string;
      timezone: string;
      occurrences: CanonicalBookingOccurrence[];
    };

type BookingTargetSource = {
  scheduledProgramId: string | null;
  slotStartAt: Date | null;
  slotEndAt: Date | null;
  timezone: string;
};

export const attachCanonicalBookingTargets = async <T extends BookingTargetSource>(
  rows: T[],
): Promise<Array<T & { target: CanonicalBookingTarget }>> => {
  const programIds = [
    ...new Set(
      rows
        .map(({ scheduledProgramId }) => scheduledProgramId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const occurrenceRows = programIds.length
    ? await db
        .select({
          scheduledProgramId: scheduledPrograms.id,
          programTitle: scheduledPrograms.title,
          programTimezone: scheduledPrograms.timezone,
          id: scheduledProgramOccurrences.id,
          startsAt: scheduledProgramOccurrences.startsAt,
          endsAt: scheduledProgramOccurrences.endsAt,
          timezone: scheduledProgramOccurrences.timezone,
          attendanceMode: scheduledProgramOccurrences.attendanceMode,
          meetUrl: scheduledProgramOccurrences.meetUrl,
          locationId: offlineLocations.id,
          locationName: offlineLocations.name,
          locationCity: offlineLocations.city,
          locationCountryCode: offlineLocations.countryCode,
        })
        .from(scheduledPrograms)
        .innerJoin(
          scheduledProgramOccurrences,
          eq(scheduledProgramOccurrences.scheduledProgramId, scheduledPrograms.id),
        )
        .leftJoin(
          offlineLocations,
          eq(scheduledProgramOccurrences.locationId, offlineLocations.id),
        )
        .where(
          and(
            inArray(scheduledPrograms.id, programIds),
            eq(scheduledProgramOccurrences.status, "scheduled"),
          ),
        )
        .orderBy(
          asc(scheduledPrograms.id),
          asc(scheduledProgramOccurrences.sortOrder),
          asc(scheduledProgramOccurrences.startsAt),
        )
    : [];
  const occurrencesByProgram = new Map<string, CanonicalBookingOccurrence[]>();
  const timezoneByProgram = new Map<string, string>();
  const titleByProgram = new Map<string, string>();

  for (const occurrence of occurrenceRows) {
    timezoneByProgram.set(occurrence.scheduledProgramId, occurrence.programTimezone);
    titleByProgram.set(occurrence.scheduledProgramId, occurrence.programTitle);
    const programOccurrences = occurrencesByProgram.get(occurrence.scheduledProgramId) ?? [];
    programOccurrences.push({
      id: occurrence.id,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      timezone: occurrence.timezone,
      attendanceMode: occurrence.attendanceMode,
      meetUrl: occurrence.meetUrl,
      location: occurrence.locationId
        ? {
            id: occurrence.locationId,
            name: occurrence.locationName!,
            city: occurrence.locationCity,
            countryCode: occurrence.locationCountryCode!,
          }
        : null,
    });
    occurrencesByProgram.set(occurrence.scheduledProgramId, programOccurrences);
  }

  return rows.map((row) => {
    if (row.scheduledProgramId) {
      return {
        ...row,
        target: {
          kind: "scheduled_program",
          scheduledProgramId: row.scheduledProgramId,
          title: titleByProgram.get(row.scheduledProgramId) ?? "Program",
          timezone: timezoneByProgram.get(row.scheduledProgramId) ?? row.timezone,
          occurrences: occurrencesByProgram.get(row.scheduledProgramId) ?? [],
        },
      };
    }

    if (!row.slotStartAt || !row.slotEndAt) {
      throw new Error("Appointment booking is missing its slot timestamps.");
    }

    return {
      ...row,
      target: {
        kind: "appointment",
        scheduledProgramId: null,
        startsAt: row.slotStartAt,
        endsAt: row.slotEndAt,
        timezone: row.timezone,
        occurrences: [],
      },
    };
  });
};

export const projectCanonicalTargetWindow = (target: CanonicalBookingTarget) =>
  target.kind === "appointment"
    ? {
        startsAt: target.startsAt,
        endsAt: target.endsAt,
        timezone: target.timezone,
      }
    : target.occurrences[0]
      ? {
          startsAt: target.occurrences[0].startsAt,
          endsAt: target.occurrences[0].endsAt,
          timezone: target.occurrences[0].timezone,
        }
      : { startsAt: null, endsAt: null, timezone: target.timezone };

export const serializeCanonicalBookingTarget = (target: CanonicalBookingTarget) =>
  target.kind === "appointment"
    ? {
        kind: target.kind,
        scheduledProgramId: null,
        startsAt: target.startsAt.toISOString(),
        endsAt: target.endsAt.toISOString(),
        timezone: target.timezone,
        occurrences: [],
      }
    : {
        kind: target.kind,
        scheduledProgramId: target.scheduledProgramId,
        title: target.title,
        timezone: target.timezone,
        occurrences: target.occurrences.map((occurrence) => ({
          ...occurrence,
          startsAt: occurrence.startsAt.toISOString(),
          endsAt: occurrence.endsAt.toISOString(),
        })),
      };
