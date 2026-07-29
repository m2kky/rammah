import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import {
  findAdminBookingById,
  findAdminBookings,
  rescheduleAdminBookingWithinCapacity,
  type AdminBookingFilters,
  type AdminBookingRow,
  type BookingStatus,
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
  bookingReference: booking.bookingReference,
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

  const result = await rescheduleAdminBookingWithinCapacity({
    bookingId: id,
    offeringSessionId: input.offeringSessionId ?? null,
    startsAt,
    endsAt,
    timezone: input.timezone?.trim() || "",
  });

  if (result.outcome === "not_found") {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (result.outcome === "invalid_status") {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Only confirmed bookings can be rescheduled.",
      statusCode: httpStatus.badRequest,
    });
  }

  if (result.outcome === "unavailable") throw slotUnavailableError();

  const updatedBooking = await findAdminBookingById(result.bookingId);

  if (!updatedBooking) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const beforeSnapshot = toAdminBooking({
    ...updatedBooking,
    status: result.before.status,
    slotStartAt: result.before.slotStartAt,
    slotEndAt: result.before.slotEndAt,
    timezone: result.before.timezone,
    confirmedAt: result.before.confirmedAt,
    updatedAt: result.before.updatedAt,
  });

  await updateGoogleCalendarEventForBooking(result.bookingId);
  await sendBookingRescheduledEmails(result.bookingId);

  const refreshedBooking = await findAdminBookingById(result.bookingId);
  const afterBooking = refreshedBooking ? toAdminBooking(refreshedBooking) : toAdminBooking(updatedBooking);

  await writeAuditLog(auditContext, {
    action: "admin.bookings.reschedule",
    resourceType: "booking",
    resourceId: result.bookingId,
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
