import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import {
  findAdminBookingById,
  findAdminBookings,
  findAdminBookingScheduleContextById,
  findRescheduleSessionById,
  countActiveHoldsForSlot,
  countBlockingBookingsForSlot,
  type AdminBookingFilters,
  type AdminBookingRow,
  type BookingStatus,
  updateAdminBookingSchedule,
  updateAdminBookingStatus as updateAdminBookingStatusRow,
} from "./admin-bookings.repository.js";
import {
  cancelGoogleCalendarEventForBooking,
  ensureGoogleCalendarEventForBooking,
  updateGoogleCalendarEventForBooking,
} from "../calendar/google-calendar.service.js";
import {
  sendBookingCancelledEmails,
  sendBookingConfirmedEmails,
  sendBookingRescheduledEmails,
} from "../emails/email.service.js";
import { previewAvailabilitySlots } from "../availability/availability-slots.service.js";

export type AdminBookingStatusPatchInput = {
  status: BookingStatus;
  reason?: string | null;
};

export type AdminBookingRescheduleInput = {
  offeringSessionId?: string | null;
  startsAt: string;
  endsAt: string;
  timezone?: string | null;
  reason?: string | null;
};

const allowedTransitions: Record<BookingStatus, BookingStatus[]> = {
  draft: ["confirmed", "rejected", "cancelled"],
  pending_payment: ["confirmed", "payment_failed", "cancelled", "expired"],
  payment_failed: ["pending_payment", "cancelled", "expired"],
  confirmed: ["completed", "no_show", "cancelled"],
  cancelled: [],
  rescheduled: ["confirmed", "completed", "no_show", "cancelled"],
  completed: [],
  no_show: [],
  expired: [],
  rejected: [],
};

const toIsoStringOrNull = (value: Date | null) =>
  value ? value.toISOString() : null;

const slotUnavailableError = () =>
  new AppError({
    code: "SLOT_UNAVAILABLE",
    message: "This slot is no longer available.",
    statusCode: httpStatus.conflict,
  });

const toAdminBooking = (booking: AdminBookingRow) => ({
  id: booking.id,
  publicToken: booking.publicToken,
  offering: {
    id: booking.offeringId,
    title: booking.offeringTitle,
    slug: booking.offeringSlug,
  },
  attendanceMode: booking.attendanceMode,
  status: booking.status,
  customer: {
    fullName: booking.customerFullName,
    email: booking.customerEmail,
    phone: booking.customerPhone,
  },
  countryCode: booking.countryCode,
  location: booking.locationId
    ? {
        id: booking.locationId,
        name: booking.locationName,
        city: booking.locationCity,
        countryCode: booking.locationCountryCode,
      }
    : null,
  slot: {
    startsAt: toIsoStringOrNull(booking.slotStartAt),
    endsAt: toIsoStringOrNull(booking.slotEndAt),
    timezone: booking.timezone,
  },
  payment: {
    required: booking.paymentRequired,
    currency: booking.priceCurrency,
    baseAmountMinor: booking.baseAmountMinor,
    discountAmountMinor: booking.discountAmountMinor,
    taxAmountMinor: booking.taxAmountMinor,
    totalAmountMinor: booking.totalAmountMinor,
  },
  calendar: booking.calendarEventId
    ? {
        id: booking.calendarEventId,
        status: booking.calendarStatus,
        externalEventId: booking.calendarExternalEventId,
        meetUrl: booking.calendarMeetUrl,
        lastError: booking.calendarLastError,
        updatedAt: toIsoStringOrNull(booking.calendarUpdatedAt),
      }
    : null,
  confirmedAt: toIsoStringOrNull(booking.confirmedAt),
  cancelledAt: toIsoStringOrNull(booking.cancelledAt),
  createdAt: booking.createdAt.toISOString(),
  updatedAt: booking.updatedAt.toISOString(),
});

export const listAdminBookings = async (filters: AdminBookingFilters) => {
  const bookings = await findAdminBookings(filters);
  return bookings.map(toAdminBooking);
};

export const getAdminBooking = async (id: string) => {
  const booking = await findAdminBookingById(id);

  if (!booking) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  return toAdminBooking(booking);
};

const assertTransitionAllowed = (from: BookingStatus, to: BookingStatus) => {
  if (from === to) {
    return;
  }

  if (!allowedTransitions[from].includes(to)) {
    throw new AppError({
      code: "CONFLICT",
      message: `Booking status cannot change from ${from} to ${to}.`,
      statusCode: httpStatus.conflict,
    });
  }
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

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const assertRecurringSlotIsAvailable = async (input: {
  bookingId: string;
  offeringId: string;
  startsAt: Date;
  endsAt: Date;
  currentStartsAt: Date | null;
  currentEndsAt: Date | null;
}) => {
  const unchangedSlot =
    input.currentStartsAt?.getTime() === input.startsAt.getTime() &&
    input.currentEndsAt?.getTime() === input.endsAt.getTime();

  if (unchangedSlot) return;

  const date = toDateKey(input.startsAt);
  const preview = await previewAvailabilitySlots({
    offeringId: input.offeringId,
    dateFrom: date,
    dateTo: date,
  });
  const matchingSlot = preview.days
    .flatMap((day) => day.slots)
    .find(
      (slot) =>
        slot.startsAt === input.startsAt.toISOString() &&
        slot.endsAt === input.endsAt.toISOString(),
    );

  if (!matchingSlot || matchingSlot.status === "blocked") {
    throw slotUnavailableError();
  }

  const [bookedCount, heldCount] = await Promise.all([
    countBlockingBookingsForSlot({
      bookingId: input.bookingId,
      offeringId: input.offeringId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    }),
    countActiveHoldsForSlot({
      offeringId: input.offeringId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    }),
  ]);

  if (bookedCount + heldCount >= Math.max(preview.offering.capacity, 1)) {
    throw slotUnavailableError();
  }
};

const assertSessionSlotIsAvailable = async (input: {
  bookingId: string;
  offeringId: string;
  offeringSessionId: string;
  startsAt: Date;
  endsAt: Date;
}) => {
  const session = await findRescheduleSessionById({
    sessionId: input.offeringSessionId,
    offeringId: input.offeringId,
  });

  if (
    !session ||
    session.status !== "published" ||
    session.startsAt.getTime() !== input.startsAt.getTime() ||
    session.endsAt.getTime() !== input.endsAt.getTime()
  ) {
    throw slotUnavailableError();
  }

  const [bookedCount, heldCount] = await Promise.all([
    countBlockingBookingsForSlot({
      bookingId: input.bookingId,
      offeringId: input.offeringId,
      offeringSessionId: input.offeringSessionId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    }),
    countActiveHoldsForSlot({
      offeringId: input.offeringId,
      offeringSessionId: input.offeringSessionId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    }),
  ]);

  if (bookedCount + heldCount >= Math.max(session.capacity, 1)) {
    throw slotUnavailableError();
  }

  return session;
};

export const updateAdminBookingStatusById = async (
  id: string,
  input: AdminBookingStatusPatchInput,
  auditContext?: AuditContext,
) => {
  const booking = await findAdminBookingById(id);

  if (!booking) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  assertTransitionAllowed(booking.status, input.status);

  const beforeBooking = toAdminBooking(booking);

  if (booking.status === input.status) {
    return beforeBooking;
  }

  const now = new Date();
  const statusUpdate: {
    status: BookingStatus;
    confirmedAt?: Date | null;
    cancelledAt?: Date | null;
  } = {
    status: input.status,
  };

  if (input.status === "confirmed") {
    statusUpdate.confirmedAt = booking.confirmedAt ?? now;
    statusUpdate.cancelledAt = null;
  }

  if (input.status === "cancelled") {
    statusUpdate.cancelledAt = booking.cancelledAt ?? now;
  }

  const updatedBooking = await updateAdminBookingStatusRow(id, statusUpdate);

  if (!updatedBooking) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  let afterBooking = toAdminBooking(updatedBooking);

  if (afterBooking.status === "confirmed") {
    await ensureGoogleCalendarEventForBooking(afterBooking.id);
    await sendBookingConfirmedEmails(afterBooking.id);
    const refreshedBooking = await findAdminBookingById(afterBooking.id);
    afterBooking = refreshedBooking ? toAdminBooking(refreshedBooking) : afterBooking;
  }

  if (afterBooking.status === "cancelled") {
    await cancelGoogleCalendarEventForBooking(afterBooking.id);
    await sendBookingCancelledEmails(afterBooking.id);
    const refreshedBooking = await findAdminBookingById(afterBooking.id);
    afterBooking = refreshedBooking ? toAdminBooking(refreshedBooking) : afterBooking;
  }

  await writeAuditLog(auditContext, {
    action: "admin.bookings.status_update",
    resourceType: "booking",
    resourceId: afterBooking.id,
    beforeSnapshot: beforeBooking,
    afterSnapshot: {
      ...afterBooking,
      transitionReason: input.reason?.trim() || null,
    },
  });

  return afterBooking;
};

export const rescheduleAdminBookingById = async (
  id: string,
  input: AdminBookingRescheduleInput,
  auditContext?: AuditContext,
) => {
  const booking = await findAdminBookingScheduleContextById(id);

  if (!booking) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (!["confirmed", "rescheduled"].includes(booking.status)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Only confirmed bookings can be rescheduled.",
      statusCode: httpStatus.badRequest,
    });
  }

  const startsAt = parseTimestamp(input.startsAt, "startsAt");
  const endsAt = parseTimestamp(input.endsAt, "endsAt");

  if (startsAt >= endsAt) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Slot start must be before slot end.",
      statusCode: httpStatus.badRequest,
      details: [{ field: "startsAt", message: "Start timestamp must be before end timestamp." }],
    });
  }

  const beforeBooking = await findAdminBookingById(id);

  if (!beforeBooking) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const beforeSnapshot = toAdminBooking(beforeBooking);
  let timezone = input.timezone?.trim() || booking.timezone || "Africa/Cairo";
  const offeringSessionId = input.offeringSessionId ?? null;

  if (offeringSessionId) {
    const session = await assertSessionSlotIsAvailable({
      bookingId: booking.id,
      offeringId: booking.offeringId,
      offeringSessionId,
      startsAt,
      endsAt,
    });
    timezone = session.timezone;
  } else {
    await assertRecurringSlotIsAvailable({
      bookingId: booking.id,
      offeringId: booking.offeringId,
      startsAt,
      endsAt,
      currentStartsAt: booking.slotStartAt,
      currentEndsAt: booking.slotEndAt,
    });
  }

  const updatedBooking = await updateAdminBookingSchedule({
    bookingId: booking.id,
    offeringSessionId,
    startsAt,
    endsAt,
    timezone,
    confirmedAt: booking.confirmedAt,
  });

  if (!updatedBooking) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  await updateGoogleCalendarEventForBooking(booking.id);
  await sendBookingRescheduledEmails(booking.id);

  const refreshedBooking = await findAdminBookingById(booking.id);
  const afterBooking = refreshedBooking ? toAdminBooking(refreshedBooking) : toAdminBooking(updatedBooking);

  await writeAuditLog(auditContext, {
    action: "admin.bookings.reschedule",
    resourceType: "booking",
    resourceId: booking.id,
    beforeSnapshot,
    afterSnapshot: {
      ...afterBooking,
      transitionReason: input.reason?.trim() || null,
    },
  });

  return afterBooking;
};

export const retryAdminBookingCalendarSync = async (
  id: string,
  auditContext?: AuditContext,
) => {
  const booking = await findAdminBookingById(id);

  if (!booking) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (booking.status !== "confirmed") {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Calendar sync can only run for confirmed bookings.",
      statusCode: httpStatus.badRequest,
    });
  }

  const beforeBooking = toAdminBooking(booking);
  await ensureGoogleCalendarEventForBooking(id, { forceRetry: true });
  const refreshedBooking = await findAdminBookingById(id);

  if (!refreshedBooking) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const afterBooking = toAdminBooking(refreshedBooking);

  await writeAuditLog(auditContext, {
    action: "admin.bookings.calendar_retry",
    resourceType: "booking",
    resourceId: id,
    beforeSnapshot: beforeBooking,
    afterSnapshot: afterBooking,
  });

  return afterBooking;
};
