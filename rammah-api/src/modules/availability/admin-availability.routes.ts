import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  createAdminAvailabilityWindow,
  deleteOrArchiveAdminAvailabilityWindowById,
  getAdminAvailabilityWindow,
  listAdminAvailabilityWindows,
  updateAdminAvailabilityWindowById,
} from "./admin-availability.service.js";

export const adminAvailabilityWindowsRouter = Router();

const idParamsSchema = z.object({ id: z.string().uuid() });
const windowStatusSchema = z.enum(["draft", "published", "archived"]);
const writableWindowStatusSchema = z.enum(["draft", "published"]);
const timeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, "Use HH:MM or HH:MM:SS time.");
const listQuerySchema = z.object({
  status: windowStatusSchema.optional(),
  weekday: z.coerce.number().int().min(0).max(6).optional(),
});
const availabilityWindowBodySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startLocalTime: timeSchema,
  endLocalTime: timeSchema,
  status: writableWindowStatusSchema.default("draft"),
});
const availabilityWindowPatchSchema = availabilityWindowBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required.",
  });
const getAuditContext = (req: Request) => ({
  adminUserId: req.admin?.id,
  ipAddress: req.ip,
});

adminAvailabilityWindowsRouter.use(requireAdmin);

adminAvailabilityWindowsRouter.get(
  "/",
  validateRequest({ query: listQuerySchema }),
  async (req, res, next) => {
    try {
      res.status(httpStatus.ok).json({ data: await listAdminAvailabilityWindows(req.query) });
    } catch (error) {
      next(error);
    }
  },
);

adminAvailabilityWindowsRouter.post(
  "/",
  validateRequest({ body: availabilityWindowBodySchema }),
  async (req, res, next) => {
    try {
      const data = await createAdminAvailabilityWindow(req.body, getAuditContext(req));
      res.status(httpStatus.created).json({ data });
    } catch (error) {
      next(error);
    }
  },
);

adminAvailabilityWindowsRouter.get(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      res.status(httpStatus.ok).json({ data: await getAdminAvailabilityWindow(req.params.id) });
    } catch (error) {
      next(error);
    }
  },
);

adminAvailabilityWindowsRouter.patch(
  "/:id",
  validateRequest({ params: idParamsSchema, body: availabilityWindowPatchSchema }),
  async (req, res, next) => {
    try {
      const data = await updateAdminAvailabilityWindowById(
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

adminAvailabilityWindowsRouter.delete(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const result = await deleteOrArchiveAdminAvailabilityWindowById(
        req.params.id,
        getAuditContext(req),
      );
      if (result.action === "deleted") {
        res.status(httpStatus.noContent).send();
        return;
      }
      res.status(httpStatus.ok).json(result);
    } catch (error) {
      next(error);
    }
  },
);
