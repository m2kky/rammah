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
  getAdminOfferingPriceMetadata,
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
const schedulingModeSchema = z.enum(["appointment", "scheduled_program"]);

const displayConfigSchema = z
  .object({
    backgroundColor: z.string().trim().min(1).max(40).optional(),
    textColor: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

const adminOfferingFieldsSchema = z.object({
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
  schedulingMode: schedulingModeSchema.default("appointment"),
  durationMinutes: z.number().int().min(1).max(1440).nullable(),
  bufferBeforeMinutes: z.number().int().min(0).max(1440).default(0),
  bufferAfterMinutes: z.number().int().min(0).max(1440).default(0),
  capacity: z.number().int().min(1).max(10000).default(1),
  requiresPayment: z.boolean().default(false),
  quoteOnly: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(100000).default(0),
  displayConfig: displayConfigSchema.default({}),
  status: contentStatusSchema.default("draft"),
});

export const adminOfferingBodySchema = adminOfferingFieldsSchema.superRefine(
  (body, context) => {
    if (body.schedulingMode === "appointment" && body.durationMinutes === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["durationMinutes"],
        message: "Appointment offerings require a duration.",
      });
    }

    if (body.schedulingMode === "scheduled_program" && body.durationMinutes !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["durationMinutes"],
        message: "Scheduled programs do not use an appointment duration.",
      });
    }
  },
);

export const adminOfferingPatchSchema = adminOfferingFieldsSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required.",
  });

const listQuerySchema = z.object({
  status: contentStatusSchema.optional(),
  search: z.string().trim().min(1).max(180).optional(),
});

const adminOfferingPriceFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  countryCodes: z.array(z.string().trim().length(2)).min(1).max(249).optional(),
  countryCode: z.string().trim().length(2).optional(),
  currency: z.string().trim().length(3),
  baseAmountMinor: z.number().int().min(0).max(1000000000),
  earlyBirdAmountMinor: z.number().int().min(0).max(1000000000).nullable().optional(),
  earlyBirdEndsAt: z.string().datetime().nullable().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
});

const validatePriceCountryFields = (
  body: { countryCode?: string; countryCodes?: string[] },
  context: z.RefinementCtx,
  requireCountry: boolean,
) => {
  const hasLegacy = body.countryCode !== undefined;
  const hasGroup = body.countryCodes !== undefined;
  if (hasLegacy && hasGroup) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["countryCodes"],
      message: "Use countryCodes or legacy countryCode, not both.",
    });
  }
  if (requireCountry && !hasLegacy && !hasGroup) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["countryCodes"],
      message: "Select at least one country.",
    });
  }
};

export const adminOfferingPriceBodySchema = adminOfferingPriceFieldsSchema.superRefine(
  (body, context) => validatePriceCountryFields(body, context, true),
);

export const adminOfferingPricePatchSchema = adminOfferingPriceFieldsSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required.",
  })
  .superRefine((body, context) => validatePriceCountryFields(body, context, false));

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
        meta: getAdminOfferingPriceMetadata(),
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
