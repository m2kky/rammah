import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../errors/app-error.js";
import { httpStatus } from "../http/status.js";

const algorithm = "aes-256-gcm";
const ivLength = 12;

const getEncryptionKey = () => {
  if (!env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY) {
    throw new AppError({
      code: "CONFIGURATION_ERROR",
      message: "Google Calendar token encryption key is not configured.",
      statusCode: httpStatus.internalServerError,
      expose: false,
    });
  }

  const rawKey = env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY.trim();
  const decoded = Buffer.from(rawKey, "base64");

  if (decoded.length === 32) {
    return decoded;
  }

  return crypto.createHash("sha256").update(rawKey).digest();
};

export const encryptSecret = (plaintext: string) => {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
};

export const decryptSecret = (payload: string) => {
  const [ivValue, tagValue, encryptedValue] = payload.split(".");

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new AppError({
      code: "CONFIGURATION_ERROR",
      message: "Stored Google Calendar token cannot be decrypted.",
      statusCode: httpStatus.internalServerError,
      expose: false,
    });
  }

  const decipher = crypto.createDecipheriv(
    algorithm,
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};
