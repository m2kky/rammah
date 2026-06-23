import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  archiveAdminBookingFormFieldById,
  createAdminBookingFormField,
  getAdminBookingFormField,
  listAdminBookingFormFields,
  updateAdminBookingFormFieldById,
} from "./booking-form-fields.service.js";

export const adminBookingFormFieldsRouter = Router();

const contentStatusSchema = z.enum(["draft", "published", "scheduled", "archived"]);
const fieldTypeSchema = z.enum([
  "text",
  "email",
  "phone",
  "textarea",
  "date",
  "select",
  "checkbox",
  "number",
]);

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const listQuerySchema = z.object({
  offeringId: z.string().uuid().optional(),
  status: contentStatusSchema.optional(),
});

const optionSchema = z.object({
  label: z.string().trim().min(1).max(160),
  value: z.string().trim().min(1).max(120),
});

const fieldBodySchema = z.object({
  offeringId: z.string().uuid().nullable().optional(),
  fieldKey: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, underscores, or hyphens."),
  label: z.string().trim().min(1).max(220),
  fieldType: fieldTypeSchema,
  required: z.boolean().default(false),
  options: z.array(optionSchema).max(30).default([]),
  validationRules: z.record(z.unknown()).default({}),
  sortOrder: z.number().int().min(0).max(100000).default(0),
  status: contentStatusSchema.default("draft"),
});

const fieldPatchSchema = fieldBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required.",
  });

const getAuditContext = (req: Request) => ({
  adminUserId: req.admin?.id,
  ipAddress: req.ip,
});

adminBookingFormFieldsRouter.use(requireAdmin);

adminBookingFormFieldsRouter.get(
  "/",
  validateRequest({ query: listQuerySchema }),
  async (req, res, next) => {
    try {
      const fields = await listAdminBookingFormFields(req.query);

      res.status(httpStatus.ok).json({
        data: fields,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminBookingFormFieldsRouter.post(
  "/",
  validateRequest({ body: fieldBodySchema }),
  async (req, res, next) => {
    try {
      const field = await createAdminBookingFormField(req.body, getAuditContext(req));

      res.status(httpStatus.created).json({
        data: field,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminBookingFormFieldsRouter.get(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const field = await getAdminBookingFormField(req.params.id);

      res.status(httpStatus.ok).json({
        data: field,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminBookingFormFieldsRouter.patch(
  "/:id",
  validateRequest({ params: idParamsSchema, body: fieldPatchSchema }),
  async (req, res, next) => {
    try {
      const field = await updateAdminBookingFormFieldById(
        req.params.id,
        req.body,
        getAuditContext(req),
      );

      res.status(httpStatus.ok).json({
        data: field,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminBookingFormFieldsRouter.delete(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      await archiveAdminBookingFormFieldById(req.params.id, getAuditContext(req));

      res.status(httpStatus.noContent).send();
    } catch (error) {
      next(error);
    }
  },
);
