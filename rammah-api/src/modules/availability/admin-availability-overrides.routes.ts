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

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const overrideTypeSchema = z.enum(["available", "blocked"]);
const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date.");
const timestampSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Use an ISO timestamp.",
  });

const listQuerySchema = z.object({
  offeringId: z.string().uuid().optional(),
  availabilityRuleId: z.string().uuid().optional(),
  overrideType: overrideTypeSchema.optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
});

const availabilityOverrideBodySchema = z.object({
  offeringId: z.string().uuid(),
  availabilityRuleId: z.string().uuid().nullable().optional(),
  date: dateSchema,
  overrideType: overrideTypeSchema.default("blocked"),
  startsAt: timestampSchema.nullable().optional(),
  endsAt: timestampSchema.nullable().optional(),
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
      const overrides = await listAdminAvailabilityOverrides(req.query);

      res.status(httpStatus.ok).json({
        data: overrides,
      });
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
      const override = await createAdminAvailabilityOverride(
        req.body,
        getAuditContext(req),
      );

      res.status(httpStatus.created).json({
        data: override,
      });
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
      const override = await getAdminAvailabilityOverride(req.params.id);

      res.status(httpStatus.ok).json({
        data: override,
      });
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
      const override = await updateAdminAvailabilityOverrideById(
        req.params.id,
        req.body,
        getAuditContext(req),
      );

      res.status(httpStatus.ok).json({
        data: override,
      });
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
