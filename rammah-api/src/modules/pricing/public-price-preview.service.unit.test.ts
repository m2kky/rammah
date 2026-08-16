import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  findPublishedOfferingForPricingById: vi.fn(),
  findPublishedPriceGroupForCountry: vi.fn(),
}));

vi.mock("./public-price-preview.repository.js", () => repositoryMocks);

import { previewPublicOfferingPrice } from "./public-price-preview.service.js";

const offering = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Coaching",
  slug: "coaching",
  bookingMode: "paid",
  requiresPayment: true,
  quoteOnly: false,
};

const price = (countryCode: string) => ({
  id: `price-${countryCode}`,
  offeringId: offering.id,
  name: countryCode === "EG" ? "Egypt" : "Saudi Arabia",
  countryCode,
  currency: countryCode === "EG" ? "EGP" : "SAR",
  baseAmountMinor: 10_000,
  earlyBirdAmountMinor: null,
  earlyBirdEndsAt: null,
});

describe("public price country enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositoryMocks.findPublishedOfferingForPricingById.mockResolvedValue(offering);
  });

  it("uses the exact detected-country group and exposes a seven-field expectation", async () => {
    repositoryMocks.findPublishedPriceGroupForCountry.mockResolvedValue(price("EG"));

    const result = await previewPublicOfferingPrice({
      offeringId: offering.id,
      detectedCountryCode: "EG",
    }, new Date("2030-08-01T00:00:00.000Z"));

    expect(result).toMatchObject({
      resolvedCountryCode: "EG",
      priceGroup: { id: "price-EG", name: "Egypt" },
      expectedPrice: {
        priceId: "price-EG",
        countryCode: "EG",
        currency: "EGP",
        baseAmountMinor: 10_000,
        discountAmountMinor: 0,
        taxAmountMinor: 0,
        totalAmountMinor: 10_000,
      },
    });
    expect(result).not.toHaveProperty("requestedCountryCode");
    expect(result).not.toHaveProperty("detectedCountryCode");
    expect(result).not.toHaveProperty("countrySource");
    expect(result).not.toHaveProperty("fallbackApplied");
    expect(repositoryMocks.findPublishedPriceGroupForCountry).toHaveBeenCalledWith(
      expect.objectContaining({ offeringId: offering.id, countryCode: "EG", lock: false }),
    );
  });

  it("refuses payment pricing when the detected country has no configured price", async () => {
    repositoryMocks.findPublishedPriceGroupForCountry.mockResolvedValue(null);

    await expect(
      previewPublicOfferingPrice({
        offeringId: offering.id,
        detectedCountryCode: "SA",
      }),
    ).rejects.toMatchObject({
      code: "COUNTRY_PRICE_UNAVAILABLE",
      statusCode: 422,
    });
  });

  it("does not query another price when detection is unavailable", async () => {
    await expect(
      previewPublicOfferingPrice({ offeringId: offering.id, detectedCountryCode: null }),
    ).rejects.toMatchObject({ code: "COUNTRY_PRICE_UNAVAILABLE", statusCode: 422 });
    expect(repositoryMocks.findPublishedPriceGroupForCountry).not.toHaveBeenCalled();
  });

  it("rejects inconsistent offerings that are not explicitly configured as paid", async () => {
    repositoryMocks.findPublishedOfferingForPricingById.mockResolvedValue({
      ...offering,
      bookingMode: "free",
      requiresPayment: true,
    });

    await expect(
      previewPublicOfferingPrice({ offeringId: offering.id, detectedCountryCode: "EG" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
    expect(repositoryMocks.findPublishedPriceGroupForCountry).not.toHaveBeenCalled();
  });
});
