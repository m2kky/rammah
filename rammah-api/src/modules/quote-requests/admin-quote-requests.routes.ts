import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  getAdminQuoteRequest,
  listAdminQuoteRequests,
  updateAdminQuoteRequestById,
} from "./admin-quote-requests.service.js";

export const adminQuoteRequestsRouter = Router();

const quoteStatusSchema = z.enum(["new", "reviewing", "contacted", "won", "lost", "archived"]);

const listQuerySchema = z.object({
  status: quoteStatusSchema.optional(),
  search: z.string().trim().max(255).optional(),
});

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const patchBodySchema = z
  .object({
    status: quoteStatusSchema.optional(),
    adminNotes: z.string().trim().max(4000).nullable().optional(),
  })
  .refine((value) => value.status !== undefined || value.adminNotes !== undefined, {
    message: "Provide status or adminNotes.",
  });

const getAuditContext = (req: Request) => ({
  adminUserId: req.admin?.id,
  ipAddress: req.ip,
});

adminQuoteRequestsRouter.use(requireAdmin);

adminQuoteRequestsRouter.get(
  "/",
  validateRequest({ query: listQuerySchema }),
  async (req, res, next) => {
    try {
      const quoteRequests = await listAdminQuoteRequests(req.query);

      res.status(httpStatus.ok).json({
        data: quoteRequests,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminQuoteRequestsRouter.get(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const quoteRequest = await getAdminQuoteRequest(req.params.id);

      res.status(httpStatus.ok).json({
        data: quoteRequest,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminQuoteRequestsRouter.patch(
  "/:id",
  validateRequest({ params: idParamsSchema, body: patchBodySchema }),
  async (req, res, next) => {
    try {
      const quoteRequest = await updateAdminQuoteRequestById(
        req.params.id,
        req.body,
        getAuditContext(req),
      );

      res.status(httpStatus.ok).json({
        data: quoteRequest,
      });
    } catch (error) {
      next(error);
    }
  },
);
