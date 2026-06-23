import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  archiveAdminSessionById,
  createAdminSession,
  getAdminSession,
  listAdminSessions,
  updateAdminSessionById,
} from "./admin-sessions.service.js";

export const adminSessionsRouter = Router();

const contentStatusSchema = z.enum(["draft", "published", "scheduled", "archived"]);
const attendanceModeSchema = z.enum(["online", "offline", "hybrid"]);

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const isoTimestampSchema = z
  .string()
  .trim()
  .datetime({ offset: true });

const listQuerySchema = z.object({
  offeringId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  attendanceMode: attendanceModeSchema.optional(),
  status: contentStatusSchema.optional(),
  dateFrom: isoTimestampSchema.optional(),
  dateTo: isoTimestampSchema.optional(),
});

const sessionBodySchema = z.object({
  offeringId: z.string().uuid(),
  startsAt: isoTimestampSchema,
  endsAt: isoTimestampSchema,
  timezone: z.string().trim().min(1).max(80).default("Africa/Cairo"),
  capacity: z.number().int().min(1).max(100000).default(1),
  attendanceMode: attendanceModeSchema,
  locationId: z.string().uuid().nullable().optional(),
  googleCalendarEventId: z.string().trim().nullable().optional(),
  status: contentStatusSchema.default("draft"),
});

const sessionPatchSchema = sessionBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required.",
  });

const getAuditContext = (req: Request) => ({
  adminUserId: req.admin?.id,
  ipAddress: req.ip,
});

adminSessionsRouter.use(requireAdmin);

adminSessionsRouter.get(
  "/",
  validateRequest({ query: listQuerySchema }),
  async (req, res, next) => {
    try {
      const sessions = await listAdminSessions(req.query);

      res.status(httpStatus.ok).json({
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminSessionsRouter.post(
  "/",
  validateRequest({ body: sessionBodySchema }),
  async (req, res, next) => {
    try {
      const session = await createAdminSession(req.body, getAuditContext(req));

      res.status(httpStatus.created).json({
        data: session,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminSessionsRouter.get(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const session = await getAdminSession(req.params.id);

      res.status(httpStatus.ok).json({
        data: session,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminSessionsRouter.patch(
  "/:id",
  validateRequest({ params: idParamsSchema, body: sessionPatchSchema }),
  async (req, res, next) => {
    try {
      const session = await updateAdminSessionById(
        req.params.id,
        req.body,
        getAuditContext(req),
      );

      res.status(httpStatus.ok).json({
        data: session,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminSessionsRouter.delete(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      await archiveAdminSessionById(req.params.id, getAuditContext(req));

      res.status(httpStatus.noContent).send();
    } catch (error) {
      next(error);
    }
  },
);
