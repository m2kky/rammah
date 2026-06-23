import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../db/client.js";
import { adminSessions, adminUsers } from "../../db/schema/index.js";
import { hashSessionToken } from "../../shared/crypto/session-token.js";
import type { AuthenticatedAdmin } from "./auth.types.js";

export const findAdminByEmail = async (email: string) => {
  const rows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email.toLowerCase()))
    .limit(1);

  return rows[0] ?? null;
};

export const updateAdminLastLogin = async (adminUserId: string) => {
  await db
    .update(adminUsers)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(adminUsers.id, adminUserId));
};

export const createAdminSession = async (input: {
  adminUserId: string;
  sessionToken: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}) => {
  await db.insert(adminSessions).values({
    adminUserId: input.adminUserId,
    sessionTokenHash: hashSessionToken(input.sessionToken),
    expiresAt: input.expiresAt,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
};

export const revokeAdminSession = async (sessionToken: string) => {
  await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.sessionTokenHash, hashSessionToken(sessionToken)));
};

export const findAdminBySessionToken = async (
  sessionToken: string,
): Promise<AuthenticatedAdmin | null> => {
  const rows = await db
    .select({
      id: adminUsers.id,
      name: adminUsers.name,
      email: adminUsers.email,
      role: adminUsers.role,
      status: adminUsers.status,
    })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.sessionTokenHash, hashSessionToken(sessionToken)),
        isNull(adminSessions.revokedAt),
        gt(adminSessions.expiresAt, new Date()),
        eq(adminUsers.status, "active"),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
};
