import "dotenv/config";
import { z } from "zod";

const positiveInteger = z.coerce.number().int().positive();
const nonNegativeInteger = z.coerce.number().int().nonnegative();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_PATH: z.string().min(1).default("/api/v1"),
  FRONTEND_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  ADMIN_SESSION_SECRET: z.string().min(12),
  ADMIN_SEED_EMAIL: z.string().email().optional(),
  ADMIN_SEED_PASSWORD: z.string().min(8).optional(),
  ADMIN_SEED_NAME: z.string().min(1).default("Ahmed Ramah Admin"),
  REQUEST_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PAYMENT_PROVIDER: z.enum(["mock", "kashier"]).default("mock"),
  PAYMENT_MODE: z.enum(["test", "live"]).default("test"),
  PAYMENT_HOLD_MINUTES: z.coerce.number().int().positive().default(15),
  BOOKING_MINIMUM_NOTICE_MINUTES: nonNegativeInteger.default(1440),
  BOOKING_DAILY_LIMIT: positiveInteger.default(8),
  KASHIER_MERCHANT_ID: z.string().optional(),
  KASHIER_API_KEY: z.string().optional(),
  KASHIER_SECRET: z.string().optional(),
  KASHIER_ALLOWED_METHODS: z.string().default("card"),
  KASHIER_CALLBACK_URL: z.string().url().optional(),
  KASHIER_RETURN_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALENDAR_CLIENT_ID: z.string().optional(),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALENDAR_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CALENDAR_DEFAULT_CALENDAR_ID: z.string().min(1).default("primary"),
  GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  EMAIL_PROVIDER: z.enum(["mock", "resend"]).default("mock"),
  EMAIL_FROM: z.string().min(1).default("Rammah <no-reply@rammah.local>"),
  EMAIL_ADMIN_RECIPIENTS: z.string().default(""),
  RESEND_API_KEY: z.string().optional(),
  WORKER_POLL_INTERVAL_MS: positiveInteger.default(1000),
  WORKER_BATCH_SIZE: positiveInteger.default(10),
  WORKER_CONCURRENCY: positiveInteger.default(4),
  JOB_LEASE_SECONDS: positiveInteger.default(120),
  JOB_TIMEOUT_SECONDS: positiveInteger.default(90),
  JOB_MAX_ATTEMPTS: positiveInteger.default(8),
  JOB_BACKOFF_BASE_MS: positiveInteger.default(1000),
  JOB_BACKOFF_MAX_MS: positiveInteger.default(300000),
  WORKER_DRAIN_TIMEOUT_MS: positiveInteger.default(30000),
}).superRefine((value, context) => {
  if (value.JOB_LEASE_SECONDS <= value.JOB_TIMEOUT_SECONDS) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JOB_LEASE_SECONDS"],
      message: "JOB_LEASE_SECONDS must be greater than JOB_TIMEOUT_SECONDS",
    });
  }
});

export const parseEnv = (source: Record<string, unknown>) => envSchema.parse(source);

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const frontendOrigins = env.FRONTEND_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
