import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  bookingAnswers,
  bookingSlotHolds,
  bookings,
  offerings,
  paymentWebhookEvents,
  payments,
} from "../../db/schema/index.js";
import {
  withAvailableSlotCapacity,
  type SlotCapacityInput,
} from "../availability/slot-capacity.repository.js";
import { lockOwnedSlotHold } from "../availability/slot-holds.repository.js";
import type { PublicBookingAnswerInput } from "../bookings/public-bookings.repository.js";
import { attachCanonicalBookingTargets } from "../bookings/booking-target.repository.js";
import { enqueueOutboxEvent } from "../outbox/outbox.repository.js";

export type PaidBookingInput = {
  holdId: string;
  holdToken: string | null | undefined;
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
  bookingReference: bookings.bookingReference,
  offeringId: bookings.offeringId,
  offeringSessionId: bookings.offeringSessionId,
  scheduledProgramId: bookings.scheduledProgramId,
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
    const hold = await lockOwnedSlotHold(tx, input.holdId, input.holdToken);

    if (!hold) {
      return { booking: null, payment: null, hold: null, rejection: "hold_unavailable" } as const;
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
        .orderBy(asc(payments.createdAt), asc(payments.id))
        .limit(1);
      const booking = bookingRows[0] ?? null;
      const payment = paymentRows[0] ?? null;

      if (!booking?.paymentRequired || !payment) {
        return { booking: null, payment: null, hold, rejection: "hold_unavailable" } as const;
      }

      const [canonicalBooking] = await attachCanonicalBookingTargets([booking]);
      return { booking: canonicalBooking!, payment, hold, rejection: null } as const;
    }

    if (
      hold.holdStatus !== "active" ||
      hold.expiresAt <= new Date() ||
      (!hold.scheduledProgramId && (!hold.slotStartAt || !hold.slotEndAt))
    ) {
      return { booking: null, payment: null, hold, rejection: "hold_unavailable" } as const;
    }

    const capacityTarget: SlotCapacityInput = hold.scheduledProgramId
      ? {
          offeringId: hold.offeringId,
          offeringSessionId: null,
          scheduledProgramId: hold.scheduledProgramId,
          startsAt: null,
          endsAt: null,
        }
      : {
          offeringId: hold.offeringId,
          offeringSessionId: hold.offeringSessionId,
          scheduledProgramId: null,
          startsAt: hold.slotStartAt!,
          endsAt: hold.slotEndAt!,
        };
    const result = await withAvailableSlotCapacity(
      tx,
      capacityTarget,
      { policyContext: "active_hold_conversion", excludeHoldId: hold.id },
      async ({ now, offering, sessionLocationId, target }) => {
        const currentHold = {
          ...hold,
          offeringTitle: offering.title,
          offeringSlug: offering.slug,
          offeringAttendanceMode: offering.attendanceMode,
          sessionLocationId,
        };

        if (
          offering.bookingMode !== "paid" ||
          !offering.requiresPayment ||
          offering.quoteOnly
        ) {
          return {
            booking: null,
            payment: null,
            hold: currentHold,
            rejection: "offering_not_paid",
          } as const;
        }

        const attendanceMode = input.attendanceMode ?? offering.attendanceMode;
        if (
          offering.attendanceMode !== "hybrid" &&
          attendanceMode !== offering.attendanceMode
        ) {
          return {
            booking: null,
            payment: null,
            hold: currentHold,
            rejection: "attendance_mode",
          } as const;
        }

        const bookingRows = await tx
          .insert(bookings)
          .values({
            offeringId: hold.offeringId,
            offeringSessionId: hold.offeringSessionId,
            scheduledProgramId: hold.scheduledProgramId,
            locationId: sessionLocationId ?? input.locationId ?? null,
            attendanceMode,
            status: "pending_payment",
            customerFullName: input.customerFullName,
            customerEmail: input.customerEmail,
            customerPhone: input.customerPhone ?? null,
            countryCode: input.countryCode ?? null,
            slotStartAt: hold.slotStartAt,
            slotEndAt: hold.slotEndAt,
            timezone: target.timezone,
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
        const [canonicalBooking] = await attachCanonicalBookingTargets([booking]);

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
          .set({ status: "converted", bookingId: booking.id })
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
          booking: canonicalBooking!,
          payment,
          hold: currentHold,
          rejection: null,
        } as const;
      },
    );

    return (
      result ?? {
        booking: null,
        payment: null,
        hold,
        rejection: "hold_unavailable",
      }
    );
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

  const [booking] = await attachCanonicalBookingTargets([row.booking]);
  return {
    ...booking!,
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

  const [booking] = await attachCanonicalBookingTargets([row.booking]);
  return {
    ...booking!,
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
    .select({
      id: paymentWebhookEvents.id,
      paymentId: paymentWebhookEvents.paymentId,
      bookingId: paymentWebhookEvents.bookingId,
      processingStatus: paymentWebhookEvents.processingStatus,
    })
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

export type TrustedPaymentFinalizationInput = {
  provider: string;
  providerEventId: string;
  paymentId: string;
  bookingId: string;
  eventType: string;
  signatureValid: true;
  payload: Record<string, unknown>;
  status: "paid" | "failed" | "abandoned" | "expired" | "cancelled";
  providerPaymentId?: string | null;
  claimedEventId?: string;
};

const paymentEventSelect = {
  id: paymentWebhookEvents.id,
  provider: paymentWebhookEvents.provider,
  providerEventId: paymentWebhookEvents.providerEventId,
  paymentId: paymentWebhookEvents.paymentId,
  bookingId: paymentWebhookEvents.bookingId,
  eventType: paymentWebhookEvents.eventType,
  signatureValid: paymentWebhookEvents.signatureValid,
  payload: paymentWebhookEvents.payload,
  processedAt: paymentWebhookEvents.processedAt,
  processingStatus: paymentWebhookEvents.processingStatus,
  createdAt: paymentWebhookEvents.createdAt,
};

export const claimVerifiedPaymentEvent = async (
  input: Omit<TrustedPaymentFinalizationInput, "claimedEventId">,
) => {
  const rows = await db
    .insert(paymentWebhookEvents)
    .values({
      provider: input.provider,
      providerEventId: input.providerEventId,
      paymentId: null,
      bookingId: null,
      eventType: input.eventType,
      signatureValid: input.signatureValid,
      payload: input.payload,
      processingStatus: "pending",
    })
    .onConflictDoNothing({
      target: [paymentWebhookEvents.provider, paymentWebhookEvents.providerEventId],
    })
    .returning(paymentEventSelect);

  return rows[0] ?? null;
};

export const finalizeVerifiedPaymentEvent = async (input: TrustedPaymentFinalizationInput) =>
  db.transaction(async (tx) => {
    const insertedEvent = input.claimedEventId
      ? (
          await tx
            .select(paymentEventSelect)
            .from(paymentWebhookEvents)
            .where(eq(paymentWebhookEvents.id, input.claimedEventId))
            .limit(1)
        )[0] ?? null
      : (
          await tx
            .insert(paymentWebhookEvents)
            .values({
              provider: input.provider,
              providerEventId: input.providerEventId,
              paymentId: null,
              bookingId: null,
              eventType: input.eventType,
              signatureValid: input.signatureValid,
              payload: input.payload,
              processingStatus: "pending",
            })
            .onConflictDoNothing({
              target: [paymentWebhookEvents.provider, paymentWebhookEvents.providerEventId],
            })
            .returning(paymentEventSelect)
        )[0] ?? null;

    if (!insertedEvent) {
      const storedEvents = await tx
        .select(paymentEventSelect)
        .from(paymentWebhookEvents)
        .where(
          and(
            eq(paymentWebhookEvents.provider, input.provider),
            eq(paymentWebhookEvents.providerEventId, input.providerEventId),
          ),
        )
        .limit(1);
      const storedEvent = storedEvents[0];

      if (!storedEvent) {
        throw new Error("Conflicting payment event could not be read.");
      }

      return { event: storedEvent };
    }
    if (
      insertedEvent.provider !== input.provider ||
      insertedEvent.providerEventId !== input.providerEventId ||
      insertedEvent.processingStatus !== "pending"
    ) {
      return { event: insertedEvent };
    }

    const paymentRows = await tx
      .select(paymentSelect)
      .from(payments)
      .where(eq(payments.id, input.paymentId))
      .limit(1)
      .for("update");
    const payment = paymentRows[0] ?? null;

    if (!payment || payment.bookingId !== input.bookingId) {
      throw new Error("Trusted payment event does not match an existing payment and booking.");
    }

    const bookingRows = await tx
      .select({ id: bookings.id, status: bookings.status })
      .from(bookings)
      .where(eq(bookings.id, payment.bookingId))
      .limit(1)
      .for("update");
    const booking = bookingRows[0] ?? null;

    if (!booking) {
      throw new Error("Trusted payment event booking was not found.");
    }

    const repeatedStatus = payment.status === input.status;
    const blockedByTerminalState =
      !repeatedStatus && (payment.status === "paid" || payment.status === "refunded");
    const now = new Date();

    if (blockedByTerminalState) {
      const ignoredEvents = await tx
        .update(paymentWebhookEvents)
        .set({
          paymentId: payment.id,
          bookingId: booking.id,
          processingStatus: "ignored",
          processedAt: now,
        })
        .where(eq(paymentWebhookEvents.id, insertedEvent.id))
        .returning(paymentEventSelect);
      return { event: ignoredEvents[0]! };
    }

    if (!repeatedStatus) {
      const bookingStatus =
        input.status === "paid"
          ? "confirmed"
          : input.status === "expired"
            ? "expired"
            : input.status === "cancelled"
              ? "cancelled"
              : "payment_failed";

      await tx
        .update(payments)
        .set({
          status: input.status,
          providerPaymentId: input.providerPaymentId ?? payment.providerPaymentId,
          paidAt: input.status === "paid" ? now : payment.paidAt,
          failedAt: input.status === "paid" ? null : now,
          updatedAt: now,
        })
        .where(eq(payments.id, payment.id));

      await tx
        .update(bookings)
        .set({
          status: bookingStatus,
          confirmedAt: input.status === "paid" ? now : null,
          cancelledAt: input.status === "cancelled" ? now : null,
          updatedAt: now,
        })
        .where(eq(bookings.id, booking.id));

      if (input.status === "paid") {
        await enqueueOutboxEvent(
          {
            topic: "calendar.booking.create",
            aggregateType: "booking",
            aggregateId: booking.id,
            payload: { bookingId: booking.id },
            idempotencyKey: `calendar.booking.create:${booking.id}`,
          },
          tx,
        );
        await enqueueOutboxEvent(
          {
            topic: "email.booking.confirmed",
            aggregateType: "booking",
            aggregateId: booking.id,
            payload: { bookingId: booking.id },
            idempotencyKey: `email.booking.confirmed:${booking.id}`,
          },
          tx,
        );
      }
    }

    const processedEvents = await tx
      .update(paymentWebhookEvents)
      .set({
        paymentId: payment.id,
        bookingId: booking.id,
        processingStatus: "processed",
        processedAt: now,
      })
      .where(eq(paymentWebhookEvents.id, insertedEvent.id))
      .returning(paymentEventSelect);
    return { event: processedEvents[0]! };
  });
