import { describe, expect, it } from "vitest";
import { DEFAULT_TEST_DATABASE_URL, getTestDatabaseName } from "./db.js";

describe("validated test database name", () => {
  it.each([
    [DEFAULT_TEST_DATABASE_URL, "rammah_test"],
    ["postgres://rammah_test:rammah_test@postgres-test:5432/%63i_test", "ci_test"],
    ["postgres://rammah_test:rammah_test@postgres-test:5432/ci%2F_test", "ci%2F_test"],
    ["postgres://rammah_test:rammah_test@postgres-test:5432/ci%3F_test", "ci%3F_test"],
    ["postgres://rammah_test:rammah_test@postgres-test:5432/ci%23_test", "ci%23_test"],
  ])("derives the decoded database name from %s", (databaseUrl, expectedName) => {
    expect(getTestDatabaseName(databaseUrl, "test")).toBe(expectedName);
  });
});
