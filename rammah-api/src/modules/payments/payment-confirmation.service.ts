import { ensureGoogleCalendarEventForBooking } from "../calendar/google-calendar.service.js";
import { sendBookingConfirmedEmails } from "../emails/email.service.js";
import { applyVerifiedPaymentResult } from "./public-payments.repository.js";

export const applyTrustedPaymentResult = async (input: {
  paymentId: string;
  status: "paid" | "failed" | "abandoned" | "expired" | "cancelled";
  providerPaymentId?: string | null;
}) => {
  const payment = await applyVerifiedPaymentResult(input);

  if (input.status === "paid" && payment?.bookingId) {
    await ensureGoogleCalendarEventForBooking(payment.bookingId);
    await sendBookingConfirmedEmails(payment.bookingId);
  }

  return payment;
};
