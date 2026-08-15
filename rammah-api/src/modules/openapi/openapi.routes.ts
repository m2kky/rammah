import { Router } from "express";
import { env } from "../../config/env.js";
import { httpStatus } from "../../shared/http/status.js";

export const openApiRouter = Router();

type Method = "get" | "post" | "patch" | "put" | "delete";
type PathSpec = Partial<Record<Method, Record<string, unknown>>>;

const jsonResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
});

const noContentResponse = {
  description: "No content",
};

const operation = (input: {
  summary: string;
  tags: string[];
  secured?: boolean;
  status?: number;
  noContent?: boolean;
  description?: string;
  deprecated?: boolean;
}) => ({
  summary: input.summary,
  tags: input.tags,
  ...(input.description ? { description: input.description } : {}),
  ...(input.deprecated ? { deprecated: true } : {}),
  ...(input.secured ? { security: [{ adminSession: [] }] } : {}),
  responses: {
    [input.noContent ? httpStatus.noContent : input.status ?? httpStatus.ok]: input.noContent
      ? noContentResponse
      : jsonResponse("Success"),
    "400": { $ref: "#/components/responses/BadRequest" },
    "401": { $ref: "#/components/responses/Unauthorized" },
    "404": { $ref: "#/components/responses/NotFound" },
    "409": { $ref: "#/components/responses/Conflict" },
    "429": { $ref: "#/components/responses/RateLimited" },
    "500": { $ref: "#/components/responses/ServerError" },
  },
});

const deprecatedSessionWrite = (summary: string) => ({
  summary,
  description: "Deprecated write endpoint. Returns conflict; fixed schedules are managed as Events & Programs.",
  deprecated: true,
  tags: ["Admin Sessions"],
  security: [{ adminSession: [] }],
  responses: {
    "400": { $ref: "#/components/responses/BadRequest" },
    "401": { $ref: "#/components/responses/Unauthorized" },
    "409": jsonResponse("Legacy Sessions are read-only"),
    "429": { $ref: "#/components/responses/RateLimited" },
    "500": { $ref: "#/components/responses/ServerError" },
  },
});

const publicPaths: Record<string, PathSpec> = {
  "/health/live": { get: operation({ summary: "Live health check", tags: ["Health"] }) },
  "/health/ready": { get: operation({ summary: "Ready health check", tags: ["Health"] }) },
  "/openapi.json": { get: operation({ summary: "OpenAPI document", tags: ["OpenAPI"] }) },
  "/public/country": { get: operation({ summary: "Detect public booking country", tags: ["Public Booking"] }) },
  "/public/offerings": { get: operation({ summary: "List public offerings", tags: ["Public Offerings"] }) },
  "/public/offerings/{id}/booking-config": { get: operation({ summary: "Get public offering booking configuration", tags: ["Public Offerings"] }) },
  "/public/offerings/{slug}": { get: operation({ summary: "Get public offering by slug", tags: ["Public Offerings"] }) },
  "/public/availability-slots": { get: operation({ summary: "Preview public availability slots", tags: ["Public Booking"] }) },
  "/public/sessions": { get: operation({ summary: "List legacy fixed-date Program adapters", tags: ["Public Booking"], description: "Deprecated compatibility projection. Each returned row includes its canonical scheduledProgramId; A4 replaces this route with public Program discovery.", deprecated: true }) },
  "/public/programs": { get: operation({ summary: "List bookable Events and Programs", tags: ["Public Programs"], description: "Returns published Programs with ordered occurrences and live enrollment capacity." }) },
  "/public/slot-holds": { post: operation({ summary: "Create canonical public booking hold", tags: ["Public Booking"], description: "Accepts a discriminated appointment or scheduled_program target. Legacy offeringSessionId is accepted only when it resolves to a migrated Program adapter.", status: httpStatus.created }) },
  "/public/slot-holds/{id}": { delete: operation({ summary: "Release public slot hold", tags: ["Public Booking"], noContent: true }) },
  "/public/bookings": { post: operation({ summary: "Create free booking", tags: ["Public Booking"], status: httpStatus.created }) },
  "/public/bookings/{publicToken}/status": { get: operation({ summary: "Get public booking status", tags: ["Public Booking"] }) },
  "/public/bookings/{publicToken}/cancel": { post: operation({ summary: "Cancel public booking", tags: ["Public Booking"] }) },
  "/public/bookings/{publicToken}/reschedule": { post: operation({ summary: "Reschedule public booking", tags: ["Public Booking"] }) },
  "/public/bookings/{publicToken}/calendar.ics": { get: operation({ summary: "Download booking calendar event", tags: ["Public Booking"] }) },
  "/public/booking/price-preview": { post: operation({ summary: "Preview paid booking price", tags: ["Public Payments"] }) },
  "/public/payments/paid-bookings": { post: operation({ summary: "Create paid booking", tags: ["Public Payments"], status: httpStatus.created }) },
  "/public/payments/bookings/{publicToken}/payment-session": { get: operation({ summary: "Get payment session", tags: ["Public Payments"] }) },
  "/public/payments/start": { post: operation({ summary: "Start payment by public token", tags: ["Public Payments"] }) },
  "/public/payments/bookings/{publicToken}/start": { post: operation({ summary: "Start payment for booking", tags: ["Public Payments"] }) },
  "/public/payments/bookings/{publicToken}/reconcile": { post: operation({ summary: "Reconcile public payment", tags: ["Public Payments"] }) },
  "/public/quote-requests": { post: operation({ summary: "Submit public quote request", tags: ["Public Quote Requests"], status: httpStatus.created }) },
  "/public/cms/settings": { get: operation({ summary: "Get public site settings", tags: ["Public CMS"] }) },
  "/public/cms/navigation": { get: operation({ summary: "List public navigation items", tags: ["Public CMS"] }) },
  "/public/cms/media/globals": { get: operation({ summary: "Get resolved global CMS media", tags: ["Public CMS"] }) },
  "/public/cms/preview/pages/{id}": { get: operation({ summary: "Get one token-scoped draft page", tags: ["Public CMS"] }) },
  "/public/cms/legal/{slug}": { get: operation({ summary: "Get public legal page", tags: ["Public CMS"] }) },
  "/public/cms/pages/{slug}": { get: operation({ summary: "Get public CMS page", tags: ["Public CMS"] }) },
  "/public/cms/blog/posts": { get: operation({ summary: "List public blog posts", tags: ["Public CMS"] }) },
  "/public/cms/blog/posts/{slug}": { get: operation({ summary: "Get public blog post", tags: ["Public CMS"] }) },
  "/webhooks/payments/kashier": { get: operation({ summary: "Kashier payment callback", tags: ["Payment Webhooks"] }) },
};

const adminResource = (tag: string, noun: string): PathSpec => ({
  get: operation({ summary: `List ${noun}`, tags: [tag], secured: true }),
  post: operation({ summary: `Create ${noun}`, tags: [tag], secured: true, status: httpStatus.created }),
});

const adminResourceItem = (tag: string, noun: string): PathSpec => ({
  get: operation({ summary: `Get ${noun}`, tags: [tag], secured: true }),
  patch: operation({ summary: `Update ${noun}`, tags: [tag], secured: true }),
  delete: operation({ summary: `Archive ${noun}`, tags: [tag], secured: true, noContent: true }),
});

const adminMutableResourceItem = (tag: string, noun: string): PathSpec => ({
  patch: operation({ summary: `Update ${noun}`, tags: [tag], secured: true }),
  delete: operation({ summary: `Archive ${noun}`, tags: [tag], secured: true, noContent: true }),
});

const adminPaths: Record<string, PathSpec> = {
  "/admin/auth/login": { post: operation({ summary: "Admin login", tags: ["Admin Auth"] }) },
  "/admin/auth/logout": { post: operation({ summary: "Admin logout", tags: ["Admin Auth"], noContent: true }) },
  "/admin/auth/me": { get: operation({ summary: "Get current admin", tags: ["Admin Auth"], secured: true }) },
  "/admin/offerings/categories": { get: operation({ summary: "List offering categories", tags: ["Admin Offerings"], secured: true }) },
  "/admin/offerings": adminResource("Admin Offerings", "offerings"),
  "/admin/offerings/{id}": adminResourceItem("Admin Offerings", "offering"),
  "/admin/offerings/{id}/prices": { get: operation({ summary: "List offering prices", tags: ["Admin Offerings"], secured: true }), post: operation({ summary: "Create offering price", tags: ["Admin Offerings"], secured: true, status: httpStatus.created }) },
  "/admin/offerings/{id}/prices/{priceId}": { patch: operation({ summary: "Update offering price", tags: ["Admin Offerings"], secured: true }), delete: operation({ summary: "Archive offering price", tags: ["Admin Offerings"], secured: true, noContent: true }) },
  "/admin/bookings": { get: operation({ summary: "List bookings", tags: ["Admin Bookings"], secured: true }) },
  "/admin/bookings/{id}": { get: operation({ summary: "Get booking", tags: ["Admin Bookings"], secured: true }) },
  "/admin/bookings/{id}/status": { patch: operation({ summary: "Update booking status", tags: ["Admin Bookings"], secured: true }) },
  "/admin/bookings/{id}/reschedule": { post: operation({ summary: "Reschedule booking", tags: ["Admin Bookings"], secured: true }) },
  "/admin/bookings/{id}/calendar/retry": { post: operation({ summary: "Retry booking calendar sync", tags: ["Admin Bookings"], secured: true }) },
  "/admin/booking-form-fields": adminResource("Admin Booking Form Fields", "booking form fields"),
  "/admin/booking-form-fields/{id}": adminResourceItem("Admin Booking Form Fields", "booking form field"),
  "/admin/locations": adminResource("Admin Locations", "locations"),
  "/admin/locations/{id}": adminResourceItem("Admin Locations", "location"),
  "/admin/sessions": {
    get: operation({ summary: "List legacy Program session adapters", tags: ["Admin Sessions"], secured: true, deprecated: true }),
    post: deprecatedSessionWrite("Reject legacy session creation"),
  },
  "/admin/sessions/{id}": {
    get: operation({ summary: "Get legacy Program session adapter", tags: ["Admin Sessions"], secured: true, deprecated: true }),
    patch: deprecatedSessionWrite("Reject legacy session update"),
    delete: deprecatedSessionWrite("Reject legacy session archive"),
  },
  "/admin/programs": adminResource("Admin Programs", "Events and Programs"),
  "/admin/programs/{id}": adminResourceItem("Admin Programs", "Event or Program"),
  "/admin/programs/{id}/publish": { post: operation({ summary: "Publish Event or Program", tags: ["Admin Programs"], secured: true }) },
  "/admin/programs/{id}/calendar/retry": { post: operation({ summary: "Retry Program occurrence calendar sync", tags: ["Admin Programs"], secured: true }) },
  "/admin/payments": { get: operation({ summary: "List payments", tags: ["Admin Payments"], secured: true }) },
  "/admin/payments/{id}": { get: operation({ summary: "Get payment", tags: ["Admin Payments"], secured: true }) },
  "/admin/payments/{id}/reconcile": { post: operation({ summary: "Reconcile payment", tags: ["Admin Payments"], secured: true }) },
  "/admin/emails/deliveries": { get: operation({ summary: "List email deliveries", tags: ["Admin Emails"], secured: true }) },
  "/admin/emails/deliveries/{id}/retry": { post: operation({ summary: "Retry email delivery", tags: ["Admin Emails"], secured: true }) },
  "/admin/emails/templates": { get: operation({ summary: "List email templates", tags: ["Admin Emails"], secured: true }) },
  "/admin/emails/templates/{key}": { patch: operation({ summary: "Update email template", tags: ["Admin Emails"], secured: true }) },
  "/admin/quote-requests": { get: operation({ summary: "List quote requests", tags: ["Admin Quote Requests"], secured: true }) },
  "/admin/quote-requests/{id}": { get: operation({ summary: "Get quote request", tags: ["Admin Quote Requests"], secured: true }), patch: operation({ summary: "Update quote request", tags: ["Admin Quote Requests"], secured: true }) },
  "/admin/integrations/google-calendar/status": { get: operation({ summary: "Get Google Calendar status", tags: ["Admin Integrations"], secured: true }) },
  "/admin/integrations/google-calendar/connect-url": { get: operation({ summary: "Get Google Calendar connect URL", tags: ["Admin Integrations"], secured: true }) },
  "/admin/integrations/google-calendar/callback": { get: operation({ summary: "Complete Google Calendar OAuth", tags: ["Admin Integrations"], secured: true }) },
  "/admin/integrations/google-calendar/settings": { patch: operation({ summary: "Update Google Calendar settings", tags: ["Admin Integrations"], secured: true }) },
  "/admin/availability-windows": adminResource("Admin Availability", "global availability windows"),
  "/admin/availability-windows/{id}": adminResourceItem("Admin Availability", "global availability window"),
  "/admin/availability-overrides": adminResource("Admin Availability", "availability overrides"),
  "/admin/availability-overrides/{id}": adminResourceItem("Admin Availability", "availability override"),
  "/admin/availability-slots": { get: operation({ summary: "Preview admin availability slots", tags: ["Admin Availability"], secured: true }) },
  "/admin/cms/settings": { get: operation({ summary: "Get CMS settings", tags: ["Admin CMS"], secured: true }), patch: operation({ summary: "Update CMS settings", tags: ["Admin CMS"], secured: true }) },
  "/admin/cms/definitions/sections": { get: operation({ summary: "List CMS section definitions", tags: ["Admin CMS"], secured: true }) },
  "/admin/cms/definitions/global-media": { get: operation({ summary: "List global media definitions", tags: ["Admin CMS"], secured: true }) },
  "/admin/cms/global-media": { get: operation({ summary: "List global media versions", tags: ["Admin CMS"], secured: true }) },
  "/admin/cms/global-media/{definitionKey}/versions": { post: operation({ summary: "Create a global media draft version", tags: ["Admin CMS"], secured: true, status: httpStatus.created }) },
  "/admin/cms/global-media/{definitionKey}/versions/{assignmentSetId}": { put: operation({ summary: "Replace global media version assignments", tags: ["Admin CMS"], secured: true }) },
  "/admin/cms/global-media/{definitionKey}/versions/{assignmentSetId}/publish": { post: operation({ summary: "Publish a global media version", tags: ["Admin CMS"], secured: true }) },
  "/admin/cms/navigation": adminResource("Admin CMS", "navigation items"),
  "/admin/cms/navigation/{id}": adminMutableResourceItem("Admin CMS", "navigation item"),
  "/admin/cms/legal-pages": adminResource("Admin CMS", "legal pages"),
  "/admin/cms/legal-pages/{id}": adminMutableResourceItem("Admin CMS", "legal page"),
  "/admin/cms/pages": adminResource("Admin CMS", "pages"),
  "/admin/cms/pages/{id}": adminMutableResourceItem("Admin CMS", "page"),
  "/admin/cms/pages/{id}/sections": adminResource("Admin CMS", "page sections"),
  "/admin/cms/pages/{id}/sections/{sectionId}": adminMutableResourceItem("Admin CMS", "page section"),
  "/admin/cms/pages/{id}/sections/{sectionId}/duplicate": { post: operation({ summary: "Duplicate page section", tags: ["Admin CMS"], secured: true, status: httpStatus.created }) },
  "/admin/cms/pages/{id}/sections/order": { put: operation({ summary: "Reorder all active page sections", tags: ["Admin CMS"], secured: true }) },
  "/admin/cms/pages/{id}/sections/{sectionId}/media": { put: operation({ summary: "Replace named section media", tags: ["Admin CMS"], secured: true }) },
  "/admin/cms/pages/{id}/preview-token": { post: operation({ summary: "Issue a page-scoped preview token", tags: ["Admin CMS"], secured: true, status: httpStatus.created }) },
  "/admin/cms/blog/categories": adminResource("Admin CMS", "blog categories"),
  "/admin/cms/blog/categories/{id}": adminMutableResourceItem("Admin CMS", "blog category"),
  "/admin/cms/blog/posts": adminResource("Admin CMS", "blog posts"),
  "/admin/cms/blog/posts/{id}": adminMutableResourceItem("Admin CMS", "blog post"),
  "/admin/cms/media-assets": {
    get: operation({ summary: "List safe media asset DTOs", tags: ["Admin CMS"], secured: true }),
  },
  "/admin/cms/media-assets/upload-intents": {
    post: operation({ summary: "Create a direct R2 upload intent", tags: ["Admin CMS"], secured: true, status: httpStatus.created }),
  },
  "/admin/cms/media-assets/finalize": {
    post: operation({ summary: "Verify and finalize an R2 upload", tags: ["Admin CMS"], secured: true }),
  },
  "/admin/cms/media-assets/external": {
    post: operation({ summary: "Register an external HTTPS media URL", tags: ["Admin CMS"], secured: true, status: httpStatus.created }),
  },
  "/admin/cms/media-assets/{id}/usages": {
    get: operation({ summary: "List every use of a media asset", tags: ["Admin CMS"], secured: true }),
  },
  "/admin/cms/media-assets/{id}": adminMutableResourceItem("Admin CMS", "media asset"),
  "/admin/cms/media-assets/{id}/permanent": {
    delete: operation({ summary: "Permanently delete archived unused media", tags: ["Admin CMS"], secured: true, noContent: true }),
  },
  "/admin/cms/seo-metadata": { put: operation({ summary: "Upsert SEO metadata", tags: ["Admin CMS"], secured: true }) },
  "/admin/cms/seo-metadata/{resourceType}/{resourceId}": { get: operation({ summary: "Get SEO metadata", tags: ["Admin CMS"], secured: true }) },
  "/admin/booking-policy": { get: operation({ summary: "Get global booking policy", tags: ["Admin Availability"], secured: true }), patch: operation({ summary: "Update global booking policy", tags: ["Admin Availability"], secured: true }) },
};

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Rammah API",
    version: "0.1.0",
  },
  servers: [{ url: env.API_BASE_PATH }],
  tags: [
    "Health",
    "OpenAPI",
    "Public Offerings",
    "Public Booking",
    "Public Programs",
    "Public Payments",
    "Public Quote Requests",
    "Public CMS",
    "Payment Webhooks",
    "Admin Auth",
    "Admin Offerings",
    "Admin Bookings",
    "Admin Booking Form Fields",
    "Admin Locations",
    "Admin Sessions",
    "Admin Programs",
    "Admin Payments",
    "Admin Emails",
    "Admin Quote Requests",
    "Admin Integrations",
    "Admin Availability",
    "Admin CMS",
  ].map((name) => ({ name })),
  paths: {
    ...publicPaths,
    ...adminPaths,
  },
  components: {
    securitySchemes: {
      adminSession: {
        type: "apiKey",
        in: "cookie",
        name: "rammah_admin_session",
      },
    },
    responses: {
      BadRequest: jsonResponse("Bad request"),
      Unauthorized: jsonResponse("Unauthorized"),
      NotFound: jsonResponse("Not found"),
      Conflict: jsonResponse("Conflict"),
      RateLimited: jsonResponse("Rate limited"),
      ServerError: jsonResponse("Unexpected server error"),
    },
  },
};

openApiRouter.get("/openapi.json", (_req, res) => {
  res.status(httpStatus.ok).json(openApiDocument);
});
