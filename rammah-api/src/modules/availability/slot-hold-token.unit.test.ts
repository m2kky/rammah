import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createSlotHoldToken,
  hashSlotHoldToken,
  verifySlotHoldToken,
} from "./slot-hold-token.js";

describe("slot hold owner tokens", () => {
  it("returns a 32-byte base64url token and its SHA-256 digest", () => {
    const result = createSlotHoldToken();

    expect(Buffer.from(result.token, "base64url")).toHaveLength(32);
    expect(result.digest).toBe(
      createHash("sha256").update(result.token, "utf8").digest("hex"),
    );
    expect(result.digest).not.toContain(result.token);
  });

  it("verifies only the exact token with a valid stored digest", () => {
    const token = "A".repeat(43);
    const digest = hashSlotHoldToken(token);

    expect(verifySlotHoldToken(token, digest)).toBe(true);
    expect(verifySlotHoldToken(`${token}x`, digest)).toBe(false);
    expect(verifySlotHoldToken(token, null)).toBe(false);
    expect(verifySlotHoldToken(undefined, digest)).toBe(false);
    expect(verifySlotHoldToken(token, "not-a-sha256-digest")).toBe(false);
  });
});
