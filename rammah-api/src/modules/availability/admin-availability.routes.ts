import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  archiveAdminAvailabilityRuleById,
  createAdminAvailabilityRule,
  getAdminAvailabilityRule,
  listAdminAvailabilityRules,
  updateAdminAvailabilityRuleById,
} from "./admin-availability.service.js";

export const adminAvailabilityRouter = Router();

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const contentStatusSchema = z.enum(["draft", "published", "scheduled", "archived"]);
const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "Use HH:MM or HH:MM:SS time.");

const listQuerySchema = z.object({
  offeringId: z.string().uuid().optional(),
  status: contentStatusSchema.optional(),
});

const availabilityRuleBodySchema = z.object({
  offeringId: z.string().uuid(),
  weekday: z.number().int().min(0).max(6),
  startTime: timeSchema,
  endTime: timeSchema,
  timezone: z.string().trim().min(1).max(80).default("Africa/Cairo"),
  slotDurationMinutes: z.number().int().min(1).max(1440),
  bufferBeforeMinutes: z.number().int().min(0).max(1440).default(0),
  bufferAfterMinutes: z.number().int().min(0).max(1440).default(0),
  status: contentStatusSchema.default("draft"),
});

const availabilityRulePatchSchema = availabilityRuleBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required.",
  });

const getAuditContext = (req: Request) => ({
  adminUserId: req.admin?.id,
  ipAddress: req.ip,
});

adminAvailabilityRouter.use(requireAdmin);

adminAvailabilityRouter.get(
  "/",
  validateRequest({ query: listQuerySchema }),
  async (req, res, next) => {
    try {
      const rules = await listAdminAvailabilityRules(req.query);

      res.status(httpStatus.ok).json({
        data: rules,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminAvailabilityRouter.post(
  "/",
  validateRequest({ body: availabilityRuleBodySchema }),
  async (req, res, next) => {
    try {
      const rule = await createAdminAvailabilityRule(
        req.body,
        getAuditContext(req),
      );

      res.status(httpStatus.created).json({
        data: rule,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminAvailabilityRouter.get(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const rule = await getAdminAvailabilityRule(req.params.id);

      res.status(httpStatus.ok).json({
        data: rule,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminAvailabilityRouter.patch(
  "/:id",
  validateRequest({ params: idParamsSchema, body: availabilityRulePatchSchema }),
  async (req, res, next) => {
    try {
      const rule = await updateAdminAvailabilityRuleById(
        req.params.id,
        req.body,
        getAuditContext(req),
      );

      res.status(httpStatus.ok).json({
        data: rule,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminAvailabilityRouter.delete(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      await archiveAdminAvailabilityRuleById(req.params.id, getAuditContext(req));

      res.status(httpStatus.noContent).send();
    } catch (error) {
      next(error);
    }
  },
);
