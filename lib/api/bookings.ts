import { apiBaseUrl } from "./config";
import type { PublicOffering } from "./offerings";

export type PublicAvailabilitySlotStatus = "available" | "blocked" | "booked" | "held";
export type PublicAvailabilitySlotSource = "rule" | "available_override";

export type PublicAvailabilitySlot = {
  date: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: PublicAvailabilitySlotStatus;
  source: PublicAvailabilitySlotSource;
  availabilityRuleId: string | null;
  availabilityOverrideId: string | null;
  remainingCapacity: number;
  bookedCount: number;
  heldCount: number;
  blockedReason: string | null;
};

export type PublicAvailabilitySlotPreview = {
  offering: {
    id: string;
    title: string;
    slug: string;
    capacity: number;
    durationMinutes: number;
    status: string;
  };
  dateFrom: string;
  dateTo: string;
  days: Array<{
    date: string;
    weekday: number;
    slots: PublicAvailabilitySlot[];
    availableCount: number;
    totalCount: number;
  }>;
  availableCount: number;
  totalCount: number;
  generatedAt: string;
};

export type PublicSlotHold = {
  id: string;
  offeringId: string;
  offeringSessionId: string | null;
  startsAt: string;
  endsAt: string;
  status: "active" | "expired" | "released" | "converted";
  expiresAt: string;
  createdAt: string;
};

export type PublicOfferingSession = {
  id: string;
  offering: {
    id: string;
    title: string;
    slug: string;
  };
  date: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: number;
  attendanceMode: PublicOffering["attendanceMode"];
  location: {
    id: string;
    name: string | null;
    city: string | null;
    countryCode: string | null;
  } | null;
  status: "available" | "booked";
  remainingCapacity: number;
  bookedCount: number;
  heldCount: number;
};

export type PublicOfferingSessionPreview = {
  offeringId: string;
  dateFrom: string;
  dateTo: string;
  sessions: PublicOfferingSession[];
  generatedAt: string;
};

export type PublicBooking = {
  id: string;
  publicToken: string;
  offering: {
    id: string;
    title: string;
    slug: string;
  };
  attendanceMode: PublicOffering["attendanceMode"];
  status: string;
  customer: {
    fullName: string;
    email: string;
    phone: string | null;
  };
  countryCode: string | null;
  slot: {
    startsAt: string | null;
    endsAt: string | null;
    timezone: string;
  };
  paymentRequired: boolean;
  calendar: {
    status: "pending" | "created" | "updated" | "cancelled" | "failed";
    meetUrl: string | null;
    lastError: string | null;
  } | null;
  confirmedAt: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type PublicPayment = {
  id: string;
  provider: "kashier" | string;
  status:
    | "created"
    | "pending"
    | "processing"
    | "paid"
    | "failed"
    | "abandoned"
    | "cancelled"
    | "expired"
    | "refunded";
  currency: string;
  amountMinor: number;
  checkoutUrl: string | null;
  merchantOrderId: string | null;
  paidAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicPaymentSession = {
  provider: "kashier";
  mode: "test" | "live";
  scriptUrl: string;
  checkoutUrl: string;
  iframe: {
    amount: string;
    currency: string;
    hash: string;
    merchantId: string;
    merchantOrderId: string;
    allowedMethods: string;
    merchantRedirect: string;
    display: string;
    store: string;
    type: string;
  };
};

export type PublicPaidBookingResult = {
  booking: PublicBooking;
  payment: PublicPayment;
  paymentSession: PublicPaymentSession;
};

export type PublicPaymentSessionResult = {
  booking: {
    id: string;
    publicToken: string;
    offering: {
      id: string;
      title: string;
      slug: string;
    };
    status: string;
    paymentRequired: boolean;
  };
  payment: PublicPayment;
  paymentSession: PublicPaymentSession;
};

export type PublicPaymentReconciliationResult = {
  booking: {
    id: string;
    publicToken: string;
    offering: {
      id: string;
      title: string;
      slug: string;
    };
    status: string;
    paymentRequired: boolean;
  };
  payment: PublicPayment;
  reconciliation: {
    provider: "kashier";
    status: string | null;
    amountMatches: boolean;
    currencyMatches: boolean;
  };
};

export type PublicQuoteRequest = {
  id: string;
  offering: {
    id: string;
    title: string;
    slug: string;
  } | null;
  status: "new" | "reviewing" | "contacted" | "won" | "lost" | "archived";
  fullName: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  participantsCount: number | null;
  preferredDate: string | null;
  message: string | null;
  createdAt: string;
};

export type PublicPricePreview = {
  offering: {
    id: string;
    title: string;
    slug: string;
    bookingMode: PublicOffering["bookingMode"];
  };
  requestedCountryCode: string;
  detectedCountryCode: string | null;
  resolvedCountryCode: string;
  countrySource: "manual" | "detected" | "default";
  fallbackApplied: boolean;
  price: {
    priceId: string;
    countryCode: string;
    currency: string;
    baseAmountMinor: number;
    amountMinor: number;
    earlyBirdAmountMinor: number | null;
    earlyBirdEndsAt: string | null;
    earlyBirdApplied: boolean;
    discountAmountMinor: number;
    taxAmountMinor: number;
    totalAmountMinor: number;
  };
  coupon: {
    code: string;
    status: "not_applied";
    reason: string;
  } | null;
  generatedAt: string;
};

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class PublicApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(input: { status: number; code: string; message: string }) {
    super(input.message);
    this.name = "PublicApiError";
    this.status = input.status;
    this.code = input.code;
  }
}

const readJson = async <T>(response: Response): Promise<T | null> => {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : null;
};

const publicRequest = async <T>(path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const payload = await readJson<T & ApiErrorPayload>(response);

  if (!response.ok) {
    throw new PublicApiError({
      status: response.status,
      code: payload?.error?.code ?? "REQUEST_FAILED",
      message: payload?.error?.message ?? "Request failed.",
    });
  }

  if (!payload) {
    throw new PublicApiError({
      status: response.status,
      code: "EMPTY_RESPONSE",
      message: "The API returned an empty response.",
    });
  }

  return payload;
};

export const fetchPublicAvailabilitySlots = async (input: {
  offeringId: string;
  dateFrom: string;
  dateTo: string;
}) => {
  const params = new URLSearchParams({
    offeringId: input.offeringId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });

  const payload = await publicRequest<{ data: PublicAvailabilitySlotPreview }>(
    `/public/availability-slots?${params.toString()}`,
  );

  return payload.data;
};

export const createPublicSlotHold = async (input: {
  offeringId: string;
  offeringSessionId?: string | null;
  startsAt: string;
  endsAt: string;
}) => {
  const payload = await publicRequest<{ data: PublicSlotHold }>("/public/slot-holds", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return payload.data;
};

export const fetchPublicOfferingSessions = async (input: {
  offeringId: string;
  dateFrom: string;
  dateTo: string;
}) => {
  const params = new URLSearchParams({
    offeringId: input.offeringId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });

  const payload = await publicRequest<{ data: PublicOfferingSessionPreview }>(
    `/public/sessions?${params.toString()}`,
  );

  return payload.data;
};

export const fetchPublicPricePreview = async (input: {
  offeringId: string;
  countryCode?: string | null;
  couponCode?: string | null;
}) => {
  const payload = await publicRequest<{ data: PublicPricePreview }>(
    "/public/booking/price-preview",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return payload.data;
};

export const submitPublicFreeBooking = async (input: {
  holdId: string;
  attendanceMode?: PublicOffering["attendanceMode"];
  customer: {
    fullName: string;
    email: string;
    phone?: string | null;
  };
  countryCode?: string | null;
  timezone: string;
  answers?: Array<{
    fieldId?: string | null;
    fieldKey: string;
    label: string;
    value?: string | null;
  }>;
}) => {
  const payload = await publicRequest<{ data: PublicBooking }>("/public/bookings", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      answers: input.answers ?? [],
    }),
  });

  return payload.data;
};

export const submitPublicPaidBooking = async (input: {
  holdId: string;
  attendanceMode?: PublicOffering["attendanceMode"];
  customer: {
    fullName: string;
    email: string;
    phone?: string | null;
  };
  countryCode?: string | null;
  timezone: string;
  answers?: Array<{
    fieldId?: string | null;
    fieldKey: string;
    label: string;
    value?: string | null;
  }>;
}) => {
  const payload = await publicRequest<{ data: PublicPaidBookingResult }>(
    "/public/payments/paid-bookings",
    {
      method: "POST",
      body: JSON.stringify({
        ...input,
        answers: input.answers ?? [],
      }),
    },
  );

  return payload.data;
};

export const fetchPublicBookingStatus = async (publicToken: string) => {
  const payload = await publicRequest<{ data: PublicBooking }>(
    `/public/bookings/${encodeURIComponent(publicToken)}/status`,
  );

  return payload.data;
};

export const fetchPublicPaymentSession = async (publicToken: string) => {
  const payload = await publicRequest<{ data: PublicPaymentSessionResult }>(
    `/public/payments/bookings/${encodeURIComponent(publicToken)}/payment-session`,
  );

  return payload.data;
};

export const startPublicPaymentForBooking = async (publicToken: string) => {
  const payload = await publicRequest<{ data: PublicPaymentSessionResult }>(
    `/public/payments/bookings/${encodeURIComponent(publicToken)}/start`,
    {
      method: "POST",
    },
  );

  return payload.data;
};

export const reconcilePublicPayment = async (publicToken: string) => {
  const payload = await publicRequest<{ data: PublicPaymentReconciliationResult }>(
    `/public/payments/bookings/${encodeURIComponent(publicToken)}/reconcile`,
    {
      method: "POST",
    },
  );

  return payload.data;
};

export const submitPublicQuoteRequest = async (input: {
  offeringId?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  companyName?: string | null;
  participantsCount?: number | null;
  preferredDate?: string | null;
  message?: string | null;
}) => {
  const payload = await publicRequest<{ data: PublicQuoteRequest }>("/public/quote-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return payload.data;
};
