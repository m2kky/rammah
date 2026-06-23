import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  bookingAnswers,
  bookingSlotHolds,
  bookings,
  offeringSessions,
  offerings,
  paymentWebhookEvents,
  payments,
} from "../../db/schema/index.js";
import type { PublicBookingAnswerInput } from "../bookings/public-bookings.repository.js";

export type PaidBookingInput = {
  holdId: string;
  attendanceMode?: "online" | "offline" | "hybrid";
  locationId?: string | null;
  customerFullName: string;
  customerEmail: string;
  customerPhone?: string | null;
  countryCode?: string | null;
  timezone: string;
  answers: PublicBookingAnswerInput[];
  price: {
    currency: string;
    baseAmountMinor: number;
    discountAmountMinor: number;
    taxAmountMinor: number;
    totalAmountMinor: number;
  };
  payment: {
    provider: string;
    idempotencyKey: string;
  };
};

const bookingSelect = {
  id: bookings.id,
  publicToken: bookings.publicToken,
  offeringId: bookings.offeringId,
  offeringSessionId: bookings.offeringSessionId,
  locationId: bookings.locationId,
  attendanceMode: bookings.attendanceMode,
  status: bookings.status,
  customerFullName: bookings.customerFullName,
  customerEmail: bookings.customerEmail,
  customerPhone: bookings.customerPhone,
  countryCode: bookings.countryCode,
  slotStartAt: bookings.slotStartAt,
  slotEndAt: bookings.slotEndAt,
  timezone: bookings.timezone,
  priceCurrency: bookings.priceCurrency,
  baseAmountMinor: bookings.baseAmountMinor,
  discountAmountMinor: bookings.discountAmountMinor,
  taxAmountMinor: bookings.taxAmountMinor,
  totalAmountMinor: bookings.totalAmountMinor,
  paymentRequired: bookings.paymentRequired,
  confirmedAt: bookings.confirmedAt,
  createdAt: bookings.createdAt,
  updatedAt: bookings.updatedAt,
};

const paymentSelect = {
  id: payments.id,
  bookingId: payments.bookingId,
  provider: payments.provider,
  providerPaymentId: payments.providerPaymentId,
  status: payments.status,
  currency: payments.currency,
  amountMinor: payments.amountMinor,
  checkoutUrl: payments.checkoutUrl,
  idempotencyKey: payments.idempotencyKey,
  paidAt: payments.paidAt,
  failedAt: payments.failedAt,
  createdAt: payments.createdAt,
  updatedAt: payments.updatedAt,
};

export const findLatestPaymentForBooking = async (bookingId: string) => {
  const rows = await db
    .select(paymentSelect)
    .from(payments)
    .where(eq(payments.bookingId, bookingId))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  return rows[0] ?? null;
};

export const updatePaymentCheckoutUrl = async (input: {
  paymentId: string;
  checkoutUrl: string;
}) => {
  const rows = await db
    .update(payments)
    .set({
      checkoutUrl: input.checkoutUrl,
      updatedAt: new Date(),
    })
    .where(eq(payments.id, input.paymentId))
    .returning(paymentSelect);

  return rows[0] ?? null;
};

export const markPaymentProcessing = async (paymentId: string) => {
  const rows = await db
    .update(payments)
    .set({
      status: "processing",
      updatedAt: new Date(),
    })
    .where(and(eq(payments.id, paymentId), inArray(payments.status, ["created", "pending"])))
    .returning(paymentSelect);

  return rows[0] ?? null;
};

export const createPaidBookingFromHold = async (input: PaidBookingInput) =>
  db.transaction(async (tx) => {
    const holdRows = await tx
      .select({
        id: bookingSlotHolds.id,
        bookingId: bookingSlotHolds.bookingId,
        offeringId: bookingSlotHolds.offeringId,
        offeringSessionId: bookingSlotHolds.offeringSessionId,
        sessionLocationId: offeringSessions.locationId,
        slotStartAt: bookingSlotHolds.slotStartAt,
        slotEndAt: bookingSlotHolds.slotEndAt,
        holdStatus: bookingSlotHolds.status,
        expiresAt: bookingSlotHolds.expiresAt,
        offeringTitle: offerings.title,
        offeringSlug: offerings.slug,
        offeringAttendanceMode: offerings.attendanceMode,
        offeringBookingMode: offerings.bookingMode,
        offeringRequiresPayment: offerings.requiresPayment,
        offeringQuoteOnly: offerings.quoteOnly,
        offeringStatus: offerings.status,
      })
      .from(bookingSlotHolds)
      .innerJoin(offerings, eq(bookingSlotHolds.offeringId, offerings.id))
      .leftJoin(offeringSessions, eq(bookingSlotHolds.offeringSessionId, offeringSessions.id))
      .where(eq(bookingSlotHolds.id, input.holdId))
      .limit(1);
    const hold = holdRows[0] ?? null;

    if (!hold) {
      return { booking: null, payment: null, hold: null, rejection: "hold_not_found" } as const;
    }

    if (hold.holdStatus === "converted" && hold.bookingId) {
      const bookingRows = await tx
        .select(bookingSelect)
        .from(bookings)
        .where(eq(bookings.id, hold.bookingId))
        .limit(1);
      const paymentRows = await tx
        .select(paymentSelect)
        .from(payments)
        .where(eq(payments.bookingId, hold.bookingId))
        .orderBy(desc(payments.createdAt))
        .limit(1);

      return {
        booking: bookingRows[0] ?? null,
        payment: paymentRows[0] ?? null,
        hold,
        rejection: null,
      } as const;
    }

    const now = new Date();

    if (hold.holdStatus !== "active" || hold.expiresAt <= now) {
      return { booking: null, payment: null, hold, rejection: "hold_unavailable" } as const;
    }

    if (
      hold.offeringStatus !== "published" ||
      hold.offeringBookingMode !== "paid" ||
      !hold.offeringRequiresPayment ||
      hold.offeringQuoteOnly
    ) {
      return { booking: null, payment: null, hold, rejection: "offering_not_paid" } as const;
    }

    const attendanceMode = input.attendanceMode ?? hold.offeringAttendanceMode;

    if (
      hold.offeringAttendanceMode !== "hybrid" &&
      attendanceMode !== hold.offeringAttendanceMode
    ) {
      return { booking: null, payment: null, hold, rejection: "attendance_mode" } as const;
    }

    const bookingRows = await tx
      .insert(bookings)
      .values({
        offeringId: hold.offeringId,
        offeringSessionId: hold.offeringSessionId,
        locationId: hold.sessionLocationId ?? input.locationId ?? null,
        attendanceMode,
        status: "pending_payment",
        customerFullName: input.customerFullName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone ?? null,
        countryCode: input.countryCode ?? null,
        slotStartAt: hold.slotStartAt,
        slotEndAt: hold.slotEndAt,
        timezone: input.timezone,
        priceCurrency: input.price.currency,
        baseAmountMinor: input.price.baseAmountMinor,
        discountAmountMinor: input.price.discountAmountMinor,
        taxAmountMinor: input.price.taxAmountMinor,
        totalAmountMinor: input.price.totalAmountMinor,
        paymentRequired: true,
      })
      .returning(bookingSelect);
    const booking = bookingRows[0];

    if (!booking) {
      throw new Error("Paid booking insert did not return a row.");
    }

    if (input.answers.length > 0) {
      await tx.insert(bookingAnswers).values(
        input.answers.map((answer) => ({
          bookingId: booking.id,
          fieldId: answer.fieldId ?? null,
          fieldKeySnapshot: answer.fieldKey,
          labelSnapshot: answer.label,
          value: answer.value ?? null,
        })),
      );
    }

    const convertedRows = await tx
      .update(bookingSlotHolds)
      .set({
        status: "converted",
        bookingId: booking.id,
      })
      .where(
        and(
          eq(bookingSlotHolds.id, hold.id),
          eq(bookingSlotHolds.status, "active"),
          gt(bookingSlotHolds.expiresAt, now),
        ),
      )
      .returning({ id: bookingSlotHolds.id });

    if (!convertedRows[0]) {
      throw new Error("Slot hold could not be converted.");
    }

    const paymentRows = await tx
      .insert(payments)
      .values({
        bookingId: booking.id,
        provider: input.payment.provider,
        status: "pending",
        currency: input.price.currency,
        amountMinor: input.price.totalAmountMinor,
        idempotencyKey: input.payment.idempotencyKey,
      })
      .returning(paymentSelect);
    const payment = paymentRows[0];

    if (!payment) {
      throw new Error("Payment insert did not return a row.");
    }

    return {
      booking,
      payment,
      hold,
      rejection: null,
    } as const;
  });

export const findPublicBookingPaymentContextByToken = async (publicToken: string) => {
  const rows = await db
    .select({
      booking: bookingSelect,
      offeringTitle: offerings.title,
      offeringSlug: offerings.slug,
    })
    .from(bookings)
    .innerJoin(offerings, eq(bookings.offeringId, offerings.id))
    .where(eq(bookings.publicToken, publicToken))
    .limit(1);
  const row = rows[0] ?? null;

  if (!row) return null;

  return {
    ...row.booking,
    offeringTitle: row.offeringTitle,
    offeringSlug: row.offeringSlug,
    payment: await findLatestPaymentForBooking(row.booking.id),
  };
};

export const findPublicBookingPaymentContextByBookingId = async (bookingId: string) => {
  const rows = await db
    .select({
      booking: bookingSelect,
      offeringTitle: offerings.title,
      offeringSlug: offerings.slug,
    })
    .from(bookings)
    .innerJoin(offerings, eq(bookings.offeringId, offerings.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  const row = rows[0] ?? null;

  if (!row) return null;

  return {
    ...row.booking,
    offeringTitle: row.offeringTitle,
    offeringSlug: row.offeringSlug,
    payment: await findLatestPaymentForBooking(row.booking.id),
  };
};

export const findPaymentByIdempotencyKey = async (idempotencyKey: string) => {
  const rows = await db
    .select(paymentSelect)
    .from(payments)
    .where(eq(payments.idempotencyKey, idempotencyKey))
    .limit(1);

  return rows[0] ?? null;
};

export const createRetryPaymentForBooking = async (input: {
  bookingId: string;
  provider: string;
  idempotencyKey: string;
}) =>
  db.transaction(async (tx) => {
    const bookingRows = await tx
      .select(bookingSelect)
      .from(bookings)
      .where(eq(bookings.id, input.bookingId))
      .limit(1);
    const booking = bookingRows[0] ?? null;

    if (!booking) {
      return { payment: null, rejection: "booking_not_found" } as const;
    }

    if (!booking.paymentRequired || !booking.priceCurrency || booking.totalAmountMinor <= 0) {
      return { payment: null, rejection: "not_payable" } as const;
    }

    const latestPaymentRows = await tx
      .select(paymentSelect)
      .from(payments)
      .where(eq(payments.bookingId, booking.id))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    const latestPayment = latestPaymentRows[0] ?? null;

    if (
      latestPayment &&
      ["created", "pending", "processing", "paid", "refunded"].includes(latestPayment.status)
    ) {
      return { payment: latestPayment, rejection: null } as const;
    }

    const paymentRows = await tx
      .insert(payments)
      .values({
        bookingId: booking.id,
        provider: input.provider,
        status: "pending",
        currency: booking.priceCurrency,
        amountMinor: booking.totalAmountMinor,
        idempotencyKey: input.idempotencyKey,
      })
      .returning(paymentSelect);
    const payment = paymentRows[0] ?? null;

    if (!payment) {
      throw new Error("Retry payment insert did not return a row.");
    }

    if (["payment_failed", "expired"].includes(booking.status)) {
      await tx
        .update(bookings)
        .set({
          status: "pending_payment",
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, booking.id));
    }

    return { payment, rejection: null } as const;
  });

export const findWebhookEventByProviderEventId = async (input: {
  provider: string;
  providerEventId: string;
}) => {
  const rows = await db
    .select({ id: paymentWebhookEvents.id })
    .from(paymentWebhookEvents)
    .where(
      and(
        eq(paymentWebhookEvents.provider, input.provider),
        eq(paymentWebhookEvents.providerEventId, input.providerEventId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
};

export const insertPaymentWebhookEvent = async (input: {
  provider: string;
  providerEventId: string;
  paymentId?: string | null;
  bookingId?: string | null;
  eventType: string;
  signatureValid: boolean;
  payload: Record<string, unknown>;
  processingStatus?: "pending" | "processed" | "failed" | "ignored";
}) => {
  const rows = await db
    .insert(paymentWebhookEvents)
    .values({
      provider: input.provider,
      providerEventId: input.providerEventId,
      paymentId: input.paymentId ?? null,
      bookingId: input.bookingId ?? null,
      eventType: input.eventType,
      signatureValid: input.signatureValid,
      payload: input.payload,
      processingStatus: input.processingStatus ?? "pending",
    })
    .returning({ id: paymentWebhookEvents.id });

  return rows[0] ?? null;
};

export const applyVerifiedPaymentResult = async (input: {
  paymentId: string;
  status: "paid" | "failed" | "abandoned" | "expired" | "cancelled";
  providerPaymentId?: string | null;
}) =>
  db.transaction(async (tx) => {
    const paymentRows = await tx
      .select(paymentSelect)
      .from(payments)
      .where(eq(payments.id, input.paymentId))
      .limit(1);
    const payment = paymentRows[0] ?? null;

    if (!payment) return null;

    if (payment.status === "paid" || payment.status === input.status) {
      return payment;
    }

    const now = new Date();
    const failedAt =
      input.status === "failed" ||
      input.status === "abandoned" ||
      input.status === "expired" ||
      input.status === "cancelled"
        ? now
        : null;
    const bookingStatus =
      input.status === "paid"
        ? "confirmed"
        : input.status === "expired"
          ? "expired"
          : input.status === "cancelled"
            ? "cancelled"
            : "payment_failed";

    const updatedPaymentRows = await tx
      .update(payments)
      .set({
        status: input.status,
        providerPaymentId: input.providerPaymentId ?? payment.providerPaymentId,
        paidAt: input.status === "paid" ? now : payment.paidAt,
        failedAt,
        updatedAt: now,
      })
      .where(eq(payments.id, payment.id))
      .returning(paymentSelect);

    const bookingUpdate: Partial<typeof bookings.$inferInsert> = {
      status: bookingStatus,
      updatedAt: now,
    };

    if (input.status === "paid") {
      bookingUpdate.confirmedAt = now;
    }

    if (input.status === "cancelled") {
      bookingUpdate.cancelledAt = now;
    }

    await tx
      .update(bookings)
      .set(bookingUpdate)
      .where(
        and(
          eq(bookings.id, payment.bookingId),
          inArray(bookings.status, ["pending_payment", "payment_failed", "expired", "cancelled"]),
        ),
      );

    return updatedPaymentRows[0] ?? null;
  });
