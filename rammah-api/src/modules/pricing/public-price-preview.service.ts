import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  findPublishedOfferingForPricingById,
  findPublishedPriceGroupForCountry,
} from "./public-price-preview.repository.js";
import { isIsoCountryCode } from "../../shared/geo/countries.js";
import {
  calculateEffectivePrice,
  toPublicPriceDetails,
} from "./pricing-resolution.js";

export type PublicPricePreviewInput = {
  offeringId: string;
  detectedCountryCode?: string | null;
  couponCode?: string | null;
};

const normalizeCountryCode = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase();

  return normalized && isIsoCountryCode(normalized) ? normalized : null;
};

const normalizeCouponCode = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase();
  return normalized || null;
};

export const previewPublicOfferingPrice = async (
  input: PublicPricePreviewInput,
  now = new Date(),
) => {
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

  if (offering.bookingMode !== "paid" || !offering.requiresPayment) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "This offering does not require payment.",
      statusCode: httpStatus.badRequest,
      details: [{ field: "offeringId", message: "Select a paid offering." }],
    });
  }

  const detectedCountryCode = normalizeCountryCode(input.detectedCountryCode);
  if (!detectedCountryCode) {
    throw new AppError({
      code: "COUNTRY_PRICE_UNAVAILABLE",
      message: "Pricing is not available in your country.",
      statusCode: httpStatus.unprocessableEntity,
    });
  }

  const selectedPrice = await findPublishedPriceGroupForCountry({
    offeringId: offering.id,
    countryCode: detectedCountryCode,
    lock: false,
  });

  if (!selectedPrice) {
    throw new AppError({
      code: "COUNTRY_PRICE_UNAVAILABLE",
      message: "Pricing is not available in your country.",
      statusCode: httpStatus.unprocessableEntity,
    });
  }

  const effectivePrice = calculateEffectivePrice(selectedPrice, now);
  const couponCode = normalizeCouponCode(input.couponCode);

  return {
    offering: {
      id: offering.id,
      title: offering.title,
      slug: offering.slug,
      bookingMode: offering.bookingMode,
    },
    ...toPublicPriceDetails(effectivePrice),
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
