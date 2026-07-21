import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TEST_DATABASE_URL,
  assertSafeTestDatabaseUrl,
  migrateTestDatabase,
  resetTestDatabase,
  resolveTestDatabaseUrl,
  truncateTestData,
  type TestDatabaseContext,
} from "./db.js";

describe("test database safety guard", () => {
  it("uses the canonical local test URL without consulting DATABASE_URL", () => {
    expect(resolveTestDatabaseUrl({
      NODE_ENV: "test",
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55432/rammah",
    })).toBe(DEFAULT_TEST_DATABASE_URL);
    expect(DEFAULT_TEST_DATABASE_URL).toBe(
      "postgres://rammah_test:rammah_test@127.0.0.1:55433/rammah_test",
    );
    expect(resolveTestDatabaseUrl({
      NODE_ENV: "test",
      TEST_DATABASE_URL: "postgres://rammah_test:rammah_test@postgres-test:5432/ci_test",
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55432/rammah",
    })).toBe("postgres://rammah_test:rammah_test@postgres-test:5432/ci_test");
  });

  it.each([
    DEFAULT_TEST_DATABASE_URL,
    "postgresql://rammah_test:rammah_test@localhost:55433/ci_test",
    "postgres://rammah_test:rammah_test@[::1]:55433/ipv6_test",
    "postgres://rammah_test:rammah_test@postgres-test:5432/rammah_test",
  ])("allows a local PostgreSQL test database URL: %s", (databaseUrl) => {
    expect(assertSafeTestDatabaseUrl(databaseUrl, "test").href).toBe(new URL(databaseUrl).href);
  });

  it.each([
    "?host=db.example.com",
    "?%68ost=db.example.com",
    "?HOST=db.example.com",
    "?port=55432",
    "?dbname=rammah",
    "?sslmode=require",
  ])("rejects connection-target query parameters before a destructive query: %s", async (search) => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const unsafeContext = {
      connectionString: `${DEFAULT_TEST_DATABASE_URL}${search}`,
      pool: { query },
    } as unknown as TestDatabaseContext;

    await expect(resetTestDatabase(unsafeContext, { NODE_ENV: "test" })).rejects.toThrow(
      /query parameters/i,
    );
    expect(query).not.toHaveBeenCalled();
  });

  it.each([undefined, "development", "production"])(
    "rejects the %s NODE_ENV before database work",
    (nodeEnv) => {
      expect(() => assertSafeTestDatabaseUrl(DEFAULT_TEST_DATABASE_URL, nodeEnv)).toThrow(
        "NODE_ENV=test",
      );
    },
  );

  it.each([
    ["missing URL", ""],
    ["invalid URL", "not a url"],
    ["non-PostgreSQL URL", "mysql://rammah_test:rammah_test@127.0.0.1:55433/rammah_test"],
    ["remote host", "postgres://rammah_test:rammah_test@db.example.com:5432/rammah_test"],
    ["case-variant Compose host", "postgres://rammah_test:rammah_test@POSTGRES-TEST:5432/rammah_test"],
    ["missing Compose service port", "postgres://rammah_test:rammah_test@postgres-test/rammah_test"],
    ["wrong Compose service port", "postgres://rammah_test:rammah_test@postgres-test:55432/rammah_test"],
    ["development database", "postgres://rammah_test:rammah_test@127.0.0.1:55433/rammah"],
    ["maintenance database", "postgres://rammah_test:rammah_test@127.0.0.1:55433/postgres"],
    ["non-test suffix", "postgres://rammah_test:rammah_test@127.0.0.1:55433/rammah_test_extra"],
  ])("rejects a %s", (_label, databaseUrl) => {
    expect(() => assertSafeTestDatabaseUrl(databaseUrl, "test")).toThrow(/test database|PostgreSQL|URL/i);
  });

  it.each([resetTestDatabase, migrateTestDatabase, truncateTestData])(
    "re-checks the guard before a destructive helper query",
    async (destructiveHelper) => {
      const query = vi.fn();
      const unsafeContext = {
        connectionString: "postgres://postgres:postgres@127.0.0.1:55432/rammah",
        pool: { query },
      } as unknown as TestDatabaseContext;

      await expect(destructiveHelper(unsafeContext, { NODE_ENV: "test" })).rejects.toThrow(
        /test database/i,
      );
      expect(query).not.toHaveBeenCalled();
    },
  );
});
