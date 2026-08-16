import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("API proxy configuration", () => {
  it("uses an explicit proxy predicate and trusts no peer by default", () => {
    const app = createApp();
    const trustProxy = app.get("trust proxy") as (ipAddress: string) => boolean;

    expect(trustProxy).toBeTypeOf("function");
    expect(trustProxy("127.0.0.1")).toBe(false);
  });
});
