import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const adminRoleEnum = pgEnum("admin_role", ["owner", "admin", "editor", "viewer"]);
export const adminStatusEnum = pgEnum("admin_status", ["active", "invited", "suspended", "disabled"]);
export const contentStatusEnum = pgEnum("content_status", ["draft", "published", "scheduled", "archived"]);
export const offeringTypeEnum = pgEnum("offering_type", [
  "coaching",
  "therapy_session",
  "workshop",
  "webinar",
  "course",
  "corporate_training",
  "custom",
]);
export const attendanceModeEnum = pgEnum("attendance_mode", ["online", "offline", "hybrid"]);
export const bookingModeEnum = pgEnum("booking_mode", ["free", "paid", "quote_only"]);
export const fieldTypeEnum = pgEnum("field_type", [
  "text",
  "email",
  "phone",
  "textarea",
  "date",
  "select",
  "checkbox",
  "number",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "draft",
  "pending_payment",
  "payment_failed",
  "confirmed",
  "cancelled",
  "rescheduled",
  "completed",
  "no_show",
  "expired",
  "rejected",
]);
export const holdStatusEnum = pgEnum("hold_status", ["active", "expired", "released", "converted"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "created",
  "pending",
  "processing",
  "paid",
  "failed",
  "abandoned",
  "cancelled",
  "expired",
  "refunded",
]);
export const quoteStatusEnum = pgEnum("quote_status", [
  "new",
  "reviewing",
  "contacted",
  "won",
  "lost",
  "archived",
]);
export const inquiryStatusEnum = pgEnum("inquiry_status", ["new", "reviewing", "replied", "archived"]);
export const subscriberStatusEnum = pgEnum("subscriber_status", ["subscribed", "unsubscribed", "suppressed"]);
export const deliveryStatusEnum = pgEnum("delivery_status", ["queued", "sent", "failed", "suppressed"]);
export const processingStatusEnum = pgEnum("processing_status", ["pending", "processed", "failed", "ignored"]);
export const calendarStatusEnum = pgEnum("calendar_status", ["pending", "created", "updated", "cancelled", "failed"]);
export const googleCalendarConnectionStatusEnum = pgEnum("google_calendar_connection_status", [
  "connected",
  "disconnected",
  "error",
]);
export const discountTypeEnum = pgEnum("discount_type", ["fixed", "percentage"]);
export const overrideTypeEnum = pgEnum("override_type", ["available", "blocked"]);
export const outboxStateEnum = pgEnum("outbox_state", [
  "queued",
  "processing",
  "completed",
  "dead_letter",
]);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: id(),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: adminRoleEnum("role").notNull().default("admin"),
    status: adminStatusEnum("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    emailUnique: uniqueIndex("admin_users_email_unique").on(table.email),
    statusIdx: index("admin_users_status_idx").on(table.status),
  }),
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: id(),
    adminUserId: uuid("admin_user_id").notNull().references(() => adminUsers.id),
    sessionTokenHash: text("session_token_hash").notNull(),
    ipAddress: varchar("ip_address", { length: 80 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => ({
    tokenUnique: uniqueIndex("admin_sessions_token_unique").on(table.sessionTokenHash),
    adminIdx: index("admin_sessions_admin_idx").on(table.adminUserId),
  }),
);

export const siteSettings = pgTable("site_settings", {
  id: id(),
  siteName: varchar("site_name", { length: 180 }).notNull(),
  defaultLocale: varchar("default_locale", { length: 16 }).notNull().default("en"),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 80 }),
  socialLinks: jsonb("social_links").$type<Record<string, string>>().notNull().default({}),
  bookingDefaultTimezone: varchar("booking_default_timezone", { length: 80 }).notNull().default("Africa/Cairo"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const navigationItems = pgTable(
  "navigation_items",
  {
    id: id(),
    label: varchar("label", { length: 120 }).notNull(),
    url: text("url").notNull(),
    location: varchar("location", { length: 40 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    locationIdx: index("navigation_items_location_idx").on(table.location, table.status),
  }),
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: id(),
    fileName: text("file_name").notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    storageKey: text("storage_key").notNull(),
    publicUrl: text("public_url"),
    altText: text("alt_text"),
    sizeBytes: integer("size_bytes").notNull(),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    storageKeyUnique: uniqueIndex("media_assets_storage_key_unique").on(table.storageKey),
    statusIdx: index("media_assets_status_idx").on(table.status),
  }),
);

export const pages = pgTable(
  "pages",
  {
    id: id(),
    slug: varchar("slug", { length: 180 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    status: contentStatusEnum("status").notNull().default("draft"),
    template: varchar("template", { length: 80 }).notNull().default("default"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    slugUnique: uniqueIndex("pages_slug_unique").on(table.slug),
    statusIdx: index("pages_status_idx").on(table.status),
  }),
);

export const pageSections = pgTable(
  "page_sections",
  {
    id: id(),
    pageId: uuid("page_id").notNull().references(() => pages.id),
    sectionType: varchar("section_type", { length: 80 }).notNull(),
    title: text("title"),
    body: text("body"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id),
    sortOrder: integer("sort_order").notNull().default(0),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    pageIdx: index("page_sections_page_idx").on(table.pageId, table.status),
  }),
);

export const legalPages = pgTable(
  "legal_pages",
  {
    id: id(),
    slug: varchar("slug", { length: 180 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    body: text("body").notNull(),
    version: varchar("version", { length: 40 }).notNull().default("1.0"),
    status: contentStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    slugUnique: uniqueIndex("legal_pages_slug_unique").on(table.slug),
  }),
);

export const seoMetadata = pgTable(
  "seo_metadata",
  {
    id: id(),
    resourceType: varchar("resource_type", { length: 80 }).notNull(),
    resourceId: uuid("resource_id").notNull(),
    metaTitle: varchar("meta_title", { length: 220 }),
    metaDescription: text("meta_description"),
    canonicalUrl: text("canonical_url"),
    ogImageAssetId: uuid("og_image_asset_id").references(() => mediaAssets.id),
    noindex: boolean("noindex").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    resourceUnique: uniqueIndex("seo_metadata_resource_unique").on(table.resourceType, table.resourceId),
  }),
);

export const offeringCategories = pgTable(
  "offering_categories",
  {
    id: id(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    slugUnique: uniqueIndex("offering_categories_slug_unique").on(table.slug),
  }),
);

export const offerings = pgTable(
  "offerings",
  {
    id: id(),
    categoryId: uuid("category_id").references(() => offeringCategories.id),
    title: varchar("title", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    shortDescription: text("short_description"),
    longDescription: text("long_description"),
    offeringType: offeringTypeEnum("offering_type").notNull(),
    attendanceMode: attendanceModeEnum("attendance_mode").notNull().default("online"),
    bookingMode: bookingModeEnum("booking_mode").notNull().default("free"),
    durationMinutes: integer("duration_minutes").notNull(),
    capacity: integer("capacity").notNull().default(1),
    requiresPayment: boolean("requires_payment").notNull().default(false),
    quoteOnly: boolean("quote_only").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    displayConfig: jsonb("display_config").$type<{
      backgroundColor?: string;
      textColor?: string;
    }>().notNull().default({}),
    featuredMediaAssetId: uuid("featured_media_asset_id").references(() => mediaAssets.id),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    slugUnique: uniqueIndex("offerings_slug_unique").on(table.slug),
    statusIdx: index("offerings_status_idx").on(table.status),
    typeIdx: index("offerings_type_idx").on(table.offeringType),
    capacityPositive: check("offerings_capacity_positive", sql`${table.capacity} > 0`),
  }),
);

export const offeringPrices = pgTable(
  "offering_prices",
  {
    id: id(),
    offeringId: uuid("offering_id").notNull().references(() => offerings.id),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    baseAmountMinor: integer("base_amount_minor").notNull(),
    earlyBirdAmountMinor: integer("early_bird_amount_minor"),
    earlyBirdEndsAt: timestamp("early_bird_ends_at", { withTimezone: true }),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    countryUnique: uniqueIndex("offering_prices_country_unique").on(table.offeringId, table.countryCode, table.currency),
    offeringIdx: index("offering_prices_offering_idx").on(table.offeringId),
  }),
);

export const offlineLocations = pgTable("offline_locations", {
  id: id(),
  name: varchar("name", { length: 180 }).notNull(),
  addressLine1: text("address_line_1").notNull(),
  addressLine2: text("address_line_2"),
  city: varchar("city", { length: 120 }),
  countryCode: varchar("country_code", { length: 2 }).notNull(),
  mapUrl: text("map_url"),
  instructions: text("instructions"),
  status: contentStatusEnum("status").notNull().default("draft"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const offeringLocations = pgTable(
  "offering_locations",
  {
    id: id(),
    offeringId: uuid("offering_id").notNull().references(() => offerings.id),
    locationId: uuid("location_id").notNull().references(() => offlineLocations.id),
  },
  (table) => ({
    offeringLocationUnique: uniqueIndex("offering_locations_unique").on(table.offeringId, table.locationId),
  }),
);

export const offeringSessions = pgTable(
  "offering_sessions",
  {
    id: id(),
    offeringId: uuid("offering_id").notNull().references(() => offerings.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    timezone: varchar("timezone", { length: 80 }).notNull().default("Africa/Cairo"),
    capacity: integer("capacity").notNull().default(1),
    attendanceMode: attendanceModeEnum("attendance_mode").notNull(),
    locationId: uuid("location_id").references(() => offlineLocations.id),
    googleCalendarEventId: text("google_calendar_event_id"),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    offeringStartsIdx: index("offering_sessions_offering_starts_idx").on(table.offeringId, table.startsAt),
    capacityPositive: check(
      "offering_sessions_capacity_positive",
      sql`${table.capacity} > 0`,
    ),
  }),
);

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: id(),
    offeringId: uuid("offering_id").notNull().references(() => offerings.id),
    weekday: integer("weekday").notNull(),
    startTime: varchar("start_time", { length: 8 }).notNull(),
    endTime: varchar("end_time", { length: 8 }).notNull(),
    timezone: varchar("timezone", { length: 80 }).notNull().default("Africa/Cairo"),
    slotDurationMinutes: integer("slot_duration_minutes").notNull(),
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(0),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    offeringWeekdayIdx: index("availability_rules_offering_weekday_idx").on(table.offeringId, table.weekday),
    slotDurationPositive: check(
      "availability_rules_slot_duration_positive",
      sql`${table.slotDurationMinutes} > 0`,
    ),
    buffersNonNegative: check(
      "availability_rules_buffers_non_negative",
      sql`${table.bufferBeforeMinutes} >= 0 AND ${table.bufferAfterMinutes} >= 0`,
    ),
  }),
);

export const availabilityOverrides = pgTable(
  "availability_overrides",
  {
    id: id(),
    availabilityRuleId: uuid("availability_rule_id").references(() => availabilityRules.id),
    offeringId: uuid("offering_id").references(() => offerings.id),
    date: varchar("date", { length: 10 }).notNull(),
    overrideType: overrideTypeEnum("override_type").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    reason: text("reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    offeringDateIdx: index("availability_overrides_offering_date_idx").on(
      table.offeringId,
      table.date,
      table.overrideType,
    ),
    validWindow: check(
      "availability_overrides_valid_window",
      sql`(${table.startsAt} IS NULL AND ${table.endsAt} IS NULL) OR (${table.startsAt} IS NOT NULL AND ${table.endsAt} IS NOT NULL AND ${table.startsAt} < ${table.endsAt})`,
    ),
  }),
);

export const bookingFormFields = pgTable(
  "booking_form_fields",
  {
    id: id(),
    offeringId: uuid("offering_id").references(() => offerings.id),
    fieldKey: varchar("field_key", { length: 120 }).notNull(),
    label: varchar("label", { length: 220 }).notNull(),
    fieldType: fieldTypeEnum("field_type").notNull(),
    required: boolean("required").notNull().default(false),
    options: jsonb("options").$type<Array<{ label: string; value: string }>>().notNull().default([]),
    validationRules: jsonb("validation_rules").$type<Record<string, unknown>>().notNull().default({}),
    sortOrder: integer("sort_order").notNull().default(0),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    offeringIdx: index("booking_form_fields_offering_idx").on(table.offeringId, table.status),
  }),
);

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    publicToken: uuid("public_token").notNull().defaultRandom(),
    offeringId: uuid("offering_id").notNull().references(() => offerings.id),
    offeringSessionId: uuid("offering_session_id").references(() => offeringSessions.id),
    locationId: uuid("location_id").references(() => offlineLocations.id),
    attendanceMode: attendanceModeEnum("attendance_mode").notNull(),
    status: bookingStatusEnum("status").notNull().default("draft"),
    customerFullName: varchar("customer_full_name", { length: 220 }).notNull(),
    customerEmail: varchar("customer_email", { length: 255 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 80 }),
    countryCode: varchar("country_code", { length: 2 }),
    slotStartAt: timestamp("slot_start_at", { withTimezone: true }),
    slotEndAt: timestamp("slot_end_at", { withTimezone: true }),
    timezone: varchar("timezone", { length: 80 }).notNull().default("Africa/Cairo"),
    priceCurrency: varchar("price_currency", { length: 3 }),
    baseAmountMinor: integer("base_amount_minor").notNull().default(0),
    discountAmountMinor: integer("discount_amount_minor").notNull().default(0),
    taxAmountMinor: integer("tax_amount_minor").notNull().default(0),
    totalAmountMinor: integer("total_amount_minor").notNull().default(0),
    paymentRequired: boolean("payment_required").notNull().default(false),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    publicTokenUnique: uniqueIndex("bookings_public_token_unique").on(table.publicToken),
    offeringSlotIdx: index("bookings_offering_slot_idx").on(table.offeringId, table.slotStartAt, table.status),
    customerEmailIdx: index("bookings_customer_email_idx").on(table.customerEmail),
    locationIdx: index("bookings_location_idx").on(table.locationId),
    statusIdx: index("bookings_status_idx").on(table.status),
    sessionStatusIdx: index("bookings_session_status_idx").on(
      table.offeringSessionId,
      table.status,
    ),
    validSlotInterval: check(
      "bookings_valid_slot_interval",
      sql`(${table.slotStartAt} IS NULL AND ${table.slotEndAt} IS NULL) OR (${table.slotStartAt} IS NOT NULL AND ${table.slotEndAt} IS NOT NULL AND ${table.slotStartAt} < ${table.slotEndAt})`,
    ),
    moneyNonNegative: check(
      "bookings_money_non_negative",
      sql`${table.baseAmountMinor} >= 0 AND ${table.discountAmountMinor} >= 0 AND ${table.taxAmountMinor} >= 0 AND ${table.totalAmountMinor} >= 0`,
    ),
  }),
);

export const bookingAnswers = pgTable("booking_answers", {
  id: id(),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  fieldId: uuid("field_id").references(() => bookingFormFields.id),
  fieldKeySnapshot: varchar("field_key_snapshot", { length: 120 }).notNull(),
  labelSnapshot: varchar("label_snapshot", { length: 220 }).notNull(),
  value: text("value"),
  createdAt: createdAt(),
});

export const bookingSlotHolds = pgTable(
  "booking_slot_holds",
  {
    id: id(),
    offeringId: uuid("offering_id").notNull().references(() => offerings.id),
    offeringSessionId: uuid("offering_session_id").references(() => offeringSessions.id),
    slotStartAt: timestamp("slot_start_at", { withTimezone: true }).notNull(),
    slotEndAt: timestamp("slot_end_at", { withTimezone: true }).notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id),
    status: holdStatusEnum("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => ({
    expiryIdx: index("booking_slot_holds_expiry_idx").on(table.status, table.expiresAt),
    slotIdx: index("booking_slot_holds_slot_idx").on(table.offeringId, table.slotStartAt, table.slotEndAt, table.status),
    sessionIdx: index("booking_slot_holds_session_idx").on(
      table.offeringSessionId,
      table.status,
      table.expiresAt,
    ),
    validSlotInterval: check(
      "booking_slot_holds_valid_slot_interval",
      sql`${table.slotStartAt} < ${table.slotEndAt}`,
    ),
  }),
);

export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    code: varchar("code", { length: 80 }).notNull(),
    description: text("description"),
    discountType: discountTypeEnum("discount_type").notNull(),
    discountValue: integer("discount_value").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    usageLimit: integer("usage_limit"),
    perEmailLimit: integer("per_email_limit"),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    codeUnique: uniqueIndex("coupons_code_unique").on(table.code),
  }),
);

export const couponRedemptions = pgTable("coupon_redemptions", {
  id: id(),
  couponId: uuid("coupon_id").notNull().references(() => coupons.id),
  bookingId: uuid("booking_id").notNull().references(() => bookings.id),
  customerEmail: varchar("customer_email", { length: 255 }).notNull(),
  discountAmountMinor: integer("discount_amount_minor").notNull(),
  createdAt: createdAt(),
});

export const taxRules = pgTable("tax_rules", {
  id: id(),
  name: varchar("name", { length: 160 }).notNull(),
  countryCode: varchar("country_code", { length: 2 }).notNull(),
  percentage: integer("percentage").notNull(),
  status: contentStatusEnum("status").notNull().default("draft"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const payments = pgTable(
  "payments",
  {
    id: id(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id),
    provider: varchar("provider", { length: 80 }).notNull(),
    providerPaymentId: text("provider_payment_id"),
    status: paymentStatusEnum("status").notNull().default("created"),
    currency: varchar("currency", { length: 3 }).notNull(),
    amountMinor: integer("amount_minor").notNull(),
    checkoutUrl: text("checkout_url"),
    idempotencyKey: text("idempotency_key"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    bookingIdx: index("payments_booking_idx").on(table.bookingId),
    providerPaymentIdx: index("payments_provider_payment_idx").on(table.provider, table.providerPaymentId),
    idempotencyUnique: uniqueIndex("payments_idempotency_unique").on(table.idempotencyKey),
    amountNonNegative: check(
      "payments_amount_non_negative",
      sql`${table.amountMinor} >= 0`,
    ),
  }),
);

export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: id(),
    provider: varchar("provider", { length: 80 }).notNull(),
    providerEventId: text("provider_event_id").notNull(),
    paymentId: uuid("payment_id").references(() => payments.id),
    bookingId: uuid("booking_id").references(() => bookings.id),
    eventType: varchar("event_type", { length: 160 }).notNull(),
    signatureValid: boolean("signature_valid").notNull().default(false),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingStatus: processingStatusEnum("processing_status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (table) => ({
    providerEventUnique: uniqueIndex("payment_webhook_events_provider_event_unique").on(table.provider, table.providerEventId),
    paymentIdx: index("payment_webhook_events_payment_idx").on(table.paymentId),
  }),
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: id(),
    bookingId: uuid("booking_id").notNull().references(() => bookings.id),
    provider: varchar("provider", { length: 80 }).notNull().default("google"),
    externalEventId: text("external_event_id"),
    meetUrl: text("meet_url"),
    status: calendarStatusEnum("status").notNull().default("pending"),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    bookingProviderUnique: uniqueIndex("calendar_events_booking_provider_unique").on(table.bookingId, table.provider),
    bookingIdx: index("calendar_events_booking_idx").on(table.bookingId),
  }),
);

export const googleCalendarConnections = pgTable(
  "google_calendar_connections",
  {
    id: id(),
    provider: varchar("provider", { length: 80 }).notNull().default("google"),
    calendarId: text("calendar_id").notNull().default("primary"),
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    tokenType: varchar("token_type", { length: 80 }),
    scope: text("scope"),
    expiryDate: timestamp("expiry_date", { withTimezone: true }),
    connectedEmail: varchar("connected_email", { length: 255 }),
    status: googleCalendarConnectionStatusEnum("status").notNull().default("disconnected"),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    providerUnique: uniqueIndex("google_calendar_connections_provider_unique").on(table.provider),
  }),
);

export const calendarSyncRuns = pgTable("calendar_sync_runs", {
  id: id(),
  provider: varchar("provider", { length: 80 }).notNull().default("google"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: processingStatusEnum("status").notNull().default("pending"),
  recordsImported: integer("records_imported").notNull().default(0),
  lastError: text("last_error"),
});

export const externalCalendarBusyBlocks = pgTable(
  "external_calendar_busy_blocks",
  {
    id: id(),
    provider: varchar("provider", { length: 80 }).notNull().default("google"),
    externalEventId: text("external_event_id"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: contentStatusEnum("status").notNull().default("published"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    rangeIdx: index("external_calendar_busy_blocks_range_idx").on(table.startsAt, table.endsAt),
  }),
);

export const quoteRequests = pgTable(
  "quote_requests",
  {
    id: id(),
    offeringId: uuid("offering_id").references(() => offerings.id),
    status: quoteStatusEnum("status").notNull().default("new"),
    fullName: varchar("full_name", { length: 220 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 80 }),
    companyName: varchar("company_name", { length: 220 }),
    participantsCount: integer("participants_count"),
    preferredDate: varchar("preferred_date", { length: 10 }),
    message: text("message"),
    adminNotes: text("admin_notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    statusIdx: index("quote_requests_status_idx").on(table.status, table.createdAt),
  }),
);

export const contactInquiries = pgTable(
  "contact_inquiries",
  {
    id: id(),
    fullName: varchar("full_name", { length: 220 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 80 }),
    subject: varchar("subject", { length: 220 }),
    message: text("message").notNull(),
    status: inquiryStatusEnum("status").notNull().default("new"),
    sourcePage: text("source_page"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    statusIdx: index("contact_inquiries_status_idx").on(table.status, table.createdAt),
  }),
);

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: id(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 220 }),
    countryCode: varchar("country_code", { length: 2 }),
    status: subscriberStatusEnum("status").notNull().default("subscribed"),
    source: text("source"),
    unsubscribeToken: uuid("unsubscribe_token").notNull().defaultRandom(),
    createdAt: createdAt(),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  },
  (table) => ({
    emailUnique: uniqueIndex("newsletter_subscribers_email_unique").on(table.email),
  }),
);

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: id(),
    key: varchar("key", { length: 160 }).notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    keyUnique: uniqueIndex("email_templates_key_unique").on(table.key),
  }),
);

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: id(),
    templateId: uuid("template_id").references(() => emailTemplates.id),
    recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
    resourceType: varchar("resource_type", { length: 80 }),
    resourceId: uuid("resource_id"),
    provider: varchar("provider", { length: 80 }).notNull().default("resend"),
    providerMessageId: text("provider_message_id"),
    status: deliveryStatusEnum("status").notNull().default("queued"),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    resourceIdx: index("email_deliveries_resource_idx").on(table.resourceType, table.resourceId),
    statusIdx: index("email_deliveries_status_idx").on(table.status),
  }),
);

export const blogCategories = pgTable(
  "blog_categories",
  {
    id: id(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    status: contentStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    slugUnique: uniqueIndex("blog_categories_slug_unique").on(table.slug),
  }),
);

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: id(),
    categoryId: uuid("category_id").references(() => blogCategories.id),
    title: varchar("title", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    excerpt: text("excerpt"),
    body: text("body").notNull(),
    featuredMediaAssetId: uuid("featured_media_asset_id").references(() => mediaAssets.id),
    status: contentStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => ({
    slugUnique: uniqueIndex("blog_posts_slug_unique").on(table.slug),
    statusIdx: index("blog_posts_status_idx").on(table.status, table.publishedAt),
  }),
);

export const adminNotifications = pgTable(
  "admin_notifications",
  {
    id: id(),
    adminUserId: uuid("admin_user_id").references(() => adminUsers.id),
    type: varchar("type", { length: 120 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    message: text("message"),
    resourceType: varchar("resource_type", { length: 80 }),
    resourceId: uuid("resource_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => ({
    adminReadIdx: index("admin_notifications_admin_read_idx").on(table.adminUserId, table.readAt),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    adminUserId: uuid("admin_user_id").references(() => adminUsers.id),
    action: varchar("action", { length: 160 }).notNull(),
    resourceType: varchar("resource_type", { length: 80 }).notNull(),
    resourceId: uuid("resource_id"),
    beforeSnapshot: jsonb("before_snapshot").$type<Record<string, unknown>>(),
    afterSnapshot: jsonb("after_snapshot").$type<Record<string, unknown>>(),
    ipAddress: varchar("ip_address", { length: 80 }),
    createdAt: createdAt(),
  },
  (table) => ({
    adminIdx: index("audit_logs_admin_idx").on(table.adminUserId),
    resourceIdx: index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  }),
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: id(),
    topic: varchar("topic", { length: 160 }).notNull(),
    aggregateType: varchar("aggregate_type", { length: 120 }).notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    state: outboxStateEnum("state").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockToken: uuid("lock_token"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastError: varchar("last_error", { length: 2000 }),
    createdAt: createdAt(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex("outbox_events_idempotency_unique").on(table.idempotencyKey),
    claimIdx: index("outbox_events_claim_idx").on(
      table.state,
      table.availableAt,
      table.createdAt,
      table.id,
    ),
    leaseIdx: index("outbox_events_lease_idx").on(table.state, table.lockedAt),
    aggregateIdx: index("outbox_events_aggregate_idx").on(table.aggregateType, table.aggregateId),
  }),
);
