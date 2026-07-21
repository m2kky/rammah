import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { env } from "../../config/env.js";
import { createAtomicSlotHold } from "./slot-capacity.repository.js";
import { releaseSlotHold } from "./slot-holds.repository.js";
import { createSlotHoldToken } from "./slot-hold-token.js";

export type SlotHoldInput = {
  offeringId: string;
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

const slotUnavailableError = () =>
  new AppError({
    code: "SLOT_UNAVAILABLE",
    message: "This slot is no longer available.",
    statusCode: httpStatus.conflict,
  });

export const createSlotHold = async (input: SlotHoldInput) => {
  const startsAt = parseTimestamp(input.startsAt, "startsAt");
  const endsAt = parseTimestamp(input.endsAt, "endsAt");

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

  const owner = createSlotHoldToken();
  const hold = await createAtomicSlotHold({
    offeringId: input.offeringId,
    offeringSessionId: input.offeringSessionId ?? null,
    startsAt,
    endsAt,
    holdDurationMinutes: env.PAYMENT_HOLD_MINUTES,
    holdSecretHash: owner.digest,
  });

  if (!hold) {
    throw slotUnavailableError();
  }

  return {
    id: hold.id,
    holdToken: owner.token,
    offeringId: hold.offeringId,
    offeringSessionId: hold.offeringSessionId,
    startsAt: hold.slotStartAt.toISOString(),
    endsAt: hold.slotEndAt.toISOString(),
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
