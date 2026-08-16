import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";
import { detectCountryFromRequest } from "../../shared/geo/request-country.js";

const requestWith = (input: {
  headers?: Record<string, string>;
  ip?: string;
  remoteAddress?: string;
}) =>
  ({
    header: (name: string) => input.headers?.[name.toLowerCase()],
    ip: input.ip,
    socket: { remoteAddress: input.remoteAddress },
  }) as Request;

const trustedProxy = (ipAddress: string) => ipAddress === "172.18.0.2";

describe("request country detection", () => {
  it("accepts only the configured provider header from a trusted immediate peer", () => {
    const lookup = vi.fn(() => "US");
    const result = detectCountryFromRequest(
      requestWith({
        headers: {
          "cf-ipcountry": "eg",
          "x-vercel-ip-country": "SA",
          "x-country-code": "AE",
        },
        ip: "8.8.8.8",
        remoteAddress: "172.18.0.2",
      }),
      lookup,
      { provider: "cloudflare", isTrustedProxy: trustedProxy },
    );

    expect(result).toEqual({ countryCode: "EG", source: "header" });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("ignores a provider header from an untrusted peer and uses effective-IP GeoIP", () => {
    const lookup = vi.fn(() => "US");
    const result = detectCountryFromRequest(
      requestWith({
        headers: { "cf-ipcountry": "EG" },
        ip: "8.8.8.8",
        remoteAddress: "203.0.113.9",
      }),
      lookup,
      { provider: "cloudflare", isTrustedProxy: trustedProxy },
    );

    expect(result).toEqual({ countryCode: "US", source: "geoip" });
    expect(lookup).toHaveBeenCalledWith("8.8.8.8");
  });

  it("uses only Vercel's header when Vercel is configured", () => {
    const result = detectCountryFromRequest(
      requestWith({
        headers: { "cf-ipcountry": "EG", "x-vercel-ip-country": "sa" },
        remoteAddress: "172.18.0.2",
      }),
      () => null,
      { provider: "vercel", isTrustedProxy: trustedProxy },
    );

    expect(result).toEqual({ countryCode: "SA", source: "header" });
  });

  it("provider none ignores every country header and never defaults to Egypt", () => {
    const result = detectCountryFromRequest(
      requestWith({
        headers: {
          "cf-ipcountry": "EG",
          "x-vercel-ip-country": "SA",
          "x-geo-country": "AE",
          "x-country-code": "US",
        },
        ip: "8.8.8.8",
        remoteAddress: "172.18.0.2",
      }),
      () => null,
      { provider: "none", isTrustedProxy: trustedProxy },
    );

    expect(result).toEqual({ countryCode: null, source: null });
  });

  it.each(["XX", "T1", "ZZ", "not-a-country"])(
    "rejects provider country %j and returns no detection without GeoIP",
    (countryCode) => {
      expect(
        detectCountryFromRequest(
          requestWith({
            headers: { "cf-ipcountry": countryCode },
            remoteAddress: "172.18.0.2",
          }),
          () => null,
          { provider: "cloudflare", isTrustedProxy: trustedProxy },
        ),
      ).toEqual({ countryCode: null, source: null });
    },
  );

  it("normalizes IPv4-mapped effective addresses before GeoIP", () => {
    const lookup = vi.fn(() => "us");
    const result = detectCountryFromRequest(
      requestWith({ ip: "::ffff:8.8.8.8" }),
      lookup,
      { provider: "none", isTrustedProxy: () => false },
    );

    expect(lookup).toHaveBeenCalledWith("8.8.8.8");
    expect(result).toEqual({ countryCode: "US", source: "geoip" });
  });
});
