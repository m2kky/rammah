import { describe, expect, it } from "vitest";
import { offerings } from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import { createAdminOfferingPrice } from "./admin-offerings.service.js";
import {
  getPublicOfferingBookingConfig,
  getPublicOfferingBySlug,
  listPublicOfferings,
} from "./offerings.service.js";

describe.sequential("public offering pricing privacy", () => {
  it("does not expose the country price matrix in list, detail, or booking config", async () => {
    const [offering] = await getTestDatabase().db
      .insert(offerings)
      .values({
        title: "Private price matrix",
        slug: `private-prices-${crypto.randomUUID()}`,
        offeringType: "coaching",
        attendanceMode: "online",
        bookingMode: "paid",
        schedulingMode: "appointment",
        durationMinutes: 60,
        requiresPayment: true,
        status: "published",
      })
      .returning();
    await createAdminOfferingPrice(offering!.id, {
      name: "GCC",
      countryCodes: ["AE", "SA"],
      currency: "EGP",
      baseAmountMinor: 15_000,
      status: "published",
    });

    const listItem = (await listPublicOfferings()).find(({ id }) => id === offering!.id);
    const detail = await getPublicOfferingBySlug(offering!.slug);
    const bookingConfig = await getPublicOfferingBookingConfig(offering!.id);

    expect(listItem).not.toHaveProperty("prices");
    expect(detail).not.toHaveProperty("prices");
    expect(bookingConfig.offering).not.toHaveProperty("prices");
  });
});
