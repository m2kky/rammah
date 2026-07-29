import type { Request } from "express";
import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../middleware/validate-request.js";
import { detectCountryFromRequest } from "../../shared/geo/request-country.js";
import { previewPublicOfferingPrice } from "./public-price-preview.service.js";

export const publicPricePreviewRouter = Router();
export { detectCountryFromRequest };

const pricePreviewBodySchema = z.object({
  offeringId: z.string().uuid(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Use a two-letter country code.")
    .nullable()
    .optional(),
  couponCode: z.string().trim().max(80).nullable().optional(),
});

publicPricePreviewRouter.post(
  "/",
  validateRequest({ body: pricePreviewBodySchema }),
  async (req, res, next) => {
    try {
      const preview = await previewPublicOfferingPrice({
        ...req.body,
        detectedCountryCode: detectCountryFromRequest(req).countryCode,
      });

      res.json({
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  },
);
