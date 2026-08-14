import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { env } from "../../config/env.js";
import { createAtomicSlotHold, isScheduledProgramFull } from "./slot-capacity.repository.js";
import { releaseSlotHold } from "./slot-holds.repository.js";
import { createSlotHoldToken } from "./slot-hold-token.js";
import { resolveLegacySessionTarget } from "../programs/program-compatibility.service.js";
import { findPublicProgramOccurrences } from "../programs/public-programs.repository.js";
import { isEligibleBookingTarget, toPublicBookingPolicy } from "./booking-policy.js";
import { getCurrentBookingPolicy } from "./booking-policy.service.js";

export type SlotHoldInput =
  | {
      offeringId: string;
      target:
        | {
            kind: "appointment";
            startsAt: string;
            endsAt: string;
          }
        | {
            kind: "scheduled_program";
            scheduledProgramId: string;
          };
    }
  | {
      offeringId: string;
      target?: undefined;
      offeringSessionId?: string | null;
      startsAt: string;
      endsAt: string;
    };

const parseTimestamp = (value: string, field: "startsAt" | "endsAt") => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Slot timestamp is invalid.",
      statusCode: httpStatus.badRequest,
      details: [{ field, message: "Use an ISO timestamp." }],
    });
  }

  return date;
};

const slotUnavailableError = (meta?: Record<string, unknown>) =>
  new AppError({
    code: "SLOT_UNAVAILABLE",
    message: "This slot is no longer available.",
    statusCode: httpStatus.conflict,
    meta,
  });

const policyConflictMeta = async (target: {
  scheduledProgramId: string | null;
  startsAt: Date | null;
}) => {
  const bookingPolicy = await getCurrentBookingPolicy();
  const startsAt = target.startsAt ?? (target.scheduledProgramId
    ? (await findPublicProgramOccurrences(target.scheduledProgramId))[0]?.startsAt ?? null
    : null);
  if (!startsAt || isEligibleBookingTarget(startsAt, bookingPolicy)) return undefined;
  const safePolicy = toPublicBookingPolicy(bookingPolicy);
  return {
    earliestBookableDate: safePolicy.earliestBookableDate,
    minimumAdvanceDays: safePolicy.minimumAdvanceDays,
    timezone: safePolicy.timezone,
  };
};

export const createSlotHold = async (input: SlotHoldInput) => {
  let target:
    | {
        offeringId: string;
        offeringSessionId: null;
        scheduledProgramId: string;
        startsAt: null;
        endsAt: null;
      }
    | {
        offeringId: string;
        offeringSessionId: null;
        scheduledProgramId: null;
        startsAt: Date;
        endsAt: Date;
      };

  if (input.target?.kind === "scheduled_program") {
    target = {
      offeringId: input.offeringId,
      offeringSessionId: null,
      scheduledProgramId: input.target.scheduledProgramId,
      startsAt: null,
      endsAt: null,
    };
  } else if (!("target" in input) && input.offeringSessionId) {
    const legacyTarget = await resolveLegacySessionTarget({
      offeringId: input.offeringId,
      offeringSessionId: input.offeringSessionId,
    });
    if (!legacyTarget) throw slotUnavailableError();
    target = {
      offeringId: input.offeringId,
      offeringSessionId: null,
      scheduledProgramId: legacyTarget.scheduledProgramId,
      startsAt: null,
      endsAt: null,
    };
  } else {
    const rawStartsAt = input.target?.kind === "appointment"
      ? input.target.startsAt
      : "startsAt" in input
        ? input.startsAt
        : "";
    const rawEndsAt = input.target?.kind === "appointment"
      ? input.target.endsAt
      : "endsAt" in input
        ? input.endsAt
        : "";
    const startsAt = parseTimestamp(rawStartsAt, "startsAt");
    const endsAt = parseTimestamp(rawEndsAt, "endsAt");

    if (startsAt >= endsAt) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Slot start must be before slot end.",
        statusCode: httpStatus.badRequest,
        details: [
          {
            field: "startsAt",
            message: "Start timestamp must be before end timestamp.",
          },
        ],
      });
    }
    target = {
      offeringId: input.offeringId,
      offeringSessionId: null,
      scheduledProgramId: null,
      startsAt,
      endsAt,
    };
  }

  const owner = createSlotHoldToken();
  const hold = await createAtomicSlotHold({
    ...target,
    holdDurationMinutes: env.PAYMENT_HOLD_MINUTES,
    holdSecretHash: owner.digest,
  });

  if (!hold) {
    if (
      input.target?.kind === "scheduled_program" &&
      target.scheduledProgramId &&
      (await isScheduledProgramFull(target.scheduledProgramId))
    ) {
      throw new AppError({
        code: "PROGRAM_FULL",
        message: "This Program is fully booked.",
        statusCode: httpStatus.conflict,
      });
    }
    throw slotUnavailableError(await policyConflictMeta(target));
  }

  const canonicalTarget = {
    kind: hold.target.kind,
    scheduledProgramId: hold.target.scheduledProgramId,
    startsAt: hold.target.startsAt.toISOString(),
    endsAt: hold.target.endsAt.toISOString(),
    timezone: hold.target.timezone,
  };

  return {
    id: hold.id,
    holdToken: owner.token,
    offeringId: hold.offeringId,
    offeringSessionId: hold.offeringSessionId,
    scheduledProgramId: hold.scheduledProgramId,
    startsAt: canonicalTarget.startsAt,
    endsAt: canonicalTarget.endsAt,
    timezone: canonicalTarget.timezone,
    target: canonicalTarget,
    status: hold.status,
    expiresAt: hold.expiresAt.toISOString(),
    createdAt: hold.createdAt.toISOString(),
  };
};

export const releaseSlotHoldById = async (
  id: string,
  holdToken: string | null | undefined,
) => {
  const releasedHold = await releaseSlotHold(id, holdToken);

  if (!releasedHold) {
    throw slotUnavailableError();
  }
};
