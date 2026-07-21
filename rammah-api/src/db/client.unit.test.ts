import { beforeAll, describe, expect, it, vi } from "vitest";

let createDatabaseCloser: typeof import("./client.js").createDatabaseCloser;

describe("database close helper", () => {
  beforeAll(async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
    vi.stubEnv("ADMIN_SESSION_SECRET", "test-secret-value");
    ({ createDatabaseCloser } = await import("./client.js"));
  });

  it("closes a pool only once across concurrent and repeated calls", async () => {
    const end = vi.fn().mockResolvedValue(undefined);
    const close = createDatabaseCloser({ end });

    await Promise.all([close(), close()]);
    await close();

    expect(end).toHaveBeenCalledOnce();
  });
});
