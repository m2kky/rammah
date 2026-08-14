export type LegacySessionTarget = {
  scheduledProgramId: string;
  occurrence: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    timezone: string;
  };
};

export const resolveLegacySessionTarget = async (input: {
  offeringId: string;
  offeringSessionId: string;
}): Promise<LegacySessionTarget | null> => {
  const target = await findLegacyProgramAdapterTarget({
    offeringId: input.offeringId,
    legacySessionId: input.offeringSessionId,
  });

  if (!target) return null;

  return {
    scheduledProgramId: target.scheduledProgramId,
    occurrence: {
      id: target.occurrenceId,
      startsAt: target.startsAt,
      endsAt: target.endsAt,
      timezone: target.timezone,
    },
  };
};
import { findLegacyProgramAdapterTarget } from "./program-compatibility.repository.js";
