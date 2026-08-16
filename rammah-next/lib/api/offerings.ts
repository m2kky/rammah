import { apiBaseUrl } from "./config";
import type { ServiceCard } from "@/data/servicesFallback";

export type PublicOfferingLocation = {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  countryCode: string;
  mapUrl: string | null;
  instructions: string | null;
};

export type PublicOffering = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  offeringType: string;
  attendanceMode: "online" | "offline" | "hybrid";
  bookingMode: "free" | "paid" | "quote_only";
  schedulingMode: "appointment" | "scheduled_program";
  durationMinutes: number | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  capacity: number;
  requiresPayment: boolean;
  quoteOnly: boolean;
  colors: {
    background: string;
    text: string;
  };
};

export type PublicSchedulingMode = "appointment" | "scheduled_program";

export type PublicBookingOffering = PublicOffering & {
  schedulingTimezone: string;
};

export type PublicBookingFormField = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType:
    | "text"
    | "email"
    | "phone"
    | "textarea"
    | "date"
    | "select"
    | "checkbox"
    | "number";
  required: boolean;
  options: Array<{ label: string; value: string }>;
  validationRules: Record<string, unknown>;
  sortOrder: number;
};

type OfferingsResponse = {
  data: PublicOffering[];
};

type OfferingResponse = {
  data: PublicOffering;
};

type BookingConfigResponse = {
  data: {
    offering: PublicBookingOffering;
    fields: PublicBookingFormField[];
    locations: PublicOfferingLocation[];
  };
};

export const filterOfferingLocationsByCountry = (
  locations: readonly PublicOfferingLocation[],
  countryCode: string,
) => {
  const normalized = countryCode.trim().toUpperCase();
  return normalized
    ? locations.filter((location) => location.countryCode.toUpperCase() === normalized)
    : [...locations];
};

export type PublicCountryContext = {
  countryCode: string | null;
  detectedCountryCode: string | null;
  source: "header" | "geoip" | null;
};

type CountryContextResponse = {
  data: PublicCountryContext;
};

const toServiceCard = (offering: PublicOffering): ServiceCard => ({
  slug: offering.slug,
  title: offering.title,
  subtitle: offering.subtitle ?? "",
  desc: offering.description ?? "",
  bg: offering.colors.background,
  text: offering.colors.text,
});

export const fetchPublicOfferingRecords = async (signal?: AbortSignal) => {
  const response = await fetch(`${apiBaseUrl}/public/offerings`, {
    method: "GET",
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch offerings: ${response.status}`);
  }

  const payload = (await response.json()) as OfferingsResponse;

  if (!Array.isArray(payload.data)) {
    throw new Error("Invalid offerings response.");
  }

  return payload.data;
};

export const fetchPublicOfferings = async (signal?: AbortSignal) => {
  const offerings = await fetchPublicOfferingRecords(signal);

  return offerings.map(toServiceCard);
};

export const fetchPublicCountryContext = async (signal?: AbortSignal) => {
  const response = await fetch(`${apiBaseUrl}/public/country`, {
    method: "GET",
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to detect country: ${response.status}`);
  }

  const payload = (await response.json()) as CountryContextResponse;

  const data = payload.data;
  const isResolved =
    typeof data?.countryCode === "string" &&
    data.countryCode.length === 2 &&
    data.detectedCountryCode === data.countryCode &&
    (data.source === "header" || data.source === "geoip");
  const isUnresolved =
    data?.countryCode === null &&
    data.detectedCountryCode === null &&
    data.source === null;

  if (!isResolved && !isUnresolved) {
    throw new Error("Invalid country context response.");
  }

  return data;
};

export const fetchPublicOffering = async (slug: string, signal?: AbortSignal) => {
  const response = await fetch(`${apiBaseUrl}/public/offerings/${slug}`, {
    method: "GET",
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch offering: ${response.status}`);
  }

  const payload = (await response.json()) as OfferingResponse;

  if (!payload.data?.id) {
    throw new Error("Invalid offering response.");
  }

  return payload.data;
};

export const fetchPublicOfferingBookingConfig = async (
  offeringId: string,
  signal?: AbortSignal,
) => {
  const response = await fetch(`${apiBaseUrl}/public/offerings/${offeringId}/booking-config`, {
    method: "GET",
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch booking config: ${response.status}`);
  }

  const payload = (await response.json()) as BookingConfigResponse;

  if (
    !payload.data?.offering?.id ||
    !Array.isArray(payload.data.fields) ||
    !Array.isArray(payload.data.locations)
  ) {
    throw new Error("Invalid booking config response.");
  }

  return payload.data;
};
