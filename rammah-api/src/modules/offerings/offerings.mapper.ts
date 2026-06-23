import type { PublicOffering, PublicOfferingPrice } from "./offerings.types.js";
import type { OfferingRow } from "./offerings.repository.js";

type PriceRow = {
  offeringId: string;
  countryCode: string;
  currency: string;
  baseAmountMinor: number;
  earlyBirdAmountMinor: number | null;
  earlyBirdEndsAt: Date | null;
};

const toPrice = (price: PriceRow): PublicOfferingPrice => ({
  countryCode: price.countryCode,
  currency: price.currency,
  baseAmountMinor: price.baseAmountMinor,
  earlyBirdAmountMinor: price.earlyBirdAmountMinor,
  earlyBirdEndsAt: price.earlyBirdEndsAt?.toISOString() ?? null,
});

export const toPublicOffering = (
  offering: OfferingRow,
  prices: PriceRow[],
): PublicOffering => {
  const colors = {
    background: offering.displayConfig.backgroundColor ?? "#0F3B46",
    text: offering.displayConfig.textColor ?? "#FFFFFF",
  };

  return {
    id: offering.id,
    slug: offering.slug,
    title: offering.title,
    subtitle: offering.shortDescription,
    description: offering.longDescription,
    category: offering.categoryId
      ? {
          id: offering.categoryId,
          name: offering.categoryName ?? "",
          slug: offering.categorySlug ?? "",
        }
      : null,
    offeringType: offering.offeringType,
    attendanceMode: offering.attendanceMode,
    bookingMode: offering.bookingMode,
    durationMinutes: offering.durationMinutes,
    capacity: offering.capacity,
    requiresPayment: offering.requiresPayment,
    quoteOnly: offering.quoteOnly,
    colors,
    prices: prices.map(toPrice),
  };
};
