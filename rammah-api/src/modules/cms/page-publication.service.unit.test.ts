import { describe, expect, it, vi } from "vitest";
import {
  createPagePublicationService,
  type PagePublicationRepository,
  type PublicationPage,
  type PublicationSection,
} from "./page-publication.service.js";

const pageId = "11111111-2222-4333-8444-555555555555";
const sectionId = "22222222-3333-4444-8555-666666666666";
const imageId = "33333333-4444-4555-8666-777777777777";

const page = (overrides: Partial<PublicationPage> = {}): PublicationPage => ({
  id: pageId,
  slug: "leadership",
  title: "Leadership",
  status: "draft",
  template: "default",
  publishedAt: null,
  ...overrides,
});

const section = (overrides: Partial<PublicationSection> = {}): PublicationSection => ({
  id: sectionId,
  sectionType: "hero",
  title: "Lead with clarity",
  body: "A practical coaching programme.",
  config: {},
  status: "published",
  assignments: [{
    slotKey: "desktopImage",
    decorative: false,
    altTextOverride: "Coach Ahmed speaking",
    asset: {
      id: imageId,
      mediaKind: "image",
      processingState: "ready",
      status: "published",
      altText: null,
    },
  }],
  ...overrides,
});

const repository = (overrides: Partial<PagePublicationRepository> = {}): PagePublicationRepository => ({
  findPage: vi.fn().mockResolvedValue(page()),
  isPageSlugTaken: vi.fn().mockResolvedValue(false),
  listSections: vi.fn().mockResolvedValue([section()]),
  ...overrides,
});

describe("CMS page publication validation", () => {
  it("rejects publishing a hero without required media", async () => {
    const service = createPagePublicationService({
      repository: repository({
        listSections: vi.fn().mockResolvedValue([section({ assignments: [] })]),
      }),
    });

    await expect(service.validatePageForPublication(pageId)).rejects.toMatchObject({
      code: "CMS_PUBLICATION_INVALID",
      statusCode: 422,
      details: expect.arrayContaining([expect.objectContaining({ field: expect.stringMatching(/media/) })]),
    });
  });

  it("requires alternative text for non-decorative images", async () => {
    const withoutAlt = section({
      sectionType: "standalone_image",
      title: null,
      body: null,
      assignments: [{
        slotKey: "image",
        decorative: false,
        altTextOverride: null,
        asset: {
          id: imageId,
          mediaKind: "image",
          processingState: "ready",
          status: "published",
          altText: null,
        },
      }],
    });
    const service = createPagePublicationService({
      repository: repository({ listSections: vi.fn().mockResolvedValue([withoutAlt]) }),
    });

    await expect(service.validatePageForPublication(pageId)).rejects.toMatchObject({
      code: "CMS_PUBLICATION_INVALID",
      details: expect.arrayContaining([expect.objectContaining({ field: expect.stringMatching(/altText/) })]),
    });
  });

  it("rejects autoplay video unless it is muted and has a poster", async () => {
    const videoSection = section({
      sectionType: "video",
      title: null,
      body: null,
      config: { autoplay: true, muted: false, controls: false },
      assignments: [{
        slotKey: "video",
        decorative: false,
        altTextOverride: null,
        asset: {
          id: imageId,
          mediaKind: "video",
          processingState: "ready",
          status: "published",
          altText: null,
        },
      }],
    });
    const service = createPagePublicationService({
      repository: repository({ listSections: vi.fn().mockResolvedValue([videoSection]) }),
    });

    await expect(service.validatePageForPublication(pageId)).rejects.toMatchObject({
      code: "CMS_PUBLICATION_INVALID",
      details: expect.arrayContaining([
        expect.objectContaining({ field: expect.stringMatching(/poster/) }),
        expect.objectContaining({ field: expect.stringMatching(/muted/) }),
      ]),
    });
  });

  it.each(["admin", "privacy-policy", "two/segments", "Uppercase"])(
    "rejects reserved or invalid slug %s",
    async (slug) => {
      const service = createPagePublicationService({
        repository: repository({ findPage: vi.fn().mockResolvedValue(page({ slug })) }),
      });

      await expect(service.validatePageForPublication(pageId)).rejects.toMatchObject({
        code: "CMS_PUBLICATION_INVALID",
        details: expect.arrayContaining([expect.objectContaining({ field: "slug" })]),
      });
    },
  );

  it("keeps reserved slugs valid for existing custom-layout pages", async () => {
    const service = createPagePublicationService({
      repository: repository({
        findPage: vi.fn().mockResolvedValue(page({ slug: "about", template: "about" })),
      }),
    });

    await expect(service.validatePageForPublication(pageId)).resolves.toMatchObject({
      page: { slug: "about", template: "about" },
    });
  });

  it("rejects duplicate slugs and scheduled dates that are not in the future", async () => {
    const service = createPagePublicationService({
      repository: repository({
        findPage: vi.fn().mockResolvedValue(page({
          status: "scheduled",
          publishedAt: new Date("2026-08-15T09:59:59.000Z"),
        })),
        isPageSlugTaken: vi.fn().mockResolvedValue(true),
      }),
      now: () => new Date("2026-08-15T10:00:00.000Z"),
    });

    await expect(service.validatePageForPublication(pageId)).rejects.toMatchObject({
      code: "CMS_PUBLICATION_INVALID",
      details: expect.arrayContaining([
        expect.objectContaining({ field: "slug" }),
        expect.objectContaining({ field: "publishedAt" }),
      ]),
    });
  });

  it("accepts a complete page with ready media and meaningful alt text", async () => {
    const service = createPagePublicationService({ repository: repository() });

    await expect(service.validatePageForPublication(pageId)).resolves.toMatchObject({
      page: { id: pageId },
      sections: [{ id: sectionId }],
    });
  });
});
