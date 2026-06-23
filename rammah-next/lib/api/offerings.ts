import { apiBaseUrl } from "./config";
import type { ServiceCard } from "@/data/servicesFallback";

export type PublicOfferingPrice = {
  countryCode: string;
  currency: string;
  baseAmountMinor: number;
  earlyBirdAmountMinor: number | null;
  earlyBirdEndsAt: string | null;
};

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
  durationMinutes: number;
  capacity: number;
  requiresPayment: boolean;
  quoteOnly: boolean;
  colors: {
    background: string;
    text: string;
  };
  prices: PublicOfferingPrice[];
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
    offering: PublicOffering;
    fields: PublicBookingFormField[];
    locations: PublicOfferingLocation[];
  };
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
