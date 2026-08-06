import { beforeAll, describe, expect, it, vi } from "vitest";

let parseEnv: typeof import("./env.js").parseEnv;

const baseEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://localhost/test",
  ADMIN_SESSION_SECRET: "test-secret-value",
};

describe("booking policy environment", () => {
  beforeAll(async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", baseEnv.DATABASE_URL);
    vi.stubEnv("ADMIN_SESSION_SECRET", baseEnv.ADMIN_SESSION_SECRET);
    ({ parseEnv } = await import("./env.js"));
  });

  it("defaults to one-day notice and eight schedule groups per day", () => {
    expect(parseEnv(baseEnv)).toMatchObject({
      BOOKING_CHANGE_MINIMUM_NOTICE_MINUTES: 1_440,
      BOOKING_DAILY_LIMIT: 8,
    });
  });

  it("allows disabling minimum notice but rejects an empty daily limit", () => {
    expect(
      parseEnv({
        ...baseEnv,
        BOOKING_CHANGE_MINIMUM_NOTICE_MINUTES: "0",
        BOOKING_DAILY_LIMIT: "1",
      }),
    ).toMatchObject({
      BOOKING_CHANGE_MINIMUM_NOTICE_MINUTES: 0,
      BOOKING_DAILY_LIMIT: 1,
    });
    expect(() => parseEnv({ ...baseEnv, BOOKING_DAILY_LIMIT: "0" })).toThrow();
  });
});
