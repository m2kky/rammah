import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";
import * as pricePreviewRoutes from "./public-price-preview.routes.js";

type CountryDetection = {
  countryCode: string | null;
  source: "header" | "geoip" | null;
};

type CountryResolver = (
  req: Request,
  lookupCountryByIp?: (ipAddress: string) => string | null,
) => CountryDetection;

const getResolver = () =>
  (
    pricePreviewRoutes as typeof pricePreviewRoutes & {
      detectCountryFromRequest?: CountryResolver;
    }
  ).detectCountryFromRequest;

const requestWith = (input: {
  headers?: Record<string, string>;
  ip?: string;
  remoteAddress?: string;
}) =>
  ({
    header: (name: string) => input.headers?.[name.toLowerCase()],
    ip: input.ip,
    socket: {
      remoteAddress: input.remoteAddress,
    },
  }) as Request;

describe("request country detection", () => {
  it("exposes a reusable request country resolver", () => {
    expect(getResolver()).toBeTypeOf("function");
  });

  it("prefers a valid CF-IPCountry header over a GeoIP lookup", () => {
    const resolver = getResolver();
    expect(resolver).toBeTypeOf("function");
    if (!resolver) return;

    const lookup = vi.fn(() => "US");
    const result = resolver(
      requestWith({
        headers: { "cf-ipcountry": "eg" },
        ip: "8.8.8.8",
      }),
      lookup,
    );

    expect(result).toEqual({
      countryCode: "EG",
      source: "header",
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("falls back to GeoIP and normalizes IPv4-mapped proxy addresses", () => {
    const resolver = getResolver();
    expect(resolver).toBeTypeOf("function");
    if (!resolver) return;

    const lookup = vi.fn(() => "us");
    const result = resolver(
      requestWith({
        headers: { "cf-ipcountry": "XX" },
        ip: "::ffff:8.8.8.8",
      }),
      lookup,
    );

    expect(lookup).toHaveBeenCalledWith("8.8.8.8");
    expect(result).toEqual({
      countryCode: "US",
      source: "geoip",
    });
  });

  it("returns no detection for invalid addresses and unknown country codes", () => {
    const resolver = getResolver();
    expect(resolver).toBeTypeOf("function");
    if (!resolver) return;

    expect(
      resolver(
        requestWith({
          headers: { "x-country-code": "not-a-country" },
          ip: "not-an-ip",
        }),
        () => "US",
      ),
    ).toEqual({
      countryCode: null,
      source: null,
    });

    expect(
      resolver(requestWith({ ip: "8.8.8.8" }), () => "XX"),
    ).toEqual({
      countryCode: null,
      source: null,
    });
  });
});
