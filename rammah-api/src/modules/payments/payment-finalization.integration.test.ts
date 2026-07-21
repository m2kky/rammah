import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bookings, offerings, outboxEvents, paymentWebhookEvents, payments } from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import { applyTrustedPaymentResult } from "./payment-confirmation.service.js";

const { calendarCall, emailCall } = vi.hoisted(() => ({
  calendarCall: vi.fn(),
  emailCall: vi.fn(),
}));

vi.mock("../calendar/google-calendar.service.js", () => ({
  ensureGoogleCalendarEventForBooking: calendarCall,
}));
vi.mock("../emails/email.service.js", () => ({
  sendBookingConfirmedEmails: emailCall,
}));

type PaymentStatus = typeof payments.$inferSelect.status;

const seedPayment = async (status: PaymentStatus = "pending") => {
  const { db } = getTestDatabase();
  const [offering] = await db.insert(offerings).values({
    title: "Atomic payment test",
    slug: `atomic-payment-${crypto.randomUUID()}`,
    offeringType: "coaching",
    attendanceMode: "online",
    bookingMode: "paid",
    durationMinutes: 60,
    requiresPayment: true,
    status: "published",
  }).returning();
  const [booking] = await db.insert(bookings).values({
    offeringId: offering!.id,
    attendanceMode: "online",
    status: ["failed", "abandoned"].includes(status)
      ? "payment_failed"
      : status === "expired"
        ? "expired"
        : status === "cancelled"
          ? "cancelled"
          : status === "paid"
            ? "confirmed"
            : "pending_payment",
    customerFullName: "Atomic Test",
    customerEmail: "atomic@example.com",
    timezone: "Africa/Cairo",
    priceCurrency: "EGP",
    totalAmountMinor: 12500,
    paymentRequired: true,
    confirmedAt: status === "paid" ? new Date() : null,
  }).returning();
  const [payment] = await db.insert(payments).values({
    bookingId: booking!.id,
    provider: "kashier",
    status,
    currency: "EGP",
    amountMinor: 12500,
    idempotencyKey: `atomic-${crypto.randomUUID()}`,
    paidAt: status === "paid" ? new Date() : null,
  }).returning();
  return { booking: booking!, payment: payment! };
};

const trustedEvent = (
  payment: typeof payments.$inferSelect,
  status: "paid" | "failed" | "abandoned" | "expired" | "cancelled",
  providerEventId: string = crypto.randomUUID(),
) => ({
  provider: "kashier",
  providerEventId,
  paymentId: payment.id,
  bookingId: payment.bookingId,
  eventType: status,
  signatureValid: true as const,
  payload: { status },
  status,
  providerPaymentId: `provider-${providerEventId}`,
});

const snapshot = async (paymentId: string, bookingId: string) => {
  const { db } = getTestDatabase();
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
  const events = await db.select().from(paymentWebhookEvents);
  const jobs = await db.select().from(outboxEvents);
  return { payment, booking, events, jobs };
};

afterEach(async () => {
  const { pool } = getTestDatabase();
  await pool.query("DROP TRIGGER IF EXISTS fail_payment_booking_update ON bookings");
  await pool.query("DROP TRIGGER IF EXISTS fail_payment_outbox_insert ON outbox_events");
  await pool.query("DROP FUNCTION IF EXISTS fail_payment_finalization_test()");
  calendarCall.mockClear();
  emailCall.mockClear();
});

describe.sequential("atomic monotonic payment finalization", () => {
  it("serializes concurrent distinct paid events and enqueues one pair of intents", async () => {
    const { payment, booking } = await seedPayment();

    const results = await Promise.all([
      applyTrustedPaymentResult(trustedEvent(payment, "paid", "paid-concurrent-1")),
      applyTrustedPaymentResult(trustedEvent(payment, "paid", "paid-concurrent-2")),
    ]);

    const state = await snapshot(payment.id, booking.id);
    expect(results.map((result) => result.event.processingStatus)).toEqual(["processed", "processed"]);
    expect(state.payment).toMatchObject({ status: "paid" });
    expect(state.booking).toMatchObject({ status: "confirmed" });
    expect(state.events).toHaveLength(2);
    expect(state.jobs.map(({ topic, payload, idempotencyKey }) => ({ topic, payload, idempotencyKey })))
      .toEqual(expect.arrayContaining([
        {
          topic: "calendar.booking.create",
          payload: { bookingId: booking.id },
          idempotencyKey: `calendar.booking.create:${booking.id}`,
        },
        {
          topic: "email.booking.confirmed",
          payload: { bookingId: booking.id },
          idempotencyKey: `email.booking.confirmed:${booking.id}`,
        },
      ]));
    expect(state.jobs).toHaveLength(2);
  });

  it.each(["failed", "cancelled", "expired"] as const)(
    "keeps paid and confirmed when a later trusted %s event arrives",
    async (lateStatus) => {
      const { payment, booking } = await seedPayment();
      await applyTrustedPaymentResult(trustedEvent(payment, "paid", `paid-before-${lateStatus}`));

      const result = await applyTrustedPaymentResult(
        trustedEvent(payment, lateStatus, `late-${lateStatus}`),
      );
      const state = await snapshot(payment.id, booking.id);

      expect(result.event).toMatchObject({ processingStatus: "ignored" });
      expect(result.event.processedAt).toBeInstanceOf(Date);
      expect(state.payment).toMatchObject({ status: "paid" });
      expect(state.booking).toMatchObject({ status: "confirmed" });
      expect(state.jobs).toHaveLength(2);
    },
  );

  it.each(["failed", "abandoned", "expired", "cancelled"] as const)(
    "recovers %s to paid and confirms with one pair of intents",
    async (initialStatus) => {
      const { payment, booking } = await seedPayment(initialStatus);

      const result = await applyTrustedPaymentResult(
        trustedEvent(payment, "paid", `recovery-${initialStatus}`),
      );
      const state = await snapshot(payment.id, booking.id);

      expect(result.event.processingStatus).toBe("processed");
      expect(state.payment).toMatchObject({ status: "paid" });
      expect(state.booking).toMatchObject({ status: "confirmed" });
      expect(state.jobs).toHaveLength(2);
    },
  );

  it("returns a duplicate provider event's stored outcome without applying new input", async () => {
    const { payment, booking } = await seedPayment();
    const providerEventId = "duplicate-event";
    const first = await applyTrustedPaymentResult(trustedEvent(payment, "paid", providerEventId));

    const duplicate = await applyTrustedPaymentResult({
      ...trustedEvent(payment, "failed", providerEventId),
      payload: { status: "failed", untrustedReplacement: true },
      providerPaymentId: "replacement-provider-id",
    });
    const state = await snapshot(payment.id, booking.id);

    expect(duplicate).toEqual(first);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]?.payload).toEqual({ status: "paid" });
    expect(state.payment).toMatchObject({ status: "paid", providerPaymentId: "provider-duplicate-event" });
    expect(state.booking).toMatchObject({ status: "confirmed" });
    expect(state.jobs).toHaveLength(2);
  });

  it("processes repeated same-status events without duplicating mutations or intents", async () => {
    const { payment, booking } = await seedPayment();
    await applyTrustedPaymentResult(trustedEvent(payment, "paid", "same-paid-1"));
    const firstState = await snapshot(payment.id, booking.id);

    const repeated = await applyTrustedPaymentResult(trustedEvent(payment, "paid", "same-paid-2"));
    const state = await snapshot(payment.id, booking.id);

    expect(repeated.event.processingStatus).toBe("processed");
    expect(state.payment?.updatedAt).toEqual(firstState.payment?.updatedAt);
    expect(state.booking?.updatedAt).toEqual(firstState.booking?.updatedAt);
    expect(state.jobs).toHaveLength(2);
  });

  it("rolls back the provider event and all state when a later database write fails", async () => {
    const { payment, booking } = await seedPayment();
    const { pool } = getTestDatabase();
    await pool.query(`
      CREATE FUNCTION fail_payment_finalization_test() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'forced booking update failure'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_payment_booking_update
      BEFORE UPDATE ON bookings
      FOR EACH ROW EXECUTE FUNCTION fail_payment_finalization_test();
    `);

    await expect(
      applyTrustedPaymentResult(trustedEvent(payment, "paid", "booking-trigger-failure")),
    ).rejects.toThrow();
    const state = await snapshot(payment.id, booking.id);

    expect(state.events).toHaveLength(0);
    expect(state.payment).toMatchObject({ status: "pending" });
    expect(state.booking).toMatchObject({ status: "pending_payment" });
    expect(state.jobs).toHaveLength(0);
  });

  it("rolls payment, booking, and event back when an outbox insert fails", async () => {
    const { payment, booking } = await seedPayment();
    const { pool } = getTestDatabase();
    await pool.query(`
      CREATE FUNCTION fail_payment_finalization_test() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'forced outbox insert failure'; END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_payment_outbox_insert
      BEFORE INSERT ON outbox_events
      FOR EACH ROW EXECUTE FUNCTION fail_payment_finalization_test();
    `);

    await expect(
      applyTrustedPaymentResult(trustedEvent(payment, "paid", "outbox-trigger-failure")),
    ).rejects.toThrow();
    const state = await snapshot(payment.id, booking.id);

    expect(state.events).toHaveLength(0);
    expect(state.payment).toMatchObject({ status: "pending" });
    expect(state.booking).toMatchObject({ status: "pending_payment" });
    expect(state.jobs).toHaveLength(0);
  });

  it("performs no synchronous Google Calendar or Resend effects", async () => {
    const { payment } = await seedPayment();

    await applyTrustedPaymentResult(trustedEvent(payment, "paid", "no-network-effects"));

    expect(calendarCall).not.toHaveBeenCalled();
    expect(emailCall).not.toHaveBeenCalled();
  });
});
