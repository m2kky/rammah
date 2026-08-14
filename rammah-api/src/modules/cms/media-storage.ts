import { randomUUID } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";

export type UploadIntentInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type MediaUploadIntent = {
  assetId: string;
  temporaryStorageKey: string;
  finalStorageKey: string;
  uploadUrl: string;
  publicUrl: string;
  expiresAt: string;
};

export interface MediaStorage {
  createUploadIntent(input: UploadIntentInput): Promise<MediaUploadIntent>;
  headObject(storageKey: string): Promise<{ sizeBytes: number; contentType: string | null }>;
  readRange(storageKey: string, start: number, end: number): Promise<Uint8Array>;
  copyObject(sourceStorageKey: string, destinationStorageKey: string): Promise<void>;
  putObject(storageKey: string, body: Uint8Array, contentType: string): Promise<void>;
  deleteObjects(storageKeys: string[]): Promise<void>;
}

export type R2MediaStorageConfig = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  presignExpiresSeconds: number;
  maxImageBytes: number;
  maxVideoBytes: number;
  maxAnimationZipBytes: number;
  allowedImageMimeTypes: string[];
  allowedVideoMimeTypes: string[];
  temporaryPrefix: string;
  mediaPrefix: string;
};

type StorageClient = {
  send(command: unknown): Promise<unknown>;
};

type Presign = (
  client: StorageClient,
  command: PutObjectCommand,
  options: { expiresIn: number },
) => Promise<string>;

type R2MediaStorageDependencies = {
  client?: StorageClient;
  getSignedUrl?: Presign;
  now?: () => Date;
  randomUUID?: () => string;
};

const immutableCacheControl = "public, max-age=31536000, immutable";
const zipMimeType = "application/zip";

const normalizeMimeType = (value: string) => value.split(";", 1)[0]!.trim().toLowerCase();

const sanitizeFileName = (value: string) => {
  const baseName = value.replaceAll("\\", "/").split("/").at(-1)?.trim().toLowerCase() ?? "";
  const extensionStart = baseName.lastIndexOf(".");
  const rawExtension = extensionStart >= 0 ? baseName.slice(extensionStart) : "";
  const extension = /^\.[a-z0-9]{1,16}$/.test(rawExtension) ? rawExtension : "";
  const stemSource = extension ? baseName.slice(0, extensionStart) : baseName;
  const sanitizedStem = stemSource
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  if (sanitizedStem) return `${sanitizedStem}${extension}`;
  return extension ? `upload${extension}` : "upload.bin";
};

const publicObjectUrl = (baseUrl: string, storageKey: string) =>
  `${baseUrl.replace(/\/+$/, "")}/${storageKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

const copySource = (bucket: string, storageKey: string) =>
  `${bucket}/${storageKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

const uploadLimit = (config: R2MediaStorageConfig, mimeType: string) => {
  if (config.allowedImageMimeTypes.includes(mimeType)) return config.maxImageBytes;
  if (config.allowedVideoMimeTypes.includes(mimeType)) return config.maxVideoBytes;
  if (mimeType === zipMimeType) return config.maxAnimationZipBytes;
  return null;
};

export const createR2MediaStorage = (
  config: R2MediaStorageConfig,
  dependencies: R2MediaStorageDependencies = {},
): MediaStorage => {
  const client = dependencies.client ?? new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  const sign = dependencies.getSignedUrl ?? ((signingClient, command, options) =>
    awsGetSignedUrl(signingClient as S3Client, command, options));
  const now = dependencies.now ?? (() => new Date());
  const createId = dependencies.randomUUID ?? randomUUID;

  return {
    async createUploadIntent(input) {
      const mimeType = normalizeMimeType(input.mimeType);
      const limit = uploadLimit(config, mimeType);
      if (limit === null) {
        throw new Error(`Unsupported upload MIME type: ${mimeType || "unknown"}.`);
      }
      if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > limit) {
        throw new Error(`Upload size must be between 1 and ${limit} bytes for ${mimeType}.`);
      }

      const assetId = createId();
      const createdAt = now();
      const year = String(createdAt.getUTCFullYear());
      const month = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
      const fileName = sanitizeFileName(input.fileName);
      const temporaryStorageKey = `${config.temporaryPrefix}/${year}/${month}/${assetId}/${fileName}`;
      const finalStorageKey = `${config.mediaPrefix}/${assetId}/${fileName}`;
      const uploadUrl = await sign(
        client,
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: temporaryStorageKey,
          ContentType: mimeType,
          ContentLength: input.sizeBytes,
          CacheControl: immutableCacheControl,
        }),
        { expiresIn: config.presignExpiresSeconds },
      );

      return {
        assetId,
        temporaryStorageKey,
        finalStorageKey,
        uploadUrl,
        publicUrl: publicObjectUrl(config.publicBaseUrl, finalStorageKey),
        expiresAt: new Date(
          createdAt.getTime() + config.presignExpiresSeconds * 1_000,
        ).toISOString(),
      };
    },

    async headObject(storageKey) {
      const result = await client.send(new HeadObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
      })) as HeadObjectCommandOutput;
      if (result.ContentLength === undefined) {
        throw new Error("R2 object size is unavailable.");
      }
      return {
        sizeBytes: result.ContentLength,
        contentType: result.ContentType ?? null,
      };
    },

    async readRange(storageKey, start, end) {
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
        throw new Error("Invalid R2 byte range.");
      }
      const result = await client.send(new GetObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
        Range: `bytes=${start}-${end}`,
      })) as { Body?: { transformToByteArray?: () => Promise<Uint8Array> } };
      if (!result.Body?.transformToByteArray) {
        throw new Error("R2 object body is unavailable.");
      }
      return result.Body.transformToByteArray();
    },

    async copyObject(sourceStorageKey, destinationStorageKey) {
      await client.send(new CopyObjectCommand({
        Bucket: config.bucket,
        Key: destinationStorageKey,
        CopySource: copySource(config.bucket, sourceStorageKey),
      }));
    },

    async putObject(storageKey, body, contentType) {
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
        Body: body,
        ContentType: contentType,
        ContentLength: body.byteLength,
        CacheControl: immutableCacheControl,
      }));
    },

    async deleteObjects(storageKeys) {
      for (let index = 0; index < storageKeys.length; index += 1_000) {
        const keys = storageKeys.slice(index, index + 1_000);
        if (keys.length === 0) continue;
        await client.send(new DeleteObjectsCommand({
          Bucket: config.bucket,
          Delete: {
            Quiet: true,
            Objects: keys.map((Key) => ({ Key })),
          },
        }));
      }
    },
  };
};

export const createConfiguredR2MediaStorage = () => {
  if (
    !env.R2_UPLOADS_ENABLED ||
    !env.R2_ENDPOINT ||
    !env.R2_BUCKET ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_PUBLIC_BASE_URL
  ) {
    throw new Error("R2 uploads are not configured.");
  }
  return createR2MediaStorage({
    endpoint: env.R2_ENDPOINT,
    bucket: env.R2_BUCKET,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL,
    presignExpiresSeconds: env.R2_PRESIGN_EXPIRES_SECONDS,
    maxImageBytes: env.R2_MAX_IMAGE_BYTES,
    maxVideoBytes: env.R2_MAX_VIDEO_BYTES,
    maxAnimationZipBytes: env.R2_MAX_ANIMATION_ZIP_BYTES,
    allowedImageMimeTypes: env.R2_ALLOWED_IMAGE_MIME_TYPES,
    allowedVideoMimeTypes: env.R2_ALLOWED_VIDEO_MIME_TYPES,
    temporaryPrefix: env.R2_TEMP_PREFIX,
    mediaPrefix: env.R2_MEDIA_PREFIX,
  });
};
