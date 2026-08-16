import { describe, expect, it } from "vitest";
import { createPaidBookingBodySchema } from "./public-payments.routes.js";

const validBody = {
  holdId: "11111111-1111-4111-8111-111111111111",
  holdToken: "owned-hold-token",
  customer: { fullName: "Paid Customer", email: "paid@example.test" },
  timezone: "Africa/Cairo",
  answers: [],
  expectedPrice: {
    priceId: "22222222-2222-4222-8222-222222222222",
    countryCode: "EG",
    currency: "EGP",
    baseAmountMinor: 25_000,
    discountAmountMinor: 0,
    taxAmountMinor: 0,
    totalAmountMinor: 25_000,
  },
};

describe("paid booking confirmation route contract", () => {
  it("requires the exact seven-field expected price and accepts no customer country", () => {
    expect(createPaidBookingBodySchema.safeParse(validBody).success).toBe(true);
    const { expectedPrice: _expectedPrice, ...withoutExpectedPrice } = validBody;
    expect(createPaidBookingBodySchema.safeParse(withoutExpectedPrice).success).toBe(false);
    expect(
      createPaidBookingBodySchema.safeParse({ ...validBody, countryCode: "SA" }).data,
    ).not.toHaveProperty("countryCode");
  });

  it("rejects missing, extra, negative, or malformed expectation fields", () => {
    const { taxAmountMinor: _tax, ...missingTax } = validBody.expectedPrice;
    expect(
      createPaidBookingBodySchema.safeParse({ ...validBody, expectedPrice: missingTax }).success,
    ).toBe(false);
    expect(
      createPaidBookingBodySchema.safeParse({
        ...validBody,
        expectedPrice: { ...validBody.expectedPrice, extra: 1 },
      }).success,
    ).toBe(false);
    expect(
      createPaidBookingBodySchema.safeParse({
        ...validBody,
        expectedPrice: { ...validBody.expectedPrice, totalAmountMinor: -1 },
      }).success,
    ).toBe(false);
  });
});
