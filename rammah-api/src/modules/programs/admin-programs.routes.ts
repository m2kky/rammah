import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  createAdminProgram,
  deleteOrArchiveAdminProgramById,
  getAdminProgram,
  listAdminPrograms,
  publishAdminProgramById,
  retryAdminProgramCalendarById,
  updateAdminProgramById,
} from "./admin-programs.service.js";

export const adminProgramsRouter = Router();

const idParamsSchema = z.object({ id: z.string().uuid() });
const statusSchema = z.enum(["draft", "published", "archived"]);
const attendanceModeSchema = z.enum(["online", "offline", "hybrid"]);
const occurrenceStatusSchema = z.enum(["scheduled", "cancelled"]);
const timestampSchema = z.string().datetime({ offset: true });
const occurrenceSchema = z.object({
  id: z.string().uuid().optional(),
  startsAt: timestampSchema,
  endsAt: timestampSchema,
  timezone: z.string().trim().min(1).max(80),
  attendanceMode: attendanceModeSchema,
  locationId: z.string().uuid().nullable().optional(),
  status: occurrenceStatusSchema.default("scheduled"),
});
const programBodySchema = z.object({
  offeringId: z.string().uuid(),
  title: z.string().trim().min(1).max(220),
  timezone: z.string().trim().min(1).max(80),
  attendanceMode: attendanceModeSchema,
  locationId: z.string().uuid().nullable().optional(),
  capacity: z.number().int().min(1).max(10000),
  registrationOpensAt: timestampSchema.nullable().optional(),
  registrationClosesAt: timestampSchema.nullable().optional(),
  occurrences: z.array(occurrenceSchema).max(200),
});
const programPatchSchema = programBodySchema.partial().refine((body) => Object.keys(body).length > 0, {
  message: "At least one field is required.",
});
const listQuerySchema = z.object({
  offeringId: z.string().uuid().optional(),
  status: statusSchema.optional(),
  search: z.string().trim().min(1).max(180).optional(),
});
const auditContext = (req: Request) => ({ adminUserId: req.admin?.id, ipAddress: req.ip });

adminProgramsRouter.use(requireAdmin);

adminProgramsRouter.get("/", validateRequest({ query: listQuerySchema }), async (req, res, next) => {
  try {
    res.status(httpStatus.ok).json({ data: await listAdminPrograms(req.query) });
  } catch (error) {
    next(error);
  }
});

adminProgramsRouter.post("/", validateRequest({ body: programBodySchema }), async (req, res, next) => {
  try {
    res.status(httpStatus.created).json({ data: await createAdminProgram(req.body, auditContext(req)) });
  } catch (error) {
    next(error);
  }
});

adminProgramsRouter.get("/:id", validateRequest({ params: idParamsSchema }), async (req, res, next) => {
  try {
    res.status(httpStatus.ok).json({ data: await getAdminProgram(req.params.id) });
  } catch (error) {
    next(error);
  }
});

adminProgramsRouter.patch(
  "/:id",
  validateRequest({ params: idParamsSchema, body: programPatchSchema }),
  async (req, res, next) => {
    try {
      res.status(httpStatus.ok).json({
        data: await updateAdminProgramById(req.params.id, req.body, auditContext(req)),
      });
    } catch (error) {
      next(error);
    }
  },
);

adminProgramsRouter.post(
  "/:id/publish",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      res.status(httpStatus.ok).json({
        data: await publishAdminProgramById(req.params.id, auditContext(req)),
      });
    } catch (error) {
      next(error);
    }
  },
);

adminProgramsRouter.post(
  "/:id/calendar/retry",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      res.status(httpStatus.ok).json(
        await retryAdminProgramCalendarById(req.params.id, auditContext(req)),
      );
    } catch (error) {
      next(error);
    }
  },
);

adminProgramsRouter.delete("/:id", validateRequest({ params: idParamsSchema }), async (req, res, next) => {
  try {
    const result = await deleteOrArchiveAdminProgramById(req.params.id, auditContext(req));
    if (result.action === "deleted") {
      res.status(httpStatus.noContent).send();
      return;
    }
    res.status(httpStatus.ok).json(result);
  } catch (error) {
    next(error);
  }
});
