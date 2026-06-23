import type { Request } from "express";
import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../middleware/validate-request.js";
import { previewPublicOfferingPrice } from "./public-price-preview.service.js";

export const publicPricePreviewRouter = Router();

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

const readDetectedCountryCode = (req: Request) => {
  const headerNames = [
    "x-country-code",
    "x-vercel-ip-country",
    "cf-ipcountry",
    "x-geo-country",
  ];

  for (const headerName of headerNames) {
    const value = req.header(headerName);

    if (value) {
      return value;
    }
  }

  return null;
};

publicPricePreviewRouter.post(
  "/",
  validateRequest({ body: pricePreviewBodySchema }),
  async (req, res, next) => {
    try {
      const preview = await previewPublicOfferingPrice({
        ...req.body,
        detectedCountryCode: readDetectedCountryCode(req),
      });

      res.json({
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  },
);
