import { describe, expect, it } from "vitest";
import { createPreviewTokenService } from "./preview-token.js";

const pageId = "11111111-2222-4333-8444-555555555555";
const otherPageId = "22222222-3333-4444-8555-666666666666";
const secret = "test-preview-secret-that-is-at-least-32-bytes";

describe("CMS preview tokens", () => {
  it("scopes a signed token to one page and expiry", () => {
    const now = new Date("2026-08-15T10:00:00.000Z");
    const service = createPreviewTokenService({
      secret,
      now: () => now,
      nonce: () => "nonce-1",
    });

    const token = service.issuePreviewToken({ pageId, expiresInSeconds: 60 });

    expect(service.verifyPreviewToken(token, pageId)).toMatchObject({
      pageId,
      exp: Math.floor(now.getTime() / 1_000) + 60,
      nonce: "nonce-1",
    });
    expect(() => service.verifyPreviewToken(token, otherPageId)).toThrow(/scope/i);
  });

  it("rejects expired or tampered tokens", () => {
    let now = new Date("2026-08-15T10:00:00.000Z");
    const service = createPreviewTokenService({
      secret,
      now: () => now,
      nonce: () => "nonce-2",
    });
    const token = service.issuePreviewToken({ pageId, expiresInSeconds: 30 });

    now = new Date("2026-08-15T10:00:31.000Z");
    expect(() => service.verifyPreviewToken(token, pageId)).toThrow(/expired/i);
    expect(() => service.verifyPreviewToken(`${token}x`, pageId)).toThrow(/signature/i);
  });

  it("caps tokens at the configured maximum lifetime", () => {
    const service = createPreviewTokenService({ secret, maxAgeSeconds: 300 });

    expect(() => service.issuePreviewToken({ pageId, expiresInSeconds: 301 }))
      .toThrow(/lifetime/i);
  });
});
