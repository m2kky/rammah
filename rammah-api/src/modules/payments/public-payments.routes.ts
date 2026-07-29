import { Router, type Request } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { publicSubmissionRateLimit } from "../../middleware/rate-limit.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import { detectCountryFromRequest } from "../../shared/geo/request-country.js";
import {
  getPublicPaymentSession,
  handleKashierCallback,
  reconcilePublicPayment,
  startPublicPaymentForBooking,
  submitPaidBooking,
} from "./public-payments.service.js";

export const publicPaymentsRouter = Router();
export const paymentWebhooksRouter = Router();

const attendanceModeSchema = z.enum(["online", "offline", "hybrid"]);

const bookingAnswerSchema = z.object({
  fieldId: z.string().uuid().nullable().optional(),
  fieldKey: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(220),
  value: z.string().trim().max(4000).nullable().optional(),
});

const createPaidBookingBodySchema = z.object({
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

const startPaymentBodySchema = z.object({
  publicToken: z.string().uuid(),
});

const getRawQuery = (req: Request) => {
  const queryStart = req.originalUrl.indexOf("?");
  return queryStart === -1 ? "" : req.originalUrl.slice(queryStart + 1);
};

const buildReturnUrl = (publicToken: string | null) => {
  const returnUrl = new URL(env.KASHIER_RETURN_URL ?? "http://localhost:3000/booking/payment/return");

  if (publicToken) {
    returnUrl.searchParams.set("booking", publicToken);
  }

  return returnUrl.toString();
};

publicPaymentsRouter.post(
  "/paid-bookings",
  publicSubmissionRateLimit,
  validateRequest({ body: createPaidBookingBodySchema }),
  async (req, res, next) => {
    try {
      const result = await submitPaidBooking({
        ...req.body,
        detectedCountryCode: detectCountryFromRequest(req).countryCode,
      });

      res.status(httpStatus.created).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

publicPaymentsRouter.get(
  "/bookings/:publicToken/payment-session",
  validateRequest({ params: publicTokenParamsSchema }),
  async (req, res, next) => {
    try {
      const result = await getPublicPaymentSession(req.params.publicToken);

      res.status(httpStatus.ok).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

publicPaymentsRouter.post(
  "/start",
  publicSubmissionRateLimit,
  validateRequest({ body: startPaymentBodySchema }),
  async (req, res, next) => {
    try {
      const result = await startPublicPaymentForBooking(req.body.publicToken);

      res.status(httpStatus.ok).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

publicPaymentsRouter.post(
  "/bookings/:publicToken/start",
  publicSubmissionRateLimit,
  validateRequest({ params: publicTokenParamsSchema }),
  async (req, res, next) => {
    try {
      const result = await startPublicPaymentForBooking(req.params.publicToken);

      res.status(httpStatus.ok).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

publicPaymentsRouter.post(
  "/bookings/:publicToken/reconcile",
  publicSubmissionRateLimit,
  validateRequest({ params: publicTokenParamsSchema }),
  async (req, res, next) => {
    try {
      const result = await reconcilePublicPayment(req.params.publicToken);

      res.status(httpStatus.ok).json({
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

paymentWebhooksRouter.get("/kashier", async (req, res, next) => {
  try {
    const result = await handleKashierCallback(getRawQuery(req));
    res.redirect(302, buildReturnUrl(result.publicToken));
  } catch (error) {
    next(error);
  }
});
