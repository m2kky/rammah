import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  archiveAdminLocationById,
  createAdminLocation,
  getAdminLocation,
  listAdminLocations,
  updateAdminLocationById,
} from "./admin-locations.service.js";

export const adminLocationsRouter = Router();

const contentStatusSchema = z.enum(["draft", "published", "scheduled", "archived"]);

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const listQuerySchema = z.object({
  status: contentStatusSchema.optional(),
  search: z.string().trim().max(160).optional(),
});

const locationBodySchema = z.object({
  name: z.string().trim().min(1).max(180),
  addressLine1: z.string().trim().min(1),
  addressLine2: z.string().trim().nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Za-z]{2}$/, "Use a two-letter country code."),
  mapUrl: z.string().trim().url().nullable().optional(),
  instructions: z.string().trim().nullable().optional(),
  status: contentStatusSchema.default("draft"),
});

const locationPatchSchema = locationBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required.",
  });

const getAuditContext = (req: Request) => ({
  adminUserId: req.admin?.id,
  ipAddress: req.ip,
});

adminLocationsRouter.use(requireAdmin);

adminLocationsRouter.get(
  "/",
  validateRequest({ query: listQuerySchema }),
  async (req, res, next) => {
    try {
      const locations = await listAdminLocations(req.query);

      res.status(httpStatus.ok).json({
        data: locations,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminLocationsRouter.post(
  "/",
  validateRequest({ body: locationBodySchema }),
  async (req, res, next) => {
    try {
      const location = await createAdminLocation(req.body, getAuditContext(req));

      res.status(httpStatus.created).json({
        data: location,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminLocationsRouter.get(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const location = await getAdminLocation(req.params.id);

      res.status(httpStatus.ok).json({
        data: location,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminLocationsRouter.patch(
  "/:id",
  validateRequest({ params: idParamsSchema, body: locationPatchSchema }),
  async (req, res, next) => {
    try {
      const location = await updateAdminLocationById(
        req.params.id,
        req.body,
        getAuditContext(req),
      );

      res.status(httpStatus.ok).json({
        data: location,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminLocationsRouter.delete(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      await archiveAdminLocationById(req.params.id, getAuditContext(req));

      res.status(httpStatus.noContent).send();
    } catch (error) {
      next(error);
    }
  },
);
