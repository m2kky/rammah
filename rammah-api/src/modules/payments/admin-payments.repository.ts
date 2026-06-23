import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  bookings,
  calendarEvents,
  offerings,
  paymentStatusEnum,
  paymentWebhookEvents,
  payments,
} from "../../db/schema/index.js";

export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];

export type AdminPaymentFilters = {
  status?: PaymentStatus;
  search?: string;
};

const adminPaymentSelect = {
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
  bookingPublicToken: bookings.publicToken,
  bookingStatus: bookings.status,
  customerFullName: bookings.customerFullName,
  customerEmail: bookings.customerEmail,
  offeringId: offerings.id,
  offeringTitle: offerings.title,
  offeringSlug: offerings.slug,
  calendarEventId: calendarEvents.id,
  calendarStatus: calendarEvents.status,
  calendarExternalEventId: calendarEvents.externalEventId,
  calendarMeetUrl: calendarEvents.meetUrl,
  calendarLastError: calendarEvents.lastError,
  calendarUpdatedAt: calendarEvents.updatedAt,
};

export const findAdminPayments = async (filters: AdminPaymentFilters = {}) => {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(payments.status, filters.status));
  }

  if (filters.search?.trim()) {
    const searchPattern = `%${filters.search.trim()}%`;
    const searchCondition = or(
      ilike(bookings.customerFullName, searchPattern),
      ilike(bookings.customerEmail, searchPattern),
      ilike(offerings.title, searchPattern),
      ilike(payments.idempotencyKey, searchPattern),
      ilike(payments.providerPaymentId, searchPattern),
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  let query = db
    .select(adminPaymentSelect)
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(offerings, eq(bookings.offeringId, offerings.id))
    .leftJoin(
      calendarEvents,
      and(eq(calendarEvents.bookingId, bookings.id), eq(calendarEvents.provider, "google")),
    )
    .$dynamic();

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  if (where) {
    query = query.where(where);
  }

  return query.orderBy(desc(payments.createdAt));
};

export type AdminPaymentRow = Awaited<ReturnType<typeof findAdminPayments>>[number];

export const findAdminPaymentById = async (id: string) => {
  const rows = await db
    .select(adminPaymentSelect)
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .innerJoin(offerings, eq(bookings.offeringId, offerings.id))
    .leftJoin(
      calendarEvents,
      and(eq(calendarEvents.bookingId, bookings.id), eq(calendarEvents.provider, "google")),
    )
    .where(eq(payments.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const findPaymentEventsByPaymentId = async (paymentId: string) =>
  db
    .select({
      id: paymentWebhookEvents.id,
      provider: paymentWebhookEvents.provider,
      providerEventId: paymentWebhookEvents.providerEventId,
      eventType: paymentWebhookEvents.eventType,
      signatureValid: paymentWebhookEvents.signatureValid,
      processingStatus: paymentWebhookEvents.processingStatus,
      createdAt: paymentWebhookEvents.createdAt,
    })
    .from(paymentWebhookEvents)
    .where(eq(paymentWebhookEvents.paymentId, paymentId))
    .orderBy(desc(paymentWebhookEvents.createdAt));
