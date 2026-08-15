import { describe, expect, it } from "vitest";
import type { PublicPage, PublicPageSection } from "./cms";
import {
  getContactPageContent,
  getHomePageContent,
  getMarqueeContent,
  getPageMetadata,
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
    contentPage.seo = {
      metaTitle: "SEO title",
      metaDescription: "SEO description",
      canonicalUrl: "https://example.com/page",
      noindex: true,
      ogImage: null,
    };

    expect(getPageMetadata(contentPage, "Fallback", "Fallback description")).toEqual({
      title: "SEO title",
      description: "SEO description",
      alternates: { canonical: "https://example.com/page" },
      robots: { index: false, follow: false },
    });
  });
});
