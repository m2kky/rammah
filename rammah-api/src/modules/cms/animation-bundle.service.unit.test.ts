import { describe, expect, it, vi } from "vitest";
import type { MediaStorage } from "./media-storage.js";
import {
  createAnimationBundleProcessor,
  type AnimationBundleRepository,
} from "./animation-bundle.service.js";
import type { MediaAssetRecord } from "./media.service.js";

const assetId = "11111111-2222-4333-8444-555555555555";
const sourceKey = `media/${assetId}/frames.zip`;
const pngFrame = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

const crc32 = (bytes: Uint8Array) => {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff]! ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};

const makeZip = (entries: Array<{ name: string; bytes: Uint8Array }>) => {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const bytes = Buffer.from(entry.bytes);
    const checksum = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, bytes);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + bytes.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
};

const asset = (): MediaAssetRecord => ({
  id: assetId,
  displayName: "Homepage animation",
  fileName: "frames.zip",
  mimeType: "application/zip",
  sourceType: "r2",
  mediaKind: "animation_bundle",
  storageKey: sourceKey,
  publicUrl: `https://media.example.com/${sourceKey}`,
  altText: null,
  sizeBytes: 1,
  width: null,
  height: null,
  durationMs: null,
  metadata: {},
  processingState: "pending",
  processingError: null,
  status: "draft",
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeRepository = (): AnimationBundleRepository => ({
  findById: vi.fn().mockResolvedValue(asset()),
  markReady: vi.fn().mockImplementation(async (_id, input) => ({
    ...asset(),
    width: input.width,
    height: input.height,
    publicUrl: input.manifestUrl,
    metadata: input,
    processingState: "ready",
  })),
  markFailed: vi.fn().mockResolvedValue(undefined),
});

const makeStorage = (zip: Uint8Array): MediaStorage => ({
  createUploadIntent: vi.fn(),
  headObject: vi.fn().mockResolvedValue({ sizeBytes: zip.byteLength, contentType: "application/zip" }),
  readRange: vi.fn().mockResolvedValue(zip),
  copyObject: vi.fn(),
  putObject: vi.fn().mockResolvedValue(undefined),
  deleteObjects: vi.fn().mockResolvedValue(undefined),
});

const processorFor = (entries: Array<{ name: string; bytes: Uint8Array }>) => {
  const zip = makeZip(entries);
  const storage = makeStorage(zip);
  const repository = makeRepository();
  const processor = createAnimationBundleProcessor({
    storage,
    repository,
    limits: { maxZipBytes: 1_000_000, maxExpandedBytes: 2_000_000, maxFrames: 20 },
  });
  return { processor, repository, storage };
};

describe("animation bundle processing", () => {
  it.each(["../escape.webp", "/absolute.webp", "run.exe", "frame0001.svg"])(
    "rejects unsafe bundle entry %s",
    async (name) => {
      const { processor, repository } = processorFor([{ name, bytes: pngFrame }]);

      await expect(processor.processAnimationBundle(assetId, AbortSignal.timeout(5_000)))
        .rejects.toThrow(/unsafe bundle entry/i);
      expect(repository.markFailed).toHaveBeenCalledWith(assetId, expect.any(String));
    },
  );

  it("rejects non-consecutive frame numbering", async () => {
    const { processor } = processorFor([
      { name: "frame0001.png", bytes: pngFrame },
      { name: "frame0003.png", bytes: pngFrame },
    ]);

    await expect(processor.processAnimationBundle(assetId, AbortSignal.timeout(5_000)))
      .rejects.toThrow(/consecutive/i);
  });

  it("writes ordered frames and a manifest then marks the asset ready", async () => {
    const { processor, repository, storage } = processorFor([
      { name: "frame0002.png", bytes: pngFrame },
      { name: "frame0001.png", bytes: pngFrame },
      { name: "frame0003.png", bytes: pngFrame },
    ]);

    await expect(processor.processAnimationBundle(assetId, AbortSignal.timeout(5_000)))
      .resolves.toMatchObject({ processingState: "ready" });

    expect(storage.putObject).toHaveBeenLastCalledWith(
      expect.stringMatching(/manifest\.json$/),
      expect.any(Uint8Array),
      "application/json",
    );
    expect(repository.markReady).toHaveBeenCalledWith(assetId, expect.objectContaining({
      frameCount: 3,
      width: 1,
      height: 1,
      objectKeys: expect.arrayContaining([expect.stringMatching(/manifest\.json$/)]),
    }));
    expect(storage.deleteObjects).toHaveBeenCalledWith([sourceKey]);
  });

  it("enforces configured frame and expanded-byte limits before writing", async () => {
    const entries = [
      { name: "frame0001.png", bytes: pngFrame },
      { name: "frame0002.png", bytes: pngFrame },
    ];
    const zip = makeZip(entries);
    const storage = makeStorage(zip);
    const repository = makeRepository();
    const processor = createAnimationBundleProcessor({
      storage,
      repository,
      limits: { maxZipBytes: 1_000_000, maxExpandedBytes: pngFrame.length, maxFrames: 1 },
    });

    await expect(processor.processAnimationBundle(assetId, AbortSignal.timeout(5_000)))
      .rejects.toThrow(/limit/i);
    expect(storage.putObject).not.toHaveBeenCalled();
  });
});
