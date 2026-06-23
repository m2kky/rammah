import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  getPublicOfferingBookingConfig,
  getPublicOfferingBySlug,
  listPublicOfferings,
} from "./offerings.service.js";

export const publicOfferingsRouter = Router();

const slugParamsSchema = z.object({
  slug: z.string().min(1).max(180),
});

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

publicOfferingsRouter.get("/", async (_req, res, next) => {
  try {
    const offerings = await listPublicOfferings();

    res.status(httpStatus.ok).json({
      data: offerings,
    });
  } catch (error) {
    next(error);
  }
});

publicOfferingsRouter.get(
  "/:id/booking-config",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const config = await getPublicOfferingBookingConfig(req.params.id);

      res.status(httpStatus.ok).json({
        data: config,
      });
    } catch (error) {
      next(error);
    }
  },
);

publicOfferingsRouter.get(
  "/:slug",
  validateRequest({ params: slugParamsSchema }),
  async (req, res, next) => {
    try {
      const offering = await getPublicOfferingBySlug(req.params.slug);

      res.status(httpStatus.ok).json({
        data: offering,
      });
    } catch (error) {
      next(error);
    }
  },
);
