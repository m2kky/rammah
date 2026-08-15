import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAdminCmsPage,
  createAdminMediaUploadIntent,
  reorderAdminCmsPageSections,
} from "./admin";
import { fetchPublicGlobalMedia, fetchPublicPage } from "./cms";

const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), {
  status,
  headers: { "content-type": "application/json" },
});

afterEach(() => vi.unstubAllGlobals());

describe("typed CMS clients", () => {
  it("creates a CMS page through the authenticated admin API", async () => {
    const page = {
      id: "page-id",
      slug: "new-page",
      title: "New page",
      template: "default",
      status: "draft" as const,
      publishedAt: null,
      publicationError: null,
      createdAt: "2026-08-15T00:00:00.000Z",
      updatedAt: "2026-08-15T00:00:00.000Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(response(page, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createAdminCmsPage({
      slug: "new-page",
      title: "New page",
      template: "default",
      status: "draft",
      publishedAt: null,
    })).resolves.toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/admin/cms/pages"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("signs uploads and sends the complete section order", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        assetId: "asset-id",
        uploadUrl: "https://upload.example.test/signed",
        expiresAt: "2026-08-15T00:05:00.000Z",
        mimeType: "image/webp",
        sizeBytes: 123,
      }, 201))
      .mockResolvedValueOnce(response([]));
    vi.stubGlobal("fetch", fetchMock);

    await createAdminMediaUploadIntent({
      fileName: "hero.webp",
      mimeType: "image/webp",
      sizeBytes: 123,
    });
    await reorderAdminCmsPageSections("page-id", ["one", "two"]);

    expect(fetchMock.mock.calls[0]![0]).toContain("/admin/cms/media-assets/upload-intents");
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ sectionIds: ["one", "two"] }),
    });
  });

  it("consumes resolved public page and global media contracts", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({
        id: "page-id",
        slug: "leadership",
        title: "Leadership",
        template: "default",
        publishedAt: null,
        seo: null,
        sections: [{
          id: "section-id",
          sectionType: "hero",
          title: "Lead",
          body: null,
          config: {},
          sortOrder: 0,
          media: { desktopImage: { id: "asset", kind: "image", publicUrl: "/hero.webp" } },
        }],
      }))
      .mockResolvedValueOnce(response({ groups: {}, loadingVideo: null }));
    vi.stubGlobal("fetch", fetchMock);

    const page = await fetchPublicPage("leadership");
    const globals = await fetchPublicGlobalMedia();
    expect(page.sections[0]!.media.desktopImage).toMatchObject({ kind: "image" });
    expect(page.sections[0]).not.toHaveProperty("mediaAssetId");
    expect(globals.loadingVideo).toBeNull();
  });
});
