import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  createAdminAvailabilityOverride,
  deleteAdminAvailabilityOverrideById,
  getAdminAvailabilityOverride,
  listAdminAvailabilityOverrides,
  updateAdminAvailabilityOverrideById,
} from "./admin-availability-overrides.service.js";

export const adminAvailabilityOverridesRouter = Router();
const idParamsSchema = z.object({ id: z.string().uuid() });
const overrideTypeSchema = z.enum(["available", "unavailable"]);
const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date.");
const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "Use HH:MM or HH:MM:SS time.");
const listQuerySchema = z.object({
  type: overrideTypeSchema.optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
});
const availabilityOverrideBodySchema = z.object({
  date: dateSchema,
  type: overrideTypeSchema.default("unavailable"),
  startLocalTime: timeSchema.nullable().optional(),
  endLocalTime: timeSchema.nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
});
const availabilityOverridePatchSchema = availabilityOverrideBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required.",
  });
const getAuditContext = (req: Request) => ({
  adminUserId: req.admin?.id,
  ipAddress: req.ip,
});

adminAvailabilityOverridesRouter.use(requireAdmin);

adminAvailabilityOverridesRouter.get(
  "/",
  validateRequest({ query: listQuerySchema }),
  async (req, res, next) => {
    try {
      res.status(httpStatus.ok).json({ data: await listAdminAvailabilityOverrides(req.query) });
    } catch (error) {
      next(error);
    }
  },
);

adminAvailabilityOverridesRouter.post(
  "/",
  validateRequest({ body: availabilityOverrideBodySchema }),
  async (req, res, next) => {
    try {
      const data = await createAdminAvailabilityOverride(req.body, getAuditContext(req));
      res.status(httpStatus.created).json({ data });
    } catch (error) {
      next(error);
    }
  },
);

adminAvailabilityOverridesRouter.get(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      res.status(httpStatus.ok).json({ data: await getAdminAvailabilityOverride(req.params.id) });
    } catch (error) {
      next(error);
    }
  },
);

adminAvailabilityOverridesRouter.patch(
  "/:id",
  validateRequest({ params: idParamsSchema, body: availabilityOverridePatchSchema }),
  async (req, res, next) => {
    try {
      const data = await updateAdminAvailabilityOverrideById(
        req.params.id,
        req.body,
        getAuditContext(req),
      );
      res.status(httpStatus.ok).json({ data });
    } catch (error) {
      next(error);
    }
  },
);

adminAvailabilityOverridesRouter.delete(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      await deleteAdminAvailabilityOverrideById(req.params.id, getAuditContext(req));
      res.status(httpStatus.noContent).send();
    } catch (error) {
      next(error);
    }
  },
);
