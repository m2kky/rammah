import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  getAdminBooking,
  listAdminBookings,
  rescheduleAdminBookingById,
  retryAdminBookingCalendarSync,
  updateAdminBookingStatusById,
} from "./admin-bookings.service.js";

export const adminBookingsRouter = Router();

const bookingStatusSchema = z.enum([
  "draft",
  "pending_payment",
  "payment_failed",
  "confirmed",
  "cancelled",
  "rescheduled",
  "completed",
  "no_show",
  "expired",
  "rejected",
]);

const listQuerySchema = z.object({
  status: bookingStatusSchema.optional(),
  search: z.string().trim().max(255).optional(),
});

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const statusPatchBodySchema = z.object({
  status: bookingStatusSchema,
  reason: z.string().trim().max(500).optional(),
});

const rescheduleBodySchema = z.object({
  offeringSessionId: z.string().uuid().nullable().optional(),
  startsAt: z.string().trim().min(1),
  endsAt: z.string().trim().min(1),
  timezone: z.string().trim().min(1).max(80).nullable().optional(),
  reason: z.string().trim().max(500).optional(),
});

const getAuditContext = (req: Request) => ({
  adminUserId: req.admin?.id,
  ipAddress: req.ip,
});

adminBookingsRouter.use(requireAdmin);

adminBookingsRouter.get(
  "/",
  validateRequest({ query: listQuerySchema }),
  async (req, res, next) => {
    try {
      const bookings = await listAdminBookings(req.query);

      res.status(httpStatus.ok).json({
        data: bookings,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminBookingsRouter.get(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const booking = await getAdminBooking(req.params.id);

      res.status(httpStatus.ok).json({
        data: booking,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminBookingsRouter.patch(
  "/:id/status",
  validateRequest({ params: idParamsSchema, body: statusPatchBodySchema }),
  async (req, res, next) => {
    try {
      const booking = await updateAdminBookingStatusById(
        req.params.id,
        req.body,
        getAuditContext(req),
      );

      res.status(httpStatus.ok).json({
        data: booking,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminBookingsRouter.post(
  "/:id/reschedule",
  validateRequest({ params: idParamsSchema, body: rescheduleBodySchema }),
  async (req, res, next) => {
    try {
      const booking = await rescheduleAdminBookingById(
        req.params.id,
        req.body,
        getAuditContext(req),
      );

      res.status(httpStatus.ok).json({
        data: booking,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminBookingsRouter.post(
  "/:id/calendar/retry",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const booking = await retryAdminBookingCalendarSync(req.params.id, getAuditContext(req));

      res.status(httpStatus.ok).json({
        data: booking,
      });
    } catch (error) {
      next(error);
    }
  },
);
