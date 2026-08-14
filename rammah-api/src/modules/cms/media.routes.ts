import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import { mediaService } from "./media.service.js";

const idParamsSchema = z.object({ id: z.string().uuid() });

const uploadIntentBodySchema = z.object({
  displayName: z.string().trim().min(1).max(255).optional(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive(),
  altText: z.string().trim().max(2_000).nullable().optional(),
});

const finalizeBodySchema = z.object({ assetId: z.string().uuid() });

const externalBodySchema = z.object({
  displayName: z.string().trim().min(1).max(255),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  mediaKind: z.enum(["image", "video"]),
  publicUrl: z.string().trim().url(),
  altText: z.string().trim().max(2_000).nullable(),
});

const listQuerySchema = z.object({
  search: z.string().trim().max(255).optional(),
  status: z.enum(["draft", "published", "scheduled", "archived"]).optional(),
  sourceType: z.enum(["r2", "external"]).optional(),
  mediaKind: z.enum(["image", "video", "animation_bundle"]).optional(),
  processingState: z.enum(["pending", "ready", "failed"]).optional(),
});

const patchBodySchema = z.object({
  displayName: z.string().trim().min(1).max(255).optional(),
  altText: z.string().trim().max(2_000).nullable().optional(),
}).refine((body) => Object.keys(body).length > 0, {
  message: "At least one field is required.",
});

const auditContext = (req: Request) => ({
  adminUserId: req.admin?.id,
  ipAddress: req.ip,
});

export const mediaRouter = Router();
mediaRouter.use(requireAdmin);

  mediaRouter.post(
    "/upload-intents",
    validateRequest({ body: uploadIntentBodySchema }),
    async (req, res, next) => {
      try {
        const intent = await mediaService.createUploadIntent(req.body, auditContext(req));
        res.status(httpStatus.created).json({ data: intent });
      } catch (error) {
        next(error);
      }
    },
  );

  mediaRouter.post(
    "/finalize",
    validateRequest({ body: finalizeBodySchema }),
    async (req, res, next) => {
      try {
        const asset = await mediaService.finalizeUpload(req.body, auditContext(req));
        res.status(httpStatus.ok).json({ data: asset });
      } catch (error) {
        next(error);
      }
    },
  );

  mediaRouter.post(
    "/external",
    validateRequest({ body: externalBodySchema }),
    async (req, res, next) => {
      try {
        const asset = await mediaService.createExternal(req.body, auditContext(req));
        res.status(httpStatus.created).json({ data: asset });
      } catch (error) {
        next(error);
      }
    },
  );

  mediaRouter.get(
    "/",
    validateRequest({ query: listQuerySchema }),
    async (req, res, next) => {
      try {
        const assets = await mediaService.list(req.query);
        res.status(httpStatus.ok).json({ data: assets });
      } catch (error) {
        next(error);
      }
    },
  );

  mediaRouter.get(
    "/:id/usages",
    validateRequest({ params: idParamsSchema }),
    async (req, res, next) => {
      try {
        const usages = await mediaService.listUsages(req.params.id);
        res.status(httpStatus.ok).json({ data: usages });
      } catch (error) {
        next(error);
      }
    },
  );

  mediaRouter.patch(
    "/:id",
    validateRequest({ params: idParamsSchema, body: patchBodySchema }),
    async (req, res, next) => {
      try {
        const asset = await mediaService.patch(req.params.id, req.body, auditContext(req));
        res.status(httpStatus.ok).json({ data: asset });
      } catch (error) {
        next(error);
      }
    },
  );

  mediaRouter.delete(
    "/:id/permanent",
    validateRequest({ params: idParamsSchema }),
    async (req, res, next) => {
      try {
        await mediaService.permanentlyDelete(req.params.id, auditContext(req));
        res.status(httpStatus.noContent).send();
      } catch (error) {
        next(error);
      }
    },
  );

  mediaRouter.delete(
    "/:id",
    validateRequest({ params: idParamsSchema }),
    async (req, res, next) => {
      try {
        await mediaService.archive(req.params.id, auditContext(req));
        res.status(httpStatus.noContent).send();
      } catch (error) {
        next(error);
      }
    },
  );
