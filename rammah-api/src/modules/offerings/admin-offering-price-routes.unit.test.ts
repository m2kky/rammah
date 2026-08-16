import { describe, expect, it } from "vitest";
import {
  adminOfferingPriceBodySchema,
  adminOfferingPricePatchSchema,
} from "./admin-offerings.routes.js";

describe("admin offering price route contract", () => {
  it("accepts a new group or the legacy one-country field", () => {
    expect(
      adminOfferingPriceBodySchema.safeParse({
        name: "GCC",
        countryCodes: ["SA", "AE"],
        currency: "EGP",
        baseAmountMinor: 10_000,
      }).success,
    ).toBe(true);
    expect(
      adminOfferingPriceBodySchema.safeParse({
        countryCode: "EG",
        currency: "EGP",
        baseAmountMinor: 10_000,
      }).success,
    ).toBe(true);
  });

  it("rejects both country forms and archived/scheduled writes", () => {
    expect(
      adminOfferingPriceBodySchema.safeParse({
        name: "Mixed",
        countryCode: "EG",
        countryCodes: ["SA"],
        currency: "EGP",
        baseAmountMinor: 10_000,
      }).success,
    ).toBe(false);
    for (const status of ["archived", "scheduled"]) {
      expect(
        adminOfferingPricePatchSchema.safeParse({ status }).success,
      ).toBe(false);
    }
  });
});
