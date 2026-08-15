import { basename, posix } from "node:path";
import { eq } from "drizzle-orm";
import { Open, type File as ZipFile } from "unzipper";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { mediaAssets } from "../../db/schema/index.js";
import { detectAllowedMedia } from "./media-signature.js";
import {
  createConfiguredR2MediaStorage,
  type MediaStorage,
} from "./media-storage.js";
import { databaseMediaRepository, type MediaAssetRecord } from "./media.service.js";

type ReadyAnimationBundle = {
  frameCount: number;
  width: number;
  height: number;
  manifestUrl: string;
  manifestStorageKey: string;
  objectKeys: string[];
};

export interface AnimationBundleRepository {
  findById(id: string): Promise<MediaAssetRecord | null>;
  markReady(id: string, input: ReadyAnimationBundle): Promise<MediaAssetRecord>;
  markFailed(id: string, processingError: string): Promise<unknown>;
}

const databaseAnimationBundleRepository: AnimationBundleRepository = {
  findById: databaseMediaRepository.findById,

  async markReady(id, input) {
    const asset = await databaseMediaRepository.findById(id);
    if (!asset) throw new Error("Animation bundle asset was not found.");
    const [ready] = await db.update(mediaAssets).set({
      storageKey: input.manifestStorageKey,
      publicUrl: input.manifestUrl,
      width: input.width,
      height: input.height,
      metadata: {
        ...asset.metadata,
        frameCount: input.frameCount,
        manifestUrl: input.manifestUrl,
        manifestStorageKey: input.manifestStorageKey,
        objectKeys: input.objectKeys,
      },
      processingState: "ready",
      processingError: null,
      updatedAt: new Date(),
    }).where(eq(mediaAssets.id, id)).returning();
    if (!ready) throw new Error("Animation bundle asset was not found.");
    return ready;
  },

  async markFailed(id, processingError) {
    await databaseMediaRepository.markFailed(id, processingError);
  },
};

type AnimationBundleLimits = {
  maxZipBytes: number;
  maxExpandedBytes: number;
  maxFrames: number;
};

type AnimationBundleDependencies = {
  storage?: MediaStorage;
  getStorage?: () => MediaStorage;
  repository?: AnimationBundleRepository;
  limits?: AnimationBundleLimits;
};

type Frame = {
  source: ZipFile;
  number: number;
  fileName: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

const defaultLimits: AnimationBundleLimits = {
  maxZipBytes: env.R2_MAX_ANIMATION_ZIP_BYTES,
  maxExpandedBytes: env.R2_MAX_ANIMATION_EXPANDED_BYTES,
  maxFrames: env.R2_MAX_ANIMATION_FRAMES,
};

const unsafeEntry = (name: string): never => {
  throw new Error(`Unsafe bundle entry: ${name}`);
};

const assertSafePath = (name: string) => {
  if (
    !name
    || name.includes("\\")
    || name.includes("\0")
    || posix.isAbsolute(name)
    || /^[a-z]:/i.test(name)
    || name.split("/").some((part) => part === ".." || part === "." || !part)
  ) {
    unsafeEntry(name);
  }
};

const frameFrom = (entry: ZipFile): Frame => {
  assertSafePath(entry.path);
  if (entry.type !== "File" || (entry.flags & 1) !== 0 || ![0, 8].includes(entry.compressionMethod)) {
    return unsafeEntry(entry.path);
  }
  const fileName = basename(entry.path);
  const match = /^frame(\d{4,6})\.(png|jpe?g|webp)$/i.exec(fileName);
  if (!match) return unsafeEntry(entry.path);
  const extension = match[2]!.toLowerCase();
  return {
    source: entry,
    number: Number(match[1]),
    fileName: fileName.toLowerCase(),
    mimeType: extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : "image/jpeg",
  };
};

const uint24Le = (bytes: Uint8Array, offset: number) =>
  bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);

const pngDimensions = (bytes: Uint8Array) => {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

const webpDimensions = (bytes: Uint8Array) => {
  if (bytes.length < 30) return null;
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk === "VP8X") {
    return {
      width: uint24Le(bytes, 24) + 1,
      height: uint24Le(bytes, 27) + 1,
    };
  }
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    const bits = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff,
      height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff,
    };
  }
  return null;
};

const jpegDimensions = (bytes: Uint8Array) => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    if (length < 2 || offset + length + 2 > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]
      .includes(marker)) {
      return {
        height: (bytes[offset + 5]! << 8) | bytes[offset + 6]!,
        width: (bytes[offset + 7]! << 8) | bytes[offset + 8]!,
      };
    }
    offset += length + 2;
  }
  return null;
};

const imageDimensions = (bytes: Uint8Array, mimeType: Frame["mimeType"]) => {
  const dimensions = mimeType === "image/png"
    ? pngDimensions(bytes)
    : mimeType === "image/webp"
      ? webpDimensions(bytes)
      : jpegDimensions(bytes);
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error("Animation frame dimensions are invalid.");
  }
  return dimensions;
};

const publicChildUrl = (sourceUrl: string, childPath: string) => {
  const url = new URL(sourceUrl);
  const parent = url.pathname.slice(0, url.pathname.lastIndexOf("/") + 1);
  url.pathname = `${parent}${childPath}`;
  url.search = "";
  url.hash = "";
  return url.toString();
};

const safeError = (error: unknown) => (
  error instanceof Error ? error.message : "Animation bundle processing failed."
).slice(0, 500);

export const createAnimationBundleProcessor = (dependencies: AnimationBundleDependencies = {}) => {
  const repository = dependencies.repository ?? databaseAnimationBundleRepository;
  const limits = dependencies.limits ?? defaultLimits;
  const getStorage = dependencies.getStorage ?? (
    dependencies.storage ? () => dependencies.storage! : createConfiguredR2MediaStorage
  );

  return {
    async processAnimationBundle(assetId: string, signal: AbortSignal) {
      const asset = await repository.findById(assetId);
      if (
        !asset
        || asset.sourceType !== "r2"
        || asset.mediaKind !== "animation_bundle"
        || asset.processingState !== "pending"
        || !asset.storageKey
        || !asset.publicUrl
      ) {
        throw new Error("Animation bundle is missing or is not pending processing.");
      }

      const storage = getStorage();
      const writtenKeys: string[] = [];
      try {
        signal.throwIfAborted();
        const object = await storage.headObject(asset.storageKey);
        if (object.sizeBytes <= 0 || object.sizeBytes > limits.maxZipBytes) {
          throw new Error("Animation ZIP byte limit exceeded.");
        }
        const zipBytes = await storage.readRange(asset.storageKey, 0, object.sizeBytes - 1);
        signal.throwIfAborted();
        const archive = await Open.buffer(Buffer.from(zipBytes));
        const files = archive.files.filter((entry) => entry.type !== "Directory");
        const expandedBytes = files.reduce((total, entry) => total + entry.uncompressedSize, 0);
        if (
          files.length === 0
          || files.length > limits.maxFrames
          || !Number.isSafeInteger(expandedBytes)
          || expandedBytes > limits.maxExpandedBytes
        ) {
          throw new Error("Animation bundle frame or expanded-byte limit exceeded.");
        }

        const frames = files.map(frameFrom).sort((left, right) => left.number - right.number);
        frames.forEach((frame, index) => {
          if (frame.number !== index + 1) {
            throw new Error("Animation frame names must use consecutive numbering from frame0001.");
          }
        });

        const sourceParent = asset.storageKey.slice(0, asset.storageKey.lastIndexOf("/"));
        const outputPrefix = `${sourceParent}/animation`;
        let expectedDimensions: { width: number; height: number } | null = null;
        const manifestFrames: Array<{ fileName: string; url: string }> = [];

        for (const frame of frames) {
          signal.throwIfAborted();
          const bytes = await frame.source.buffer();
          if (bytes.byteLength !== frame.source.uncompressedSize) {
            throw new Error("Animation frame expanded size is invalid.");
          }
          const detected = await detectAllowedMedia(bytes, frame.mimeType);
          if (detected.mediaKind !== "image") return unsafeEntry(frame.source.path);
          const dimensions = imageDimensions(bytes, frame.mimeType);
          if (
            expectedDimensions
            && (dimensions.width !== expectedDimensions.width || dimensions.height !== expectedDimensions.height)
          ) {
            throw new Error("Animation frames must all have identical dimensions.");
          }
          expectedDimensions ??= dimensions;
          const destination = `${outputPrefix}/${frame.fileName}`;
          await storage.putObject(destination, bytes, frame.mimeType);
          writtenKeys.push(destination);
          manifestFrames.push({
            fileName: frame.fileName,
            url: publicChildUrl(asset.publicUrl, `animation/${frame.fileName}`),
          });
        }

        if (!expectedDimensions) throw new Error("Animation bundle contains no frames.");
        const manifestStorageKey = `${outputPrefix}/manifest.json`;
        const manifestUrl = publicChildUrl(asset.publicUrl, "animation/manifest.json");
        const manifest = Buffer.from(JSON.stringify({
          version: 1,
          frameCount: manifestFrames.length,
          width: expectedDimensions.width,
          height: expectedDimensions.height,
          frames: manifestFrames,
        }));
        await storage.putObject(manifestStorageKey, manifest, "application/json");
        writtenKeys.push(manifestStorageKey);
        const ready = await repository.markReady(assetId, {
          frameCount: manifestFrames.length,
          width: expectedDimensions.width,
          height: expectedDimensions.height,
          manifestUrl,
          manifestStorageKey,
          objectKeys: [...writtenKeys, asset.storageKey],
        });
        await storage.deleteObjects([asset.storageKey]).catch(() => undefined);
        return ready;
      } catch (error) {
        if (writtenKeys.length > 0) {
          await storage.deleteObjects(writtenKeys).catch(() => undefined);
        }
        await repository.markFailed(assetId, safeError(error));
        throw error;
      }
    },
  };
};

const animationBundleProcessor = createAnimationBundleProcessor();

export const processAnimationBundle = (assetId: string, signal: AbortSignal) =>
  animationBundleProcessor.processAnimationBundle(assetId, signal);
