import {
  findPublicSection,
  type PublicPage,
  type PublicPageSection,
  type PublicSiteSettings,
} from "./cms";
import type { Metadata } from "next";

const textField = (
  section: PublicPageSection | null,
  field: "title" | "body",
  fallback: string,
) => {
  if (!section) return fallback;
  return section[field] ?? "";
};

const configString = (
  section: PublicPageSection | null,
  key: string,
  fallback: string,
) => {
  if (!section) return fallback;
  const value = section.config[key];
  return typeof value === "string" ? value : fallback;
};

const configStringArray = (
  section: PublicPageSection | null,
  key: string,
  fallback: string[],
) => {
  if (!section) return fallback;
  const value = section.config[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : fallback;
};

export const getMarqueeContent = (
  section: PublicPageSection | null,
  fallback: [string, string],
) => ({
  row1:
    section?.title ??
    configString(section, "row1", fallback[0]),
  row2:
    section?.body ??
    configString(section, "row2", fallback[1]),
});

export const getSiteBrand = (settings: PublicSiteSettings | null) =>
  settings?.siteName?.trim() || "Rammah";

export const getSiteLocale = (settings: PublicSiteSettings | null) =>
  settings?.defaultLocale?.trim() || "en";

export const getPageMetadata = (
  page: PublicPage | null,
  fallbackTitle: string,
  fallbackDescription: string,
): Metadata => ({
  title: page?.seo?.metaTitle || page?.title || fallbackTitle,
  description: page?.seo?.metaDescription || fallbackDescription,
  ...(page?.seo?.canonicalUrl
    ? { alternates: { canonical: page.seo.canonicalUrl } }
    : {}),
  ...(page?.seo?.noindex
    ? { robots: { index: false, follow: false } }
    : {}),
});

export const getHomePageContent = (page: PublicPage | null) => {
  const hero = findPublicSection(page, "hero");
  const statement = findPublicSection(page, "statement");
  const services = findPublicSection(page, "services");
  const heroTitle = textField(hero, "title", "DECODE");
  const configuredDisplayWord = hero?.config.displayWord;

  return {
    hero: {
      section: hero,
      displayWord:
        typeof configuredDisplayWord === "string"
          ? configuredDisplayWord
          : heroTitle === "Ahmed Rammah"
            ? "DECODE"
            : heroTitle,
      body: textField(
        hero,
        "body",
        "I don't just coach. I map your psychological system, find the bugs and rewrite the code",
      ),
      roles: configStringArray(
        hero,
        "roles",
        ["Engineer", "Systematizer", "Trainer", "Coach"],
      ),
    },
    statement: {
      section: statement,
      title: textField(statement, "title", "REWRITE YOUR MIND"),
      body: textField(statement, "body", ""),
    },
    services: {
      section: services,
      title: textField(services, "title", "SERVICES"),
      body: textField(services, "body", "Scroll to Discover ———"),
      roles: configStringArray(
        services,
        "roles",
        ["Engineer", "Systematizer", "Trainer", "Coach"],
      ),
      programLabel: configString(services, "programLabel", "Program"),
      bookingCta: configString(services, "bookingCta", "Book Now"),
    },
  };
};

export const getServicesPageContent = (page: PublicPage | null) => {
  const hero = findPublicSection(page, "hero");
  const marquee = findPublicSection(page, "marquee");
  const listing = findPublicSection(page, "listing_intro");
  const marqueeContent = getMarqueeContent(
    marquee,
    [
      "Engineer | Systematizer | Trainer | Coach |",
      "First & Only aCRL Master Trainer in the Middle East |",
    ],
  );

  return {
    hero: {
      title: textField(hero, "title", "Work on the system."),
      body: textField(
        hero,
        "body",
        "Choose the format that matches the work: personal decoding, therapy-style support, intensive workshops, or custom team programs.",
      ),
    },
    marquee: marqueeContent,
    listing: {
      title: textField(listing, "title", ""),
      body: textField(listing, "body", ""),
    },
  };
};

export const getContactPageContent = (page: PublicPage | null) => {
  const hero = findPublicSection(page, "hero");
  const details = findPublicSection(page, "details");
  const cta = findPublicSection(page, "cta");

  return {
    hero: {
      title: textField(hero, "title", "Start with context."),
      body: textField(
        hero,
        "body",
        "Send the problem, the pattern, or the program you want to build. The reply can route you to a session, quote, or the right next step.",
      ),
    },
    details: {
      title: textField(details, "title", "Contact"),
      body: textField(details, "body", ""),
    },
    cta: {
      title: textField(cta, "title", "Prefer a session?") || "Prefer a session?",
      body: textField(cta, "body", ""),
      ctaText: configString(cta, "ctaText", "Open booking"),
      ctaHref: configString(cta, "ctaHref", "/booking"),
    },
  };
};
