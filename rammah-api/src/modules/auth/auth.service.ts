import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { generateSessionToken } from "../../shared/crypto/session-token.js";
import { verifyPassword } from "../../shared/crypto/password.js";
import {
  createAdminSession,
  findAdminByEmail,
  findAdminBySessionToken,
  revokeAdminSession,
  updateAdminLastLogin,
} from "./auth.repository.js";
import { adminSessionDurationMs } from "./auth.constants.js";
import type { LoginResult } from "./auth.types.js";

const invalidCredentialsError = () =>
  new AppError({
    code: "AUTH_REQUIRED",
    message: "Invalid email or password.",
    statusCode: httpStatus.unauthorized,
  });

export const loginAdmin = async (input: {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<LoginResult> => {
  const admin = await findAdminByEmail(input.email);

  if (!admin || admin.status !== "active") {
    throw invalidCredentialsError();
  }

  const passwordValid = await verifyPassword(input.password, admin.passwordHash);

  if (!passwordValid) {
    throw invalidCredentialsError();
  }

  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + adminSessionDurationMs);

  await createAdminSession({
    adminUserId: admin.id,
    sessionToken,
    expiresAt,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  await updateAdminLastLogin(admin.id);

  return {
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: admin.status,
    },
    sessionToken,
    expiresAt,
  };
};

export const logoutAdmin = async (sessionToken?: string) => {
  if (!sessionToken) return;
  await revokeAdminSession(sessionToken);
};

export const getAdminFromSession = async (sessionToken?: string) => {
  if (!sessionToken) {
    return null;
  }

  return findAdminBySessionToken(sessionToken);
};
