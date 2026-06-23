import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  findPublicSessionById,
  findSessionActiveHolds,
  findSessionBlockingBookings,
} from "../sessions/public-sessions.repository.js";
import { previewAvailabilitySlots } from "./availability-slots.service.js";
import { insertSlotHold, releaseSlotHold } from "./slot-holds.repository.js";

export type SlotHoldInput = {
  offeringId: string;
  offeringSessionId?: string | null;
  startsAt: string;
  endsAt: string;
};

const holdDurationMinutes = 10;

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

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const slotUnavailableError = () =>
  new AppError({
    code: "SLOT_UNAVAILABLE",
    message: "This slot is no longer available.",
    statusCode: httpStatus.conflict,
  });

const assertAvailableSessionHold = async (input: {
  offeringId: string;
  offeringSessionId: string;
  startsAt: Date;
  endsAt: Date;
}) => {
  const session = await findPublicSessionById({
    id: input.offeringSessionId,
    offeringId: input.offeringId,
  });

  if (
    !session ||
    session.startsAt <= new Date() ||
    session.startsAt.getTime() !== input.startsAt.getTime() ||
    session.endsAt.getTime() !== input.endsAt.getTime()
  ) {
    throw slotUnavailableError();
  }

  const now = new Date();
  const [bookings, holds] = await Promise.all([
    findSessionBlockingBookings(session.id),
    findSessionActiveHolds(session.id, now),
  ]);
  const capacity = Math.max(session.capacity, 1);

  if (bookings.length + holds.length >= capacity) {
    throw slotUnavailableError();
  }

  return session;
};

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

  if (input.offeringSessionId) {
    await assertAvailableSessionHold({
      offeringId: input.offeringId,
      offeringSessionId: input.offeringSessionId,
      startsAt,
      endsAt,
    });
  } else {
    const date = toDateKey(startsAt);
    const preview = await previewAvailabilitySlots({
      offeringId: input.offeringId,
      dateFrom: date,
      dateTo: date,
    });
    const matchingSlot = preview.days
      .flatMap((day) => day.slots)
      .find((slot) => slot.startsAt === startsAt.toISOString() && slot.endsAt === endsAt.toISOString());

    if (!matchingSlot || matchingSlot.status !== "available") {
      throw slotUnavailableError();
    }
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + holdDurationMinutes * 60 * 1000);
  const hold = await insertSlotHold({
    offeringId: input.offeringId,
    offeringSessionId: input.offeringSessionId ?? null,
    slotStartAt: startsAt,
    slotEndAt: endsAt,
    status: "active",
    expiresAt,
  });

  if (!hold) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Slot hold could not be created.",
      statusCode: httpStatus.internalServerError,
    });
  }

  return {
    id: hold.id,
    offeringId: hold.offeringId,
    offeringSessionId: hold.offeringSessionId,
    startsAt: hold.slotStartAt.toISOString(),
    endsAt: hold.slotEndAt.toISOString(),
    status: hold.status,
    expiresAt: hold.expiresAt.toISOString(),
    createdAt: hold.createdAt.toISOString(),
  };
};

export const releaseSlotHoldById = async (id: string) => {
  const releasedHold = await releaseSlotHold(id);

  if (!releasedHold) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Slot hold was not found.",
      statusCode: httpStatus.notFound,
    });
  }
};
