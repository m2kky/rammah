import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("API proxy configuration", () => {
  it("trusts the one-hop Coolify reverse proxy for the client IP", () => {
    const app = createApp();

    expect(app.get("trust proxy")).toBe(1);
  });
});
