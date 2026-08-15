import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import { mediaAssets, outboxEvents } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import { listMediaAssetUsages } from "./media-assignments.service.js";
import { detectAllowedMedia } from "./media-signature.js";
import {
  createConfiguredR2MediaStorage,
  type MediaStorage,
} from "./media-storage.js";

export type MediaKind = "image" | "video" | "animation_bundle";
export type MediaSourceType = "r2" | "external";
export type MediaProcessingState = "pending" | "ready" | "failed";
export type MediaStatus = "draft" | "published" | "scheduled" | "archived";

export type MediaAssetRecord = {
  id: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  sourceType: MediaSourceType;
  mediaKind: MediaKind;
  storageKey: string | null;
  publicUrl: string | null;
  altText: string | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
  processingState: MediaProcessingState;
  processingError: string | null;
  status: MediaStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type MediaUsage = {
  ownerType: string;
  ownerId?: string;
  ownerLabel?: string;
  slotKey: string;
};

export type CreatePendingUploadInput = {
  id: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  mediaKind: MediaKind;
  storageKey: string;
  publicUrl: string;
  altText: string | null;
  sizeBytes: number;
  metadata: Record<string, unknown>;
  processingState: "pending";
};

export type CreateExternalMediaInput = {
  displayName: string;
  fileName: string;
  mimeType: string;
  mediaKind: "image" | "video";
  publicUrl: string;
  altText: string | null;
};

export type MediaListInput = {
  search?: string;
  status?: MediaStatus;
  sourceType?: MediaSourceType;
  mediaKind?: MediaKind;
  processingState?: MediaProcessingState;
};

export type MediaPatchInput = {
  displayName?: string;
  altText?: string | null;
};

export interface MediaRepository {
  createPendingUpload(input: CreatePendingUploadInput): Promise<MediaAssetRecord>;
  findById(id: string): Promise<MediaAssetRecord | null>;
  markReady(
    id: string,
    input: { mimeType: string; mediaKind: MediaKind; metadata?: Record<string, unknown> },
  ): Promise<MediaAssetRecord>;
  queueAnimationProcessing(id: string): Promise<MediaAssetRecord>;
  markFailed(id: string, processingError: string): Promise<MediaAssetRecord>;
  createExternal(input: CreateExternalMediaInput): Promise<MediaAssetRecord>;
  list(input: MediaListInput): Promise<MediaAssetRecord[]>;
  patch(id: string, input: MediaPatchInput): Promise<MediaAssetRecord | null>;
  listUsages(id: string): Promise<MediaUsage[]>;
  archive(id: string): Promise<MediaAssetRecord | null>;
  delete(id: string): Promise<void>;
}

const toRecord = (row: typeof mediaAssets.$inferSelect): MediaAssetRecord => row;

export const databaseMediaRepository: MediaRepository = {
  async createPendingUpload(input) {
    const [row] = await db.insert(mediaAssets).values({
      ...input,
      sourceType: "r2",
      width: null,
      height: null,
      durationMs: null,
      processingError: null,
      status: "draft",
    }).returning();
    return toRecord(row!);
  },

  async findById(id) {
    const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    return row ? toRecord(row) : null;
  },

  async markReady(id, input) {
    const [row] = await db.update(mediaAssets).set({
      mimeType: input.mimeType,
      mediaKind: input.mediaKind,
      metadata: input.metadata,
      processingState: "ready",
      processingError: null,
      updatedAt: new Date(),
    }).where(eq(mediaAssets.id, id)).returning();
    if (!row) throw mediaNotFound();
    return toRecord(row);
  },

  async queueAnimationProcessing(id) {
    const asset = await this.findById(id);
    if (!asset) throw mediaNotFound();
    await db.insert(outboxEvents).values({
      topic: "cms.media.animation_bundle.process",
      aggregateType: "media_asset",
      aggregateId: id,
      payload: { assetId: id },
      idempotencyKey: `cms.media.animation_bundle.process:${id}`,
    }).onConflictDoNothing({ target: outboxEvents.idempotencyKey });
    return asset;
  },

  async markFailed(id, processingError) {
    const [row] = await db.update(mediaAssets).set({
      processingState: "failed",
      processingError,
      updatedAt: new Date(),
    }).where(eq(mediaAssets.id, id)).returning();
    if (!row) throw mediaNotFound();
    return toRecord(row);
  },

  async createExternal(input) {
    const [row] = await db.insert(mediaAssets).values({
      ...input,
      sourceType: "external",
      storageKey: null,
      sizeBytes: 0,
      metadata: {},
      processingState: "ready",
      processingError: null,
      status: "draft",
    }).returning();
    return toRecord(row!);
  },

  async list(input) {
    const filters: SQL[] = [];
    if (input.status) filters.push(eq(mediaAssets.status, input.status));
    if (input.sourceType) filters.push(eq(mediaAssets.sourceType, input.sourceType));
    if (input.mediaKind) filters.push(eq(mediaAssets.mediaKind, input.mediaKind));
    if (input.processingState) {
      filters.push(eq(mediaAssets.processingState, input.processingState));
    }
    if (input.search?.trim()) {
      const pattern = `%${input.search.trim()}%`;
      filters.push(or(
        ilike(mediaAssets.displayName, pattern),
        ilike(mediaAssets.fileName, pattern),
      )!);
    }
    const query = db.select().from(mediaAssets).orderBy(desc(mediaAssets.createdAt));
    const rows = filters.length > 0 ? await query.where(and(...filters)) : await query;
    return rows.map(toRecord);
  },

  async patch(id, input) {
    const [row] = await db.update(mediaAssets).set({
      ...input,
      updatedAt: new Date(),
    }).where(eq(mediaAssets.id, id)).returning();
    return row ? toRecord(row) : null;
  },

  listUsages: listMediaAssetUsages,

  async archive(id) {
    const [row] = await db.update(mediaAssets).set({
      status: "archived",
      updatedAt: new Date(),
    }).where(eq(mediaAssets.id, id)).returning();
    return row ? toRecord(row) : null;
  },

  async delete(id) {
    await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
  },
};

type MediaAuditInput = {
  action: string;
  resourceId: string;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
};

type MediaServiceDependencies = {
  storage?: MediaStorage;
  getStorage?: () => MediaStorage;
  repository?: MediaRepository;
  audit?: (context: AuditContext | undefined, input: MediaAuditInput) => Promise<void>;
};

const mediaNotFound = () => new AppError({
  code: "NOT_FOUND",
  message: "Media asset was not found.",
  statusCode: httpStatus.notFound,
});

const normalizeMimeType = (value: string) => value.split(";", 1)[0]!.trim().toLowerCase();

const mediaKindForUpload = (mimeType: string): MediaKind => {
  if (mimeType.startsWith("image/") && mimeType !== "image/svg+xml") return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/zip") return "animation_bundle";
  throw new AppError({
    code: "VALIDATION_ERROR",
    message: "Upload must be a supported image, video, or animation ZIP.",
    statusCode: httpStatus.unprocessableEntity,
  });
};

const safeFailureMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Uploaded media is invalid.";
  return message.slice(0, 500);
};

const metadataString = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return typeof value === "string" && value ? value : null;
};

const publicMetadata = (metadata: Record<string, unknown>) => {
  const result = { ...metadata };
  delete result.temporaryStorageKey;
  delete result.finalStorageKey;
  delete result.uploadExpiresAt;
  delete result.objectKeys;
  return result;
};

const publicAsset = (asset: MediaAssetRecord) => {
  const { storageKey: _storageKey, ...safe } = asset;
  return {
    ...safe,
    metadata: publicMetadata(asset.metadata),
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
};

const defaultAudit = async (context: AuditContext | undefined, input: MediaAuditInput) => {
  await writeAuditLog(context, {
    ...input,
    resourceType: "media_asset",
  });
};

export const createMediaService = (dependencies: MediaServiceDependencies = {}) => {
  const repository = dependencies.repository ?? databaseMediaRepository;
  const getStorage = dependencies.getStorage ?? (
    dependencies.storage
      ? () => dependencies.storage!
      : createConfiguredR2MediaStorage
  );
  const audit = dependencies.audit ?? (
    dependencies.repository ? async () => undefined : defaultAudit
  );

  const assertUnused = async (id: string) => {
    const usages = await repository.listUsages(id);
    if (usages.length > 0) {
      throw new AppError({
        code: "MEDIA_IN_USE",
        message: "Media cannot be removed while it is still in use.",
        statusCode: httpStatus.conflict,
        meta: { usages },
      });
    }
  };

  return {
    async createUploadIntent(input: {
      displayName?: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      altText?: string | null;
    }, context?: AuditContext) {
      const mimeType = normalizeMimeType(input.mimeType);
      const mediaKind = mediaKindForUpload(mimeType);
      const intent = await getStorage().createUploadIntent({
        fileName: input.fileName,
        mimeType,
        sizeBytes: input.sizeBytes,
      });
      const asset = await repository.createPendingUpload({
        id: intent.assetId,
        displayName: input.displayName?.trim() || input.fileName,
        fileName: input.fileName,
        mimeType,
        mediaKind,
        storageKey: intent.finalStorageKey,
        publicUrl: intent.publicUrl,
        altText: input.altText?.trim() || null,
        sizeBytes: input.sizeBytes,
        metadata: {
          temporaryStorageKey: intent.temporaryStorageKey,
          finalStorageKey: intent.finalStorageKey,
          uploadExpiresAt: intent.expiresAt,
        },
        processingState: "pending",
      });
      await audit(context, {
        action: "admin.cms.media_assets.upload_intent.create",
        resourceId: asset.id,
        afterSnapshot: publicAsset(asset),
      });
      return {
        assetId: intent.assetId,
        uploadUrl: intent.uploadUrl,
        expiresAt: intent.expiresAt,
        mimeType,
        sizeBytes: input.sizeBytes,
      };
    },

    async finalizeUpload(input: { assetId: string }, context?: AuditContext) {
      const asset = await repository.findById(input.assetId);
      if (!asset) throw mediaNotFound();
      if (asset.sourceType !== "r2" || asset.processingState !== "pending") {
        throw new AppError({
          code: "CONFLICT",
          message: "Only pending R2 uploads can be finalized.",
          statusCode: httpStatus.conflict,
        });
      }
      const temporaryStorageKey = metadataString(asset.metadata, "temporaryStorageKey");
      const finalStorageKey = asset.storageKey ?? metadataString(asset.metadata, "finalStorageKey");
      if (!temporaryStorageKey || !finalStorageKey) {
        throw new AppError({
          code: "MEDIA_UPLOAD_INVALID",
          message: "Upload metadata is incomplete. Start the upload again.",
          statusCode: httpStatus.unprocessableEntity,
        });
      }

      const storage = getStorage();
      let ready: MediaAssetRecord;
      try {
        const object = await storage.headObject(temporaryStorageKey);
        if (object.sizeBytes !== asset.sizeBytes) {
          throw new Error("Uploaded file size does not match the upload intent.");
        }
        const objectType = object.contentType ? normalizeMimeType(object.contentType) : null;
        if (objectType !== normalizeMimeType(asset.mimeType)) {
          throw new Error("Uploaded content type does not match the upload intent.");
        }
        const signatureBytes = await storage.readRange(
          temporaryStorageKey,
          0,
          Math.min(object.sizeBytes, 8_192) - 1,
        );
        const detected = await detectAllowedMedia(signatureBytes, asset.mimeType);
        await storage.copyObject(temporaryStorageKey, finalStorageKey);
        await storage.deleteObjects([temporaryStorageKey]);
        ready = detected.mediaKind === "animation_bundle"
          ? await repository.queueAnimationProcessing(asset.id)
          : await repository.markReady(asset.id, {
            mimeType: detected.mimeType,
            mediaKind: detected.mediaKind,
          });
      } catch (error) {
        const message = safeFailureMessage(error);
        await repository.markFailed(asset.id, message);
        throw new AppError({
          code: "MEDIA_UPLOAD_INVALID",
          message,
          statusCode: httpStatus.unprocessableEntity,
        });
      }
      await audit(context, {
        action: "admin.cms.media_assets.upload.finalize",
        resourceId: ready.id,
        beforeSnapshot: publicAsset(asset),
        afterSnapshot: publicAsset(ready),
      });
      return publicAsset(ready);
    },

    async createExternal(input: CreateExternalMediaInput, context?: AuditContext) {
      let url: URL;
      try {
        url = new URL(input.publicUrl);
      } catch {
        url = new URL("http://invalid.local");
      }
      const mimeType = normalizeMimeType(input.mimeType);
      const mimeMatchesKind = input.mediaKind === "image"
        ? mimeType.startsWith("image/") && mimeType !== "image/svg+xml"
        : mimeType.startsWith("video/");
      if (url.protocol !== "https:" || !mimeMatchesKind) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "External media requires an HTTPS image or video URL with a matching MIME type.",
          statusCode: httpStatus.unprocessableEntity,
        });
      }
      const asset = await repository.createExternal({
        ...input,
        displayName: input.displayName.trim(),
        fileName: input.fileName.trim(),
        mimeType,
        publicUrl: url.toString(),
        altText: input.altText?.trim() || null,
      });
      await audit(context, {
        action: "admin.cms.media_assets.external.create",
        resourceId: asset.id,
        afterSnapshot: publicAsset(asset),
      });
      return publicAsset(asset);
    },

    async list(input: MediaListInput = {}) {
      const assets = await repository.list(input);
      return assets.map(publicAsset);
    },

    async findById(id: string) {
      const asset = await repository.findById(id);
      if (!asset) throw mediaNotFound();
      return publicAsset(asset);
    },

    async listUsages(id: string) {
      const asset = await repository.findById(id);
      if (!asset) throw mediaNotFound();
      return repository.listUsages(id);
    },

    async patch(id: string, input: MediaPatchInput, context?: AuditContext) {
      const before = await repository.findById(id);
      if (!before) throw mediaNotFound();
      const asset = await repository.patch(id, {
        displayName: input.displayName?.trim(),
        altText: input.altText === undefined ? undefined : input.altText?.trim() || null,
      });
      if (!asset) throw mediaNotFound();
      await audit(context, {
        action: "admin.cms.media_assets.update",
        resourceId: id,
        beforeSnapshot: publicAsset(before),
        afterSnapshot: publicAsset(asset),
      });
      return publicAsset(asset);
    },

    async archive(id: string, context?: AuditContext) {
      const before = await repository.findById(id);
      if (!before) throw mediaNotFound();
      await assertUnused(id);
      const asset = await repository.archive(id);
      if (!asset) throw mediaNotFound();
      await audit(context, {
        action: "admin.cms.media_assets.archive",
        resourceId: id,
        beforeSnapshot: publicAsset(before),
        afterSnapshot: publicAsset(asset),
      });
      return publicAsset(asset);
    },

    async permanentlyDelete(id: string, context?: AuditContext) {
      const asset = await repository.findById(id);
      if (!asset) throw mediaNotFound();
      if (asset.status !== "archived") {
        throw new AppError({
          code: "CONFLICT",
          message: "Archive media before deleting it permanently.",
          statusCode: httpStatus.conflict,
        });
      }
      await assertUnused(id);
      if (asset.sourceType === "r2") {
        const objectKeys = Array.isArray(asset.metadata.objectKeys)
          ? asset.metadata.objectKeys.filter((key): key is string => typeof key === "string")
          : [];
        const keys = [
          asset.storageKey,
          metadataString(asset.metadata, "temporaryStorageKey"),
          ...objectKeys,
        ].filter((key): key is string => Boolean(key));
        const uniqueKeys = [...new Set(keys)];
        if (uniqueKeys.length > 0) await getStorage().deleteObjects(uniqueKeys);
      }
      await repository.delete(id);
      await audit(context, {
        action: "admin.cms.media_assets.delete_permanently",
        resourceId: id,
        beforeSnapshot: publicAsset(asset),
      });
    },
  };
};

export const mediaService = createMediaService();
export type MediaService = ReturnType<typeof createMediaService>;
