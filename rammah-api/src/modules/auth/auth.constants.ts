import type { CookieOptions } from "express";
import { env } from "../../config/env.js";

export const adminSessionCookieName = "rammah_admin_session";

export const adminSessionDurationMs = 1000 * 60 * 60 * 24 * 7;

export const adminSessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: adminSessionDurationMs,
};
