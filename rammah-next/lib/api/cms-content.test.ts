import { describe, expect, it } from "vitest";
import type { PublicPage, PublicPageSection } from "./cms";
import {
  getContactPageContent,
  getAboutMedia,
  getGlobalMedia,
  getHomePageContent,
  getMarqueeContent,
  getPageMetadata,
  getRecognitionContent,
  getSiteBrand,
  getSiteLocale,
  getServicesPageContent,
} from "./cms-content";

const section = (
  sectionType: string,
  overrides: Partial<PublicPageSection> = {},
): PublicPageSection => ({
  id: `${sectionType}-id`,
  sectionType,
  title: null,
  body: null,
  config: {},
  media: {},
  sortOrder: 10,
  ...overrides,
});

const page = (sections: PublicPageSection[]): PublicPage => ({
  id: "page-id",
  slug: "test",
  title: "Test",
  template: "default",
  publishedAt: null,
  seo: null,
  sections,
});

describe("CMS page content contracts", () => {
  it("uses CMS media and preserves the seeded fallback", () => {
    const globals = getGlobalMedia(null);
    expect(globals.loadingVideo.publicUrl).toBe("/videos/intro-loading.mp4");
    expect(getAboutMedia(null).heroImage.publicUrl).toBe("/about_hero.png");

    const edited = getGlobalMedia({
      groups: {},
      loadingVideo: { ...globals.loadingVideo, publicUrl: "https://media.example.test/loading.mp4" },
      loadingPoster: null,
      matchedHeroFrame: null,
      desktopMenuVideo: null,
      mobileMenuVideo: null,
      defaultOgImage: null,
    });
    expect(edited.loadingVideo.publicUrl).toBe("https://media.example.test/loading.mp4");
  });

  it("prefers About hero section images over global and seeded media", () => {
    const fallback = getAboutMedia(null);
    const desktopImage = {
      ...fallback.heroImage,
      id: "about-desktop",
      publicUrl: "https://media.example.test/about-desktop.webp",
    };
    const mobileImage = {
      ...fallback.heroImage,
      id: "about-mobile",
      publicUrl: "https://media.example.test/about-mobile.webp",
    };

    const media = getAboutMedia(null, page([
      section("hero", {
        media: { desktopImage, mobileImage },
      }),
    ]));

    expect(media.heroImage).toEqual(desktopImage);
    expect(media.heroMobileImage).toEqual(mobileImage);
  });

  it("maps recognition copy, portrait, and a safe external CTA", () => {
    const fallbackPortrait = getRecognitionContent(null).portrait;
    const cmsPortrait = {
      ...fallbackPortrait,
      id: "recognition-portrait",
      publicUrl: "https://media.example.test/recognition.webp",
    };

    const content = getRecognitionContent(section("recognition", {
      title: "(04) Verified",
      body: "Official listing copy",
      config: {
        name: "Ahmed from CMS",
        roles: "Supervisor · Master Trainer",
        sourceLabel: "Official source",
        profileBadge: "Verified profile",
        cta: { label: "Open listing", url: "https://example.test/ahmed" },
      },
      media: { portrait: cmsPortrait },
    }));

    expect(content).toEqual({
      sectionLabel: "(04) Verified",
      name: "Ahmed from CMS",
      statement: "Official listing copy",
      roles: "Supervisor · Master Trainer",
      sourceLabel: "Official source",
      profileBadge: "Verified profile",
      ctaLabel: "Open listing",
      ctaUrl: "https://example.test/ahmed",
      portrait: cmsPortrait,
    });
  });

  it.each(["javascript:alert(1)", "data:text/html,broken", "/relative-link", "   "])(
    "falls back from unsupported recognition URL %s",
    (url) => {
      const content = getRecognitionContent(section("recognition", {
        config: { cta: { label: "Official profile", url } },
      }));

      expect(content.ctaUrl).toBe(
        "https://acrl-academy.eu/acrl-academy-eddi-schulze-2/#:~:text=Ahmed%20Sherif%20Rammah",
      );
    },
  );

  it("uses approved field-level fallbacks for an incomplete recognition section", () => {
    const content = getRecognitionContent(section("recognition", {
      title: null,
      body: " ",
      config: { name: "", roles: null, cta: {} },
    }));

    expect(content.sectionLabel).toBe("(04) Official recognition");
    expect(content.name).toBe("Ahmed Sherif Rammah");
    expect(content.statement).toContain("aCRL® Cooperation & Project Partners");
    expect(content.portrait.publicUrl).toBe("/acrl-ahmed-rammah.webp");
  });

  it("uses the home hero title as the visible display word", () => {
    const content = getHomePageContent(
      page([
        section("hero", {
          title: "CUSTOM HERO",
          body: "Custom body",
          config: { roles: ["One", "Two"] },
        }),
        section("statement", {
          title: "A fully editable statement",
          body: "An optional supporting line.",
        }),
      ]),
    );

    expect(content.hero.displayWord).toBe("CUSTOM HERO");
    expect(content.hero.body).toBe("Custom body");
    expect(content.hero.roles).toEqual(["One", "Two"]);
    expect(content.statement).toEqual({
      section: expect.objectContaining({ sectionType: "statement" }),
      title: "A fully editable statement",
      body: "An optional supporting line.",
    });
  });

  it("preserves the designed DECODE word for the original seeded hero title", () => {
    const content = getHomePageContent(
      page([section("hero", { title: "Ahmed Rammah" })]),
    );

    expect(content.hero.displayWord).toBe("DECODE");
  });

  it("maps the services hero, marquee, and listing sections created by the CMS seed", () => {
    const content = getServicesPageContent(
      page([
        section("hero", { title: "Custom services", body: "Custom services body" }),
        section("marquee", {
          title: "Custom row one",
          body: "Custom row two",
        }),
        section("listing_intro", {
          title: "Programs label",
          body: "Programs introduction",
        }),
      ]),
    );

    expect(content.hero.title).toBe("Custom services");
    expect(content.hero.body).toBe("Custom services body");
    expect(content.marquee.row1).toBe("Custom row one");
    expect(content.marquee.row2).toBe("Custom row two");
    expect(content.listing.title).toBe("Programs label");
    expect(content.listing.body).toBe("Programs introduction");
  });

  it("maps the contact hero, details, and CTA sections created by the CMS seed", () => {
    const content = getContactPageContent(
      page([
        section("hero", { title: "Custom contact", body: "Custom contact body" }),
        section("details", { title: "Contact details", body: "Available worldwide" }),
        section("cta", {
          title: "Prefer a session?",
          body: "Open the booking calendar.",
          config: { ctaText: "Book now", ctaHref: "/booking" },
        }),
      ]),
    );

    expect(content.hero.title).toBe("Custom contact");
    expect(content.details.body).toBe("Available worldwide");
    expect(content.cta).toEqual({
      title: "Prefer a session?",
      body: "Open the booking calendar.",
      ctaText: "Book now",
      ctaHref: "/booking",
    });
  });

  it("does not resurrect hard-coded text when a saved CMS field is intentionally blank", () => {
    const content = getServicesPageContent(
      page([section("hero", { title: null, body: null })]),
    );

    expect(content.hero.title).toBe("");
    expect(content.hero.body).toBe("");
  });

  it("lets marquee title and body override legacy row config", () => {
    const content = getMarqueeContent(
      section("marquee", {
        title: "Edited first row",
        body: "Edited second row",
        config: { row1: "Old row one", row2: "Old row two" },
      }),
      ["Fallback one", "Fallback two"],
    );

    expect(content).toEqual({
      row1: "Edited first row",
      row2: "Edited second row",
    });
  });

  it("uses the CMS site name as the public brand label", () => {
    const settings = {
      siteName: "Edited Brand",
      contactEmail: null,
      contactPhone: null,
      socialLinks: {},
      bookingDefaultTimezone: "Africa/Cairo",
      defaultLocale: "ar",
    };

    expect(getSiteBrand(settings)).toBe("Edited Brand");
    expect(getSiteLocale(settings)).toBe("ar");
  });

  it("uses CMS page and SEO fields for browser metadata", () => {
    const contentPage = page([]);
    contentPage.title = "Edited browser title";
    const ogImage = {
      ...getGlobalMedia(null).defaultOgImage,
      publicUrl: "https://media.example.test/page-card.png",
      width: 1200,
      height: 630,
    };
    contentPage.seo = {
      metaTitle: "SEO title",
      metaDescription: "SEO description",
      canonicalUrl: "https://example.com/page",
      noindex: true,
      ogImage,
    };

    expect(getPageMetadata(
      contentPage,
      "Fallback",
      "Fallback description",
      "/test",
      getGlobalMedia(null).defaultOgImage,
    )).toEqual({
      title: "SEO title",
      description: "SEO description",
      alternates: { canonical: "https://example.com/page" },
      robots: { index: false, follow: false },
      openGraph: {
        title: "SEO title",
        description: "SEO description",
        url: "https://example.com/page",
        siteName: "Ahmed Rammah",
        locale: "en",
        type: "website",
        images: [{
          url: "https://media.example.test/page-card.png",
          alt: "Ahmed Rammah",
          width: 1200,
          height: 630,
          type: "image/png",
        }],
      },
      twitter: {
        card: "summary_large_image",
        title: "SEO title",
        description: "SEO description",
        images: ["https://media.example.test/page-card.png"],
      },
    });
  });
});
