import { describe, expect, it } from "vitest";
import {
  calculateEffectivePrice,
  compareExpectedPrice,
  toExpectedPrice,
} from "./pricing-resolution.js";

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  offeringId: "22222222-2222-4222-8222-222222222222",
  name: "GCC",
  countryCode: "SA",
  currency: "SAR",
  baseAmountMinor: 15_000,
  earlyBirdAmountMinor: 12_000,
  earlyBirdEndsAt: new Date("2030-09-01T20:59:59.000Z"),
};

describe("shared pricing resolution", () => {
  it("applies early booking through its exact boundary and calculates the discount", () => {
    expect(calculateEffectivePrice(row, new Date("2030-09-01T20:59:59.000Z"))).toMatchObject({
      amountMinor: 12_000,
      earlyBirdApplied: true,
      discountAmountMinor: 3_000,
      taxAmountMinor: 0,
      totalAmountMinor: 12_000,
    });
    expect(calculateEffectivePrice(row, new Date("2030-09-01T20:59:59.001Z"))).toMatchObject({
      amountMinor: 15_000,
      earlyBirdApplied: false,
      discountAmountMinor: 0,
      totalAmountMinor: 15_000,
    });
  });

  it("returns the exact seven-field client expectation", () => {
    const current = calculateEffectivePrice(row, new Date("2030-08-01T00:00:00.000Z"));
    expect(toExpectedPrice(current)).toEqual({
      priceId: row.id,
      countryCode: "SA",
      currency: "SAR",
      baseAmountMinor: 15_000,
      discountAmountMinor: 3_000,
      taxAmountMinor: 0,
      totalAmountMinor: 12_000,
    });
  });

  it("compares every expectation field", () => {
    const expected = toExpectedPrice(
      calculateEffectivePrice(row, new Date("2030-08-01T00:00:00.000Z")),
    );
    expect(compareExpectedPrice(expected, expected)).toBe(true);

    for (const field of Object.keys(expected) as Array<keyof typeof expected>) {
      const changed = {
        ...expected,
        [field]: typeof expected[field] === "number"
          ? (expected[field] as number) + 1
          : `${expected[field]}-changed`,
      };
      expect(compareExpectedPrice(expected, changed), field).toBe(false);
    }
  });
});
