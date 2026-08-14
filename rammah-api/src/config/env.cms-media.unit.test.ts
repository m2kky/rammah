import { beforeAll, describe, expect, it, vi } from "vitest";

let parseEnv: typeof import("./env.js").parseEnv;

const baseEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgres://localhost/test",
  ADMIN_SESSION_SECRET: "test-secret-value",
};

const completeR2Env = {
  R2_UPLOADS_ENABLED: "true",
  R2_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
  R2_BUCKET: "rammah-media",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_PUBLIC_BASE_URL: "https://media.example.com",
};

describe("CMS media environment", () => {
  beforeAll(async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", baseEnv.DATABASE_URL);
    vi.stubEnv("ADMIN_SESSION_SECRET", baseEnv.ADMIN_SESSION_SECRET);
    ({ parseEnv } = await import("./env.js"));
  });

  it("keeps R2 disabled by default with bounded upload defaults", () => {
    expect(parseEnv(baseEnv)).toMatchObject({
      R2_UPLOADS_ENABLED: false,
      R2_PRESIGN_EXPIRES_SECONDS: 300,
      R2_MAX_IMAGE_BYTES: 15 * 1024 * 1024,
      R2_MAX_VIDEO_BYTES: 500 * 1024 * 1024,
      R2_MAX_ANIMATION_ZIP_BYTES: 500 * 1024 * 1024,
      R2_TEMP_PREFIX: "tmp",
      R2_MEDIA_PREFIX: "media",
    });
  });

  it("accepts blank R2 placeholders while uploads are disabled", () => {
    expect(
      parseEnv({
        ...baseEnv,
        R2_UPLOADS_ENABLED: "false",
        R2_ENDPOINT: "",
        R2_BUCKET: "",
        R2_ACCESS_KEY_ID: "",
        R2_SECRET_ACCESS_KEY: "",
        R2_PUBLIC_BASE_URL: "",
      }),
    ).toMatchObject({ R2_UPLOADS_ENABLED: false });
  });

  it("requires the complete private and public R2 configuration when uploads are enabled", () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        R2_UPLOADS_ENABLED: "true",
      }),
    ).toThrow();

    expect(parseEnv({ ...baseEnv, ...completeR2Env })).toMatchObject({
      R2_UPLOADS_ENABLED: true,
      R2_BUCKET: "rammah-media",
      R2_PUBLIC_BASE_URL: "https://media.example.com",
    });
  });

  it("rejects unsafe prefixes and excessive presign expiry", () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        ...completeR2Env,
        R2_TEMP_PREFIX: "../tmp",
      }),
    ).toThrow();
    expect(() =>
      parseEnv({
        ...baseEnv,
        ...completeR2Env,
        R2_PRESIGN_EXPIRES_SECONDS: "901",
      }),
    ).toThrow();
  });
});
