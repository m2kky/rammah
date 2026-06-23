import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  archiveAdminOfferingById,
  archiveAdminOfferingPriceById,
  createAdminOffering,
  createAdminOfferingPrice,
  getAdminOffering,
  listAdminOfferingCategories,
  listAdminOfferingPrices,
  listAdminOfferings,
  updateAdminOfferingById,
  updateAdminOfferingPriceById,
} from "./admin-offerings.service.js";

export const adminOfferingsRouter = Router();

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const priceParamsSchema = z.object({
  id: z.string().uuid(),
  priceId: z.string().uuid(),
});

const contentStatusSchema = z.enum(["draft", "published", "scheduled", "archived"]);
const offeringTypeSchema = z.enum([
  "coaching",
  "therapy_session",
  "workshop",
  "webinar",
  "course",
  "corporate_training",
  "custom",
]);
const attendanceModeSchema = z.enum(["online", "offline", "hybrid"]);
const bookingModeSchema = z.enum(["free", "paid", "quote_only"]);

const displayConfigSchema = z
  .object({
    backgroundColor: z.string().trim().min(1).max(40).optional(),
    textColor: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

const adminOfferingBodySchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(220),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase URL slug."),
  shortDescription: z.string().trim().max(1000).nullable().optional(),
  longDescription: z.string().trim().max(10000).nullable().optional(),
  offeringType: offeringTypeSchema,
  attendanceMode: attendanceModeSchema.default("online"),
  bookingMode: bookingModeSchema.default("free"),
  durationMinutes: z.number().int().min(1).max(1440),
  capacity: z.number().int().min(1).max(10000).default(1),
  requiresPayment: z.boolean().default(false),
  quoteOnly: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(100000).default(0),
  displayConfig: displayConfigSchema.default({}),
  status: contentStatusSchema.default("draft"),
});

const adminOfferingPatchSchema = adminOfferingBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required.",
  });

const listQuerySchema = z.object({
  status: contentStatusSchema.optional(),
  search: z.string().trim().min(1).max(180).optional(),
});

const adminOfferingPriceBodySchema = z.object({
  countryCode: z.string().trim().length(2),
  currency: z.string().trim().length(3),
  baseAmountMinor: z.number().int().min(0).max(1000000000),
  earlyBirdAmountMinor: z.number().int().min(0).max(1000000000).nullable().optional(),
  earlyBirdEndsAt: z.string().datetime().nullable().optional(),
  status: contentStatusSchema.default("draft"),
});

const adminOfferingPricePatchSchema = adminOfferingPriceBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required.",
  });

const getAuditContext = (req: Request) => ({
  adminUserId: req.admin?.id,
  ipAddress: req.ip,
});

adminOfferingsRouter.use(requireAdmin);

adminOfferingsRouter.get("/categories", async (_req, res, next) => {
  try {
    const categories = await listAdminOfferingCategories();

    res.status(httpStatus.ok).json({
      data: categories,
    });
  } catch (error) {
    next(error);
  }
});

adminOfferingsRouter.get(
  "/",
  validateRequest({ query: listQuerySchema }),
  async (req, res, next) => {
    try {
      const filters = req.query as z.infer<typeof listQuerySchema>;
      const offerings = await listAdminOfferings(filters);

      res.status(httpStatus.ok).json({
        data: offerings,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminOfferingsRouter.post(
  "/",
  validateRequest({ body: adminOfferingBodySchema }),
  async (req, res, next) => {
    try {
      const offering = await createAdminOffering(req.body, getAuditContext(req));

      res.status(httpStatus.created).json({
        data: offering,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminOfferingsRouter.get(
  "/:id/prices",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const prices = await listAdminOfferingPrices(req.params.id);

      res.status(httpStatus.ok).json({
        data: prices,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminOfferingsRouter.post(
  "/:id/prices",
  validateRequest({ params: idParamsSchema, body: adminOfferingPriceBodySchema }),
  async (req, res, next) => {
    try {
      const price = await createAdminOfferingPrice(
        req.params.id,
        req.body,
        getAuditContext(req),
      );

      res.status(httpStatus.created).json({
        data: price,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminOfferingsRouter.patch(
  "/:id/prices/:priceId",
  validateRequest({ params: priceParamsSchema, body: adminOfferingPricePatchSchema }),
  async (req, res, next) => {
    try {
      const price = await updateAdminOfferingPriceById(
        req.params.id,
        req.params.priceId,
        req.body,
        getAuditContext(req),
      );

      res.status(httpStatus.ok).json({
        data: price,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminOfferingsRouter.delete(
  "/:id/prices/:priceId",
  validateRequest({ params: priceParamsSchema }),
  async (req, res, next) => {
    try {
      await archiveAdminOfferingPriceById(
        req.params.id,
        req.params.priceId,
        getAuditContext(req),
      );

      res.status(httpStatus.noContent).send();
    } catch (error) {
      next(error);
    }
  },
);

adminOfferingsRouter.get(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const offering = await getAdminOffering(req.params.id);

      res.status(httpStatus.ok).json({
        data: offering,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminOfferingsRouter.patch(
  "/:id",
  validateRequest({ params: idParamsSchema, body: adminOfferingPatchSchema }),
  async (req, res, next) => {
    try {
      const offering = await updateAdminOfferingById(
        req.params.id,
        req.body,
        getAuditContext(req),
      );

      res.status(httpStatus.ok).json({
        data: offering,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminOfferingsRouter.delete(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      await archiveAdminOfferingById(req.params.id, getAuditContext(req));

      res.status(httpStatus.noContent).send();
    } catch (error) {
      next(error);
    }
  },
);
