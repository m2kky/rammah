import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAdminBlogCategory,
  createAdminBlogPost,
  createAdminCmsPage,
  createAdminMediaUploadIntent,
  reorderAdminCmsPageSections,
} from "./admin";
import { fetchPublicBlogPosts, fetchPublicGlobalMedia, fetchPublicPage } from "./cms";

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

  it("creates typed blog categories and posts through the admin API", async () => {
    const category = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Leadership",
      slug: "leadership",
      status: "published" as const,
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    };
    const post = {
      id: "22222222-2222-4222-8222-222222222222",
      categoryId: category.id,
      title: "A useful post",
      slug: "a-useful-post",
      excerpt: null,
      body: "Post body",
      featuredMediaAssetId: null,
      status: "draft" as const,
      publishedAt: null,
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(category, 201))
      .mockResolvedValueOnce(response(post, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createAdminBlogCategory({
      name: category.name,
      slug: category.slug,
      status: category.status,
    })).resolves.toEqual(category);
    await expect(createAdminBlogPost({
      categoryId: category.id,
      title: post.title,
      slug: post.slug,
      excerpt: null,
      body: post.body,
      featuredMediaAssetId: null,
      status: "draft",
      publishedAt: null,
    })).resolves.toEqual(post);

    expect(fetchMock.mock.calls[0]![0]).toContain("/admin/cms/blog/categories");
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "POST", credentials: "include" });
    expect(fetchMock.mock.calls[1]![0]).toContain("/admin/cms/blog/posts");
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ method: "POST", credentials: "include" });
  });

  it("preserves resolved public blog featured media", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([{
      id: "post-id",
      title: "A useful post",
      slug: "a-useful-post",
      excerpt: null,
      publishedAt: "2026-08-16T00:00:00.000Z",
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
      featuredMedia: {
        id: "asset-id",
        kind: "image",
        mimeType: "image/webp",
        publicUrl: "https://media.example.test/blog.webp",
        altText: "Article cover",
        decorative: false,
        width: 1200,
        height: 630,
        durationMs: null,
        metadata: {},
      },
    }]));
    vi.stubGlobal("fetch", fetchMock);

    const posts = await fetchPublicBlogPosts();

    expect(posts[0]!.featuredMedia).toMatchObject({
      kind: "image",
      publicUrl: "https://media.example.test/blog.webp",
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
