import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  bookings,
  emailDeliveries,
  emailTemplates,
  offerings,
  payments,
  quoteRequests,
} from "../../db/schema/index.js";

export type EmailDeliveryStatus = (typeof emailDeliveries.$inferSelect)["status"];
export type EmailTemplateStatus = (typeof emailTemplates.$inferSelect)["status"];

export type EmailDeliveryFilters = {
  status?: EmailDeliveryStatus;
  resourceType?: string;
  resourceId?: string;
  search?: string;
};

const emailTemplateSelect = {
  id: emailTemplates.id,
  key: emailTemplates.key,
  subject: emailTemplates.subject,
  body: emailTemplates.body,
  status: emailTemplates.status,
  createdAt: emailTemplates.createdAt,
  updatedAt: emailTemplates.updatedAt,
};

const emailDeliverySelect = {
  id: emailDeliveries.id,
  templateId: emailDeliveries.templateId,
  templateKey: emailTemplates.key,
  recipientEmail: emailDeliveries.recipientEmail,
  resourceType: emailDeliveries.resourceType,
  resourceId: emailDeliveries.resourceId,
  provider: emailDeliveries.provider,
  providerMessageId: emailDeliveries.providerMessageId,
  status: emailDeliveries.status,
  lastError: emailDeliveries.lastError,
  sentAt: emailDeliveries.sentAt,
  createdAt: emailDeliveries.createdAt,
  updatedAt: emailDeliveries.updatedAt,
};

export type EmailTemplateRow = typeof emailTemplates.$inferSelect;
export type EmailDeliveryRow = Awaited<ReturnType<typeof findEmailDeliveryById>>;

export const findEmailTemplateByKey = async (key: string) => {
  const rows = await db
    .select(emailTemplateSelect)
    .from(emailTemplates)
    .where(eq(emailTemplates.key, key))
    .limit(1);

  return rows[0] ?? null;
};

export const insertEmailTemplate = async (input: {
  key: string;
  subject: string;
  body: string;
  status?: EmailTemplateStatus;
}) => {
  const rows = await db
    .insert(emailTemplates)
    .values({
      key: input.key,
      subject: input.subject,
      body: input.body,
      status: input.status ?? "published",
    })
    .onConflictDoNothing({
      target: emailTemplates.key,
    })
    .returning(emailTemplateSelect);

  return rows[0] ?? findEmailTemplateByKey(input.key);
};

export const upsertEmailTemplate = async (input: {
  key: string;
  subject: string;
  body: string;
  status: EmailTemplateStatus;
}) => {
  const rows = await db
    .insert(emailTemplates)
    .values(input)
    .onConflictDoUpdate({
      target: emailTemplates.key,
      set: {
        subject: input.subject,
        body: input.body,
        status: input.status,
        updatedAt: new Date(),
      },
    })
    .returning(emailTemplateSelect);

  return rows[0] ?? null;
};

export const listEmailTemplates = async () =>
  db.select(emailTemplateSelect).from(emailTemplates).orderBy(emailTemplates.key);

export const findExistingEmailDelivery = async (input: {
  templateKey: string;
  recipientEmail: string;
  resourceType: string;
  resourceId: string;
}) => {
  const rows = await db
    .select(emailDeliverySelect)
    .from(emailDeliveries)
    .innerJoin(emailTemplates, eq(emailDeliveries.templateId, emailTemplates.id))
    .where(
      and(
        eq(emailTemplates.key, input.templateKey),
        eq(emailDeliveries.recipientEmail, input.recipientEmail),
        eq(emailDeliveries.resourceType, input.resourceType),
        eq(emailDeliveries.resourceId, input.resourceId),
      ),
    )
    .orderBy(desc(emailDeliveries.createdAt))
    .limit(1);

  return rows[0] ?? null;
};

export const insertEmailDelivery = async (input: {
  templateId: string;
  recipientEmail: string;
  resourceType?: string | null;
  resourceId?: string | null;
  provider: string;
  status?: EmailDeliveryStatus;
  lastError?: string | null;
}) => {
  const rows = await db
    .insert(emailDeliveries)
    .values({
      templateId: input.templateId,
      recipientEmail: input.recipientEmail,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      provider: input.provider,
      status: input.status ?? "queued",
      lastError: input.lastError ?? null,
    })
    .returning({ id: emailDeliveries.id });

  return rows[0] ? findEmailDeliveryById(rows[0].id) : null;
};

export const markEmailDeliveryQueued = async (id: string, provider: string) => {
  const rows = await db
    .update(emailDeliveries)
    .set({
      provider,
      providerMessageId: null,
      status: "queued",
      lastError: null,
      sentAt: null,
      updatedAt: new Date(),
    })
    .where(eq(emailDeliveries.id, id))
    .returning({ id: emailDeliveries.id });

  return rows[0] ? findEmailDeliveryById(rows[0].id) : null;
};

export const markEmailDeliverySent = async (input: {
  id: string;
  providerMessageId: string;
}) => {
  const rows = await db
    .update(emailDeliveries)
    .set({
      providerMessageId: input.providerMessageId,
      status: "sent",
      lastError: null,
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(emailDeliveries.id, input.id))
    .returning({ id: emailDeliveries.id });

  return rows[0] ? findEmailDeliveryById(rows[0].id) : null;
};

export const markEmailDeliveryFailed = async (input: {
  id: string;
  lastError: string;
}) => {
  const rows = await db
    .update(emailDeliveries)
    .set({
      status: "failed",
      lastError: input.lastError,
      updatedAt: new Date(),
    })
    .where(eq(emailDeliveries.id, input.id))
    .returning({ id: emailDeliveries.id });

  return rows[0] ? findEmailDeliveryById(rows[0].id) : null;
};

export const markEmailDeliverySuppressed = async (input: {
  id: string;
  lastError: string;
}) => {
  const rows = await db
    .update(emailDeliveries)
    .set({
      status: "suppressed",
      lastError: input.lastError,
      updatedAt: new Date(),
    })
    .where(eq(emailDeliveries.id, input.id))
    .returning({ id: emailDeliveries.id });

  return rows[0] ? findEmailDeliveryById(rows[0].id) : null;
};

export const listEmailDeliveries = async (filters: EmailDeliveryFilters = {}) => {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(emailDeliveries.status, filters.status));
  }

  if (filters.resourceType) {
    conditions.push(eq(emailDeliveries.resourceType, filters.resourceType));
  }

  if (filters.resourceId) {
    conditions.push(eq(emailDeliveries.resourceId, filters.resourceId));
  }

  if (filters.search?.trim()) {
    const searchPattern = `%${filters.search.trim()}%`;
    const searchCondition = or(
      ilike(emailDeliveries.recipientEmail, searchPattern),
      ilike(emailTemplates.key, searchPattern),
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  let query = db
    .select(emailDeliverySelect)
    .from(emailDeliveries)
    .leftJoin(emailTemplates, eq(emailDeliveries.templateId, emailTemplates.id))
    .$dynamic();
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  if (where) {
    query = query.where(where);
  }

  return query.orderBy(desc(emailDeliveries.createdAt)).limit(100);
};

export const findEmailDeliveryById = async (id: string) => {
  const rows = await db
    .select(emailDeliverySelect)
    .from(emailDeliveries)
    .leftJoin(emailTemplates, eq(emailDeliveries.templateId, emailTemplates.id))
    .where(eq(emailDeliveries.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const findBookingEmailContextById = async (id: string) => {
  const rows = await db
    .select({
      id: bookings.id,
      publicToken: bookings.publicToken,
      bookingReference: bookings.bookingReference,
      status: bookings.status,
      customerFullName: bookings.customerFullName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      slotStartAt: bookings.slotStartAt,
      slotEndAt: bookings.slotEndAt,
      timezone: bookings.timezone,
      priceCurrency: bookings.priceCurrency,
      totalAmountMinor: bookings.totalAmountMinor,
      paymentRequired: bookings.paymentRequired,
      offeringTitle: offerings.title,
      offeringSlug: offerings.slug,
    })
    .from(bookings)
    .innerJoin(offerings, eq(bookings.offeringId, offerings.id))
    .where(eq(bookings.id, id))
    .limit(1);
  const booking = rows[0] ?? null;

  if (!booking) return null;

  const paymentRows = await db
    .select({
      id: payments.id,
      status: payments.status,
      paidAt: payments.paidAt,
      provider: payments.provider,
    })
    .from(payments)
    .where(eq(payments.bookingId, booking.id))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  return {
    ...booking,
    payment: paymentRows[0] ?? null,
  };
};

export const findQuoteRequestEmailContextById = async (id: string) => {
  const rows = await db
    .select({
      id: quoteRequests.id,
      status: quoteRequests.status,
      fullName: quoteRequests.fullName,
      email: quoteRequests.email,
      phone: quoteRequests.phone,
      companyName: quoteRequests.companyName,
      participantsCount: quoteRequests.participantsCount,
      preferredDate: quoteRequests.preferredDate,
      message: quoteRequests.message,
      createdAt: quoteRequests.createdAt,
      offeringTitle: offerings.title,
      offeringSlug: offerings.slug,
    })
    .from(quoteRequests)
    .leftJoin(offerings, eq(quoteRequests.offeringId, offerings.id))
    .where(eq(quoteRequests.id, id))
    .limit(1);

  return rows[0] ?? null;
};
