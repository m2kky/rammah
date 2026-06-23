import { insertAuditLog, type AuditLogInput } from "./audit.repository.js";

export type AuditContext = {
  adminUserId?: string;
  ipAddress?: string;
};

export const writeAuditLog = async (
  context: AuditContext | undefined,
  input: Omit<AuditLogInput, "adminUserId" | "ipAddress">,
) => {
  await insertAuditLog({
    ...input,
    adminUserId: context?.adminUserId,
    ipAddress: context?.ipAddress,
  });
};
