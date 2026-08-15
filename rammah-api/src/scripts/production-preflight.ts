import { sql } from "drizzle-orm";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env, frontendOrigins } from "../config/env.js";
import { db, pool } from "../db/client.js";
import { siteSettings } from "../db/schema/index.js";
import {
  defaultBookingPolicySettings,
  validateBookingPolicyInput,
} from "../modules/availability/booking-policy.js";

type CheckStatus = "pass" | "warn" | "fail";

export type Check = {
  name: string;
  status: CheckStatus;
  message: string;
};

const target =
  process.argv.includes("--production") ||
  process.env.PREFLIGHT_TARGET === "production" ||
  env.NODE_ENV === "production"
    ? "production"
    : "local";
const checks: Check[] = [];

const addCheck = (check: Check) => {
  checks.push(check);
};

const present = (value: string | null | undefined) => Boolean(value?.trim());

const redacted = (value: string | null | undefined) =>
  present(value) ? "configured" : "missing";

const parseUrl = (value: string | null | undefined) => {
  if (!value) return null;

  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const isLocalHostname = (hostname: string) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname.endsWith(".local");

const isProductionUrl = (value: string | null | undefined) => {
  const url = parseUrl(value);
  return Boolean(url && url.protocol === "https:" && !isLocalHostname(url.hostname));
};

const checkProductionUrl = (name: string, value: string | null | undefined) => {
  if (target === "production" && !isProductionUrl(value)) {
    addCheck({
      name,
      status: "fail",
      message: `${name} must be a public HTTPS URL in production.`,
    });
    return;
  }

  addCheck({
    name,
    status: present(value) ? "pass" : "warn",
    message: `${name} is ${redacted(value)}.`,
  });
};

const looksLikeDefaultSecret = (value: string) =>
  value === "development-secret-change-me" ||
  value.toLowerCase().includes("change-me") ||
  value.toLowerCase().includes("secret");

const isStrongEncryptionKey = (value: string | null | undefined) => {
  if (!value) return false;

  const trimmed = value.trim();
  const decoded = Buffer.from(trimmed, "base64");

  return decoded.length === 32 || trimmed.length >= 32;
};

const checkEnvironment = () => {
  addCheck({
    name: "NODE_ENV",
    status: target === "production" && env.NODE_ENV !== "production" ? "fail" : "pass",
    message: `NODE_ENV=${env.NODE_ENV}; preflight target=${target}.`,
  });

  const weakAdminSecret =
    env.ADMIN_SESSION_SECRET.length < 32 || looksLikeDefaultSecret(env.ADMIN_SESSION_SECRET);
  addCheck({
    name: "ADMIN_SESSION_SECRET",
    status: weakAdminSecret && target === "production" ? "fail" : weakAdminSecret ? "warn" : "pass",
    message: weakAdminSecret
      ? "Use a unique random value of at least 32 characters."
      : "Admin session secret length/shape is acceptable.",
  });

  const badOrigins = frontendOrigins.filter((origin) => !isProductionUrl(origin));
  addCheck({
    name: "FRONTEND_ORIGIN",
    status: target === "production" && badOrigins.length > 0 ? "fail" : "pass",
    message:
      target === "production"
        ? badOrigins.length > 0
          ? `Non-production origins found: ${badOrigins.join(", ")}.`
          : "All frontend origins are public HTTPS URLs."
        : `Configured origins: ${frontendOrigins.join(", ")}.`,
  });
};

const checkPayments = () => {
  addCheck({
    name: "PAYMENT_PROVIDER",
    status: target === "production" && env.PAYMENT_PROVIDER !== "kashier" ? "fail" : "pass",
    message: `PAYMENT_PROVIDER=${env.PAYMENT_PROVIDER}.`,
  });

  addCheck({
    name: "PAYMENT_MODE",
    status: target === "production" && env.PAYMENT_MODE !== "live" ? "fail" : "pass",
    message: `PAYMENT_MODE=${env.PAYMENT_MODE}.`,
  });

  for (const [name, value] of [
    ["KASHIER_MERCHANT_ID", env.KASHIER_MERCHANT_ID],
    ["KASHIER_API_KEY", env.KASHIER_API_KEY],
    ["KASHIER_SECRET", env.KASHIER_SECRET],
  ] as const) {
    addCheck({
      name,
      status: target === "production" && !present(value) ? "fail" : present(value) ? "pass" : "warn",
      message: `${name} is ${redacted(value)}.`,
    });
  }

  checkProductionUrl("KASHIER_CALLBACK_URL", env.KASHIER_CALLBACK_URL);
  checkProductionUrl("KASHIER_RETURN_URL", env.KASHIER_RETURN_URL);
};

const checkGoogleCalendar = () => {
  for (const [name, value] of [
    ["GOOGLE_CALENDAR_CLIENT_ID", env.GOOGLE_CALENDAR_CLIENT_ID ?? env.GOOGLE_CLIENT_ID],
    ["GOOGLE_CALENDAR_CLIENT_SECRET", env.GOOGLE_CALENDAR_CLIENT_SECRET ?? env.GOOGLE_CLIENT_SECRET],
  ] as const) {
    addCheck({
      name,
      status: target === "production" && !present(value) ? "fail" : present(value) ? "pass" : "warn",
      message: `${name} is ${redacted(value)}.`,
    });
  }

  checkProductionUrl("GOOGLE_CALENDAR_REDIRECT_URI", env.GOOGLE_CALENDAR_REDIRECT_URI);

  addCheck({
    name: "GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY",
    status:
      target === "production" && !isStrongEncryptionKey(env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY)
        ? "fail"
        : isStrongEncryptionKey(env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY)
          ? "pass"
          : "warn",
    message:
      "Use a stable 32-byte base64 key or a strong 32+ character secret; changing it breaks stored Google token decryption.",
  });
};

const checkEmail = () => {
  addCheck({
    name: "EMAIL_PROVIDER",
    status: target === "production" && env.EMAIL_PROVIDER !== "resend" ? "fail" : "pass",
    message: `EMAIL_PROVIDER=${env.EMAIL_PROVIDER}.`,
  });

  addCheck({
    name: "RESEND_API_KEY",
    status: target === "production" && !present(env.RESEND_API_KEY) ? "fail" : present(env.RESEND_API_KEY) ? "pass" : "warn",
    message: `RESEND_API_KEY is ${redacted(env.RESEND_API_KEY)}.`,
  });

  const localSender = env.EMAIL_FROM.includes("@rammah.local");
  addCheck({
    name: "EMAIL_FROM",
    status: target === "production" && localSender ? "fail" : "pass",
    message: localSender
      ? "EMAIL_FROM still uses the local development sender."
      : "EMAIL_FROM does not use the local development sender.",
  });

  addCheck({
    name: "EMAIL_ADMIN_RECIPIENTS",
    status:
      target === "production" && !env.EMAIL_ADMIN_RECIPIENTS.includes("@")
        ? "fail"
        : env.EMAIL_ADMIN_RECIPIENTS.includes("@")
          ? "pass"
          : "warn",
    message: env.EMAIL_ADMIN_RECIPIENTS.includes("@")
      ? "Admin email recipients configured."
      : "Admin email recipients are empty.",
  });
};

const checkDatabase = async () => {
  try {
    await db.execute(sql`select 1`);
    addCheck({
      name: "DATABASE_URL",
      status: "pass",
      message: "Database connection succeeded.",
    });
  } catch (error) {
    addCheck({
      name: "DATABASE_URL",
      status: "fail",
      message: `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
    });
    return;
  }

  try {
    const storedPolicies = await db
      .select({
        minimumAdvanceDays: siteSettings.bookingMinimumAdvanceDays,
        timezone: siteSettings.bookingDefaultTimezone,
      })
      .from(siteSettings);
    const effectivePolicy = storedPolicies[0] ?? defaultBookingPolicySettings;
    const policyIssues = validateBookingPolicyInput(effectivePolicy);
    addCheck({
      name: "BOOKING_POLICY",
      status: storedPolicies.length > 1 || policyIssues.length > 0 ? "fail" : "pass",
      message:
        storedPolicies.length > 1
          ? `Expected one global site_settings row; found ${storedPolicies.length}.`
          : policyIssues.length > 0
            ? policyIssues.map((issue) => `${issue.field}: ${issue.message}`).join(" ")
            : `Stored booking policy is valid (${effectivePolicy.minimumAdvanceDays} day(s), ${effectivePolicy.timezone}).`,
    });
  } catch (error) {
    addCheck({
      name: "BOOKING_POLICY",
      status: "fail",
      message: `Stored booking policy could not be validated: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
};

export type CmsPreflightConfig = Pick<typeof env,
  | "R2_UPLOADS_ENABLED"
  | "R2_ENDPOINT"
  | "R2_BUCKET"
  | "R2_ACCESS_KEY_ID"
  | "R2_SECRET_ACCESS_KEY"
  | "R2_PUBLIC_BASE_URL"
  | "R2_MAX_IMAGE_BYTES"
  | "R2_MAX_VIDEO_BYTES"
  | "R2_MAX_ANIMATION_ZIP_BYTES"
  | "R2_MAX_ANIMATION_EXPANDED_BYTES"
  | "R2_MAX_ANIMATION_FRAMES"
  | "CMS_PREVIEW_SECRET"
  | "ADMIN_SESSION_SECRET"
  | "WORKER_POLL_INTERVAL_MS"
  | "WORKER_BATCH_SIZE"
  | "WORKER_CONCURRENCY"
  | "JOB_LEASE_SECONDS"
  | "JOB_TIMEOUT_SECONDS"
  | "WORKER_DRAIN_TIMEOUT_MS"
>;

export const collectCmsMediaChecks = (
  config: CmsPreflightConfig,
  production: boolean,
): Check[] => {
  const result: Check[] = [];
  const check = (name: string, valid: boolean, message: string) => result.push({
    name,
    status: valid ? "pass" : production ? "fail" : "warn",
    message,
  });

  check(
    "R2_UPLOADS_ENABLED",
    config.R2_UPLOADS_ENABLED,
    config.R2_UPLOADS_ENABLED
      ? "Direct R2 uploads are enabled."
      : "Enable direct R2 uploads before deploying the CMS.",
  );
  for (const [name, value] of [
    ["R2_BUCKET", config.R2_BUCKET],
    ["R2_ACCESS_KEY_ID", config.R2_ACCESS_KEY_ID],
    ["R2_SECRET_ACCESS_KEY", config.R2_SECRET_ACCESS_KEY],
  ] as const) {
    check(name, present(value), `${name} is ${redacted(value)}.`);
  }
  for (const [name, value] of [
    ["R2_ENDPOINT", config.R2_ENDPOINT],
    ["R2_PUBLIC_BASE_URL", config.R2_PUBLIC_BASE_URL],
  ] as const) {
    check(
      name,
      production ? isProductionUrl(value) : Boolean(parseUrl(value)),
      `${name} must be an ${production ? "external HTTPS" : "valid"} URL.`,
    );
  }

  const previewSecret = config.CMS_PREVIEW_SECRET?.trim();
  const previewSecretValid = Boolean(
    previewSecret
    && previewSecret.length >= 32
    && previewSecret !== config.ADMIN_SESSION_SECRET
    && !previewSecret.toLowerCase().includes("change-me"),
  );
  check(
    "CMS_PREVIEW_SECRET",
    previewSecretValid,
    previewSecretValid
      ? "Preview tokens use a strong dedicated secret."
      : "Configure a dedicated random preview secret of at least 32 characters; do not reuse the admin session secret.",
  );

  const limitsValid = [
    config.R2_MAX_IMAGE_BYTES,
    config.R2_MAX_VIDEO_BYTES,
    config.R2_MAX_ANIMATION_ZIP_BYTES,
    config.R2_MAX_ANIMATION_EXPANDED_BYTES,
    config.R2_MAX_ANIMATION_FRAMES,
  ].every((value) => Number.isInteger(value) && value > 0)
    && config.R2_MAX_ANIMATION_EXPANDED_BYTES >= config.R2_MAX_ANIMATION_ZIP_BYTES;
  check(
    "R2_MEDIA_LIMITS",
    limitsValid,
    limitsValid
      ? "Image, video, animation archive, expanded-size and frame-count limits are coherent."
      : "Media limits must be positive and the expanded animation limit must not be smaller than the ZIP limit.",
  );

  const workerValid = [
    config.WORKER_POLL_INTERVAL_MS,
    config.WORKER_BATCH_SIZE,
    config.WORKER_CONCURRENCY,
    config.WORKER_DRAIN_TIMEOUT_MS,
  ].every((value) => Number.isInteger(value) && value > 0)
    && config.JOB_LEASE_SECONDS > config.JOB_TIMEOUT_SECONDS;
  check(
    "CMS_WORKER",
    workerValid,
    workerValid
      ? "Worker polling, concurrency, drain timeout and job lease settings are coherent."
      : "Worker values must be positive and JOB_LEASE_SECONDS must exceed JOB_TIMEOUT_SECONDS.",
  );
  return result;
};

const checkCmsMedia = () => {
  checks.push(...collectCmsMediaChecks(env, target === "production"));
};

const checkKnownOperationalWarnings = () => {
  addCheck({
    name: "RATE_LIMITER_STORAGE",
    status: "warn",
    message:
      "Current public/auth limiter is in-process. Keep one API instance or move buckets to Redis before multi-instance deploy.",
  });
};

export const runProductionPreflight = async () => {
  checkEnvironment();
  checkPayments();
  checkGoogleCalendar();
  checkEmail();
  checkCmsMedia();
  await checkDatabase();
  checkKnownOperationalWarnings();

  const failures = checks.filter((check) => check.status === "fail");

  console.log(
    JSON.stringify(
      {
        ok: failures.length === 0,
        target,
        checkedAt: new Date().toISOString(),
        summary: {
          pass: checks.filter((check) => check.status === "pass").length,
          warn: checks.filter((check) => check.status === "warn").length,
          fail: failures.length,
        },
        checks,
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
};

const isMain = process.argv[1]
  ? fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1]).toLowerCase()
  : false;

if (isMain) {
  runProductionPreflight()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(async () => {
      await pool.end();
    });
}
