import {
  findPublicSection,
  type PublicPage,
  type PublicPageSection,
  type PublicGlobalMedia,
  type PublicSiteSettings,
  type CmsMedia,
} from "./cms";
import type { Metadata } from "next";
import { buildMetadata, DEFAULT_OG_IMAGE } from "@/lib/seo/metadata";

const fallbackMedia = (
  id: string,
  kind: CmsMedia["kind"],
  mimeType: string,
  publicUrl: string,
  altText: string | null,
  metadata: Record<string, unknown> = {},
  width: number | null = null,
  height: number | null = null,
): CmsMedia => ({
  id: `fallback:${id}`,
  kind,
  mimeType,
  publicUrl,
  altText,
  decorative: altText === null,
  width,
  height,
  durationMs: null,
  metadata,
});

const groupSlot = (
  globals: PublicGlobalMedia | null | undefined,
  definitionKey: string,
  slotKey: string,
) => {
  const value = globals?.groups[definitionKey]?.[slotKey];
  return Array.isArray(value) ? value[0] : value;
};

export const getGlobalMedia = (globals: PublicGlobalMedia | null | undefined) => ({
  loadingVideo: globals?.loadingVideo ?? fallbackMedia("loading-video", "video", "video/mp4", "/videos/intro-loading.mp4", null),
  loadingPoster: globals?.loadingPoster ?? fallbackMedia("loading-poster", "image", "image/jpeg", "/videos/intro-loading-poster.jpg", "Ahmed Rammah intro"),
  matchedHeroFrame: globals?.matchedHeroFrame ?? fallbackMedia("matched-hero", "image", "image/png", "/hero.png", "Ahmed Rammah"),
  desktopMenuVideo: globals?.desktopMenuVideo ?? fallbackMedia("menu-desktop", "video", "video/webm", "/videos/about-fastcut-desktop.webm", null),
  mobileMenuVideo: globals?.mobileMenuVideo ?? fallbackMedia("menu-mobile", "video", "video/webm", "/videos/about-fastcut-mobile.webm", null),
  defaultOgImage: globals?.defaultOgImage ?? fallbackMedia(
    "default-og",
    "image",
    "image/png",
    DEFAULT_OG_IMAGE.publicUrl,
    DEFAULT_OG_IMAGE.altText ?? "Ahmed Rammah",
    {},
    DEFAULT_OG_IMAGE.width ?? null,
    DEFAULT_OG_IMAGE.height ?? null,
  ),
});

export const getHomepageMedia = (globals: PublicGlobalMedia | null | undefined) => ({
  heroPortrait: groupSlot(globals, "homepage", "heroPortrait")
    ?? fallbackMedia("home-hero", "image", "image/png", "/hero.png", "Ahmed Rammah"),
  servicesAnimation: groupSlot(globals, "homepage", "servicesAnimation")
    ?? fallbackMedia("services-animation", "animation_bundle", "application/vnd.rammah.animation+json", "/services-frames/frame0001.webp?v=services_v1", null, {
      frameCount: 168,
      fileExtension: "webp",
      urlPattern: "/services-frames/frame{frame}.webp?v=services_v1",
    }),
});

export const getAboutMedia = (globals: PublicGlobalMedia | null | undefined) => ({
  heroImage: groupSlot(globals, "about", "heroImage")
    ?? fallbackMedia("about-hero", "image", "image/png", "/about_hero.png", "Ahmed Rammah"),
  desktopFastCutVideo: groupSlot(globals, "about", "desktopFastCutVideo")
    ?? fallbackMedia("about-video-desktop", "video", "video/webm", "/videos/about-fastcut-desktop.webm", null),
  mobileFastCutVideo: groupSlot(globals, "about", "mobileFastCutVideo")
    ?? fallbackMedia("about-video-mobile", "video", "video/webm", "/videos/about-fastcut-mobile.webm", null),
  supportingImage: groupSlot(globals, "about", "supportingImage")
    ?? fallbackMedia("about-supporting", "image", "image/png", "/Systems meet people.png", "Ahmed Rammah during a training session"),
});

export const getCorporateMedia = (globals: PublicGlobalMedia | null | undefined) => ({
  portrait: groupSlot(globals, "corporateTraining", "portrait")
    ?? fallbackMedia("corporate-portrait", "image", "image/png", "/RammahPortrait1.png", "Corporate training with Ahmed Rammah"),
  parallaxImage: groupSlot(globals, "corporateTraining", "parallaxImage")
    ?? fallbackMedia("corporate-parallax", "image", "image/png", "/hero-final-frame.png", "Corporate leadership training"),
});

export const getServiceDetailMedia = (globals: PublicGlobalMedia | null | undefined) => ({
  portrait: groupSlot(globals, "serviceDetail", "portrait")
    ?? fallbackMedia("service-portrait", "image", "image/png", "/RammahPortrait1.png", "Ahmed Rammah"),
});

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
  pathname: string,
  fallbackImage?: CmsMedia | null,
): Metadata => buildMetadata({
  title: page?.seo?.metaTitle || page?.title || fallbackTitle,
  description: page?.seo?.metaDescription || fallbackDescription,
  pathname,
  canonicalUrl: page?.seo?.canonicalUrl,
  noindex: page?.seo?.noindex,
  image: page?.seo?.ogImage || fallbackImage || DEFAULT_OG_IMAGE,
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
