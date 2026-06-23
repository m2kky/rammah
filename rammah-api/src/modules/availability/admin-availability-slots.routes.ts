import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import { previewAvailabilitySlots } from "./availability-slots.service.js";

export const adminAvailabilitySlotsRouter = Router();

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date.");

const slotPreviewQuerySchema = z.object({
  offeringId: z.string().uuid(),
  dateFrom: dateSchema,
  dateTo: dateSchema,
});

adminAvailabilitySlotsRouter.use(requireAdmin);

adminAvailabilitySlotsRouter.get(
  "/",
  validateRequest({ query: slotPreviewQuerySchema }),
  async (req, res, next) => {
    try {
      const preview = await previewAvailabilitySlots(
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
