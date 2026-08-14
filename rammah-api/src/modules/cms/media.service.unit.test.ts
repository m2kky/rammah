import { describe, expect, it, vi } from "vitest";
import type { MediaStorage } from "./media-storage.js";
import {
  createMediaService,
  type MediaAssetRecord,
  type MediaRepository,
} from "./media.service.js";

const assetId = "11111111-2222-4333-8444-555555555555";
const temporaryStorageKey = `tmp/2026/08/${assetId}/hero.png`;
const finalStorageKey = `media/${assetId}/hero.png`;
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const baseAsset = (overrides: Partial<MediaAssetRecord> = {}): MediaAssetRecord => ({
  id: assetId,
  displayName: "Hero",
  fileName: "hero.png",
  mimeType: "image/png",
  sourceType: "r2",
  mediaKind: "image",
  storageKey: finalStorageKey,
  publicUrl: `https://media.example.com/${finalStorageKey}`,
  altText: null,
  sizeBytes: pngBytes.length,
  width: null,
  height: null,
  durationMs: null,
  metadata: {
    temporaryStorageKey,
    finalStorageKey,
    uploadExpiresAt: "2026-08-06T09:05:00.000Z",
  },
  processingState: "pending",
  processingError: null,
  status: "draft",
  createdAt: new Date("2026-08-06T09:00:00.000Z"),
  updatedAt: new Date("2026-08-06T09:00:00.000Z"),
  ...overrides,
});

const makeStorage = (): MediaStorage => ({
  createUploadIntent: vi.fn().mockResolvedValue({
    assetId,
    temporaryStorageKey,
    finalStorageKey,
    uploadUrl: "https://signed.example/upload",
    publicUrl: `https://media.example.com/${finalStorageKey}`,
    expiresAt: "2026-08-06T09:05:00.000Z",
  }),
  headObject: vi.fn().mockResolvedValue({ sizeBytes: pngBytes.length, contentType: "image/png" }),
  readRange: vi.fn().mockResolvedValue(pngBytes),
  copyObject: vi.fn().mockResolvedValue(undefined),
  putObject: vi.fn().mockResolvedValue(undefined),
  deleteObjects: vi.fn().mockResolvedValue(undefined),
});

const makeRepository = (): MediaRepository => ({
  createPendingUpload: vi.fn(async (input) => baseAsset({
    id: input.id,
    displayName: input.displayName,
    fileName: input.fileName,
    mimeType: input.mimeType,
    mediaKind: input.mediaKind,
    storageKey: input.storageKey,
    publicUrl: input.publicUrl,
    sizeBytes: input.sizeBytes,
    metadata: input.metadata,
  })),
  findById: vi.fn().mockResolvedValue(baseAsset()),
  markReady: vi.fn().mockResolvedValue(baseAsset({ processingState: "ready" })),
  markFailed: vi.fn().mockResolvedValue(baseAsset({ processingState: "failed" })),
  createExternal: vi.fn(async (input) => baseAsset({
    ...input,
    sourceType: "external",
    storageKey: null,
    sizeBytes: 0,
    processingState: "ready",
  })),
  list: vi.fn().mockResolvedValue([baseAsset()]),
  patch: vi.fn().mockResolvedValue(baseAsset()),
  listUsages: vi.fn().mockResolvedValue([]),
  archive: vi.fn().mockResolvedValue(baseAsset({ status: "archived" })),
  delete: vi.fn().mockResolvedValue(undefined),
});

describe("CMS media service", () => {
  it("persists a pending asset when it creates an R2 upload intent", async () => {
    const storage = makeStorage();
    const repository = makeRepository();
    const service = createMediaService({ storage, repository });

    const result = await service.createUploadIntent({
      displayName: "Homepage hero",
      fileName: "hero.png",
      mimeType: "image/png",
      sizeBytes: pngBytes.length,
      altText: "Ahmed Rammah",
    });

    expect(storage.createUploadIntent).toHaveBeenCalledWith({
      fileName: "hero.png",
      mimeType: "image/png",
      sizeBytes: pngBytes.length,
    });
    expect(repository.createPendingUpload).toHaveBeenCalledWith(expect.objectContaining({
      id: assetId,
      displayName: "Homepage hero",
      storageKey: finalStorageKey,
      publicUrl: `https://media.example.com/${finalStorageKey}`,
      processingState: "pending",
      metadata: expect.objectContaining({ temporaryStorageKey, finalStorageKey }),
    }));
    expect(result).toMatchObject({ assetId, uploadUrl: "https://signed.example/upload" });
  });

  it("verifies the uploaded object before copying it to its immutable key", async () => {
    const storage = makeStorage();
    const repository = makeRepository();
    const service = createMediaService({ storage, repository });

    await expect(service.finalizeUpload({ assetId })).resolves.toMatchObject({
      id: assetId,
      processingState: "ready",
    });

    expect(storage.headObject).toHaveBeenCalledWith(temporaryStorageKey);
    expect(storage.readRange).toHaveBeenCalledWith(temporaryStorageKey, 0, pngBytes.length - 1);
    expect(storage.copyObject).toHaveBeenCalledWith(temporaryStorageKey, finalStorageKey);
    expect(storage.deleteObjects).toHaveBeenCalledWith([temporaryStorageKey]);
    expect(repository.markReady).toHaveBeenCalledWith(assetId, expect.objectContaining({
      mimeType: "image/png",
      mediaKind: "image",
    }));
  });

  it("returns an actionable 422 error when the object signature is spoofed", async () => {
    const storage = makeStorage();
    vi.mocked(storage.readRange).mockResolvedValue(Buffer.from("not an image"));
    const repository = makeRepository();
    const service = createMediaService({ storage, repository });

    await expect(service.finalizeUpload({ assetId })).rejects.toMatchObject({
      code: "MEDIA_UPLOAD_INVALID",
      statusCode: 422,
    });
    expect(storage.copyObject).not.toHaveBeenCalled();
    expect(repository.markFailed).toHaveBeenCalledWith(
      assetId,
      expect.stringMatching(/signature/i),
    );
  });

  it("registers only HTTPS external image or video URLs", async () => {
    const repository = makeRepository();
    const service = createMediaService({ storage: makeStorage(), repository });

    await expect(service.createExternal({
      displayName: "External hero",
      fileName: "hero.webp",
      mimeType: "image/webp",
      mediaKind: "image",
      publicUrl: "http://cdn.example.com/hero.webp",
      altText: null,
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 422 });
    await expect(service.createExternal({
      displayName: "External hero",
      fileName: "hero.webp",
      mimeType: "image/webp",
      mediaKind: "image",
      publicUrl: "https://cdn.example.com/hero.webp",
      altText: null,
    })).resolves.toMatchObject({ sourceType: "external", processingState: "ready" });
  });

  it("refuses to archive a used asset and returns named usages", async () => {
    const repository = makeRepository();
    const usages = [{
      ownerType: "page_section" as const,
      ownerId: "22222222-3333-4444-8555-666666666666",
      ownerLabel: "Home / Hero",
      slotKey: "desktopImage",
    }];
    vi.mocked(repository.listUsages).mockResolvedValue(usages);
    const service = createMediaService({ storage: makeStorage(), repository });

    await expect(service.archive(assetId)).rejects.toMatchObject({
      code: "MEDIA_IN_USE",
      statusCode: 409,
      meta: { usages },
    });
    expect(repository.archive).not.toHaveBeenCalled();
  });

  it("permanently deletes storage objects only for an unused archived asset", async () => {
    const storage = makeStorage();
    const repository = makeRepository();
    vi.mocked(repository.findById).mockResolvedValue(baseAsset({
      status: "archived",
      metadata: {
        temporaryStorageKey,
        finalStorageKey,
        objectKeys: [`${finalStorageKey}/manifest.json`, `${finalStorageKey}/frame0001.webp`],
      },
    }));
    const service = createMediaService({ storage, repository });

    await service.permanentlyDelete(assetId);

    expect(storage.deleteObjects).toHaveBeenCalledWith([
      finalStorageKey,
      temporaryStorageKey,
      `${finalStorageKey}/manifest.json`,
      `${finalStorageKey}/frame0001.webp`,
    ]);
    expect(repository.delete).toHaveBeenCalledWith(assetId);
  });

  it("does not expose storage keys or temporary upload metadata in list DTOs", async () => {
    const service = createMediaService({ storage: makeStorage(), repository: makeRepository() });

    const [asset] = await service.list({ search: "hero" });

    expect(asset).not.toHaveProperty("storageKey");
    expect(asset?.metadata).not.toHaveProperty("temporaryStorageKey");
    expect(asset).toMatchObject({ id: assetId, publicUrl: expect.any(String) });
  });
});
