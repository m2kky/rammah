import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { offeringPriceCountries, offerings } from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import { createAdminOfferingPrice } from "../offerings/admin-offerings.service.js";
import { findPublishedPriceGroupForCountry } from "./public-price-preview.repository.js";
import { previewPublicOfferingPrice } from "./public-price-preview.service.js";

const seedPaidOffering = async () => {
  const [offering] = await getTestDatabase().db
    .insert(offerings)
    .values({
      title: "Strict country pricing",
      slug: `strict-country-${crypto.randomUUID()}`,
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode: "paid",
      schedulingMode: "appointment",
      durationMinutes: 60,
      requiresPayment: true,
      status: "published",
    })
    .returning();
  return offering!;
};

describe.sequential("public country price resolution", () => {
  it("uses active memberships rather than the legacy header country and never falls back", async () => {
    const offering = await seedPaidOffering();
    const group = await createAdminOfferingPrice(offering.id, {
      name: "GCC",
      countryCodes: ["AE", "SA"],
      currency: "EGP",
      baseAmountMinor: 15_000,
      status: "published",
    });

    await expect(
      findPublishedPriceGroupForCountry({ offeringId: offering.id, countryCode: "SA" }),
    ).resolves.toMatchObject({ id: group.id, name: "GCC", countryCode: "SA" });
    await expect(
      getTestDatabase().db.transaction((tx) =>
        findPublishedPriceGroupForCountry({
          offeringId: offering.id,
          countryCode: "SA",
          executor: tx,
          lock: true,
        }),
      ),
    ).resolves.toMatchObject({ id: group.id, countryCode: "SA" });
    await expect(
      previewPublicOfferingPrice({ offeringId: offering.id, detectedCountryCode: "US" }),
    ).rejects.toMatchObject({ code: "COUNTRY_PRICE_UNAVAILABLE", statusCode: 422 });

    await getTestDatabase().db
      .update(offeringPriceCountries)
      .set({ active: false })
      .where(
        eq(offeringPriceCountries.priceId, group.id),
      );
    await expect(
      findPublishedPriceGroupForCountry({ offeringId: offering.id, countryCode: "SA" }),
    ).resolves.toBeNull();
  });
});
