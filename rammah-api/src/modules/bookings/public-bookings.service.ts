import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  listPublicBookingFormFields,
  validateAndNormalizeBookingAnswers,
} from "../booking-form-fields/booking-form-fields.service.js";
import {
  createFreeBookingFromHold,
  findPublicBookableLocationById,
  findPublicBookingHoldContextById,
  findPublicBookingByToken,
  type PublicBookingAnswerInput,
} from "./public-bookings.repository.js";
import { ensureGoogleCalendarEventForBooking } from "../calendar/google-calendar.service.js";
import { findCalendarEventByBookingId } from "../calendar/google-calendar.repository.js";
import { sendBookingConfirmedEmails } from "../emails/email.service.js";
import { findPublishedLocationsForOffering } from "../offerings/offerings.repository.js";
import { env } from "../../config/env.js";
import {
  rescheduleAdminBookingById,
  updateAdminBookingStatusById,
} from "./admin-bookings.service.js";
import {
  projectCanonicalTargetWindow,
  serializeCanonicalBookingTarget,
} from "./booking-target.repository.js";

export type PublicBookingInput = {
  holdId: string;
  holdToken?: string | null;
  attendanceMode?: "online" | "offline" | "hybrid";
  locationId?: string | null;
  customer: {
    fullName: string;
    email: string;
    phone?: string | null;
  };
  countryCode?: string | null;
  timezone: string;
  answers: PublicBookingAnswerInput[];
};

const slotUnavailableError = () =>
  new AppError({
    code: "SLOT_UNAVAILABLE",
    message: "This slot is no longer available.",
    statusCode: httpStatus.conflict,
  });

const normalizeOptionalText = (value: string | null | undefined) => {
  if (value === undefined || value === null) return null;

  const normalized = value.trim();
  return normalized ? normalized : null;
};

const normalizeCountryCode = (value: string | null | undefined) => {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toUpperCase() : null;
};

const validationError = (
  message: string,
  details: Array<{ field?: string; message: string }> = [],
) =>
  new AppError({
    code: "VALIDATION_ERROR",
    message,
    statusCode: httpStatus.badRequest,
    details,
  });

const resolveLocationId = async (input: {
  offeringId: string;
  offeringSessionId?: string | null;
  scheduledProgramId?: string | null;
  attendanceMode: "online" | "offline" | "hybrid";
  locationId?: string | null;
}) => {
  if (
    input.offeringSessionId ||
    input.scheduledProgramId ||
    input.attendanceMode === "online"
  ) {
    return null;
  }

  const locations = await findPublishedLocationsForOffering(input.offeringId);

  if (locations.length === 0) {
    return null;
  }

  const locationId = normalizeOptionalText(input.locationId);

  if (!locationId) {
    throw validationError("Select an offline location.", [
      { field: "locationId", message: "Choose where you want to attend." },
    ]);
  }

  const location = await findPublicBookableLocationById({
    offeringId: input.offeringId,
    locationId,
  });

  if (!location) {
    throw validationError("Selected location is not available for this offering.", [
      { field: "locationId", message: "Choose an available location." },
    ]);
  }

  return location.id;
};

const toPublicBooking = (
  result: Awaited<ReturnType<typeof createFreeBookingFromHold>>,
) => {
  if (!result.booking || !result.hold) {
    throw slotUnavailableError();
  }
  const targetWindow = projectCanonicalTargetWindow(result.booking.target);

  return {
    id: result.booking.id,
    publicToken: result.booking.publicToken,
    bookingReference: result.booking.bookingReference,
    offering: {
      id: result.booking.offeringId,
      title: result.hold.offeringTitle,
      slug: result.hold.offeringSlug,
    },
    attendanceMode: result.booking.attendanceMode,
    status: result.booking.status,
    customer: {
      fullName: result.booking.customerFullName,
      email: result.booking.customerEmail,
      phone: result.booking.customerPhone,
    },
    countryCode: result.booking.countryCode,
    location: result.booking.locationId
      ? {
          id: result.booking.locationId,
          name: null,
          addressLine1: null,
          addressLine2: null,
          city: null,
          countryCode: null,
          mapUrl: null,
          instructions: null,
        }
      : null,
    slot: {
      startsAt: targetWindow.startsAt?.toISOString() ?? null,
      endsAt: targetWindow.endsAt?.toISOString() ?? null,
      timezone: targetWindow.timezone,
    },
    target: serializeCanonicalBookingTarget(result.booking.target),
    paymentRequired: result.booking.paymentRequired,
    calendar: null,
    confirmedAt: result.booking.confirmedAt?.toISOString() ?? null,
    createdAt: result.booking.createdAt.toISOString(),
  };
};

const toPublicCalendar = (
  bookingStatus: string,
  event: Awaited<ReturnType<typeof findCalendarEventByBookingId>> | null,
) => {
  if (bookingStatus !== "confirmed") {
    return null;
  }

  return {
    status: event?.status ?? "pending",
    meetUrl: event?.status === "created" ? event.meetUrl : null,
    lastError: event?.status === "failed" ? event.lastError : null,
  };
};

export const submitFreeBooking = async (input: PublicBookingInput) => {
  try {
    if (!input.holdToken) {
      throw slotUnavailableError();
    }

    const holdContext = await findPublicBookingHoldContextById(
      input.holdId,
      input.holdToken,
    );
    if (!holdContext) {
      throw slotUnavailableError();
    }

    if (holdContext.holdStatus === "converted") {
      const replay = await createFreeBookingFromHold({
        holdId: input.holdId,
        holdToken: input.holdToken,
        attendanceMode: input.attendanceMode,
        locationId: input.locationId,
        customerFullName: input.customer.fullName.trim(),
        customerEmail: input.customer.email.trim().toLowerCase(),
        customerPhone: normalizeOptionalText(input.customer.phone),
        countryCode: normalizeCountryCode(input.countryCode),
        timezone: input.timezone.trim() || "Africa/Cairo",
        answers: [],
      });
      if (!replay.booking || !replay.hold || replay.rejection) {
        throw slotUnavailableError();
      }

      return toPublicBooking(replay);
    }

    if (holdContext.holdStatus !== "active" || holdContext.expiresAt <= new Date()) {
      throw slotUnavailableError();
    }

    const activeHold = holdContext;
    const fields = await listPublicBookingFormFields(activeHold.offeringId);
    const answers = validateAndNormalizeBookingAnswers(fields, input.answers);
    const locationId = await resolveLocationId({
      offeringId: activeHold.offeringId,
      offeringSessionId: activeHold.offeringSessionId,
      scheduledProgramId: activeHold.scheduledProgramId,
      attendanceMode: input.attendanceMode ?? activeHold.offeringAttendanceMode,
      locationId: input.locationId,
    });

    const initialResult = await createFreeBookingFromHold({
      holdId: input.holdId,
      holdToken: input.holdToken,
      attendanceMode: input.attendanceMode,
      locationId,
      customerFullName: input.customer.fullName.trim(),
      customerEmail: input.customer.email.trim().toLowerCase(),
      customerPhone: normalizeOptionalText(input.customer.phone),
      countryCode: normalizeCountryCode(input.countryCode),
      timezone: input.timezone.trim() || "Africa/Cairo",
      answers,
    });

    if (!initialResult.hold) {
      throw slotUnavailableError();
    }

    if (initialResult.rejection === "offering_not_free") {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "This offering is not available for free booking.",
        statusCode: httpStatus.badRequest,
      });
    }

    if (initialResult.rejection === "attendance_mode") {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Attendance mode is not available for this offering.",
        statusCode: httpStatus.badRequest,
        details: [
          {
            field: "attendanceMode",
            message: `Use ${initialResult.hold.offeringAttendanceMode} for this offering.`,
          },
        ],
      });
    }

    if (initialResult.rejection === "hold_unavailable") {
      throw slotUnavailableError();
    }

    const booking = toPublicBooking(initialResult);
    await ensureGoogleCalendarEventForBooking(booking.id);
    await sendBookingConfirmedEmails(booking.id);

    return booking;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Error && error.message === "Slot hold could not be converted.") {
      throw slotUnavailableError();
    }

    throw error;
  }
};

export const getPublicBookingStatus = async (publicToken: string) => {
  const booking = await findPublicBookingByToken(publicToken);

  if (!booking) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const calendarEvent =
    booking.status === "confirmed" ? await findCalendarEventByBookingId(booking.id) : null;
  const targetWindow = projectCanonicalTargetWindow(booking.target);

  return {
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
          addressLine1: booking.locationAddressLine1,
          addressLine2: booking.locationAddressLine2,
          city: booking.locationCity,
          countryCode: booking.locationCountryCode,
          mapUrl: booking.locationMapUrl,
          instructions: booking.locationInstructions,
        }
      : null,
    slot: {
      startsAt: targetWindow.startsAt?.toISOString() ?? null,
      endsAt: targetWindow.endsAt?.toISOString() ?? null,
      timezone: targetWindow.timezone,
    },
    target: serializeCanonicalBookingTarget(booking.target),
    paymentRequired: booking.paymentRequired,
    confirmedAt: booking.confirmedAt?.toISOString() ?? null,
    cancelledAt: booking.cancelledAt?.toISOString() ?? null,
    calendar: toPublicCalendar(booking.status, calendarEvent),
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
};

const assertCustomerChangeAllowed = (booking: Awaited<ReturnType<typeof findPublicBookingByToken>>) => {
  if (!booking) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }
  if (
    !["confirmed", "rescheduled"].includes(booking.status) ||
    !booking.slotStartAt ||
    booking.slotStartAt.getTime() - Date.now()
      < env.BOOKING_MINIMUM_NOTICE_MINUTES * 60_000
  ) {
    throw new AppError({
      code: "CONFLICT",
      message: "This booking can no longer be changed online.",
      statusCode: httpStatus.conflict,
    });
  }
  return booking;
};

export const cancelPublicBooking = async (publicToken: string) => {
  const booking = assertCustomerChangeAllowed(await findPublicBookingByToken(publicToken));
  await updateAdminBookingStatusById(booking.id, { status: "cancelled" });
  return getPublicBookingStatus(publicToken);
};

export const reschedulePublicBooking = async (
  publicToken: string,
  input: {
    offeringSessionId?: string | null;
    startsAt: string;
    endsAt: string;
    timezone?: string | null;
  },
) => {
  const booking = assertCustomerChangeAllowed(await findPublicBookingByToken(publicToken));
  await rescheduleAdminBookingById(booking.id, input);
  return getPublicBookingStatus(publicToken);
};

const escapeIcs = (value: string) =>
  value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
const toIcsTimestamp = (date: Date) =>
  date.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");

export const buildPublicBookingCalendar = async (publicToken: string) => {
  const booking = await findPublicBookingByToken(publicToken);
  if (!booking || !booking.slotStartAt || !booking.slotEndAt) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }
  const location = booking.locationName
    ? [booking.locationName, booking.locationAddressLine1, booking.locationCity]
        .filter(Boolean)
        .join(", ")
    : "";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rammah//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${booking.publicToken}@rammah`,
    `DTSTAMP:${toIcsTimestamp(new Date())}`,
    `DTSTART:${toIcsTimestamp(booking.slotStartAt)}`,
    `DTEND:${toIcsTimestamp(booking.slotEndAt)}`,
    `SUMMARY:${escapeIcs(booking.offeringTitle)}`,
    `DESCRIPTION:${escapeIcs(`Booking reference: ${booking.bookingReference}`)}`,
    ...(location ? [`LOCATION:${escapeIcs(location)}`] : []),
    `STATUS:${booking.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
};
