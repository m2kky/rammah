import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog } from "../audit/audit.service.js";
import {
  listEmailDeliveries,
  listEmailTemplates,
  retryEmailDelivery,
  saveEmailTemplate,
} from "./email.service.js";

export const adminEmailsRouter = Router();

const deliveryStatusSchema = z.enum(["queued", "sent", "failed", "suppressed"]);
const templateStatusSchema = z.enum(["draft", "published", "scheduled", "archived"]);

const listDeliveriesQuerySchema = z.object({
  status: deliveryStatusSchema.optional(),
  resourceType: z.string().trim().min(1).max(80).optional(),
  resourceId: z.string().uuid().optional(),
  search: z.string().trim().max(255).optional(),
});

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const templateParamsSchema = z.object({
  key: z.string().trim().min(1).max(160).regex(/^[a-z0-9_.-]+$/i),
});

const templateBodySchema = z.object({
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(12000),
  status: templateStatusSchema.default("published"),
});

const getAuditContext = (req: Request) => ({
  adminUserId: req.admin?.id,
  ipAddress: req.ip,
});

adminEmailsRouter.use(requireAdmin);

adminEmailsRouter.get(
  "/deliveries",
  validateRequest({ query: listDeliveriesQuerySchema }),
  async (req, res, next) => {
    try {
      const deliveries = await listEmailDeliveries(req.query);

      res.status(httpStatus.ok).json({
        data: deliveries,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminEmailsRouter.post(
  "/deliveries/:id/retry",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const delivery = await retryEmailDelivery(req.params.id);

      await writeAuditLog(getAuditContext(req), {
        action: "admin.emails.delivery_retry",
        resourceType: "email_delivery",
        resourceId: delivery?.id ?? req.params.id,
        beforeSnapshot: null,
        afterSnapshot: delivery ?? null,
      });

      res.status(httpStatus.ok).json({
        data: delivery,
      });
    } catch (error) {
      next(error);
    }
  },
);

adminEmailsRouter.get("/templates", async (_req, res, next) => {
  try {
    const templates = await listEmailTemplates();

    res.status(httpStatus.ok).json({
      data: templates,
    });
  } catch (error) {
    next(error);
  }
});

adminEmailsRouter.patch(
  "/templates/:key",
  validateRequest({ params: templateParamsSchema, body: templateBodySchema }),
  async (req, res, next) => {
    try {
      const template = await saveEmailTemplate({
        key: req.params.key,
        subject: req.body.subject,
        body: req.body.body,
        status: req.body.status,
      });

      await writeAuditLog(getAuditContext(req), {
        action: "admin.emails.template_save",
        resourceType: "email_template",
        resourceId: template.id,
        beforeSnapshot: null,
        afterSnapshot: template,
      });

      res.status(httpStatus.ok).json({
        data: template,
      });
    } catch (error) {
      next(error);
    }
  },
);
