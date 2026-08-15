import { apiBaseUrl } from "./config";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "editor" | "viewer";
  status: "active" | "invited" | "suspended" | "disabled";
};

export type AdminOfferingStatus = "draft" | "published" | "scheduled" | "archived";
export type AdminBookingStatus =
  | "draft"
  | "pending_payment"
  | "payment_failed"
  | "confirmed"
  | "cancelled"
  | "rescheduled"
  | "completed"
  | "no_show"
  | "expired"
  | "rejected";
export type AdminPaymentStatus =
  | "created"
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "abandoned"
  | "cancelled"
  | "expired"
  | "refunded";
export type AdminCalendarStatus = "pending" | "created" | "updated" | "cancelled" | "failed";
export type AdminBookingFormFieldType =
  | "text"
  | "email"
  | "phone"
  | "textarea"
  | "date"
  | "select"
  | "checkbox"
  | "number";

export type AdminOfferingCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  status: AdminOfferingStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminOffering = {
  id: string;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  title: string;
  slug: string;
  shortDescription: string | null;
  longDescription: string | null;
  offeringType:
    | "coaching"
    | "therapy_session"
    | "workshop"
    | "webinar"
    | "course"
    | "corporate_training"
    | "custom";
  attendanceMode: "online" | "offline" | "hybrid";
  bookingMode: "free" | "paid" | "quote_only";
  schedulingMode: "appointment" | "scheduled_program";
  durationMinutes: number | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  capacity: number;
  requiresPayment: boolean;
  quoteOnly: boolean;
  sortOrder: number;
  displayConfig: {
    backgroundColor?: string;
    textColor?: string;
  };
  status: AdminOfferingStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminOfferingPrice = {
  id: string;
  offeringId: string;
  countryCode: string;
  currency: string;
  baseAmountMinor: number;
  earlyBirdAmountMinor: number | null;
  earlyBirdEndsAt: string | null;
  status: AdminOfferingStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminAvailabilityWindowStatus = "draft" | "published" | "archived";

export type AdminAvailabilityWindow = {
  id: string;
  weekday: number;
  startLocalTime: string;
  endLocalTime: string;
  status: AdminAvailabilityWindowStatus;
  allowedActions: {
    edit: boolean;
    archive: boolean;
    delete: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

export type AdminAvailabilityOverrideType = "available" | "unavailable";

export type AdminAvailabilityOverride = {
  id: string;
  date: string;
  type: AdminAvailabilityOverrideType;
  startLocalTime: string | null;
  endLocalTime: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminAvailabilitySlotStatus = "available" | "blocked" | "booked" | "held";
export type AdminAvailabilitySlotSource = "window" | "available_override";

export type AdminAvailabilitySlot = {
  date: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: AdminAvailabilitySlotStatus;
  source: AdminAvailabilitySlotSource;
  availabilityWindowId: string | null;
  availabilityOverrideId: string | null;
  remainingCapacity: number;
  bookedCount: number;
  heldCount: number;
  blockedReason: string | null;
  publicBookingPolicy: {
    bookable: boolean;
    reason: "minimum_advance_days" | null;
    earliestBookableDate: string;
  };
};

export type AdminBookingPolicy = {
  bookingMinimumAdvanceDays: number;
  bookingDefaultTimezone: string;
  localToday: string;
  earliestBookableDate: string;
  updatedAt: string | null;
};

export type AdminAvailabilitySlotPreview = {
  offering: {
    id: string;
    title: string;
    slug: string;
    schedulingMode: "appointment";
    capacity: number;
    durationMinutes: number | null;
    bufferBeforeMinutes: number;
    bufferAfterMinutes: number;
    status: AdminOfferingStatus;
  };
  timezone: string;
  dateFrom: string;
  dateTo: string;
  bookingPolicy: {
    minimumAdvanceDays: number;
    timezone: string;
    localToday: string;
    earliestBookableDate: string;
  };
  days: Array<{
    date: string;
    weekday: number;
    slots: AdminAvailabilitySlot[];
    availableCount: number;
    totalCount: number;
  }>;
  programBlockers: Array<{
    occurrenceId: string;
    programId: string;
    title: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    readOnly: true;
  }>;
  availableCount: number;
  totalCount: number;
  generatedAt: string;
};

export type AdminBookingTarget =
  | {
      kind: "appointment";
      scheduledProgramId: null;
      startsAt: string;
      endsAt: string;
      timezone: string;
      occurrences: [];
    }
  | {
      kind: "scheduled_program";
      scheduledProgramId: string;
      title: string;
      timezone: string;
      occurrences: Array<{
        id: string;
        startsAt: string;
        endsAt: string;
        timezone: string;
        attendanceMode: AdminOffering["attendanceMode"];
        meetUrl: string | null;
        location: {
          id: string;
          name: string;
          city: string | null;
          countryCode: string;
        } | null;
      }>;
    };

export type AdminBooking = {
  id: string;
  publicToken: string;
  bookingReference: string;
  offering: {
    id: string;
    title: string;
    slug: string;
  };
  attendanceMode: AdminOffering["attendanceMode"];
  status: AdminBookingStatus;
  customer: {
    fullName: string;
    email: string;
    phone: string | null;
  };
  countryCode: string | null;
  location: {
    id: string;
    name: string | null;
    city: string | null;
    countryCode: string | null;
  } | null;
  slot: {
    startsAt: string | null;
    endsAt: string | null;
    timezone: string;
  };
  target: AdminBookingTarget;
  payment: {
    required: boolean;
    currency: string | null;
    baseAmountMinor: number;
    discountAmountMinor: number;
    taxAmountMinor: number;
    totalAmountMinor: number;
  };
  calendar: {
    id: string;
    status: AdminCalendarStatus;
    externalEventId: string | null;
    meetUrl: string | null;
    lastError: string | null;
    updatedAt: string | null;
  } | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminPayment = {
  id: string;
  provider: string;
  providerPaymentId: string | null;
  status: AdminPaymentStatus;
  currency: string;
  amountMinor: number;
  checkoutUrl: string | null;
  merchantOrderId: string | null;
  paidAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
  booking: {
    id: string;
    publicToken: string;
    status: AdminBookingStatus;
    customer: {
      fullName: string;
      email: string;
    };
    offering: {
      id: string;
      title: string;
      slug: string;
    };
    target: AdminBookingTarget;
    calendar: AdminBooking["calendar"];
  };
};

export type AdminPaymentDetail = AdminPayment & {
  events: Array<{
    id: string;
    provider: string;
    providerEventId: string;
    eventType: string;
    signatureValid: boolean;
    processingStatus: "pending" | "processed" | "failed" | "ignored";
    createdAt: string;
  }>;
};

export type AdminPaymentReconciliationResult = {
  payment: AdminPayment;
  reconciliation: {
    provider: "kashier";
    status: string | null;
    amountMatches: boolean;
    currencyMatches: boolean;
    appliedStatus: AdminPaymentStatus | null;
  };
};

export type AdminQuoteRequestStatus =
  | "new"
  | "reviewing"
  | "contacted"
  | "won"
  | "lost"
  | "archived";

export type AdminQuoteRequest = {
  id: string;
  offering: {
    id: string;
    title: string;
    slug: string;
  } | null;
  status: AdminQuoteRequestStatus;
  customer: {
    fullName: string;
    email: string;
    phone: string | null;
    companyName: string | null;
  };
  participantsCount: number | null;
  preferredDate: string | null;
  message: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminQuoteRequestPatch = {
  status?: AdminQuoteRequestStatus;
  adminNotes?: string | null;
};

export type AdminEmailDeliveryStatus = "queued" | "sent" | "failed" | "suppressed";
export type AdminEmailTemplateStatus = "draft" | "published" | "scheduled" | "archived";

export type AdminEmailDelivery = {
  id: string;
  templateId: string | null;
  templateKey: string | null;
  recipientEmail: string;
  resourceType: string | null;
  resourceId: string | null;
  provider: string;
  providerMessageId: string | null;
  status: AdminEmailDeliveryStatus;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminEmailTemplate = {
  id: string;
  key: string;
  subject: string;
  body: string;
  status: AdminEmailTemplateStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminEmailTemplatePayload = {
  subject: string;
  body: string;
  status: AdminEmailTemplateStatus;
};

export type AdminContentStatus = "draft" | "published" | "scheduled" | "archived";

export type AdminSiteSettings = {
  id: string;
  siteName: string;
  defaultLocale: string;
  contactEmail: string | null;
  contactPhone: string | null;
  socialLinks: Record<string, string>;
  bookingDefaultTimezone: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminSiteSettingsPayload = {
  siteName: string;
  defaultLocale: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  socialLinks: Record<string, string>;
};

export type AdminNavigationItem = {
  id: string;
  label: string;
  url: string;
  location: string;
  sortOrder: number;
  status: AdminContentStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminNavigationItemPayload = {
  label: string;
  url: string;
  location: string;
  sortOrder: number;
  status: AdminContentStatus;
};

export type AdminLegalPage = {
  id: string;
  slug: string;
  title: string;
  body: string;
  version: string;
  status: AdminContentStatus;
  publishedAt: string | null;
  publicationError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminLegalPagePayload = {
  slug: string;
  title: string;
  body: string;
  version: string;
  status: AdminContentStatus;
  publishedAt?: string | null;
};

export type AdminCmsPage = {
  id: string;
  slug: string;
  title: string;
  template: string;
  status: AdminContentStatus;
  publishedAt: string | null;
  publicationError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminCmsPagePayload = {
  slug: string;
  title: string;
  template: string;
  status: AdminContentStatus;
  publishedAt?: string | null;
};

export type AdminCmsPageSection = {
  id: string;
  pageId: string;
  sectionType: string;
  title: string | null;
  body: string | null;
  config: Record<string, unknown>;
  media: Record<string, AdminMediaAssignment[]>;
  /** @deprecated Compatibility only; new API responses omit this field. */
  mediaAssetId?: string | null;
  sortOrder: number;
  status: AdminContentStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminCmsPageSectionPayload = {
  sectionType: string;
  title?: string | null;
  body?: string | null;
  config: Record<string, unknown>;
  /** @deprecated Use replaceAdminCmsSectionMedia after saving the section. */
  mediaAssetId?: string | null;
  sortOrder?: number;
  status: AdminContentStatus;
};

export type AdminMediaKind = "image" | "video" | "animation_bundle";
export type AdminMediaSource = "r2" | "external";
export type AdminMediaProcessingState = "pending" | "ready" | "failed";

export type AdminMediaAsset = {
  id: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  sourceType: AdminMediaSource;
  mediaKind: AdminMediaKind;
  publicUrl: string | null;
  altText: string | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
  processingState: AdminMediaProcessingState;
  processingError: string | null;
  status: AdminContentStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminMediaAssignment = {
  id: string;
  slotKey: string;
  sortOrder: number;
  altTextOverride: string | null;
  decorative: boolean;
  assetId: string;
  displayName: string;
  mediaKind: AdminMediaKind;
  mimeType: string;
  publicUrl: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  processingState: AdminMediaProcessingState;
  status: AdminContentStatus;
};

export type AdminMediaAssignmentInput = {
  mediaAssetId: string;
  altTextOverride?: string | null;
  decorative?: boolean;
};

export type AdminCmsFieldDefinition = {
  key: string;
  label: string;
  type: "text" | "markdown" | "boolean" | "choice" | "link" | "media";
  required?: boolean;
  helpText?: string;
  defaultValue?: boolean;
  options?: ReadonlyArray<{ value: string; label: string }>;
  accepts?: ReadonlyArray<AdminMediaKind>;
  cardinality?: "single" | "multiple";
};

export type AdminCmsSectionDefinition = {
  key: string;
  label: string;
  description: string;
  fields: AdminCmsFieldDefinition[];
};

export type AdminGlobalMediaDefinition = {
  key: string;
  label: string;
  description: string;
  atomic: boolean;
  slots: AdminCmsFieldDefinition[];
};

export type AdminGlobalMediaVersion = {
  id: string;
  definitionKey: string;
  version: number;
  status: AdminContentStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignments: Array<AdminMediaAssignment & { assignmentSetId: string }>;
};

export type AdminSeoMetadata = {
  id?: string;
  resourceType: string;
  resourceId: string;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogImageAssetId: string | null;
  noindex: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type MediaUploadIntent = {
  assetId: string;
  uploadUrl: string;
  expiresAt: string;
  mimeType: string;
  sizeBytes: number;
};

export type AdminMediaUsage = Record<string, unknown> & {
  ownerType: string;
  slotKey?: string;
};

export type GoogleCalendarIntegrationStatus = {
  configured: boolean;
  connected: boolean;
  calendarId: string;
  connectedEmail: string | null;
  status: "connected" | "disconnected" | "error";
  lastError: string | null;
  tokenExpiresAt: string | null;
  updatedAt: string | null;
};

export type AdminBookingFormField = {
  id: string;
  offering: {
    id: string;
    title: string;
    slug: string;
  } | null;
  fieldKey: string;
  label: string;
  fieldType: AdminBookingFormFieldType;
  required: boolean;
  options: Array<{ label: string; value: string }>;
  validationRules: Record<string, unknown>;
  sortOrder: number;
  status: AdminOfferingStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminLocation = {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  countryCode: string;
  mapUrl: string | null;
  instructions: string | null;
  status: AdminOfferingStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminSession = {
  id: string;
  scheduledProgramId: string;
  offering: {
    id: string;
    title: string;
    slug: string;
    attendanceMode: AdminOffering["attendanceMode"];
  };
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: number;
  attendanceMode: AdminOffering["attendanceMode"];
  location: {
    id: string;
    name: string | null;
    city: string | null;
    countryCode: string | null;
  } | null;
  googleCalendarEventId: string | null;
  status: AdminOfferingStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminOfferingPayload = {
  categoryId?: string | null;
  title: string;
  slug: string;
  shortDescription?: string | null;
  longDescription?: string | null;
  offeringType: AdminOffering["offeringType"];
  attendanceMode: AdminOffering["attendanceMode"];
  bookingMode: AdminOffering["bookingMode"];
  schedulingMode: AdminOffering["schedulingMode"];
  durationMinutes: number | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  capacity: number;
  requiresPayment: boolean;
  quoteOnly: boolean;
  sortOrder: number;
  displayConfig: AdminOffering["displayConfig"];
  status: AdminOfferingStatus;
};

export type AdminOfferingPricePayload = {
  countryCode: string;
  currency: string;
  baseAmountMinor: number;
  earlyBirdAmountMinor?: number | null;
  earlyBirdEndsAt?: string | null;
  status: AdminOfferingStatus;
};

export type AdminAvailabilityWindowPayload = {
  weekday: number;
  startLocalTime: string;
  endLocalTime: string;
  status: AdminAvailabilityWindowStatus;
};

export type AdminProgramStatus = "draft" | "published" | "archived";

export type AdminProgramOccurrence = {
  id: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  attendanceMode: AdminOffering["attendanceMode"];
  location: { id: string; name: string | null } | null;
  locationId: string | null;
  sortOrder: number;
  googleCalendarEventId: string | null;
  meetUrl: string | null;
  status: "scheduled" | "cancelled";
};

export type AdminProgram = {
  id: string;
  offering: {
    id: string;
    title: string;
    slug: string;
    status: AdminOfferingStatus;
    schedulingMode: "scheduled_program";
    bookingMode: AdminOffering["bookingMode"];
  };
  title: string;
  timezone: string;
  attendanceMode: AdminOffering["attendanceMode"];
  location: { id: string; name: string | null } | null;
  capacity: { total: number; booked: number; held: number; remaining: number };
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  status: AdminProgramStatus;
  occurrences: AdminProgramOccurrence[];
  conflicts: Array<{
    kind: "program" | "appointment_booking" | "appointment_hold" | "external_busy";
    resourceId: string;
    startsAt: string;
    endsAt: string;
  }>;
  allowedActions: { edit: boolean; publish: boolean; archive: boolean; delete: boolean };
  createdAt: string;
  updatedAt: string;
};

export type AdminAvailabilityOverridePayload = {
  date: string;
  type: AdminAvailabilityOverrideType;
  startLocalTime?: string | null;
  endLocalTime?: string | null;
  reason?: string | null;
};

export type AdminBookingStatusPayload = {
  status: AdminBookingStatus;
  reason?: string | null;
};

export type AdminBookingReschedulePayload = {
  offeringSessionId?: string | null;
  startsAt: string;
  endsAt: string;
  timezone?: string | null;
  reason?: string | null;
};

export type AdminBookingFormFieldPayload = {
  offeringId?: string | null;
  fieldKey: string;
  label: string;
  fieldType: AdminBookingFormFieldType;
  required: boolean;
  options: Array<{ label: string; value: string }>;
  validationRules: Record<string, unknown>;
  sortOrder: number;
  status: AdminOfferingStatus;
};

export type AdminLocationPayload = {
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  countryCode: string;
  mapUrl?: string | null;
  instructions?: string | null;
  status: AdminOfferingStatus;
};

export type AdminSessionPayload = {
  offeringId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: number;
  attendanceMode: AdminOffering["attendanceMode"];
  locationId?: string | null;
  googleCalendarEventId?: string | null;
  status: AdminOfferingStatus;
};

export type AdminProgramPayload = {
  offeringId: string;
  title: string;
  timezone: string;
  attendanceMode: AdminOffering["attendanceMode"];
  locationId?: string | null;
  capacity: number;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  occurrences: Array<{
    id?: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    attendanceMode: AdminOffering["attendanceMode"];
    locationId?: string | null;
    status: "scheduled" | "cancelled";
  }>;
};

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ field?: string; message: string }>;
    requestId?: string;
  };
};

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Array<{ field?: string; message: string }>;
  readonly requestId?: string;

  constructor(input: {
    status: number;
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
    requestId?: string;
  }) {
    super(input.message);
    this.name = "AdminApiError";
    this.status = input.status;
    this.code = input.code;
    this.details = input.details ?? [];
    this.requestId = input.requestId;
  }
}

const readJson = async <T>(response: Response): Promise<T | null> => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  return JSON.parse(text) as T;
};

const adminRequest = async <T>(path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await readJson<T & ApiErrorPayload>(response);

  if (!response.ok) {
    throw new AdminApiError({
      status: response.status,
      code: payload?.error?.code ?? "REQUEST_FAILED",
      message: payload?.error?.message ?? "Request failed.",
      details: payload?.error?.details,
      requestId: payload?.error?.requestId,
    });
  }

  if (!payload) {
    throw new AdminApiError({
      status: response.status,
      code: "EMPTY_RESPONSE",
      message: "The API returned an empty response.",
    });
  }

  return payload;
};

export const loginAdmin = async (input: { email: string; password: string }) => {
  const payload = await adminRequest<{
    data: {
      admin: AdminUser;
      expiresAt: string;
    };
  }>("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return payload.data;
};

export const logoutAdmin = async () => {
  await adminRequest<void>("/admin/auth/logout", {
    method: "POST",
  });
};

export const fetchCurrentAdmin = async () => {
  const payload = await adminRequest<{
    data: {
      admin: AdminUser;
    };
  }>("/admin/auth/me");

  return payload.data.admin;
};

export const fetchAdminOfferings = async (
  filters: { status?: AdminOfferingStatus | "all"; search?: string } = {},
) => {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  const queryString = params.toString();
  const payload = await adminRequest<{ data: AdminOffering[] }>(
    `/admin/offerings${queryString ? `?${queryString}` : ""}`,
  );

  return payload.data;
};

export const fetchAdminOfferingCategories = async () => {
  const payload = await adminRequest<{ data: AdminOfferingCategory[] }>(
    "/admin/offerings/categories",
  );

  return payload.data;
};

export const fetchAdminOffering = async (id: string) => {
  const payload = await adminRequest<{ data: AdminOffering }>(
    `/admin/offerings/${id}`,
  );

  return payload.data;
};

export const createAdminOffering = async (input: AdminOfferingPayload) => {
  const payload = await adminRequest<{ data: AdminOffering }>("/admin/offerings", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return payload.data;
};

export const updateAdminOffering = async (
  id: string,
  input: Partial<AdminOfferingPayload>,
) => {
  const payload = await adminRequest<{ data: AdminOffering }>(`/admin/offerings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

  return payload.data;
};

export const fetchAdminOfferingPrices = async (offeringId: string) => {
  const payload = await adminRequest<{ data: AdminOfferingPrice[] }>(
    `/admin/offerings/${offeringId}/prices`,
  );

  return payload.data;
};

export const createAdminOfferingPrice = async (
  offeringId: string,
  input: AdminOfferingPricePayload,
) => {
  const payload = await adminRequest<{ data: AdminOfferingPrice }>(
    `/admin/offerings/${offeringId}/prices`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const updateAdminOfferingPrice = async (
  offeringId: string,
  priceId: string,
  input: Partial<AdminOfferingPricePayload>,
) => {
  const payload = await adminRequest<{ data: AdminOfferingPrice }>(
    `/admin/offerings/${offeringId}/prices/${priceId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const archiveAdminOfferingPrice = async (offeringId: string, priceId: string) => {
  await adminRequest<void>(`/admin/offerings/${offeringId}/prices/${priceId}`, {
    method: "DELETE",
  });
};

export const archiveAdminOffering = async (id: string) => {
  await adminRequest<void>(`/admin/offerings/${id}`, {
    method: "DELETE",
  });
};

export const fetchAdminAvailabilityWindows = async (
  filters: {
    status?: AdminAvailabilityWindowStatus | "all";
    weekday?: number | "all";
  } = {},
) => {
  const params = new URLSearchParams();

  if (filters.weekday !== undefined && filters.weekday !== "all") {
    params.set("weekday", String(filters.weekday));
  }

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  const queryString = params.toString();
  const payload = await adminRequest<{ data: AdminAvailabilityWindow[] }>(
    `/admin/availability-windows${queryString ? `?${queryString}` : ""}`,
  );

  return payload.data;
};

export const createAdminAvailabilityWindow = async (
  input: AdminAvailabilityWindowPayload,
) => {
  const payload = await adminRequest<{ data: AdminAvailabilityWindow }>(
    "/admin/availability-windows",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const updateAdminAvailabilityWindow = async (
  id: string,
  input: Partial<AdminAvailabilityWindowPayload>,
) => {
  const payload = await adminRequest<{ data: AdminAvailabilityWindow }>(
    `/admin/availability-windows/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const deleteOrArchiveAdminAvailabilityWindow = async (id: string) => {
  await adminRequest<void>(`/admin/availability-windows/${id}`, {
    method: "DELETE",
  });
};

export const fetchAdminAvailabilityOverrides = async (
  filters: {
    type?: AdminAvailabilityOverrideType | "all";
    dateFrom?: string;
    dateTo?: string;
  } = {},
) => {
  const params = new URLSearchParams();

  if (filters.type && filters.type !== "all") {
    params.set("type", filters.type);
  }

  if (filters.dateFrom?.trim()) {
    params.set("dateFrom", filters.dateFrom.trim());
  }

  if (filters.dateTo?.trim()) {
    params.set("dateTo", filters.dateTo.trim());
  }

  const queryString = params.toString();
  const payload = await adminRequest<{ data: AdminAvailabilityOverride[] }>(
    `/admin/availability-overrides${queryString ? `?${queryString}` : ""}`,
  );

  return payload.data;
};

export const createAdminAvailabilityOverride = async (
  input: AdminAvailabilityOverridePayload,
) => {
  const payload = await adminRequest<{ data: AdminAvailabilityOverride }>(
    "/admin/availability-overrides",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const updateAdminAvailabilityOverride = async (
  id: string,
  input: Partial<AdminAvailabilityOverridePayload>,
) => {
  const payload = await adminRequest<{ data: AdminAvailabilityOverride }>(
    `/admin/availability-overrides/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const deleteAdminAvailabilityOverride = async (id: string) => {
  await adminRequest<void>(`/admin/availability-overrides/${id}`, {
    method: "DELETE",
  });
};

export const fetchAdminAvailabilitySlotPreview = async (filters: {
  offeringId: string;
  dateFrom: string;
  dateTo: string;
}) => {
  const params = new URLSearchParams({
    offeringId: filters.offeringId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  const payload = await adminRequest<{ data: AdminAvailabilitySlotPreview }>(
    `/admin/availability-slots?${params.toString()}`,
  );

  return payload.data;
};

export const fetchAdminBookings = async (
  filters: { status?: AdminBookingStatus | "all"; search?: string } = {},
) => {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  const queryString = params.toString();
  const payload = await adminRequest<{ data: AdminBooking[] }>(
    `/admin/bookings${queryString ? `?${queryString}` : ""}`,
  );

  return payload.data;
};

export const fetchAdminBooking = async (id: string) => {
  const payload = await adminRequest<{ data: AdminBooking }>(`/admin/bookings/${id}`);

  return payload.data;
};

export const updateAdminBookingStatus = async (
  id: string,
  input: AdminBookingStatusPayload,
) => {
  const payload = await adminRequest<{ data: AdminBooking }>(
    `/admin/bookings/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const rescheduleAdminBooking = async (
  id: string,
  input: AdminBookingReschedulePayload,
) => {
  const payload = await adminRequest<{ data: AdminBooking }>(
    `/admin/bookings/${id}/reschedule`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const retryAdminBookingCalendarSync = async (id: string) => {
  const payload = await adminRequest<{ data: AdminBooking }>(
    `/admin/bookings/${id}/calendar/retry`,
    {
      method: "POST",
    },
  );

  return payload.data;
};

export const fetchAdminPayments = async (
  filters: { status?: AdminPaymentStatus | "all"; search?: string } = {},
) => {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  const queryString = params.toString();
  const payload = await adminRequest<{ data: AdminPayment[] }>(
    `/admin/payments${queryString ? `?${queryString}` : ""}`,
  );

  return payload.data;
};

export const fetchAdminPayment = async (id: string) => {
  const payload = await adminRequest<{ data: AdminPaymentDetail }>(`/admin/payments/${id}`);

  return payload.data;
};

export const reconcileAdminPayment = async (id: string) => {
  const payload = await adminRequest<{ data: AdminPaymentReconciliationResult }>(
    `/admin/payments/${id}/reconcile`,
    {
      method: "POST",
    },
  );

  return payload.data;
};

export const fetchAdminQuoteRequests = async (
  filters: { status?: AdminQuoteRequestStatus | "all"; search?: string } = {},
) => {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  const queryString = params.toString();
  const payload = await adminRequest<{ data: AdminQuoteRequest[] }>(
    `/admin/quote-requests${queryString ? `?${queryString}` : ""}`,
  );

  return payload.data;
};

export const fetchAdminQuoteRequest = async (id: string) => {
  const payload = await adminRequest<{ data: AdminQuoteRequest }>(
    `/admin/quote-requests/${id}`,
  );

  return payload.data;
};

export const updateAdminQuoteRequest = async (
  id: string,
  input: AdminQuoteRequestPatch,
) => {
  const payload = await adminRequest<{ data: AdminQuoteRequest }>(
    `/admin/quote-requests/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const fetchAdminEmailDeliveries = async (
  filters: { status?: AdminEmailDeliveryStatus | "all"; search?: string } = {},
) => {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  const queryString = params.toString();
  const payload = await adminRequest<{ data: AdminEmailDelivery[] }>(
    `/admin/emails/deliveries${queryString ? `?${queryString}` : ""}`,
  );

  return payload.data;
};

export const retryAdminEmailDelivery = async (id: string) => {
  const payload = await adminRequest<{ data: AdminEmailDelivery }>(
    `/admin/emails/deliveries/${id}/retry`,
    {
      method: "POST",
    },
  );

  return payload.data;
};

export const fetchAdminEmailTemplates = async () => {
  const payload = await adminRequest<{ data: AdminEmailTemplate[] }>(
    "/admin/emails/templates",
  );

  return payload.data;
};

export const saveAdminEmailTemplate = async (
  key: string,
  input: AdminEmailTemplatePayload,
) => {
  const payload = await adminRequest<{ data: AdminEmailTemplate }>(
    `/admin/emails/templates/${encodeURIComponent(key)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const fetchAdminSiteSettings = async () => {
  const payload = await adminRequest<{ data: AdminSiteSettings | null }>(
    "/admin/cms/settings",
  );

  return payload.data;
};

export const saveAdminSiteSettings = async (input: AdminSiteSettingsPayload) => {
  const payload = await adminRequest<{ data: AdminSiteSettings }>(
    "/admin/cms/settings",
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const fetchAdminNavigationItems = async (
  filters: { status?: AdminContentStatus | "all"; search?: string; location?: string } = {},
) => {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.location?.trim()) {
    params.set("location", filters.location.trim());
  }

  const queryString = params.toString();
  const payload = await adminRequest<{ data: AdminNavigationItem[] }>(
    `/admin/cms/navigation${queryString ? `?${queryString}` : ""}`,
  );

  return payload.data;
};

export const createAdminNavigationItem = async (input: AdminNavigationItemPayload) => {
  const payload = await adminRequest<{ data: AdminNavigationItem }>(
    "/admin/cms/navigation",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const updateAdminNavigationItem = async (
  id: string,
  input: Partial<AdminNavigationItemPayload>,
) => {
  const payload = await adminRequest<{ data: AdminNavigationItem }>(
    `/admin/cms/navigation/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const archiveAdminNavigationItem = async (id: string) => {
  await adminRequest<void>(`/admin/cms/navigation/${id}`, {
    method: "DELETE",
  });
};

export const fetchAdminLegalPages = async (
  filters: { status?: AdminContentStatus | "all"; search?: string } = {},
) => {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  const queryString = params.toString();
  const payload = await adminRequest<{ data: AdminLegalPage[] }>(
    `/admin/cms/legal-pages${queryString ? `?${queryString}` : ""}`,
  );

  return payload.data;
};

export const createAdminLegalPage = async (input: AdminLegalPagePayload) => {
  const payload = await adminRequest<{ data: AdminLegalPage }>(
    "/admin/cms/legal-pages",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const updateAdminLegalPage = async (
  id: string,
  input: Partial<AdminLegalPagePayload>,
) => {
  const payload = await adminRequest<{ data: AdminLegalPage }>(
    `/admin/cms/legal-pages/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const archiveAdminLegalPage = async (id: string) => {
  await adminRequest<void>(`/admin/cms/legal-pages/${id}`, {
    method: "DELETE",
  });
};

export const fetchAdminCmsPages = async (
  filters: { status?: AdminContentStatus | "all"; search?: string } = {},
) => {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  const queryString = params.toString();
  const payload = await adminRequest<{ data: AdminCmsPage[] }>(
    `/admin/cms/pages${queryString ? `?${queryString}` : ""}`,
  );

  return payload.data;
};

export const fetchAdminCmsPageSections = async (pageId: string) => {
  const payload = await adminRequest<{ data: AdminCmsPageSection[] }>(
    `/admin/cms/pages/${pageId}/sections`,
  );

  return payload.data;
};

export const updateAdminCmsPage = async (
  id: string,
  input: Partial<AdminCmsPagePayload>,
) => {
  const payload = await adminRequest<{ data: AdminCmsPage }>(
    `/admin/cms/pages/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const updateAdminCmsPageSection = async (
  pageId: string,
  sectionId: string,
  input: Partial<AdminCmsPageSectionPayload>,
) => {
  const payload = await adminRequest<{ data: AdminCmsPageSection }>(
    `/admin/cms/pages/${pageId}/sections/${sectionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const createAdminCmsPage = async (input: AdminCmsPagePayload) => {
  const payload = await adminRequest<{ data: AdminCmsPage }>("/admin/cms/pages", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.data;
};

export const archiveAdminCmsPage = async (id: string) => {
  await adminRequest<void>(`/admin/cms/pages/${id}`, { method: "DELETE" });
};

export const createAdminCmsPageSection = async (
  pageId: string,
  input: AdminCmsPageSectionPayload,
) => {
  const payload = await adminRequest<{ data: AdminCmsPageSection }>(
    `/admin/cms/pages/${pageId}/sections`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return payload.data;
};

export const archiveAdminCmsPageSection = async (pageId: string, sectionId: string) => {
  await adminRequest<void>(`/admin/cms/pages/${pageId}/sections/${sectionId}`, {
    method: "DELETE",
  });
};

export const duplicateAdminCmsPageSection = async (pageId: string, sectionId: string) => {
  const payload = await adminRequest<{ data: AdminCmsPageSection }>(
    `/admin/cms/pages/${pageId}/sections/${sectionId}/duplicate`,
    { method: "POST" },
  );
  return payload.data;
};

export const reorderAdminCmsPageSections = async (pageId: string, sectionIds: string[]) => {
  const payload = await adminRequest<{ data: AdminCmsPageSection[] }>(
    `/admin/cms/pages/${pageId}/sections/order`,
    { method: "PUT", body: JSON.stringify({ sectionIds }) },
  );
  return payload.data;
};

export const replaceAdminCmsSectionMedia = async (
  pageId: string,
  sectionId: string,
  slots: Record<string, AdminMediaAssignmentInput[]>,
) => {
  const payload = await adminRequest<{ data: AdminMediaAssignment[] }>(
    `/admin/cms/pages/${pageId}/sections/${sectionId}/media`,
    { method: "PUT", body: JSON.stringify({ slots }) },
  );
  return payload.data;
};

export const fetchAdminCmsSectionDefinitions = async () => {
  const payload = await adminRequest<{ data: AdminCmsSectionDefinition[] }>(
    "/admin/cms/definitions/sections",
  );
  return payload.data;
};

export const fetchAdminGlobalMediaDefinitions = async () => {
  const payload = await adminRequest<{ data: AdminGlobalMediaDefinition[] }>(
    "/admin/cms/definitions/global-media",
  );
  return payload.data;
};

export const fetchAdminMediaAssets = async (filters: {
  search?: string;
  status?: AdminContentStatus | "all";
  sourceType?: AdminMediaSource | "all";
  mediaKind?: AdminMediaKind | "all";
  processingState?: AdminMediaProcessingState | "all";
} = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== "all") params.set(key, value);
  }
  const query = params.toString();
  const payload = await adminRequest<{ data: AdminMediaAsset[] }>(
    `/admin/cms/media-assets${query ? `?${query}` : ""}`,
  );
  return payload.data;
};

export const createAdminMediaUploadIntent = async (input: {
  displayName?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  altText?: string | null;
}) => {
  const payload = await adminRequest<{ data: MediaUploadIntent }>(
    "/admin/cms/media-assets/upload-intents",
    { method: "POST", body: JSON.stringify(input) },
  );
  return payload.data;
};

export const uploadAdminMediaFile = (
  uploadUrl: string,
  file: File,
  onProgress: (percentage: number) => void = () => undefined,
) => new Promise<void>((resolve, reject) => {
  const request = new XMLHttpRequest();
  request.open("PUT", uploadUrl);
  request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
  request.upload.addEventListener("progress", (event) => {
    if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
  });
  request.addEventListener("load", () => {
    if (request.status >= 200 && request.status < 300) {
      onProgress(100);
      resolve();
    } else {
      reject(new Error(`Direct upload failed with status ${request.status}.`));
    }
  });
  request.addEventListener("error", () => reject(new Error("Direct upload failed.")));
  request.addEventListener("abort", () => reject(new Error("Direct upload was cancelled.")));
  request.send(file);
});

export const finalizeAdminMediaUpload = async (assetId: string) => {
  const payload = await adminRequest<{ data: AdminMediaAsset }>(
    "/admin/cms/media-assets/finalize",
    { method: "POST", body: JSON.stringify({ assetId }) },
  );
  return payload.data;
};

export const createAdminExternalMedia = async (input: {
  displayName: string;
  fileName: string;
  mimeType: string;
  mediaKind: "image" | "video";
  publicUrl: string;
  altText: string | null;
}) => {
  const payload = await adminRequest<{ data: AdminMediaAsset }>(
    "/admin/cms/media-assets/external",
    { method: "POST", body: JSON.stringify(input) },
  );
  return payload.data;
};

export const updateAdminMediaAsset = async (
  id: string,
  input: { displayName?: string; altText?: string | null },
) => {
  const payload = await adminRequest<{ data: AdminMediaAsset }>(
    `/admin/cms/media-assets/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return payload.data;
};

export const fetchAdminMediaUsages = async (id: string) => {
  const payload = await adminRequest<{ data: AdminMediaUsage[] }>(
    `/admin/cms/media-assets/${id}/usages`,
  );
  return payload.data;
};

export const archiveAdminMediaAsset = async (id: string) => {
  await adminRequest<void>(`/admin/cms/media-assets/${id}`, { method: "DELETE" });
};

export const permanentlyDeleteAdminMediaAsset = async (id: string) => {
  await adminRequest<void>(`/admin/cms/media-assets/${id}/permanent`, { method: "DELETE" });
};

export const fetchAdminGlobalMediaVersions = async () => {
  const payload = await adminRequest<{ data: AdminGlobalMediaVersion[] }>(
    "/admin/cms/global-media",
  );
  return payload.data;
};

export const createAdminGlobalMediaVersion = async (definitionKey: string) => {
  const payload = await adminRequest<{ data: AdminGlobalMediaVersion }>(
    `/admin/cms/global-media/${encodeURIComponent(definitionKey)}/versions`,
    { method: "POST" },
  );
  return payload.data;
};

export const replaceAdminGlobalMedia = async (
  definitionKey: string,
  assignmentSetId: string,
  slots: Record<string, AdminMediaAssignmentInput[]>,
) => {
  const payload = await adminRequest<{ data: AdminMediaAssignment[] }>(
    `/admin/cms/global-media/${encodeURIComponent(definitionKey)}/versions/${assignmentSetId}`,
    { method: "PUT", body: JSON.stringify({ slots }) },
  );
  return payload.data;
};

export const publishAdminGlobalMediaVersion = async (
  definitionKey: string,
  assignmentSetId: string,
) => {
  const payload = await adminRequest<{ data: AdminGlobalMediaVersion }>(
    `/admin/cms/global-media/${encodeURIComponent(definitionKey)}/versions/${assignmentSetId}/publish`,
    { method: "POST" },
  );
  return payload.data;
};

export const fetchAdminSeoMetadata = async (resourceType: string, resourceId: string) => {
  const payload = await adminRequest<{ data: AdminSeoMetadata | null }>(
    `/admin/cms/seo-metadata/${encodeURIComponent(resourceType)}/${resourceId}`,
  );
  return payload.data;
};

export const saveAdminSeoMetadata = async (
  input: Omit<AdminSeoMetadata, "id" | "createdAt" | "updatedAt">,
) => {
  const payload = await adminRequest<{ data: AdminSeoMetadata }>(
    "/admin/cms/seo-metadata",
    { method: "PUT", body: JSON.stringify(input) },
  );
  return payload.data;
};

export const createAdminPagePreviewToken = async (pageId: string, expiresInSeconds?: number) => {
  const payload = await adminRequest<{
    data: { token: string; pageId: string; slug: string; expiresAt: string };
  }>(`/admin/cms/pages/${pageId}/preview-token`, {
    method: "POST",
    body: JSON.stringify(expiresInSeconds ? { expiresInSeconds } : {}),
  });
  return payload.data;
};

export const fetchGoogleCalendarIntegrationStatus = async () => {
  const payload = await adminRequest<{ data: GoogleCalendarIntegrationStatus }>(
    "/admin/integrations/google-calendar/status",
  );

  return payload.data;
};

export const fetchGoogleCalendarConnectUrl = async () => {
  const payload = await adminRequest<{ data: { url: string } }>(
    "/admin/integrations/google-calendar/connect-url",
  );

  return payload.data.url;
};

export const updateGoogleCalendarSettings = async (input: { calendarId: string }) => {
  const payload = await adminRequest<{
    data: {
      calendarId: string;
      status: GoogleCalendarIntegrationStatus["status"];
    };
  }>("/admin/integrations/google-calendar/settings", {
    method: "PATCH",
    body: JSON.stringify(input),
  });

  return payload.data;
};

export const fetchAdminBookingFormFields = async (
  filters: {
    offeringId?: string | "all";
    status?: AdminOfferingStatus | "all";
  } = {},
) => {
  const params = new URLSearchParams();

  if (filters.offeringId && filters.offeringId !== "all") {
    params.set("offeringId", filters.offeringId);
  }

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  const queryString = params.toString();
  const payload = await adminRequest<{ data: AdminBookingFormField[] }>(
    `/admin/booking-form-fields${queryString ? `?${queryString}` : ""}`,
  );

  return payload.data;
};

export const createAdminBookingFormField = async (
  input: AdminBookingFormFieldPayload,
) => {
  const payload = await adminRequest<{ data: AdminBookingFormField }>(
    "/admin/booking-form-fields",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const updateAdminBookingFormField = async (
  id: string,
  input: Partial<AdminBookingFormFieldPayload>,
) => {
  const payload = await adminRequest<{ data: AdminBookingFormField }>(
    `/admin/booking-form-fields/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const archiveAdminBookingFormField = async (id: string) => {
  await adminRequest<void>(`/admin/booking-form-fields/${id}`, {
    method: "DELETE",
  });
};

export const fetchAdminLocations = async (
  filters: { status?: AdminOfferingStatus | "all"; search?: string } = {},
) => {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  const queryString = params.toString();
  const payload = await adminRequest<{ data: AdminLocation[] }>(
    `/admin/locations${queryString ? `?${queryString}` : ""}`,
  );

  return payload.data;
};

export const createAdminLocation = async (input: AdminLocationPayload) => {
  const payload = await adminRequest<{ data: AdminLocation }>("/admin/locations", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return payload.data;
};

export const updateAdminLocation = async (
  id: string,
  input: Partial<AdminLocationPayload>,
) => {
  const payload = await adminRequest<{ data: AdminLocation }>(
    `/admin/locations/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const archiveAdminLocation = async (id: string) => {
  await adminRequest<void>(`/admin/locations/${id}`, {
    method: "DELETE",
  });
};

export const fetchAdminSessions = async (
  filters: {
    offeringId?: string | "all";
    locationId?: string | "all";
    attendanceMode?: AdminOffering["attendanceMode"] | "all";
    status?: AdminOfferingStatus | "all";
    dateFrom?: string;
    dateTo?: string;
  } = {},
) => {
  const params = new URLSearchParams();

  if (filters.offeringId && filters.offeringId !== "all") {
    params.set("offeringId", filters.offeringId);
  }

  if (filters.locationId && filters.locationId !== "all") {
    params.set("locationId", filters.locationId);
  }

  if (filters.attendanceMode && filters.attendanceMode !== "all") {
    params.set("attendanceMode", filters.attendanceMode);
  }

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.dateFrom?.trim()) {
    params.set("dateFrom", filters.dateFrom.trim());
  }

  if (filters.dateTo?.trim()) {
    params.set("dateTo", filters.dateTo.trim());
  }

  const queryString = params.toString();
  const payload = await adminRequest<{ data: AdminSession[] }>(
    `/admin/sessions${queryString ? `?${queryString}` : ""}`,
  );

  return payload.data;
};

export const createAdminSession = async (input: AdminSessionPayload) => {
  const payload = await adminRequest<{ data: AdminSession }>("/admin/sessions", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return payload.data;
};

export const updateAdminSession = async (
  id: string,
  input: Partial<AdminSessionPayload>,
) => {
  const payload = await adminRequest<{ data: AdminSession }>(
    `/admin/sessions/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const archiveAdminSession = async (id: string) => {
  await adminRequest<void>(`/admin/sessions/${id}`, {
    method: "DELETE",
  });
};

export const fetchAdminBookingPolicy = async () => {
  const payload = await adminRequest<{ data: AdminBookingPolicy }>(
    "/admin/booking-policy",
  );
  return payload.data;
};

export const updateAdminBookingPolicy = async (input: {
  bookingMinimumAdvanceDays: number;
  bookingDefaultTimezone: string;
}) => {
  const payload = await adminRequest<{ data: AdminBookingPolicy }>(
    "/admin/booking-policy",
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return payload.data;
};

export const fetchAdminPrograms = async (
  filters: { offeringId?: string | "all"; status?: AdminProgramStatus | "all"; search?: string } = {},
) => {
  const params = new URLSearchParams();
  if (filters.offeringId && filters.offeringId !== "all") params.set("offeringId", filters.offeringId);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  const query = params.toString();
  const payload = await adminRequest<{ data: AdminProgram[] }>(
    `/admin/programs${query ? `?${query}` : ""}`,
  );
  return payload.data;
};

export const fetchAdminProgram = async (id: string) => {
  const payload = await adminRequest<{ data: AdminProgram }>(`/admin/programs/${id}`);
  return payload.data;
};

export const createAdminProgram = async (input: AdminProgramPayload) => {
  const payload = await adminRequest<{ data: AdminProgram }>("/admin/programs", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.data;
};

export const updateAdminProgram = async (id: string, input: Partial<AdminProgramPayload>) => {
  const payload = await adminRequest<{ data: AdminProgram }>(`/admin/programs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return payload.data;
};

export const publishAdminProgram = async (id: string) => {
  const payload = await adminRequest<{ data: AdminProgram }>(`/admin/programs/${id}/publish`, {
    method: "POST",
  });
  return payload.data;
};

export const retryAdminProgramCalendar = async (id: string) => {
  const payload = await adminRequest<{
    data: AdminProgram;
    calendarSync: Array<{
      occurrenceId: string;
      status: "created" | "updated" | "cancelled" | "failed" | "skipped";
      googleCalendarEventId: string | null;
      meetUrl: string | null;
      error: string | null;
    }>;
  }>(`/admin/programs/${id}/calendar/retry`, { method: "POST" });
  return payload;
};

export const deleteOrArchiveAdminProgram = async (id: string) => {
  await adminRequest<void>(`/admin/programs/${id}`, { method: "DELETE" });
};
