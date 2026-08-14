import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { detectAllowedMedia } from "./media-signature.js";
import {
  createR2MediaStorage,
  type R2MediaStorageConfig,
} from "./media-storage.js";

const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const mp4Bytes = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
  0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
  0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
]);
const zipBytes = Buffer.from([
  0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const config: R2MediaStorageConfig = {
  endpoint: "https://account-id.r2.cloudflarestorage.com",
  bucket: "rammah-media",
  accessKeyId: "access-key",
  secretAccessKey: "secret-key",
  publicBaseUrl: "https://media.example.com/assets",
  presignExpiresSeconds: 300,
  maxImageBytes: 15 * 1024 * 1024,
  maxVideoBytes: 500 * 1024 * 1024,
  maxAnimationZipBytes: 500 * 1024 * 1024,
  allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
  allowedVideoMimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
  temporaryPrefix: "tmp",
  mediaPrefix: "media",
};

describe("media file signature verification", () => {
  it("recognizes supported image, video, and animation bundle bytes", async () => {
    await expect(detectAllowedMedia(pngBytes, "image/png")).resolves.toEqual({
      mediaKind: "image",
      mimeType: "image/png",
    });
    await expect(detectAllowedMedia(mp4Bytes, "video/mp4")).resolves.toEqual({
      mediaKind: "video",
      mimeType: "video/mp4",
    });
    await expect(detectAllowedMedia(zipBytes, "application/zip")).resolves.toEqual({
      mediaKind: "animation_bundle",
      mimeType: "application/zip",
    });
  });

  it("rejects a mismatched declaration, unknown bytes, and SVG", async () => {
    await expect(detectAllowedMedia(pngBytes, "image/jpeg")).rejects.toThrow(/signature/i);
    await expect(detectAllowedMedia(Buffer.from("not an image"), "image/png")).rejects.toThrow(
      /signature/i,
    );
    await expect(
      detectAllowedMedia(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' />"), "image/svg+xml"),
    ).rejects.toThrow(/svg/i);
  });
});

describe("R2 media storage", () => {
  it("creates a short-lived, content-type-bound PUT intent with immutable keys", async () => {
    const send = vi.fn();
    const getSignedUrl = vi.fn().mockResolvedValue("https://signed.example/upload");
    const storage = createR2MediaStorage(config, {
      client: { send },
      getSignedUrl,
      now: () => new Date("2026-08-06T09:00:00.000Z"),
      randomUUID: () => "11111111-2222-4333-8444-555555555555",
    });

    await expect(
      storage.createUploadIntent({
        fileName: "../My Hero (Final).PNG",
        mimeType: "image/png",
        sizeBytes: pngBytes.length,
      }),
    ).resolves.toEqual({
      assetId: "11111111-2222-4333-8444-555555555555",
      temporaryStorageKey:
        "tmp/2026/08/11111111-2222-4333-8444-555555555555/my-hero-final.png",
      finalStorageKey:
        "media/11111111-2222-4333-8444-555555555555/my-hero-final.png",
      uploadUrl: "https://signed.example/upload",
      publicUrl:
        "https://media.example.com/assets/media/11111111-2222-4333-8444-555555555555/my-hero-final.png",
      expiresAt: "2026-08-06T09:05:00.000Z",
    });

    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(PutObjectCommand),
      { expiresIn: 300 },
    );
    const command = getSignedUrl.mock.calls[0]?.[1] as PutObjectCommand;
    expect(command.input).toMatchObject({
      Bucket: "rammah-media",
      ContentType: "image/png",
      ContentLength: pngBytes.length,
      CacheControl: "public, max-age=31536000, immutable",
    });
  });

  it("rejects unsupported or oversized uploads before signing", async () => {
    const getSignedUrl = vi.fn();
    const storage = createR2MediaStorage(config, {
      client: { send: vi.fn() },
      getSignedUrl,
    });

    await expect(
      storage.createUploadIntent({
        fileName: "vector.svg",
        mimeType: "image/svg+xml",
        sizeBytes: 100,
      }),
    ).rejects.toThrow(/mime/i);
    await expect(
      storage.createUploadIntent({
        fileName: "huge.png",
        mimeType: "image/png",
        sizeBytes: config.maxImageBytes + 1,
      }),
    ).rejects.toThrow(/size/i);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("preserves a safe extension when the original file name is non-Latin", async () => {
    const storage = createR2MediaStorage(config, {
      client: { send: vi.fn() },
      getSignedUrl: vi.fn().mockResolvedValue("https://signed.example/upload"),
      now: () => new Date("2026-08-06T09:00:00.000Z"),
      randomUUID: () => "11111111-2222-4333-8444-555555555555",
    });

    const intent = await storage.createUploadIntent({
      fileName: "صورة الغلاف.png",
      mimeType: "image/png",
      sizeBytes: pngBytes.length,
    });

    expect(intent.temporaryStorageKey).toMatch(/\/upload\.png$/);
    expect(intent.finalStorageKey).toMatch(/\/upload\.png$/);
  });

  it("maps verification, range, copy, put, and delete operations to scoped S3 commands", async () => {
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        return { ContentLength: 42, ContentType: "image/png" };
      }
      if (command instanceof GetObjectCommand) {
        return { Body: { transformToByteArray: async () => Uint8Array.from([1, 2, 3]) } };
      }
      return {};
    });
    const storage = createR2MediaStorage(config, { client: { send } });

    await expect(storage.headObject("tmp/object.png")).resolves.toEqual({
      sizeBytes: 42,
      contentType: "image/png",
    });
    await expect(storage.readRange("tmp/object.png", 0, 31)).resolves.toEqual(
      Uint8Array.from([1, 2, 3]),
    );
    await storage.copyObject("tmp/source image.png", "media/final image.png");
    await storage.putObject("media/manifest.json", Uint8Array.from([123]), "application/json");
    await storage.deleteObjects(["tmp/object.png", "media/final image.png"]);

    expect(send.mock.calls.flat().some((command) => command instanceof CopyObjectCommand)).toBe(true);
    expect(send.mock.calls.flat().some((command) => command instanceof PutObjectCommand)).toBe(true);
    expect(send.mock.calls.flat().some((command) => command instanceof DeleteObjectsCommand)).toBe(true);
    const rangeCommand = send.mock.calls.flat().find(
      (command) => command instanceof GetObjectCommand,
    ) as GetObjectCommand;
    expect(rangeCommand.input.Range).toBe("bytes=0-31");
    const copyCommand = send.mock.calls.flat().find(
      (command) => command instanceof CopyObjectCommand,
    ) as CopyObjectCommand;
    expect(copyCommand.input.CopySource).toBe("rammah-media/tmp/source%20image.png");
  });
});
