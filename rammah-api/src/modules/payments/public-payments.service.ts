import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  listPublicBookingFormFields,
  validateAndNormalizeBookingAnswers,
} from "../booking-form-fields/booking-form-fields.service.js";
import {
  findPublicBookableLocationById,
  findPublicBookingHoldContextById,
} from "../bookings/public-bookings.repository.js";
import { findPublishedLocationsForOffering } from "../offerings/offerings.repository.js";
import { previewPublicOfferingPrice } from "../pricing/public-price-preview.service.js";
import {
  createKashierSession,
  parseKashierAmountMinor,
  reconcileKashierPayment,
  verifyKashierCallbackSignature,
  type KashierSession,
} from "./kashier.adapter.js";
import {
  createRetryPaymentForBooking,
  createPaidBookingFromHold,
  findPaymentByIdempotencyKey,
  findPublicBookingPaymentContextByBookingId,
  findPublicBookingPaymentContextByToken,
  findWebhookEventByProviderEventId,
  insertPaymentWebhookEvent,
  markPaymentWebhookEventProcessed,
  markPaymentProcessing,
  updatePaymentCheckoutUrl,
} from "./public-payments.repository.js";
import { applyTrustedPaymentResult } from "./payment-confirmation.service.js";

type PublicPaidBookingInput = {
  holdId: string;
  attendanceMode?: "online" | "offline" | "hybrid";
  locationId?: string | null;
  customer: {
    fullName: string;
    email: string;
    phone?: string | null;
  };
  countryCode?: string | null;
  timezone: string;
  answers: Array<{
    fieldId?: string | null;
    fieldKey: string;
    label: string;
    value?: string | null;
  }>;
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
  attendanceMode: "online" | "offline" | "hybrid";
  locationId?: string | null;
}) => {
  if (input.offeringSessionId || input.attendanceMode === "online") {
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

const generatePaymentReference = () =>
  `${Date.now()}${crypto.randomInt(100000, 999999)}`;

const toPublicPayment = (payment: {
  id: string;
  provider: string;
  status: string;
  currency: string;
  amountMinor: number;
  checkoutUrl: string | null;
  idempotencyKey: string | null;
  paidAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: payment.id,
  provider: payment.provider,
  status: payment.status,
  currency: payment.currency,
  amountMinor: payment.amountMinor,
  checkoutUrl: payment.checkoutUrl,
  merchantOrderId: payment.idempotencyKey,
  paidAt: payment.paidAt?.toISOString() ?? null,
  failedAt: payment.failedAt?.toISOString() ?? null,
  createdAt: payment.createdAt.toISOString(),
  updatedAt: payment.updatedAt.toISOString(),
});

const toPaymentSession = (session: KashierSession) => ({
  provider: session.provider,
  mode: session.mode,
  scriptUrl: session.scriptUrl,
  checkoutUrl: session.checkoutUrl,
  iframe: {
    amount: session.amount,
    currency: session.currency,
    hash: session.hash,
    merchantId: session.merchantId,
    merchantOrderId: session.merchantOrderId,
    allowedMethods: session.allowedMethods,
    merchantRedirect: session.merchantRedirect,
    display: "en",
    store: "Rammah",
    type: "external",
  },
});

const toPublicPaidBooking = (input: {
  booking: NonNullable<Awaited<ReturnType<typeof createPaidBookingFromHold>>["booking"]>;
  hold: NonNullable<Awaited<ReturnType<typeof createPaidBookingFromHold>>["hold"]>;
  payment: NonNullable<Awaited<ReturnType<typeof createPaidBookingFromHold>>["payment"]>;
  session: KashierSession;
}) => ({
  booking: {
    id: input.booking.id,
    publicToken: input.booking.publicToken,
    offering: {
      id: input.booking.offeringId,
      title: input.hold.offeringTitle,
      slug: input.hold.offeringSlug,
    },
    attendanceMode: input.booking.attendanceMode,
    status: input.booking.status,
    customer: {
      fullName: input.booking.customerFullName,
      email: input.booking.customerEmail,
      phone: input.booking.customerPhone,
    },
    countryCode: input.booking.countryCode,
    location: input.booking.locationId
      ? {
          id: input.booking.locationId,
          name: null,
          city: null,
          countryCode: null,
        }
      : null,
    slot: {
      startsAt: input.booking.slotStartAt?.toISOString() ?? null,
      endsAt: input.booking.slotEndAt?.toISOString() ?? null,
      timezone: input.booking.timezone,
    },
    paymentRequired: input.booking.paymentRequired,
    calendar: null,
    confirmedAt: input.booking.confirmedAt?.toISOString() ?? null,
    createdAt: input.booking.createdAt.toISOString(),
    updatedAt: input.booking.updatedAt.toISOString(),
  },
  payment: toPublicPayment(input.payment),
  paymentSession: toPaymentSession(input.session),
});

const getOrCreateSessionForPayment = async (input: {
  publicToken: string;
  payment: NonNullable<Awaited<ReturnType<typeof findPaymentByIdempotencyKey>>>;
  markProcessing?: boolean;
}) => {
  const session = createKashierSession({
    merchantOrderId: input.payment.idempotencyKey as string,
    amountMinor: input.payment.amountMinor,
    currency: input.payment.currency,
    publicToken: input.publicToken,
  });
  let payment = input.payment;

  if (input.payment.checkoutUrl !== session.checkoutUrl) {
    const updatedPayment = await updatePaymentCheckoutUrl({
      paymentId: input.payment.id,
      checkoutUrl: session.checkoutUrl,
    });

    if (updatedPayment) {
      payment = updatedPayment;
    }
  }

  if (input.markProcessing && (payment.status === "created" || payment.status === "pending")) {
    const processingPayment = await markPaymentProcessing(payment.id);

    if (processingPayment) {
      payment = processingPayment;
    }
  }

  return { session, payment };
};

export const submitPaidBooking = async (input: PublicPaidBookingInput) => {
  const holdContext = await findPublicBookingHoldContextById(input.holdId);
  const activeHold =
    holdContext?.holdStatus === "active" && holdContext.expiresAt > new Date()
      ? holdContext
      : null;
  const fields = activeHold ? await listPublicBookingFormFields(activeHold.offeringId) : [];
  const answers = validateAndNormalizeBookingAnswers(fields, input.answers);
  const locationId = activeHold
    ? await resolveLocationId({
        offeringId: activeHold.offeringId,
        offeringSessionId: activeHold.offeringSessionId,
        attendanceMode: input.attendanceMode ?? activeHold.offeringAttendanceMode,
        locationId: input.locationId,
      })
    : null;

  if (!holdContext) {
    throw slotUnavailableError();
  }

  const pricePreview = await previewPublicOfferingPrice({
    offeringId: holdContext.offeringId,
    countryCode: input.countryCode,
  });

  const result = await createPaidBookingFromHold({
    holdId: input.holdId,
    attendanceMode: input.attendanceMode,
    locationId,
    customerFullName: input.customer.fullName.trim(),
    customerEmail: input.customer.email.trim().toLowerCase(),
    customerPhone: normalizeOptionalText(input.customer.phone),
    countryCode: normalizeCountryCode(input.countryCode) ?? pricePreview.resolvedCountryCode,
    timezone: input.timezone.trim() || "Africa/Cairo",
    answers,
    price: {
      currency: pricePreview.price.currency,
      baseAmountMinor: pricePreview.price.baseAmountMinor,
      discountAmountMinor: pricePreview.price.discountAmountMinor,
      taxAmountMinor: pricePreview.price.taxAmountMinor,
      totalAmountMinor: pricePreview.price.totalAmountMinor,
    },
    payment: {
      provider: env.PAYMENT_PROVIDER,
      idempotencyKey: generatePaymentReference(),
    },
  });

  if (!result.hold) {
    throw slotUnavailableError();
  }

  if (result.rejection === "offering_not_paid") {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "This offering is not available for paid booking.",
      statusCode: httpStatus.badRequest,
    });
  }

  if (result.rejection === "attendance_mode") {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Attendance mode is not available for this offering.",
      statusCode: httpStatus.badRequest,
      details: [
        {
          field: "attendanceMode",
          message: `Use ${result.hold.offeringAttendanceMode} for this offering.`,
        },
      ],
    });
  }

  if (result.rejection === "hold_unavailable") {
    throw slotUnavailableError();
  }

  if (!result.booking || !result.payment || !result.payment.idempotencyKey) {
    throw slotUnavailableError();
  }

  const { session, payment } = await getOrCreateSessionForPayment({
    publicToken: result.booking.publicToken,
    payment: result.payment,
    markProcessing: true,
  });

  return toPublicPaidBooking({
    booking: result.booking,
    hold: result.hold,
    payment,
    session,
  });
};

export const getPublicPaymentSession = async (publicToken: string) => {
  const context = await findPublicBookingPaymentContextByToken(publicToken);

  if (!context) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (!context.paymentRequired || !context.payment || !context.payment.idempotencyKey) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "This booking does not have a payable payment.",
      statusCode: httpStatus.badRequest,
    });
  }

  if (["failed", "abandoned", "expired", "cancelled"].includes(context.payment.status)) {
    throw new AppError({
      code: "PAYMENT_ATTEMPT_CLOSED",
      message: "This payment attempt is closed. Start a new payment attempt.",
      statusCode: httpStatus.conflict,
    });
  }

  const { session, payment } = await getOrCreateSessionForPayment({
    publicToken: context.publicToken,
    payment: context.payment,
  });

  return {
    booking: {
      id: context.id,
      publicToken: context.publicToken,
      offering: {
        id: context.offeringId,
        title: context.offeringTitle,
        slug: context.offeringSlug,
      },
      status: context.status,
      paymentRequired: context.paymentRequired,
    },
    payment: toPublicPayment(payment),
    paymentSession: toPaymentSession(session),
  };
};

export const startPublicPaymentForBooking = async (publicToken: string) => {
  const context = await findPublicBookingPaymentContextByToken(publicToken);

  if (!context) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (!context.paymentRequired) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "This booking does not require payment.",
      statusCode: httpStatus.badRequest,
    });
  }

  if (context.status === "confirmed" && context.payment?.status === "paid") {
    return getPublicPaymentSession(publicToken);
  }

  const activePayment =
    context.payment &&
    ["created", "pending", "processing", "paid", "refunded"].includes(context.payment.status)
      ? context.payment
      : null;
  const payment =
    activePayment ??
    (
      await createRetryPaymentForBooking({
        bookingId: context.id,
        provider: env.PAYMENT_PROVIDER,
        idempotencyKey: generatePaymentReference(),
      })
    ).payment;

  if (!payment?.idempotencyKey) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "This booking cannot start a payment attempt.",
      statusCode: httpStatus.badRequest,
    });
  }

  const sessionResult = await getOrCreateSessionForPayment({
    publicToken: context.publicToken,
    payment,
    markProcessing: true,
  });

  return {
    booking: {
      id: context.id,
      publicToken: context.publicToken,
      offering: {
        id: context.offeringId,
        title: context.offeringTitle,
        slug: context.offeringSlug,
      },
      status: context.status,
      paymentRequired: context.paymentRequired,
    },
    payment: toPublicPayment(sessionResult.payment),
    paymentSession: toPaymentSession(sessionResult.session),
  };
};

const callbackParam = (params: URLSearchParams, name: string) => {
  const value = params.get(name)?.trim();
  return value && !["null", "undefined"].includes(value.toLowerCase()) ? value : null;
};

const normalizeProviderStatus = (value: string | null) => {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) return "ignored" as const;

  if (
    ["success", "successful", "paid", "approved", "captured", "completed", "authorized"].includes(
      normalized,
    )
  ) {
    return "paid" as const;
  }

  if (["failed", "failure", "declined", "rejected", "error"].includes(normalized)) {
    return "failed" as const;
  }

  if (["abandoned", "abandon"].includes(normalized)) {
    return "abandoned" as const;
  }

  if (["expired", "timeout", "timed_out"].includes(normalized)) {
    return "expired" as const;
  }

  if (["cancelled", "canceled", "void"].includes(normalized)) {
    return "cancelled" as const;
  }

  return "ignored" as const;
};

const storedEventResult = async (event: {
  bookingId: string | null;
  processingStatus: "pending" | "processed" | "failed" | "ignored";
}) => {
  const context = event.bookingId
    ? await findPublicBookingPaymentContextByBookingId(event.bookingId)
    : null;
  return {
    processed: event.processingStatus === "processed",
    publicToken: context?.publicToken ?? null,
  };
};

const claimAndApplyReconciliation = async (input: {
  payment: NonNullable<Awaited<ReturnType<typeof findPaymentByIdempotencyKey>>>;
  reconciliation: Awaited<ReturnType<typeof reconcileKashierPayment>>;
}) => {
  const providerStatus = normalizeProviderStatus(input.reconciliation.status);
  const providerPaymentId = input.reconciliation.providerOrderId?.trim() || null;
  const evidenceMatches =
    providerStatus !== "ignored" &&
    providerPaymentId !== null &&
    input.reconciliation.amountMinor !== null &&
    input.reconciliation.amountMinor === input.payment.amountMinor &&
    input.reconciliation.currency !== null &&
    input.reconciliation.currency === input.payment.currency;

  if (!evidenceMatches) return false;

  const providerEventId = `reconcile:${input.payment.idempotencyKey}:${providerPaymentId}:${providerStatus}`;
  const claimed = await insertPaymentWebhookEvent({
    provider: "kashier",
    providerEventId,
    paymentId: input.payment.id,
    bookingId: input.payment.bookingId,
    eventType: input.reconciliation.status!,
    signatureValid: true,
    payload: input.reconciliation.raw,
    processingStatus: "pending",
  });

  if (!claimed) {
    const storedEvent = await findWebhookEventByProviderEventId({
      provider: "kashier",
      providerEventId,
    });
    return storedEvent?.processingStatus === "processed";
  }

  await applyTrustedPaymentResult({
    paymentId: input.payment.id,
    status: providerStatus,
    providerPaymentId,
  });
  await markPaymentWebhookEventProcessed(claimed.id);
  return true;
};

const reconcileCallbackPayment = async (
  payment: NonNullable<Awaited<ReturnType<typeof findPaymentByIdempotencyKey>>>,
) => {
  try {
    // ponytail: JOB-01/07 replace this one bounded lookup with durable reconciliation.
    const reconciliation = await reconcileKashierPayment(payment.idempotencyKey!);
    return claimAndApplyReconciliation({ payment, reconciliation });
  } catch {
    return false;
  }
};

export const handleKashierCallback = async (rawQuery: string) => {
  if (Buffer.byteLength(rawQuery, "utf8") > 16 * 1024) {
    return { processed: false, publicToken: null };
  }

  const params = new URLSearchParams(rawQuery);
  if (!verifyKashierCallbackSignature(rawQuery)) {
    return { processed: false, publicToken: null };
  }

  const providerEventId =
    callbackParam(params, "transactionId") ?? callbackParam(params, "orderReference");
  if (providerEventId) {
    const existingEvent = await findWebhookEventByProviderEventId({
      provider: "kashier",
      providerEventId,
    });
    if (existingEvent) return storedEventResult(existingEvent);
  }

  const merchantOrderId = callbackParam(params, "merchantOrderId");
  if (!merchantOrderId) return { processed: false, publicToken: null };

  const payment = await findPaymentByIdempotencyKey(merchantOrderId);
  if (!payment || payment.provider !== "kashier") {
    return { processed: false, publicToken: null };
  }

  const context = await findPublicBookingPaymentContextByBookingId(payment.bookingId);
  const storedToken = context?.publicToken ?? null;
  const statusValue = callbackParam(params, "paymentStatus");
  const providerStatus = normalizeProviderStatus(statusValue);
  const amountMinor = parseKashierAmountMinor(callbackParam(params, "amount"));
  const currencyValue = callbackParam(params, "currency");
  const currency = currencyValue && /^[A-Za-z]{3}$/.test(currencyValue)
    ? currencyValue.toUpperCase()
    : null;
  const directlyTrusted =
    providerEventId !== null &&
    providerStatus !== "ignored" &&
    amountMinor !== null &&
    amountMinor === payment.amountMinor &&
    currency !== null &&
    currency === payment.currency &&
    (!payment.providerPaymentId || payment.providerPaymentId === providerEventId);

  if (!directlyTrusted) {
    const processed = await reconcileCallbackPayment(payment);
    return { processed, publicToken: storedToken };
  }

  const claimed = await insertPaymentWebhookEvent({
    provider: "kashier",
    providerEventId: providerEventId!,
    paymentId: payment.id,
    bookingId: payment.bookingId,
    eventType: statusValue!,
    signatureValid: true,
    payload: Object.fromEntries(params.entries()),
    processingStatus: "pending",
  });

  if (!claimed) {
    const existingEvent = await findWebhookEventByProviderEventId({
      provider: "kashier",
      providerEventId: providerEventId!,
    });
    return existingEvent
      ? storedEventResult(existingEvent)
      : { processed: false, publicToken: null };
  }

  await applyTrustedPaymentResult({
    paymentId: payment.id,
    status: providerStatus,
    providerPaymentId: providerEventId,
  });
  await markPaymentWebhookEventProcessed(claimed.id);

  return { processed: true, publicToken: storedToken };
};

export const reconcilePublicPayment = async (publicToken: string) => {
  const context = await findPublicBookingPaymentContextByToken(publicToken);

  if (!context) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Booking was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (
    !context.paymentRequired ||
    !context.payment?.idempotencyKey ||
    context.payment.provider !== "kashier"
  ) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "This booking does not have a payable payment.",
      statusCode: httpStatus.badRequest,
    });
  }

  const reconciliation = await reconcileKashierPayment(context.payment.idempotencyKey);
  const providerStatus = normalizeProviderStatus(reconciliation.status);
  const amountMatches =
    reconciliation.amountMinor !== null && reconciliation.amountMinor === context.payment.amountMinor;
  const currencyMatches =
    reconciliation.currency !== null && reconciliation.currency === context.payment.currency;
  await claimAndApplyReconciliation({ payment: context.payment, reconciliation });

  const nextContext = await findPublicBookingPaymentContextByToken(publicToken);

  if (!nextContext?.payment) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Payment was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  return {
    booking: {
      id: nextContext.id,
      publicToken: nextContext.publicToken,
      offering: {
        id: nextContext.offeringId,
        title: nextContext.offeringTitle,
        slug: nextContext.offeringSlug,
      },
      status: nextContext.status,
      paymentRequired: nextContext.paymentRequired,
    },
    payment: toPublicPayment(nextContext.payment),
    reconciliation: {
      provider: reconciliation.provider,
      status: reconciliation.status,
      amountMatches,
      currencyMatches,
    },
  };
};
