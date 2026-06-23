import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  getAdminPayment,
  listAdminPayments,
  reconcileAdminPayment,
} from "./admin-payments.service.js";

export const adminPaymentsRouter = Router();

const paymentStatusSchema = z.enum([
  "created",
  "pending",
  "processing",
  "paid",
  "failed",
  "abandoned",
  "cancelled",
  "expired",
  "refunded",
]);

const listQuerySchema = z.object({
  status: paymentStatusSchema.optional(),
  search: z.string().trim().max(255).optional(),
});

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const getAuditContext = (req: Request) => ({
  adminUserId: req.admin?.id,
  ipAddress: req.ip,
});

adminPaymentsRouter.use(requireAdmin);

adminPaymentsRouter.get(
  "/",
  validateRequest({ query: listQuerySchema }),
  async (req, res, next) => {
    try {
      const payments = await listAdminPayments(req.query);

      res.status(httpStatus.ok).json({
        data: payments,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminPaymentsRouter.get(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const payment = await getAdminPayment(req.params.id);

      res.status(httpStatus.ok).json({
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminPaymentsRouter.post(
  "/:id/reconcile",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const result = await reconcileAdminPayment(req.params.id, getAuditContext(req));

      res.status(httpStatus.ok).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);
