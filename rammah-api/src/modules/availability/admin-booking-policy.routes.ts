import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import { getAdminBookingPolicy, updateAdminBookingPolicy } from "./booking-policy.service.js";

export const adminBookingPolicyRouter = Router();

const policyBodySchema = z.object({
  bookingMinimumAdvanceDays: z.number().int().min(1).max(365),
  bookingDefaultTimezone: z.string().trim().min(1).max(80),
});

const auditContext = (req: Request) => ({
  adminUserId: req.admin?.id,
  ipAddress: req.ip,
});

adminBookingPolicyRouter.use(requireAdmin);

adminBookingPolicyRouter.get("/", async (_req, res, next) => {
  try {
    res.status(httpStatus.ok).json({ data: await getAdminBookingPolicy() });
  } catch (error) {
    next(error);
  }
});

adminBookingPolicyRouter.patch(
  "/",
  validateRequest({ body: policyBodySchema }),
  async (req, res, next) => {
    try {
      res.status(httpStatus.ok).json({
        data: await updateAdminBookingPolicy(req.body, auditContext(req)),
      });
    } catch (error) {
      next(error);
    }
  },
);
