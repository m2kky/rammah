import { Router } from "express";
import { z } from "zod";
import { publicSubmissionRateLimit } from "../../middleware/rate-limit.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import { submitPublicQuoteRequest } from "./public-quote-requests.service.js";

export const publicQuoteRequestsRouter = Router();

const quoteRequestBodySchema = z.object({
  offeringId: z.string().uuid().nullable().optional(),
  fullName: z.string().trim().min(1).max(220),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(80).nullable().optional(),
  companyName: z.string().trim().max(220).nullable().optional(),
  participantsCount: z.number().int().min(1).max(100000).nullable().optional(),
  preferredDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date.")
    .nullable()
    .optional(),
  message: z.string().trim().max(5000).nullable().optional(),
});

publicQuoteRequestsRouter.post(
  "/",
  publicSubmissionRateLimit,
  validateRequest({ body: quoteRequestBodySchema }),
  async (req, res, next) => {
    try {
      const quoteRequest = await submitPublicQuoteRequest(req.body);

      res.status(httpStatus.created).json({
        data: quoteRequest,
      });
    } catch (error) {
      next(error);
    }
  },
);
