import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import {
  reconcileKashierPayment,
} from "./kashier.adapter.js";
import {
  insertPaymentWebhookEvent,
  markPaymentWebhookEventProcessed,
} from "./public-payments.repository.js";
import { applyTrustedPaymentResult } from "./payment-confirmation.service.js";
import {
  findAdminPaymentById,
  findAdminPayments,
  findPaymentEventsByPaymentId,
  type AdminPaymentFilters,
  type AdminPaymentRow,
  type PaymentStatus,
} from "./admin-payments.repository.js";

const toIsoStringOrNull = (value: Date | null) =>
  value ? value.toISOString() : null;

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

const toAdminPayment = (payment: AdminPaymentRow) => ({
  id: payment.id,
  provider: payment.provider,
  providerPaymentId: payment.providerPaymentId,
  status: payment.status,
  currency: payment.currency,
  amountMinor: payment.amountMinor,
  checkoutUrl: payment.checkoutUrl,
  merchantOrderId: payment.idempotencyKey,
  paidAt: toIsoStringOrNull(payment.paidAt),
  failedAt: toIsoStringOrNull(payment.failedAt),
  createdAt: payment.createdAt.toISOString(),
  updatedAt: payment.updatedAt.toISOString(),
  booking: {
    id: payment.bookingId,
    publicToken: payment.bookingPublicToken,
    status: payment.bookingStatus,
    customer: {
      fullName: payment.customerFullName,
      email: payment.customerEmail,
    },
    offering: {
      id: payment.offeringId,
      title: payment.offeringTitle,
      slug: payment.offeringSlug,
    },
    calendar: payment.calendarEventId
      ? {
          id: payment.calendarEventId,
          status: payment.calendarStatus,
          externalEventId: payment.calendarExternalEventId,
          meetUrl: payment.calendarMeetUrl,
          lastError: payment.calendarLastError,
          updatedAt: toIsoStringOrNull(payment.calendarUpdatedAt),
        }
      : null,
  },
});

export const listAdminPayments = async (filters: AdminPaymentFilters) => {
  const payments = await findAdminPayments(filters);
  return payments.map(toAdminPayment);
};

export const getAdminPayment = async (id: string) => {
  const payment = await findAdminPaymentById(id);

  if (!payment) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Payment was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const events = await findPaymentEventsByPaymentId(payment.id);

  return {
    ...toAdminPayment(payment),
    events: events.map((event) => ({
      id: event.id,
      provider: event.provider,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      signatureValid: event.signatureValid,
      processingStatus: event.processingStatus,
      createdAt: event.createdAt.toISOString(),
    })),
  };
};

export const reconcileAdminPayment = async (
  id: string,
  auditContext?: AuditContext,
) => {
  const payment = await findAdminPaymentById(id);

  if (!payment) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Payment was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (payment.provider !== "kashier" || !payment.idempotencyKey) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "This payment cannot be reconciled with Kashier.",
      statusCode: httpStatus.badRequest,
    });
  }

  const beforePayment = toAdminPayment(payment);
  const reconciliation = await reconcileKashierPayment(payment.idempotencyKey);
  const providerStatus = normalizeProviderStatus(reconciliation.status);
  const amountMatches =
    reconciliation.amountMinor !== null && reconciliation.amountMinor === payment.amountMinor;
  const currencyMatches =
    reconciliation.currency !== null && reconciliation.currency === payment.currency;
  const providerPaymentId = reconciliation.providerOrderId?.trim() || null;
  const providerIdentityMatches = providerPaymentId !== null;
  const evidenceMatches =
    providerStatus !== "ignored" &&
    amountMatches &&
    currencyMatches &&
    providerIdentityMatches;
  let applied = false;

  if (evidenceMatches) {
    const providerEventId = `reconcile:${payment.idempotencyKey}:${providerPaymentId}:${providerStatus}`;
    const claimed = await insertPaymentWebhookEvent({
      provider: "kashier",
      providerEventId,
      paymentId: payment.id,
      bookingId: payment.bookingId,
      eventType: reconciliation.status ?? "unknown",
      signatureValid: true,
      payload: reconciliation.raw,
      processingStatus: "pending",
    });

    if (claimed) {
      await applyTrustedPaymentResult({
        paymentId: payment.id,
        status: providerStatus,
        providerPaymentId,
      });
      await markPaymentWebhookEventProcessed(claimed.id);
      applied = true;
    }
  }

  const nextPayment = await findAdminPaymentById(payment.id);

  if (!nextPayment) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Payment was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const afterPayment = toAdminPayment(nextPayment);

  await writeAuditLog(auditContext, {
    action: "admin.payments.reconcile",
    resourceType: "payment",
    resourceId: payment.id,
    beforeSnapshot: beforePayment,
    afterSnapshot: {
      ...afterPayment,
      reconciliation: {
        provider: reconciliation.provider,
        status: reconciliation.status,
        amountMatches,
        currencyMatches,
      },
    },
  });

  return {
    payment: afterPayment,
    reconciliation: {
      provider: reconciliation.provider,
      status: reconciliation.status,
      amountMatches,
      currencyMatches,
      appliedStatus: applied ? (providerStatus as PaymentStatus) : null,
    },
  };
};
