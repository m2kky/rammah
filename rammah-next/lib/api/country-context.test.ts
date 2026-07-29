import { afterEach, describe, expect, it, vi } from "vitest";
import { apiBaseUrl } from "./config";
import * as offeringsApi from "./offerings";

type CountryContext = {
  countryCode: string;
  detectedCountryCode: string | null;
  source: "header" | "geoip" | "default";
};

type CountryContextFetcher = (signal?: AbortSignal) => Promise<CountryContext>;

const getFetcher = () =>
  (
    offeringsApi as typeof offeringsApi & {
      fetchPublicCountryContext?: CountryContextFetcher;
    }
  ).fetchPublicCountryContext;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public country context API", () => {
  it("exposes the server-resolved country to the booking flow", async () => {
    const fetcher = getFetcher();
    expect(fetcher).toBeTypeOf("function");
    if (!fetcher) return;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          countryCode: "SA",
          detectedCountryCode: "SA",
          source: "geoip",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetcher()).resolves.toEqual({
      countryCode: "SA",
      detectedCountryCode: "SA",
      source: "geoip",
    });
    expect(fetchMock).toHaveBeenCalledWith(`${apiBaseUrl}/public/country`, {
      method: "GET",
      signal: undefined,
      cache: "no-store",
    });
  });
});
