import { describe, expect, it } from "vitest";
import { validateEarlyBookingPrice } from "./admin-offerings.service.js";

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
});
