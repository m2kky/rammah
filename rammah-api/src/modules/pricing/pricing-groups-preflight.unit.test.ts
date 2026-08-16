import { describe, expect, it, vi } from "vitest";
import {
  analyzeLegacyPriceRows,
  assertPricingGroupsMigrationReady,
  inspectPricingGroupsMigration,
  parseSupportedCurrencies,
  type LegacyPriceRow,
} from "./pricing-groups-preflight.js";

const validRow = (overrides: Partial<LegacyPriceRow> = {}): LegacyPriceRow => ({
  id: "price-eg",
  offeringId: "offering-1",
  countryCode: "EG",
  currency: "EGP",
  baseAmountMinor: 10_000,
  earlyBirdAmountMinor: null,
  earlyBirdEndsAt: null,
  status: "published",
  offeringRequiresPayment: true,
  offeringBookingMode: "paid",
  ...overrides,
});

describe("legacy price-group migration preflight", () => {
  it("normalizes and deduplicates the provider currency allowlist", () => {
    expect(parseSupportedCurrencies(" egp,USD,egp ")).toEqual(new Set(["EGP", "USD"]));
    expect(() => parseSupportedCurrencies(" ")).toThrowError(/currency/i);
    expect(() => parseSupportedCurrencies("EGPT")).toThrowError(/currency/i);
  });

  it("reports every blocking record id and scheduled conversion deterministically", () => {
    const report = analyzeLegacyPriceRows(
      [
        validRow(),
        validRow({ id: "price-eg-usd", currency: "USD" }),
        validRow({ id: "price-bad-country", offeringId: "offering-2", countryCode: "ZZ" }),
        validRow({ id: "price-negative", offeringId: "offering-3", baseAmountMinor: -1 }),
        validRow({ id: "price-zero", offeringId: "offering-4", baseAmountMinor: 0 }),
        validRow({
          id: "price-incomplete-early",
          offeringId: "offering-5",
          earlyBirdAmountMinor: 8_000,
        }),
        validRow({
          id: "price-invalid-early",
          offeringId: "offering-6",
          earlyBirdAmountMinor: 10_000,
          earlyBirdEndsAt: new Date("2026-09-01T00:00:00.000Z"),
        }),
        validRow({ id: "price-unsupported", offeringId: "offering-7", currency: "SAR" }),
        validRow({ id: "price-scheduled", offeringId: "offering-8", status: "scheduled" }),
      ],
      new Set(["EGP", "USD"]),
      new Set(["EG", "US"]),
    );

    expect(report).toEqual({
      ok: false,
      totalRows: 9,
      duplicateActiveCountryPriceIds: ["price-eg", "price-eg-usd"],
      invalidCountryPriceIds: ["price-bad-country"],
      negativeAmountPriceIds: ["price-negative"],
      zeroPublishedPaidPriceIds: ["price-zero"],
      incompleteEarlyBookingPriceIds: ["price-incomplete-early"],
      invalidEarlyBookingAmountPriceIds: ["price-invalid-early"],
      unsupportedCurrencyPriceIds: ["price-unsupported"],
      scheduledPriceIds: ["price-scheduled"],
    });
    let error: Error | null = null;
    try {
      assertPricingGroupsMigrationReady(report);
    } catch (caught) {
      error = caught as Error;
    }
    expect(error).not.toBeNull();
    for (const priceId of [
      "price-eg",
      "price-bad-country",
      "price-negative",
      "price-zero",
      "price-incomplete-early",
      "price-invalid-early",
      "price-unsupported",
    ]) {
      expect(error?.message).toContain(priceId);
    }
  });

  it("accepts valid draft, published, and archived rows while reporting scheduled conversion", () => {
    const report = analyzeLegacyPriceRows(
      [
        validRow(),
        validRow({
          id: "price-draft",
          offeringId: "offering-2",
          countryCode: "US",
          currency: "USD",
          baseAmountMinor: 0,
          status: "draft",
        }),
        validRow({ id: "price-archived", status: "archived" }),
        validRow({ id: "price-scheduled", offeringId: "offering-3", status: "scheduled" }),
      ],
      new Set(["EGP", "USD"]),
      new Set(["EG", "US"]),
    );

    expect(report.ok).toBe(true);
    expect(report.scheduledPriceIds).toEqual(["price-scheduled"]);
    expect(() => assertPricingGroupsMigrationReady(report)).not.toThrow();
  });

  it("loads legacy rows and maps database fields before analysis", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "price-eg",
          offering_id: "offering-1",
          country_code: "EG",
          currency: "EGP",
          base_amount_minor: 10_000,
          early_bird_amount_minor: null,
          early_bird_ends_at: null,
          status: "published",
          offering_requires_payment: true,
          offering_booking_mode: "paid",
        },
      ],
    });

    const report = await inspectPricingGroupsMigration(
      { query },
      new Set(["EGP"]),
      new Set(["EG"]),
    );

    expect(report).toMatchObject({ ok: true, totalRows: 1 });
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]?.[0]).toMatch(/FROM offering_prices/i);
  });
});
