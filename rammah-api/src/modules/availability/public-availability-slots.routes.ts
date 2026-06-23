import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import { previewPublicAvailabilitySlots } from "./availability-slots.service.js";

export const publicAvailabilitySlotsRouter = Router();

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date.");

const slotPreviewQuerySchema = z.object({
  offeringId: z.string().uuid(),
  dateFrom: dateSchema,
  dateTo: dateSchema,
});

publicAvailabilitySlotsRouter.get(
  "/",
  validateRequest({ query: slotPreviewQuerySchema }),
  async (req, res, next) => {
    try {
      const preview = await previewPublicAvailabilitySlots(
        req.query as z.infer<typeof slotPreviewQuerySchema>,
      );

      res.status(httpStatus.ok).json({
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  },
);
