import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  findPublishedOfferingForPricingById,
  findPublishedPricesForOffering,
} from "./public-price-preview.repository.js";

const defaultCountryCode = "EG";

export type PublicPricePreviewInput = {
  offeringId: string;
  countryCode?: string | null;
  detectedCountryCode?: string | null;
  couponCode?: string | null;
};

type PriceRow = Awaited<ReturnType<typeof findPublishedPricesForOffering>>[number];

const normalizeCountryCode = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase();

  if (!normalized) return null;

  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
};

const normalizeCouponCode = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
};

const isEarlyBirdActive = (price: PriceRow, now: Date) =>
  price.earlyBirdAmountMinor !== null &&
  price.earlyBirdAmountMinor < price.baseAmountMinor &&
  (!price.earlyBirdEndsAt || price.earlyBirdEndsAt.getTime() >= now.getTime());

const selectPrice = (prices: PriceRow[], targetCountryCode: string) => {
  const exactPrice = prices.find((price) => price.countryCode === targetCountryCode);

  if (exactPrice) {
    return exactPrice;
  }

  const defaultPrice = prices.find((price) => price.countryCode === defaultCountryCode);

  return defaultPrice ?? prices[0] ?? null;
};

export const previewPublicOfferingPrice = async (input: PublicPricePreviewInput) => {
  const offering = await findPublishedOfferingForPricingById(input.offeringId);

  if (!offering) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (offering.bookingMode === "quote_only" || offering.quoteOnly) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Quote-only offerings do not expose public prices.",
      statusCode: httpStatus.badRequest,
      details: [{ field: "offeringId", message: "Select a paid offering." }],
    });
  }

  if (offering.bookingMode !== "paid" && !offering.requiresPayment) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "This offering does not require payment.",
      statusCode: httpStatus.badRequest,
      details: [{ field: "offeringId", message: "Select a paid offering." }],
    });
  }

  const prices = await findPublishedPricesForOffering(offering.id);

  if (prices.length === 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "No published price is available for this offering.",
      statusCode: httpStatus.notFound,
    });
  }

  const manualCountryCode = normalizeCountryCode(input.countryCode);
  const detectedCountryCode = normalizeCountryCode(input.detectedCountryCode);
  const requestedCountryCode = manualCountryCode ?? detectedCountryCode ?? defaultCountryCode;
  const countrySource = manualCountryCode ? "manual" : detectedCountryCode ? "detected" : "default";
  const selectedPrice = selectPrice(prices, requestedCountryCode);

  if (!selectedPrice) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "No published price is available for this offering.",
      statusCode: httpStatus.notFound,
    });
  }

  const now = new Date();
  const earlyBirdApplied = isEarlyBirdActive(selectedPrice, now);
  const amountMinor = earlyBirdApplied
    ? selectedPrice.earlyBirdAmountMinor ?? selectedPrice.baseAmountMinor
    : selectedPrice.baseAmountMinor;
  const couponCode = normalizeCouponCode(input.couponCode);

  return {
    offering: {
      id: offering.id,
      title: offering.title,
      slug: offering.slug,
      bookingMode: offering.bookingMode,
    },
    requestedCountryCode,
    detectedCountryCode,
    resolvedCountryCode: selectedPrice.countryCode,
    countrySource,
    fallbackApplied: selectedPrice.countryCode !== requestedCountryCode,
    price: {
      priceId: selectedPrice.id,
      countryCode: selectedPrice.countryCode,
      currency: selectedPrice.currency,
      baseAmountMinor: selectedPrice.baseAmountMinor,
      amountMinor,
      earlyBirdAmountMinor: selectedPrice.earlyBirdAmountMinor,
      earlyBirdEndsAt: selectedPrice.earlyBirdEndsAt?.toISOString() ?? null,
      earlyBirdApplied,
      discountAmountMinor: 0,
      taxAmountMinor: 0,
      totalAmountMinor: amountMinor,
    },
    coupon: couponCode
      ? {
          code: couponCode,
          status: "not_applied",
          reason: "Coupon validation is pending for the payment slice.",
        }
      : null,
    generatedAt: now.toISOString(),
  };
};
