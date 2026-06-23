import "dotenv/config";
import { z } from "zod";

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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const frontendOrigins = env.FRONTEND_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
