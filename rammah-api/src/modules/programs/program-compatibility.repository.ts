import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  scheduledProgramOccurrences,
  scheduledPrograms,
} from "../../db/schema/index.js";

export const findLegacyProgramAdapterTarget = async (input: {
  offeringId: string;
  legacySessionId: string;
}) => {
  const rows = await db
    .select({
      scheduledProgramId: scheduledPrograms.id,
      occurrenceId: scheduledProgramOccurrences.id,
      startsAt: scheduledProgramOccurrences.startsAt,
      endsAt: scheduledProgramOccurrences.endsAt,
      timezone: scheduledProgramOccurrences.timezone,
    })
    .from(scheduledPrograms)
    .innerJoin(
      scheduledProgramOccurrences,
      eq(scheduledProgramOccurrences.scheduledProgramId, scheduledPrograms.id),
    )
    .where(
      and(
        eq(scheduledPrograms.offeringId, input.offeringId),
        eq(scheduledPrograms.id, input.legacySessionId),
        eq(scheduledProgramOccurrences.id, input.legacySessionId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
};
