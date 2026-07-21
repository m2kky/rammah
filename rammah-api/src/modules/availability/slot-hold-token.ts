import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const sha256HexPattern = /^[0-9a-f]{64}$/;

export const hashSlotHoldToken = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

export const createSlotHoldToken = () => {
  const token = randomBytes(32).toString("base64url");
  return { token, digest: hashSlotHoldToken(token) };
};

export const verifySlotHoldToken = (
  token: string | null | undefined,
  storedDigest: string | null | undefined,
) => {
  if (!token || !storedDigest || !sha256HexPattern.test(storedDigest)) {
    return false;
  }

  const suppliedDigest = Buffer.from(hashSlotHoldToken(token), "hex");
  const expectedDigest = Buffer.from(storedDigest, "hex");
  return timingSafeEqual(suppliedDigest, expectedDigest);
};
