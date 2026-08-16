import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db, pool } from "../db/client.js";
import {
  bookingAnswers,
  bookingSlotHolds,
  bookings,
  calendarEvents,
  emailDeliveries,
  offeringPrices,
  offeringSessions,
  offerings,
  payments,
  paymentWebhookEvents,
} from "../db/schema/index.js";

const baseUrl = process.env.BUSINESS_SMOKE_API_BASE_URL ?? "http://localhost:4000/api/v1";
const runId = `business-smoke-${Date.now()}`;
const amountMinor = 23400;
const currency = "EGP";

type SmokeState = {
  offeringId?: string;
  sessionId?: string;
  holdId?: string;
  bookingId?: string;
  publicToken?: string;
  paymentId?: string;
  merchantOrderId?: string;
};

const state: SmokeState = {};

const ensure = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const requireValue = <T>(value: T | null | undefined, message: string): T => {
  if (value === null || value === undefined || value === "") {
    throw new Error(message);
  }

  return value;
};

const readJson = async (response: Response) => {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
};

const request = async (
  path: string,
  options: RequestInit & { expectedStatuses?: number[] } = {},
) => {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const expectedStatuses = options.expectedStatuses ?? [200];
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  const payload = await readJson(response);

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `${options.method ?? "GET"} ${path} failed: ${response.status} ${JSON.stringify(payload)}`,
    );
  }

  return { response, payload };
};

const cleanup = async () => {
  if (state.bookingId) {
    await db.delete(paymentWebhookEvents).where(eq(paymentWebhookEvents.bookingId, state.bookingId));
    await db.delete(emailDeliveries).where(eq(emailDeliveries.resourceId, state.bookingId));
    await db.delete(calendarEvents).where(eq(calendarEvents.bookingId, state.bookingId));
    await db.delete(payments).where(eq(payments.bookingId, state.bookingId));
    await db.delete(bookingAnswers).where(eq(bookingAnswers.bookingId, state.bookingId));
  }

  if (state.offeringId) {
    await db.delete(bookingSlotHolds).where(eq(bookingSlotHolds.offeringId, state.offeringId));
  }

  if (state.bookingId) {
    await db.delete(bookings).where(eq(bookings.id, state.bookingId));
  }

  if (state.offeringId) {
    await db.delete(offeringPrices).where(eq(offeringPrices.offeringId, state.offeringId));
    await db.delete(offeringSessions).where(eq(offeringSessions.offeringId, state.offeringId));
    await db.delete(offerings).where(eq(offerings.id, state.offeringId));
  }
};

const assertKashierLocalConfig = () => {
  const missing = [
    ["PAYMENT_PROVIDER", env.PAYMENT_PROVIDER],
    ["KASHIER_MERCHANT_ID", env.KASHIER_MERCHANT_ID],
    ["KASHIER_API_KEY", env.KASHIER_API_KEY],
    ["KASHIER_CALLBACK_URL", env.KASHIER_CALLBACK_URL],
    ["KASHIER_RETURN_URL", env.KASHIER_RETURN_URL],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  ensure(
    missing.length === 0,
    `Kashier smoke configuration is incomplete. Missing: ${missing.join(", ")}`,
  );
};

const createTemporaryPaidSessionOffering = async () => {
  const startsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  startsAt.setUTCMinutes(0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

  const offeringRows = await db
    .insert(offerings)
    .values({
      title: "Business Smoke Paid Session",
      slug: runId,
      shortDescription: "Temporary paid session for backend business smoke checks.",
      longDescription: "Temporary paid session for backend business smoke checks.",
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode: "paid",
      durationMinutes: 60,
      capacity: 2,
      requiresPayment: true,
      quoteOnly: false,
      status: "published",
    })
    .returning({ id: offerings.id });
  const offeringId = offeringRows[0]?.id;
  ensure(offeringId, "Temporary offering was not created.");
  state.offeringId = offeringId;

  await db.insert(offeringPrices).values({
    offeringId,
    name: "Egypt",
    countryCode: "EG",
    currency,
    baseAmountMinor: amountMinor,
    status: "published",
  });

  const sessionRows = await db
    .insert(offeringSessions)
    .values({
      offeringId,
      startsAt,
      endsAt,
      timezone: "Africa/Cairo",
      capacity: 2,
      attendanceMode: "online",
      status: "published",
    })
    .returning({ id: offeringSessions.id });
  const sessionId = sessionRows[0]?.id;
  ensure(sessionId, "Temporary offering session was not created.");
  state.sessionId = sessionId;

  return { offeringId, sessionId, startsAt, endsAt };
};

const countPaymentsForBooking = async (bookingId: string) =>
  (
    await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.bookingId, bookingId))
  ).length;

const countWebhookEventsForPayment = async (paymentId: string) =>
  (
    await db
      .select({ id: paymentWebhookEvents.id })
      .from(paymentWebhookEvents)
      .where(eq(paymentWebhookEvents.paymentId, paymentId))
  ).length;

const countCalendarEventsForBooking = async (bookingId: string) =>
  (
    await db
      .select({ id: calendarEvents.id })
      .from(calendarEvents)
      .where(eq(calendarEvents.bookingId, bookingId))
  ).length;

const countEmailDeliveriesForBooking = async (bookingId: string) =>
  (
    await db
      .select({ id: emailDeliveries.id })
      .from(emailDeliveries)
      .where(eq(emailDeliveries.resourceId, bookingId))
  ).length;

const getBookingAndPayment = async () => {
  const bookingId = requireValue(state.bookingId, "Booking id is missing.");
  const paymentId = requireValue(state.paymentId, "Payment id is missing.");

  const bookingRows = await db
    .select({
      id: bookings.id,
      publicToken: bookings.publicToken,
      status: bookings.status,
      confirmedAt: bookings.confirmedAt,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId));
  const paymentRows = await db
    .select({
      id: payments.id,
      status: payments.status,
      providerPaymentId: payments.providerPaymentId,
      paidAt: payments.paidAt,
    })
    .from(payments)
    .where(eq(payments.id, paymentId));

  return {
    booking: bookingRows[0] ?? null,
    payment: paymentRows[0] ?? null,
  };
};

const signKashierCallback = (params: URLSearchParams) => {
  const secret = env.KASHIER_API_KEY || env.KASHIER_SECRET;
  ensure(secret, "Kashier signing secret is missing.");

  const orderedKeys = [
    "paymentStatus",
    "cardDataToken",
    "maskedCard",
    "merchantOrderId",
    "orderId",
    "cardBrand",
    "orderReference",
    "transactionId",
    "amount",
    "currency",
  ];
  const payload = orderedKeys.map((key) => `${key}=${params.get(key) ?? ""}`).join("&");

  return crypto.createHmac("sha256", secret as string).update(payload).digest("hex");
};

const buildPaidCallbackQuery = () => {
  const publicToken = requireValue(state.publicToken, "Public token is missing.");
  const merchantOrderId = requireValue(state.merchantOrderId, "Merchant order id is missing.");

  const params = new URLSearchParams({
    paymentStatus: "SUCCESS",
    cardDataToken: "",
    maskedCard: "511111******1118",
    merchantOrderId,
    orderId: merchantOrderId,
    cardBrand: "MasterCard",
    orderReference: `${runId}-order`,
    transactionId: `${runId}-transaction`,
    amount: (amountMinor / 100).toFixed(2),
    currency,
    booking: publicToken,
  });
  params.set("signature", signKashierCallback(params));

  return params.toString();
};

const run = async () => {
  assertKashierLocalConfig();

  const results: Array<{ name: string; ok: true }> = [];
  const session = await createTemporaryPaidSessionOffering();
  results.push({ name: "temporary paid offering/session", ok: true });

  const hold = await request("/public/slot-holds", {
    method: "POST",
    expectedStatuses: [201],
    body: JSON.stringify({
      offeringId: session.offeringId,
      offeringSessionId: session.sessionId,
      startsAt: session.startsAt.toISOString(),
      endsAt: session.endsAt.toISOString(),
    }),
  });
  state.holdId = hold.payload?.data?.id;
  const holdId = requireValue(state.holdId, "Slot hold was not created.");
  results.push({ name: "slot hold create", ok: true });

  const paidBookingBody = {
    holdId,
    attendanceMode: "online",
    customer: {
      fullName: "Business Smoke Customer",
      email: `${runId}@example.com`,
      phone: "01000000000",
    },
    countryCode: "EG",
    timezone: "Africa/Cairo",
    answers: [],
  };

  const firstPaidBooking = await request("/public/payments/paid-bookings", {
    method: "POST",
    expectedStatuses: [201],
    body: JSON.stringify(paidBookingBody),
  });
  const firstData = firstPaidBooking.payload?.data;
  state.bookingId = firstData?.booking?.id;
  state.publicToken = firstData?.booking?.publicToken;
  state.paymentId = firstData?.payment?.id;
  state.merchantOrderId = firstData?.payment?.merchantOrderId;
  const bookingId = requireValue(state.bookingId, "Paid booking did not return booking id.");
  const publicToken = requireValue(state.publicToken, "Paid booking did not return public token.");
  const paymentId = requireValue(state.paymentId, "Paid booking did not return payment id.");
  const merchantOrderId = requireValue(state.merchantOrderId, "Paid booking did not return merchant order id.");
  ensure(firstData?.booking?.status === "pending_payment", "Paid booking did not start as pending_payment.");
  ensure(firstData?.payment?.status === "processing", "Payment did not move to processing after checkout session creation.");
  ensure(firstData?.paymentSession?.iframe?.merchantOrderId === merchantOrderId, "Payment session merchant order id mismatch.");
  results.push({ name: "paid booking create", ok: true });

  const duplicatePaidBooking = await request("/public/payments/paid-bookings", {
    method: "POST",
    expectedStatuses: [201],
    body: JSON.stringify(paidBookingBody),
  });
  const duplicateData = duplicatePaidBooking.payload?.data;
  ensure(duplicateData?.booking?.id === bookingId, "Duplicate hold submit created a different booking.");
  ensure(duplicateData?.payment?.id === paymentId, "Duplicate hold submit created a different payment.");
  ensure(duplicateData?.payment?.merchantOrderId === merchantOrderId, "Duplicate hold submit changed merchant order id.");
  ensure((await countPaymentsForBooking(bookingId)) === 1, "Duplicate hold submit inserted more than one payment.");
  results.push({ name: "duplicate paid booking idempotency", ok: true });

  const startPayment = await request("/public/payments/start", {
    method: "POST",
    body: JSON.stringify({ publicToken }),
  });
  const tokenStartPayment = await request(`/public/payments/bookings/${publicToken}/start`, {
    method: "POST",
  });
  const sessionLookup = await request(`/public/payments/bookings/${publicToken}/payment-session`);
  ensure(startPayment.payload?.data?.payment?.id === paymentId, "Payment start returned a different payment.");
  ensure(tokenStartPayment.payload?.data?.payment?.id === paymentId, "Token payment start returned a different payment.");
  ensure(sessionLookup.payload?.data?.payment?.id === paymentId, "Payment session lookup returned a different payment.");
  ensure(startPayment.payload?.data?.payment?.merchantOrderId === merchantOrderId, "Payment start changed merchant order id.");
  ensure((await countPaymentsForBooking(bookingId)) === 1, "Payment start inserted more than one payment.");
  results.push({ name: "refresh/start payment reuse", ok: true });

  const callbackQuery = buildPaidCallbackQuery();
  await request(`/webhooks/payments/kashier?${callbackQuery}`, {
    redirect: "manual",
    expectedStatuses: [302],
  });
  const afterCallback = await getBookingAndPayment();
  ensure(afterCallback.booking?.status === "confirmed", "Paid callback did not confirm the booking.");
  ensure(afterCallback.booking?.confirmedAt, "Paid callback did not set booking confirmedAt.");
  ensure(afterCallback.payment?.status === "paid", "Paid callback did not mark payment paid.");
  ensure(afterCallback.payment?.paidAt, "Paid callback did not set payment paidAt.");
  ensure(afterCallback.payment?.providerPaymentId === `${runId}-transaction`, "Paid callback did not store provider payment id.");
  ensure((await countWebhookEventsForPayment(paymentId)) === 1, "Paid callback did not create exactly one webhook event.");
  ensure((await countCalendarEventsForBooking(bookingId)) === 1, "Paid callback did not create exactly one calendar ledger row.");
  const emailCountAfterCallback = await countEmailDeliveriesForBooking(bookingId);
  ensure(emailCountAfterCallback >= 1, "Paid callback did not create booking email delivery rows.");
  results.push({ name: "signed paid callback confirmation", ok: true });

  await request(`/webhooks/payments/kashier?${callbackQuery}`, {
    redirect: "manual",
    expectedStatuses: [302],
  });
  ensure((await countWebhookEventsForPayment(paymentId)) === 1, "Callback replay inserted a duplicate webhook event.");
  ensure((await countCalendarEventsForBooking(bookingId)) === 1, "Callback replay inserted a duplicate calendar event.");
  ensure(
    (await countEmailDeliveriesForBooking(bookingId)) === emailCountAfterCallback,
    "Callback replay inserted duplicate email deliveries.",
  );
  results.push({ name: "callback replay idempotency", ok: true });

  const publicStatus = await request(`/public/bookings/${publicToken}/status`);
  ensure(publicStatus.payload?.data?.status === "confirmed", "Public status did not reflect confirmed booking.");
  ensure(publicStatus.payload?.data?.paymentRequired === true, "Public status did not reflect paid booking.");
  results.push({ name: "public booking status after paid callback", ok: true });

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        checks: results.map((result) => result.name),
      },
      null,
      2,
    ),
  );
};

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => {
      console.error(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
    await pool.end();
  });
