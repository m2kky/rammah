import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";

export type PreviewTokenPayload = {
  version: 1;
  pageId: string;
  exp: number;
  nonce: string;
};

type PreviewTokenDependencies = {
  secret?: string;
  maxAgeSeconds?: number;
  now?: () => Date;
  nonce?: () => string;
};

const previewError = (message: string) => new AppError({
  code: "FORBIDDEN",
  message,
  statusCode: httpStatus.forbidden,
});

export const createPreviewTokenService = (dependencies: PreviewTokenDependencies = {}) => {
  const secret = dependencies.secret ?? env.CMS_PREVIEW_SECRET ?? env.ADMIN_SESSION_SECRET;
  const maxAgeSeconds = dependencies.maxAgeSeconds ?? env.CMS_PREVIEW_MAX_AGE_SECONDS;
  const now = dependencies.now ?? (() => new Date());
  const nonce = dependencies.nonce ?? (() => randomBytes(16).toString("base64url"));

  const signatureFor = (payload: string) =>
    createHmac("sha256", secret).update(payload).digest();

  return {
    issuePreviewToken(input: { pageId: string; expiresInSeconds?: number }) {
      const expiresInSeconds = input.expiresInSeconds ?? maxAgeSeconds;
      if (
        !Number.isInteger(expiresInSeconds)
        || expiresInSeconds <= 0
        || expiresInSeconds > maxAgeSeconds
      ) {
        throw new Error(`Preview token lifetime must be between 1 and ${maxAgeSeconds} seconds.`);
      }
      const payload: PreviewTokenPayload = {
        version: 1,
        pageId: input.pageId,
        exp: Math.floor(now().getTime() / 1_000) + expiresInSeconds,
        nonce: nonce(),
      };
      const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
      return `${encoded}.${signatureFor(encoded).toString("base64url")}`;
    },

    verifyPreviewToken(token: string, expectedPageId: string): PreviewTokenPayload {
      const [encoded, suppliedSignature, extra] = token.split(".");
      if (!encoded || !suppliedSignature || extra !== undefined) {
        throw previewError("Preview token signature is invalid.");
      }
      const expectedSignature = signatureFor(encoded);
      let signature: Buffer;
      try {
        signature = Buffer.from(suppliedSignature, "base64url");
      } catch {
        throw previewError("Preview token signature is invalid.");
      }
      if (
        signature.byteLength !== expectedSignature.byteLength
        || !timingSafeEqual(signature, expectedSignature)
      ) {
        throw previewError("Preview token signature is invalid.");
      }

      let payload: PreviewTokenPayload;
      try {
        payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PreviewTokenPayload;
      } catch {
        throw previewError("Preview token payload is invalid.");
      }
      if (
        payload.version !== 1
        || typeof payload.pageId !== "string"
        || typeof payload.exp !== "number"
        || !Number.isInteger(payload.exp)
        || typeof payload.nonce !== "string"
        || !payload.nonce
      ) {
        throw previewError("Preview token payload is invalid.");
      }
      if (payload.pageId !== expectedPageId) {
        throw previewError("Preview token scope does not match this page.");
      }
      if (payload.exp <= Math.floor(now().getTime() / 1_000)) {
        throw previewError("Preview token has expired.");
      }
      return payload;
    },
  };
};

export const previewTokenService = createPreviewTokenService();
export const issuePreviewToken = previewTokenService.issuePreviewToken;
export const verifyPreviewToken = previewTokenService.verifyPreviewToken;
