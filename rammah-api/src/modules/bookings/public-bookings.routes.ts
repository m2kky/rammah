import { Router } from "express";
import { z } from "zod";
import { publicSubmissionRateLimit } from "../../middleware/rate-limit.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import { detectCountryFromRequest } from "../../shared/geo/request-country.js";
import {
  buildPublicBookingCalendar,
  cancelPublicBooking,
  getPublicBookingStatus,
  reschedulePublicBooking,
  submitFreeBooking,
} from "./public-bookings.service.js";

export const publicBookingsRouter = Router();

const attendanceModeSchema = z.enum(["online", "offline", "hybrid"]);

const bookingAnswerSchema = z.object({
  fieldId: z.string().uuid().nullable().optional(),
  fieldKey: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(220),
  value: z.string().trim().max(4000).nullable().optional(),
});

const createBookingBodySchema = z.object({
  holdId: z.string().uuid(),
  holdToken: z.string().trim().min(1).max(200).optional(),
  attendanceMode: attendanceModeSchema.optional(),
  locationId: z.string().uuid().nullable().optional(),
  customer: z.object({
    fullName: z.string().trim().min(2).max(220),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().min(5).max(80).nullable().optional(),
  }),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Use a two-letter country code.")
    .nullable()
    .optional(),
  timezone: z.string().trim().min(1).max(80).default("Africa/Cairo"),
  answers: z.array(bookingAnswerSchema).max(50).default([]),
});

const publicTokenParamsSchema = z.object({
  publicToken: z.string().uuid(),
});
const rescheduleBodySchema = z.object({
  offeringSessionId: z.string().uuid().nullable().optional(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  timezone: z.string().trim().min(1).max(80).nullable().optional(),
});

publicBookingsRouter.post(
  "/",
  publicSubmissionRateLimit,
  validateRequest({ body: createBookingBodySchema }),
  async (req, res, next) => {
    try {
      const booking = await submitFreeBooking({
        ...req.body,
        countryCode: req.body.countryCode ?? detectCountryFromRequest(req).countryCode,
      });

      res.status(httpStatus.created).json({
        data: booking,
      });
    } catch (error) {
      next(error);
    }
  },
);

publicBookingsRouter.get(
  "/:publicToken/status",
  validateRequest({ params: publicTokenParamsSchema }),
  async (req, res, next) => {
    try {
      const booking = await getPublicBookingStatus(req.params.publicToken);

      res.status(httpStatus.ok).json({
        data: booking,
      });
    } catch (error) {
      next(error);
    }
  },
);

publicBookingsRouter.post(
  "/:publicToken/cancel",
  publicSubmissionRateLimit,
  validateRequest({ params: publicTokenParamsSchema }),
  async (req, res, next) => {
    try {
      res.status(httpStatus.ok).json({
        data: await cancelPublicBooking(req.params.publicToken),
      });
    } catch (error) {
      next(error);
    }
  },
);

publicBookingsRouter.post(
  "/:publicToken/reschedule",
  publicSubmissionRateLimit,
  validateRequest({ params: publicTokenParamsSchema, body: rescheduleBodySchema }),
  async (req, res, next) => {
    try {
      res.status(httpStatus.ok).json({
        data: await reschedulePublicBooking(req.params.publicToken, req.body),
      });
    } catch (error) {
      next(error);
    }
  },
);

publicBookingsRouter.get(
  "/:publicToken/calendar.ics",
  validateRequest({ params: publicTokenParamsSchema }),
  async (req, res, next) => {
    try {
      const calendar = await buildPublicBookingCalendar(req.params.publicToken);
      res
        .status(httpStatus.ok)
        .type("text/calendar")
        .attachment(`rammah-${req.params.publicToken}.ics`)
        .send(calendar);
    } catch (error) {
      next(error);
    }
  },
);
