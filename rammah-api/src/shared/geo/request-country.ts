import { isIP } from "node:net";
import { createRequire } from "node:module";
import type { Request } from "express";

const require = createRequire(import.meta.url);

type GeoIpCountryModule = {
  lookup: (ipAddress: string) => { country?: string | null } | null;
};

const geoIpCountry = require("geoip-country") as GeoIpCountryModule;

export const defaultCountryCode = "EG";

export type RequestCountryDetection = {
  countryCode: string | null;
  source: "header" | "geoip" | null;
};

const countryHeaderNames = [
  "cf-ipcountry",
  "x-vercel-ip-country",
  "x-geo-country",
  "x-country-code",
] as const;

const normalizeCountryCode = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase();

  if (!normalized || !/^[A-Z]{2}$/.test(normalized) || normalized === "XX") {
    return null;
  }

  return normalized;
};

const normalizeIpAddress = (value: string | null | undefined) => {
  const normalized = value?.trim();

  if (!normalized) return null;

  const withoutIpv4Prefix = normalized.startsWith("::ffff:")
    ? normalized.slice("::ffff:".length)
    : normalized;
  const zoneSeparatorIndex = withoutIpv4Prefix.indexOf("%");
  const withoutZone =
    zoneSeparatorIndex === -1
      ? withoutIpv4Prefix
      : withoutIpv4Prefix.slice(0, zoneSeparatorIndex);

  return isIP(withoutZone) ? withoutZone : null;
};

export const lookupCountryCodeByIp = (ipAddress: string) =>
  normalizeCountryCode(geoIpCountry.lookup(ipAddress)?.country);

export const detectCountryFromRequest = (
  req: Request,
  lookupCountryByIp: (ipAddress: string) => string | null = lookupCountryCodeByIp,
): RequestCountryDetection => {
  for (const headerName of countryHeaderNames) {
    const countryCode = normalizeCountryCode(req.header(headerName));

    if (countryCode) {
      return {
        countryCode,
        source: "header",
      };
    }
  }

  const ipAddress = normalizeIpAddress(req.ip ?? req.socket.remoteAddress);

  if (!ipAddress) {
    return {
      countryCode: null,
      source: null,
    };
  }

  const countryCode = normalizeCountryCode(lookupCountryByIp(ipAddress));

  return countryCode
    ? {
        countryCode,
        source: "geoip",
      }
    : {
        countryCode: null,
        source: null,
      };
};
