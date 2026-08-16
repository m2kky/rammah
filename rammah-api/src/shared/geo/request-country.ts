import { isIP } from "node:net";
import type { Request } from "express";
import { env, trustedProxyPredicate } from "../../config/env.js";
import { isIsoCountryCode } from "./countries.js";
import type { TrustedProxyPredicate } from "./trusted-proxy.js";

export type RequestCountryDetection = {
  countryCode: string | null;
  source: "header" | null;
};

export type CountryHeaderProvider = "cloudflare" | "vercel" | "none";

export type RequestCountryDetectionOptions = {
  provider: CountryHeaderProvider;
  isTrustedProxy: TrustedProxyPredicate;
};

const providerHeaderNames: Record<Exclude<CountryHeaderProvider, "none">, string> = {
  cloudflare: "cf-ipcountry",
  vercel: "x-vercel-ip-country",
};

const normalizeCountryCode = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase();

  if (!normalized || !isIsoCountryCode(normalized)) {
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

export const detectCountryFromRequest = (
  req: Request,
  options: RequestCountryDetectionOptions = {
    provider: env.COUNTRY_HEADER_PROVIDER,
    isTrustedProxy: trustedProxyPredicate,
  },
): RequestCountryDetection => {
  const immediatePeer = normalizeIpAddress(req.socket.remoteAddress);
  if (
    options.provider !== "none" &&
    immediatePeer &&
    options.isTrustedProxy(immediatePeer)
  ) {
    const countryCode = normalizeCountryCode(
      req.header(providerHeaderNames[options.provider]),
    );
    if (countryCode) {
      return {
        countryCode,
        source: "header",
      };
    }
  }

  return {
    countryCode: null,
    source: null,
  };
};
