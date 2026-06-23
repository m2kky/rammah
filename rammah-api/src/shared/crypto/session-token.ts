import crypto from "node:crypto";
import { env } from "../../config/env.js";

export const generateSessionToken = () => crypto.randomBytes(32).toString("base64url");

export const hashSessionToken = (token: string) =>
  crypto.createHmac("sha256", env.ADMIN_SESSION_SECRET).update(token).digest("hex");
