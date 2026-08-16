import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  fetchAdminMediaAssets: vi.fn(),
  fetchAdminSeoMetadata: vi.fn(),
  saveAdminSeoMetadata: vi.fn(),
}));

vi.mock("@/lib/api/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin")>();
  return { ...actual, ...apiMocks };
});

vi.mock("./MediaPicker", () => ({
  MediaPicker: ({ value, onChange }: {
    value: Array<{ id: string; displayName: string }>;
    onChange(value: Array<{ id: string; displayName: string }>): void;
  }) => value.length ? (
    <button type="button" onClick={() => onChange([])}>Remove SEO image</button>
  ) : (
    <button type="button" onClick={() => onChange([image])}>Choose SEO image</button>
  ),
}));

import type { AdminMediaAsset } from "@/lib/api/admin";
import { SeoEditor } from "./SeoEditor";

const PAGE_ID = "11111111-1111-4111-8111-111111111111";
const IMAGE_ID = "22222222-2222-4222-8222-222222222222";
const image: AdminMediaAsset = {
  id: IMAGE_ID,
  displayName: "Social cover",
  fileName: "social.webp",
  mimeType: "image/webp",
  sourceType: "r2",
  mediaKind: "image",
  publicUrl: "https://media.example.test/social.webp",
  altText: "Social cover",
  sizeBytes: 123,
  width: 1200,
  height: 630,
  durationMs: null,
  metadata: {},
  processingState: "ready",
  processingError: null,
  status: "published",
  createdAt: "2026-08-16T00:00:00.000Z",
  updatedAt: "2026-08-16T00:00:00.000Z",
};

describe("SeoEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchAdminSeoMetadata.mockResolvedValue(null);
    apiMocks.fetchAdminMediaAssets.mockResolvedValue([image]);
    apiMocks.saveAdminSeoMetadata.mockImplementation(async (input) => input);
  });

  it("saves canonical, Open Graph image and noindex controls", async () => {
    const user = userEvent.setup();
    render(<SeoEditor resourceType="page" resourceId={PAGE_ID} />);

    await user.type(await screen.findByLabelText("Meta title"), "Title");
    await user.type(screen.getByLabelText("Meta description"), "Description");
    await user.type(screen.getByLabelText("Canonical URL"), "https://example.com/custom");
    await user.click(screen.getByRole("button", { name: "Choose SEO image" }));
    await user.click(screen.getByLabelText("Hide from search engines"));
    await user.click(screen.getByRole("button", { name: "Save SEO" }));

    await waitFor(() => expect(apiMocks.saveAdminSeoMetadata).toHaveBeenCalledWith({
      resourceType: "page",
      resourceId: PAGE_ID,
      metaTitle: "Title",
      metaDescription: "Description",
      canonicalUrl: "https://example.com/custom",
      ogImageAssetId: IMAGE_ID,
      noindex: true,
    }));
    expect(screen.getByText("SEO saved.")).toBeInTheDocument();
  });

  it("resolves and removes an existing Open Graph image", async () => {
    apiMocks.fetchAdminSeoMetadata.mockResolvedValue({
      resourceType: "legal_page",
      resourceId: PAGE_ID,
      metaTitle: null,
      metaDescription: null,
      canonicalUrl: null,
      ogImageAssetId: IMAGE_ID,
      noindex: false,
    });
    const user = userEvent.setup();
    render(<SeoEditor resourceType="legal_page" resourceId={PAGE_ID} />);

    await user.click(await screen.findByRole("button", { name: "Remove SEO image" }));
    await user.click(screen.getByRole("button", { name: "Save SEO" }));

    await waitFor(() => expect(apiMocks.saveAdminSeoMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ ogImageAssetId: null }),
    ));
  });

  it("keeps entered values when saving fails", async () => {
    apiMocks.saveAdminSeoMetadata.mockRejectedValue(new Error("Save failed"));
    const user = userEvent.setup();
    render(<SeoEditor resourceType="blog_post" resourceId={PAGE_ID} />);

    const title = await screen.findByLabelText("Meta title");
    await user.type(title, "Keep me");
    await user.click(screen.getByRole("button", { name: "Save SEO" }));

    expect(await screen.findByText("Save failed")).toBeInTheDocument();
    expect(title).toHaveValue("Keep me");
  });
});
