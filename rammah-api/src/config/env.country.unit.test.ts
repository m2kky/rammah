import { beforeAll, describe, expect, it, vi } from "vitest";

let parseEnv: typeof import("./env.js").parseEnv;

const baseEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://localhost/test",
  ADMIN_SESSION_SECRET: "test-secret-value",
};

describe("country pricing environment", () => {
  beforeAll(async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", baseEnv.DATABASE_URL);
    vi.stubEnv("ADMIN_SESSION_SECRET", baseEnv.ADMIN_SESSION_SECRET);
    ({ parseEnv } = await import("./env.js"));
  });

  it("defaults to no trusted country provider or proxy and EGP only", () => {
    expect(parseEnv(baseEnv)).toMatchObject({
      COUNTRY_HEADER_PROVIDER: "none",
      TRUSTED_PROXY_CIDRS: [],
      PAYMENT_SUPPORTED_CURRENCIES: ["EGP"],
      ADMIN_PRICE_WRITES_ENABLED: true,
    });
  });

  it("parses the explicit admin price write pause", () => {
    expect(
      parseEnv({ ...baseEnv, ADMIN_PRICE_WRITES_ENABLED: "false" }),
    ).toMatchObject({ ADMIN_PRICE_WRITES_ENABLED: false });
  });

  it("normalizes trusted CIDRs and payment currencies", () => {
    expect(
      parseEnv({
        ...baseEnv,
        COUNTRY_HEADER_PROVIDER: "cloudflare",
        TRUSTED_PROXY_CIDRS: " 172.18.0.0/16,127.0.0.1 ",
        PAYMENT_SUPPORTED_CURRENCIES: "egp, USD,egp",
      }),
    ).toMatchObject({
      COUNTRY_HEADER_PROVIDER: "cloudflare",
      TRUSTED_PROXY_CIDRS: ["172.18.0.0/16", "127.0.0.1"],
      PAYMENT_SUPPORTED_CURRENCIES: ["EGP", "USD"],
    });
  });

  it("rejects provider mode without trusted peers and malformed CIDRs/currencies", () => {
    expect(() =>
      parseEnv({ ...baseEnv, COUNTRY_HEADER_PROVIDER: "cloudflare" }),
    ).toThrow();
    expect(() =>
      parseEnv({ ...baseEnv, TRUSTED_PROXY_CIDRS: "not-a-cidr" }),
    ).toThrow();
    expect(() =>
      parseEnv({ ...baseEnv, PAYMENT_SUPPORTED_CURRENCIES: "EGPT" }),
    ).toThrow();
  });
});
