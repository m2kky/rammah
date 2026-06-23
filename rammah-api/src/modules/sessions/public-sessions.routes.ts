import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import { listPublicOfferingSessions } from "./public-sessions.service.js";

export const publicSessionsRouter = Router();

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date.");

const sessionsQuerySchema = z.object({
  offeringId: z.string().uuid(),
  dateFrom: dateSchema,
  dateTo: dateSchema,
});

publicSessionsRouter.get(
  "/",
  validateRequest({ query: sessionsQuerySchema }),
  async (req, res, next) => {
    try {
      const sessions = await listPublicOfferingSessions(
        req.query as z.infer<typeof sessionsQuerySchema>,
      );

      res.status(httpStatus.ok).json({
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  },
);
