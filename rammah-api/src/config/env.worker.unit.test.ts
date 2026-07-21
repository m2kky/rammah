import { beforeAll, describe, expect, it, vi } from "vitest";

let parseEnv: typeof import("./env.js").parseEnv;

const baseEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://localhost/test",
  ADMIN_SESSION_SECRET: "test-secret-value",
};

describe("worker environment", () => {
  beforeAll(async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", baseEnv.DATABASE_URL);
    vi.stubEnv("ADMIN_SESSION_SECRET", baseEnv.ADMIN_SESSION_SECRET);
    ({ parseEnv } = await import("./env.js"));
  });

  it("provides bounded development and test defaults", () => {
    const parsed = parseEnv(baseEnv);

    expect(parsed).toMatchObject({
      WORKER_POLL_INTERVAL_MS: 1_000,
      WORKER_BATCH_SIZE: 10,
      WORKER_CONCURRENCY: 4,
      JOB_LEASE_SECONDS: 120,
      JOB_TIMEOUT_SECONDS: 90,
      JOB_MAX_ATTEMPTS: 8,
      JOB_BACKOFF_BASE_MS: 1_000,
      JOB_BACKOFF_MAX_MS: 300_000,
      WORKER_DRAIN_TIMEOUT_MS: 30_000,
    });
  });

  it("rejects non-positive values and leases that do not exceed timeout", () => {
    expect(() => parseEnv({ ...baseEnv, WORKER_BATCH_SIZE: "0" })).toThrow();
    expect(() => parseEnv({
      ...baseEnv,
      JOB_LEASE_SECONDS: "90",
      JOB_TIMEOUT_SECONDS: "90",
    })).toThrow("JOB_LEASE_SECONDS must be greater than JOB_TIMEOUT_SECONDS");
  });
});
