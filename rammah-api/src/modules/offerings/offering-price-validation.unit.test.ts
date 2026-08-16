import { describe, expect, it } from "vitest";
import {
  assertAdminPriceWritesEnabled,
  normalizeAdminOfferingPriceInput,
  validatePublishedPaidPrice,
  validateEarlyBookingPrice,
} from "./admin-offerings.service.js";

describe("early-booking price validation", () => {
  it("requires amount and expiry together", () => {
    expect(() => validateEarlyBookingPrice(10_000, 8_000, null)).toThrowError(
      /amount and expiry/i,
    );
    expect(() => validateEarlyBookingPrice(10_000, null, new Date())).toThrowError(
      /amount and expiry/i,
    );
  });

  it("requires the early-booking price to be lower than the standard price", () => {
    expect(() => validateEarlyBookingPrice(10_000, 10_000, new Date())).toThrowError(
      /lower than/i,
    );
  });

  it("allows no discount or a complete lower discount", () => {
    expect(() => validateEarlyBookingPrice(10_000, null, null)).not.toThrow();
    expect(() => validateEarlyBookingPrice(10_000, 8_000, new Date())).not.toThrow();
  });

  it("rejects a zero early-booking amount when the group is published", () => {
    expect(() =>
      normalizeAdminOfferingPriceInput(
        {
          name: "Egypt",
          countryCodes: ["EG"],
          currency: "EGP",
          baseAmountMinor: 10_000,
          earlyBirdAmountMinor: 0,
          earlyBirdEndsAt: "2030-01-01T00:00:00.000Z",
          status: "published",
        },
        ["EGP"],
      ),
    ).toThrowError(/greater than zero/i);
  });
});

describe("admin price-group input validation", () => {
  const supportedCurrencies = ["EGP", "USD"];

  it("normalizes a named one-or-many country group", () => {
    expect(
      normalizeAdminOfferingPriceInput(
        {
          name: "  GCC  ",
          countryCodes: ["sa", "AE", "sa"],
          currency: "usd",
          baseAmountMinor: 15_000,
          status: "published",
        },
        supportedCurrencies,
      ),
    ).toMatchObject({
      name: "GCC",
      countryCodes: ["AE", "SA"],
      countryCode: "AE",
      currency: "USD",
      status: "published",
    });
  });

  it("accepts legacy countryCode only when countryCodes is absent", () => {
    expect(
      normalizeAdminOfferingPriceInput(
        {
          countryCode: "eg",
          currency: "egp",
          baseAmountMinor: 10_000,
          status: "draft",
        },
        supportedCurrencies,
      ),
    ).toMatchObject({
      name: "Egypt",
      countryCodes: ["EG"],
      countryCode: "EG",
      currency: "EGP",
    });
  });

  it.each([
    {
      name: "Both forms",
      countryCode: "EG",
      countryCodes: ["SA"],
      currency: "EGP",
      baseAmountMinor: 100,
      status: "draft",
    },
    {
      name: "Unknown country",
      countryCodes: ["XX"],
      currency: "EGP",
      baseAmountMinor: 100,
      status: "draft",
    },
    {
      name: "Unsupported currency",
      countryCodes: ["EG"],
      currency: "SAR",
      baseAmountMinor: 100,
      status: "draft",
    },
    {
      name: "Archived mutation",
      countryCodes: ["EG"],
      currency: "EGP",
      baseAmountMinor: 100,
      status: "archived",
    },
  ])("rejects invalid group input: $name", (input) => {
    expect(() => normalizeAdminOfferingPriceInput(input, supportedCurrencies)).toThrow();
  });

  it("returns a maintenance error while admin price writes are paused", () => {
    expect(() => assertAdminPriceWritesEnabled(false)).toThrowError(
      expect.objectContaining({ code: "SERVICE_UNAVAILABLE", statusCode: 503 }),
    );
    expect(() => assertAdminPriceWritesEnabled(true)).not.toThrow();
  });

  it("rejects a zero published price for a paid offering but permits drafts", () => {
    expect(() =>
      validatePublishedPaidPrice(0, "published", {
        bookingMode: "paid",
        requiresPayment: true,
      }),
    ).toThrowError(/greater than zero/i);
    expect(() =>
      validatePublishedPaidPrice(0, "draft", {
        bookingMode: "paid",
        requiresPayment: true,
      }),
    ).not.toThrow();
  });
});
