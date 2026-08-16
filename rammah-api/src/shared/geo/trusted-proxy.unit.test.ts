import { describe, expect, it } from "vitest";
import { compileTrustedProxyCidrs } from "./trusted-proxy.js";

describe("trusted proxy CIDRs", () => {
  it("matches only configured addresses and networks", () => {
    const isTrusted = compileTrustedProxyCidrs(["127.0.0.1", "172.18.0.0/16"]);

    expect(isTrusted("127.0.0.1")).toBe(true);
    expect(isTrusted("172.18.9.4")).toBe(true);
    expect(isTrusted("203.0.113.9")).toBe(false);
  });

  it("trusts nothing for an empty list and rejects invalid CIDRs", () => {
    expect(compileTrustedProxyCidrs([])("127.0.0.1")).toBe(false);
    expect(() => compileTrustedProxyCidrs(["not-a-cidr"])).toThrow();
  });
});
