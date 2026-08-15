import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MediaPicker } from "../components/admin/cms/MediaPicker";
import type { AdminMediaAsset } from "./api/admin";

const asset: AdminMediaAsset = {
  id: "asset-id",
  displayName: "Hero portrait",
  fileName: "hero.webp",
  mimeType: "image/webp",
  sourceType: "r2",
  mediaKind: "image",
  publicUrl: "https://media.example.test/hero.webp",
  altText: "Ahmed Rammah",
  sizeBytes: 1024,
  width: 1200,
  height: 1600,
  durationMs: null,
  metadata: {},
  processingState: "ready",
  processingError: null,
  status: "published",
  createdAt: "2026-08-15T00:00:00.000Z",
  updatedAt: "2026-08-15T00:00:00.000Z",
};

describe("admin media UI", () => {
  it("renders upload, external URL, replace, and remove actions without UUID inputs", () => {
    const html = renderToStaticMarkup(createElement(MediaPicker, {
      accepts: ["image"],
      value: [asset],
      onChange: () => undefined,
    }));
    expect(html).toContain("Upload from device");
    expect(html).toContain("External URL");
    expect(html).toContain("Replace");
    expect(html).toContain("Remove");
    expect(html).not.toContain("Media asset ID");
  });
});
