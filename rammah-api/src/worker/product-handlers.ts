import { ensureGoogleCalendarEventForBooking } from "../modules/calendar/google-calendar.service.js";
import { sendBookingConfirmedEmails } from "../modules/emails/email.service.js";
import { PermanentJobError, type JobHandler } from "./handler-registry.js";

const bookingIdFrom = (payload: Record<string, unknown>) => {
  const bookingId = payload.bookingId;
  if (typeof bookingId !== "string" || !bookingId.trim()) {
    throw new PermanentJobError("Invalid booking job payload");
  }
  return bookingId;
};

export const productHandlers: Readonly<Record<string, JobHandler>> = {
  "calendar.booking.create": async (event) => {
    await ensureGoogleCalendarEventForBooking(bookingIdFrom(event.payload));
  },
  "email.booking.confirmed": async (event) => {
    await sendBookingConfirmedEmails(bookingIdFrom(event.payload));
  },
};
