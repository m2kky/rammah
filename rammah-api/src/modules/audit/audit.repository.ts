import { db } from "../../db/client.js";
import { auditLogs } from "../../db/schema/index.js";

export type AuditLogInput = {
  adminUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  ipAddress?: string;
};

export const insertAuditLog = async (input: AuditLogInput) => {
  await db.insert(auditLogs).values({
    adminUserId: input.adminUserId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    beforeSnapshot: input.beforeSnapshot ?? null,
    afterSnapshot: input.afterSnapshot ?? null,
    ipAddress: input.ipAddress,
  });
};
