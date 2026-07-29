import { env } from "../../config/env.js";
import { findCalendarEventByBookingId } from "../calendar/google-calendar.repository.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { logger } from "../../shared/logger/logger.js";
import {
  findBookingEmailContextById,
  findEmailDeliveryById,
  findEmailTemplateByKey,
  findExistingEmailDelivery,
  findQuoteRequestEmailContextById,
  insertEmailDelivery,
  insertEmailTemplate,
  listEmailDeliveries as listEmailDeliveriesRows,
  listEmailTemplates as listEmailTemplateRows,
  markEmailDeliveryFailed,
  markEmailDeliveryQueued,
  markEmailDeliverySent,
  markEmailDeliverySuppressed,
  upsertEmailTemplate,
  type EmailDeliveryFilters,
  type EmailDeliveryRow,
  type EmailTemplateStatus,
} from "./email.repository.js";

type EmailTemplateKey =
  | "booking_confirmed_customer"
  | "booking_confirmed_admin"
  | "booking_cancelled_customer"
  | "booking_cancelled_admin"
  | "booking_rescheduled_customer"
  | "booking_rescheduled_admin"
  | "quote_request_customer"
  | "quote_request_admin";

type TemplateVariables = Record<string, string | number | null | undefined>;

const defaultTemplates: Record<EmailTemplateKey, { subject: string; body: string }> = {
  booking_confirmed_customer: {
    subject: "Your Rammah booking is confirmed",
    body: [
      "<p>Hi {{customerFullName}},</p>",
      "<p>Your booking for <strong>{{offeringTitle}}</strong> is confirmed.</p>",
      "<p>{{slotLabel}}</p>",
      "<p>{{paymentLabel}}</p>",
      "<p>{{meetLine}}</p>",
      "<p>Booking reference: {{bookingReference}}</p>",
    ].join("\n"),
  },
  booking_confirmed_admin: {
    subject: "New confirmed booking: {{offeringTitle}}",
    body: [
      "<p>A booking was confirmed.</p>",
      "<p>Customer: {{customerFullName}} ({{customerEmail}})</p>",
      "<p>Offering: {{offeringTitle}}</p>",
      "<p>{{slotLabel}}</p>",
      "<p>{{paymentLabel}}</p>",
      "<p>Booking id: {{bookingId}}</p>",
    ].join("\n"),
  },
  booking_cancelled_customer: {
    subject: "Your Rammah booking was cancelled",
    body: [
      "<p>Hi {{customerFullName}},</p>",
      "<p>Your booking for <strong>{{offeringTitle}}</strong> was cancelled.</p>",
      "<p>{{slotLabel}}</p>",
      "<p>Booking reference: {{bookingReference}}</p>",
    ].join("\n"),
  },
  booking_cancelled_admin: {
    subject: "Booking cancelled: {{offeringTitle}}",
    body: [
      "<p>A booking was cancelled.</p>",
      "<p>Customer: {{customerFullName}} ({{customerEmail}})</p>",
      "<p>Offering: {{offeringTitle}}</p>",
      "<p>{{slotLabel}}</p>",
      "<p>Booking id: {{bookingId}}</p>",
    ].join("\n"),
  },
  booking_rescheduled_customer: {
    subject: "Your Rammah booking was rescheduled",
    body: [
      "<p>Hi {{customerFullName}},</p>",
      "<p>Your booking for <strong>{{offeringTitle}}</strong> was rescheduled.</p>",
      "<p>{{slotLabel}}</p>",
      "<p>{{meetLine}}</p>",
      "<p>Booking reference: {{bookingReference}}</p>",
    ].join("\n"),
  },
  booking_rescheduled_admin: {
    subject: "Booking rescheduled: {{offeringTitle}}",
    body: [
      "<p>A booking was rescheduled.</p>",
      "<p>Customer: {{customerFullName}} ({{customerEmail}})</p>",
      "<p>Offering: {{offeringTitle}}</p>",
      "<p>{{slotLabel}}</p>",
      "<p>Booking id: {{bookingId}}</p>",
    ].join("\n"),
  },
  quote_request_customer: {
    subject: "We received your Rammah quote request",
    body: [
      "<p>Hi {{fullName}},</p>",
      "<p>We received your quote request and will review it shortly.</p>",
      "<p>Offering: {{offeringTitle}}</p>",
      "<p>Reference: {{quoteRequestId}}</p>",
    ].join("\n"),
  },
  quote_request_admin: {
    subject: "New quote request: {{offeringTitle}}",
    body: [
      "<p>A new quote request was submitted.</p>",
      "<p>Customer: {{fullName}} ({{email}})</p>",
      "<p>Company: {{companyName}}</p>",
      "<p>Participants: {{participantsCount}}</p>",
      "<p>Preferred date: {{preferredDate}}</p>",
      "<p>Message: {{message}}</p>",
      "<p>Quote request id: {{quoteRequestId}}</p>",
    ].join("\n"),
  },
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const renderTemplate = (
  template: string,
  variables: TemplateVariables,
  options: { html: boolean },
) =>
  template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_match, key: string) => {
    const value = variables[key];
    const text = value === null || value === undefined ? "" : String(value);
    return options.html ? escapeHtml(text) : text;
  });

const stripHtml = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const normalizeEmail = (email: string | null | undefined) => email?.trim().toLowerCase() ?? "";

const getAdminRecipients = () => {
  const configuredRecipients = env.EMAIL_ADMIN_RECIPIENTS.split(",")
    .map(normalizeEmail)
    .filter(Boolean);

  if (configuredRecipients.length > 0) {
    return configuredRecipients;
  }

  return env.ADMIN_SEED_EMAIL ? [env.ADMIN_SEED_EMAIL.toLowerCase()] : [];
};

const formatDateRange = (input: {
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string;
}) => {
  if (!input.startsAt || !input.endsAt) return "Time: not scheduled";

  const formatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: input.timezone,
  });

  return `Time: ${formatter.format(input.startsAt)} - ${formatter.format(input.endsAt)}`;
};

const formatAmount = (amountMinor: number, currency: string | null) => {
  if (!currency || amountMinor <= 0) return "Free booking";

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
};

const serializeError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return String(error);
};

const getTemplate = async (key: EmailTemplateKey) => {
  const existingTemplate = await findEmailTemplateByKey(key);

  if (existingTemplate) {
    return existingTemplate.status === "published" ? existingTemplate : null;
  }

  return insertEmailTemplate({
    key,
    subject: defaultTemplates[key].subject,
    body: defaultTemplates[key].body,
    status: "published",
  });
};

const sendWithResend = async (input: {
  deliveryId: string;
  to: string;
  subject: string;
  html: string;
}) => {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.deliveryId,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: stripHtml(input.html),
    }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { id?: string; data?: { id?: string }; error?: { message?: string }; message?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error?.message ?? payload?.message ?? `Resend HTTP ${response.status}`);
  }

  const providerMessageId = payload?.id ?? payload?.data?.id;

  if (!providerMessageId) {
    throw new Error("Resend did not return an email id.");
  }

  return providerMessageId;
};

const deliver = async (input: {
  delivery: NonNullable<EmailDeliveryRow>;
  subject: string;
  html: string;
}) => {
  try {
    if (!input.delivery.recipientEmail.includes("@")) {
      return markEmailDeliverySuppressed({
        id: input.delivery.id,
        lastError: "Recipient email is invalid.",
      });
    }

    const providerMessageId =
      env.EMAIL_PROVIDER === "mock"
        ? `mock:${input.delivery.id}`
        : await sendWithResend({
            deliveryId: input.delivery.id,
            to: input.delivery.recipientEmail,
            subject: input.subject,
            html: input.html,
          });

    if (env.EMAIL_PROVIDER === "mock") {
      logger.info("Mock email sent.", {
        to: input.delivery.recipientEmail,
        subject: input.subject,
        resourceType: input.delivery.resourceType,
        resourceId: input.delivery.resourceId,
      });
    }

    return markEmailDeliverySent({
      id: input.delivery.id,
      providerMessageId,
    });
  } catch (error) {
    const message = serializeError(error);
    logger.warn("Email delivery failed.", {
      deliveryId: input.delivery.id,
      provider: env.EMAIL_PROVIDER,
      error: message,
    });

    return markEmailDeliveryFailed({
      id: input.delivery.id,
      lastError: message,
    });
  }
};

const createAndDeliverOnce = async (input: {
  templateKey: EmailTemplateKey;
  recipientEmail: string;
  resourceType: string;
  resourceId: string;
  variables: TemplateVariables;
  dedupe?: boolean;
}) => {
  const recipientEmail = normalizeEmail(input.recipientEmail);
  const template = await getTemplate(input.templateKey);

  if (!template) return null;

  const existingDelivery =
    input.dedupe === false
      ? null
      : await findExistingEmailDelivery({
          templateKey: input.templateKey,
          recipientEmail,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
        });

  if (existingDelivery) {
    return existingDelivery;
  }

  const delivery = await insertEmailDelivery({
    templateId: template.id,
    recipientEmail,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    provider: env.EMAIL_PROVIDER,
  });

  if (!delivery) return null;

  return deliver({
    delivery,
    subject: renderTemplate(template.subject, input.variables, { html: false }),
    html: renderTemplate(template.body, input.variables, { html: true }),
  });
};

const bookingVariables = async (
  bookingId: string,
  allowedStatuses: string[] = ["confirmed"],
) => {
  const booking = await findBookingEmailContextById(bookingId);

  if (!booking || !allowedStatuses.includes(booking.status)) return null;

  const calendarEvent = await findCalendarEventByBookingId(booking.id);
  const meetUrl = calendarEvent?.status === "created" ? calendarEvent.meetUrl : null;
  const paymentLabel = booking.paymentRequired
    ? `Payment: ${formatAmount(booking.totalAmountMinor, booking.priceCurrency)} (${booking.payment?.status ?? "pending"})`
    : "Payment: not required";

  return {
    booking,
    variables: {
      bookingId: booking.id,
      publicToken: booking.publicToken,
      bookingReference: booking.bookingReference,
      customerFullName: booking.customerFullName,
      customerEmail: booking.customerEmail,
      customerPhone: booking.customerPhone,
      offeringTitle: booking.offeringTitle,
      offeringSlug: booking.offeringSlug,
      slotLabel: formatDateRange({
        startsAt: booking.slotStartAt,
        endsAt: booking.slotEndAt,
        timezone: booking.timezone,
      }),
      paymentLabel,
      meetUrl,
      meetLine: meetUrl ? `Meet link: ${meetUrl}` : "Meet link will appear on your booking page.",
    },
  };
};

export const sendBookingConfirmedEmails = async (bookingId: string) => {
  try {
    const context = await bookingVariables(bookingId);

    if (!context) return [];

    const deliveries = [
      await createAndDeliverOnce({
        templateKey: "booking_confirmed_customer",
        recipientEmail: context.booking.customerEmail,
        resourceType: "booking",
        resourceId: context.booking.id,
        variables: context.variables,
      }),
    ];

    for (const recipientEmail of getAdminRecipients()) {
      deliveries.push(
        await createAndDeliverOnce({
          templateKey: "booking_confirmed_admin",
          recipientEmail,
          resourceType: "booking",
          resourceId: context.booking.id,
          variables: context.variables,
        }),
      );
    }

    return deliveries.filter(Boolean);
  } catch (error) {
    logger.warn("Booking confirmation email flow failed.", {
      bookingId,
      error: serializeError(error),
    });
    return [];
  }
};

export const sendBookingCancelledEmails = async (bookingId: string) => {
  try {
    const context = await bookingVariables(bookingId, ["cancelled"]);

    if (!context) return [];

    const deliveries = [
      await createAndDeliverOnce({
        templateKey: "booking_cancelled_customer",
        recipientEmail: context.booking.customerEmail,
        resourceType: "booking",
        resourceId: context.booking.id,
        variables: context.variables,
      }),
    ];

    for (const recipientEmail of getAdminRecipients()) {
      deliveries.push(
        await createAndDeliverOnce({
          templateKey: "booking_cancelled_admin",
          recipientEmail,
          resourceType: "booking",
          resourceId: context.booking.id,
          variables: context.variables,
        }),
      );
    }

    return deliveries.filter(Boolean);
  } catch (error) {
    logger.warn("Booking cancellation email flow failed.", {
      bookingId,
      error: serializeError(error),
    });
    return [];
  }
};

export const sendBookingRescheduledEmails = async (bookingId: string) => {
  try {
    const context = await bookingVariables(bookingId, ["confirmed", "rescheduled"]);

    if (!context) return [];

    const deliveries = [
      await createAndDeliverOnce({
        templateKey: "booking_rescheduled_customer",
        recipientEmail: context.booking.customerEmail,
        resourceType: "booking",
        resourceId: context.booking.id,
        variables: context.variables,
        dedupe: false,
      }),
    ];

    for (const recipientEmail of getAdminRecipients()) {
      deliveries.push(
        await createAndDeliverOnce({
          templateKey: "booking_rescheduled_admin",
          recipientEmail,
          resourceType: "booking",
          resourceId: context.booking.id,
          variables: context.variables,
          dedupe: false,
        }),
      );
    }

    return deliveries.filter(Boolean);
  } catch (error) {
    logger.warn("Booking reschedule email flow failed.", {
      bookingId,
      error: serializeError(error),
    });
    return [];
  }
};

const quoteVariables = async (quoteRequestId: string) => {
  const quoteRequest = await findQuoteRequestEmailContextById(quoteRequestId);

  if (!quoteRequest) return null;

  const offeringTitle = quoteRequest.offeringTitle ?? "Custom request";

  return {
    quoteRequest,
    variables: {
      quoteRequestId: quoteRequest.id,
      fullName: quoteRequest.fullName,
      email: quoteRequest.email,
      phone: quoteRequest.phone,
      companyName: quoteRequest.companyName ?? "-",
      participantsCount: quoteRequest.participantsCount ?? "-",
      preferredDate: quoteRequest.preferredDate ?? "-",
      message: quoteRequest.message ?? "-",
      offeringTitle,
      offeringSlug: quoteRequest.offeringSlug ?? "",
    },
  };
};

export const sendQuoteRequestEmails = async (quoteRequestId: string) => {
  try {
    const context = await quoteVariables(quoteRequestId);

    if (!context) return [];

    const deliveries = [
      await createAndDeliverOnce({
        templateKey: "quote_request_customer",
        recipientEmail: context.quoteRequest.email,
        resourceType: "quote_request",
        resourceId: context.quoteRequest.id,
        variables: context.variables,
      }),
    ];

    for (const recipientEmail of getAdminRecipients()) {
      deliveries.push(
        await createAndDeliverOnce({
          templateKey: "quote_request_admin",
          recipientEmail,
          resourceType: "quote_request",
          resourceId: context.quoteRequest.id,
          variables: context.variables,
        }),
      );
    }

    return deliveries.filter(Boolean);
  } catch (error) {
    logger.warn("Quote request email flow failed.", {
      quoteRequestId,
      error: serializeError(error),
    });
    return [];
  }
};

const variablesForDelivery = async (delivery: NonNullable<EmailDeliveryRow>) => {
  if (delivery.resourceType === "booking" && delivery.resourceId) {
    if (delivery.templateKey?.includes("cancelled")) {
      return bookingVariables(delivery.resourceId, ["cancelled"]);
    }

    if (delivery.templateKey?.includes("rescheduled")) {
      return bookingVariables(delivery.resourceId, ["confirmed", "rescheduled"]);
    }

    return bookingVariables(delivery.resourceId);
  }

  if (delivery.resourceType === "quote_request" && delivery.resourceId) {
    return quoteVariables(delivery.resourceId);
  }

  return null;
};

export const retryEmailDelivery = async (id: string) => {
  const delivery = await findEmailDeliveryById(id);

  if (!delivery) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Email delivery was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (delivery.status === "sent") {
    return delivery;
  }

  if (!delivery.templateKey || !delivery.resourceType || !delivery.resourceId) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Email delivery cannot be retried.",
      statusCode: httpStatus.badRequest,
    });
  }

  const template = await findEmailTemplateByKey(delivery.templateKey);
  const context = await variablesForDelivery(delivery);

  if (!template || template.status !== "published" || !context) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Email delivery retry context is not available.",
      statusCode: httpStatus.badRequest,
    });
  }

  const queuedDelivery = await markEmailDeliveryQueued(delivery.id, env.EMAIL_PROVIDER);

  if (!queuedDelivery) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Email delivery was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  return deliver({
    delivery: queuedDelivery,
    subject: renderTemplate(template.subject, context.variables, { html: false }),
    html: renderTemplate(template.body, context.variables, { html: true }),
  });
};

export const listEmailDeliveries = async (filters: EmailDeliveryFilters) => {
  const deliveries = await listEmailDeliveriesRows(filters);

  return deliveries.map((delivery) => ({
    ...delivery,
    sentAt: delivery.sentAt?.toISOString() ?? null,
    createdAt: delivery.createdAt.toISOString(),
    updatedAt: delivery.updatedAt.toISOString(),
  }));
};

export const listEmailTemplates = async () => {
  const templates = await listEmailTemplateRows();

  return templates.map((template) => ({
    ...template,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  }));
};

export const saveEmailTemplate = async (input: {
  key: string;
  subject: string;
  body: string;
  status: EmailTemplateStatus;
}) => {
  const template = await upsertEmailTemplate(input);

  if (!template) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Email template could not be saved.",
      statusCode: httpStatus.internalServerError,
    });
  }

  return {
    ...template,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
};
