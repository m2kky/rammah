import { describe, expect, it } from "vitest";
import { configureIntegrationTestEnvironment, DEFAULT_TEST_DATABASE_URL } from "./db.js";

describe("integration Vitest configuration", () => {
  it("uses one trimmed, validated test URL for the harness and application", () => {
    const env = {
      NODE_ENV: "development",
      TEST_DATABASE_URL: `  ${DEFAULT_TEST_DATABASE_URL}  `,
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55432/rammah",
    };

    expect(configureIntegrationTestEnvironment(env)).toBe(DEFAULT_TEST_DATABASE_URL);
    expect(env.NODE_ENV).toBe("test");
    expect(env.TEST_DATABASE_URL).toBe(DEFAULT_TEST_DATABASE_URL);
    expect(env.DATABASE_URL).toBe(DEFAULT_TEST_DATABASE_URL);
  });

  it("rejects an unsafe TEST_DATABASE_URL before integration setup", () => {
    const env = { TEST_DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55432/rammah" };

    expect(() => configureIntegrationTestEnvironment(env)).toThrow(/port 55433/i);
  });
});
