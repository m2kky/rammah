import { describe, expect, it } from "vitest";
import { collectCmsMediaChecks, type CmsPreflightConfig } from "./production-preflight.js";

const productionConfig = (overrides: Partial<CmsPreflightConfig> = {}): CmsPreflightConfig => ({
  R2_UPLOADS_ENABLED: true,
  R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
  R2_BUCKET: "rammah-media",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-access-key",
  R2_PUBLIC_BASE_URL: "https://media.example.com",
  R2_MAX_IMAGE_BYTES: 15 * 1024 * 1024,
  R2_MAX_VIDEO_BYTES: 500 * 1024 * 1024,
  R2_MAX_ANIMATION_ZIP_BYTES: 500 * 1024 * 1024,
  R2_MAX_ANIMATION_EXPANDED_BYTES: 2 * 1024 * 1024 * 1024,
  R2_MAX_ANIMATION_FRAMES: 2_000,
  CMS_PREVIEW_SECRET: "a-separate-preview-secret-with-32-chars",
  ADMIN_SESSION_SECRET: "a-different-admin-session-secret-value",
  WORKER_POLL_INTERVAL_MS: 1_000,
  WORKER_BATCH_SIZE: 10,
  WORKER_CONCURRENCY: 4,
  JOB_LEASE_SECONDS: 120,
  JOB_TIMEOUT_SECONDS: 90,
  WORKER_DRAIN_TIMEOUT_MS: 30_000,
  ...overrides,
});

describe("CMS production preflight", () => {
  it("fails when R2 uploads or a required R2 value is missing", () => {
    const disabled = collectCmsMediaChecks(productionConfig({ R2_UPLOADS_ENABLED: false }), true);
    const missingBucket = collectCmsMediaChecks(productionConfig({ R2_BUCKET: undefined }), true);
    expect(disabled).toContainEqual(expect.objectContaining({ name: "R2_UPLOADS_ENABLED", status: "fail" }));
    expect(missingBucket).toContainEqual(expect.objectContaining({ name: "R2_BUCKET", status: "fail" }));
  });

  it("requires a strong separate preview secret", () => {
    const missing = collectCmsMediaChecks(productionConfig({ CMS_PREVIEW_SECRET: undefined }), true);
    const reused = collectCmsMediaChecks(productionConfig({
      CMS_PREVIEW_SECRET: "a-different-admin-session-secret-value",
    }), true);
    expect(missing).toContainEqual(expect.objectContaining({ name: "CMS_PREVIEW_SECRET", status: "fail" }));
    expect(reused).toContainEqual(expect.objectContaining({ name: "CMS_PREVIEW_SECRET", status: "fail" }));
  });

  it("checks animation limits and worker lease safety", () => {
    const checks = collectCmsMediaChecks(productionConfig({
      R2_MAX_ANIMATION_EXPANDED_BYTES: 100,
      R2_MAX_ANIMATION_ZIP_BYTES: 200,
      JOB_LEASE_SECONDS: 30,
      JOB_TIMEOUT_SECONDS: 90,
    }), true);
    expect(checks).toContainEqual(expect.objectContaining({ name: "R2_MEDIA_LIMITS", status: "fail" }));
    expect(checks).toContainEqual(expect.objectContaining({ name: "CMS_WORKER", status: "fail" }));
  });
});
