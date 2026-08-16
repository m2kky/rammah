import { apiBaseUrl } from "./config";

export type PublicSiteSettings = {
  siteName: string;
  defaultLocale: string;
  contactEmail: string | null;
  contactPhone: string | null;
  socialLinks: Record<string, string>;
  bookingDefaultTimezone: string;
};

export type PublicNavigationItem = {
  id: string;
  label: string;
  url: string;
  location: string;
  sortOrder: number;
};

export type PublicLegalPage = {
  id: string;
  slug: string;
  title: string;
  body: string;
  version: string;
  publishedAt: string | null;
  seo: {
    metaTitle: string | null;
    metaDescription: string | null;
    canonicalUrl: string | null;
    noindex: boolean;
    ogImage: CmsMedia | null;
  } | null;
};

export type CmsMedia = {
  id: string;
  kind: "image" | "video" | "animation_bundle";
  mimeType: string;
  publicUrl: string;
  altText: string | null;
  decorative: boolean;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
};

export type CmsSectionMedia = Record<string, CmsMedia | CmsMedia[]>;

export type PublicGlobalMedia = {
  groups: Record<string, Record<string, CmsMedia | CmsMedia[]>>;
  loadingVideo: CmsMedia | null;
  loadingPoster: CmsMedia | null;
  matchedHeroFrame: CmsMedia | null;
  desktopMenuVideo: CmsMedia | null;
  mobileMenuVideo: CmsMedia | null;
  defaultOgImage: CmsMedia | null;
};

export type PublicBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body?: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  featuredMedia: CmsMedia | null;
  category?: {
    id: string;
    name: string | null;
    slug: string | null;
  } | null;
  seo?: {
    metaTitle: string | null;
    metaDescription: string | null;
    canonicalUrl: string | null;
    noindex: boolean;
    ogImage: CmsMedia | null;
  } | null;
};

const publicCmsRequest = async <T>(path: string) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`CMS request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

export const fetchPublicSiteSettings = async () => {
  const payload = await publicCmsRequest<{ data: PublicSiteSettings | null }>(
    "/public/cms/settings",
  );

  return payload.data;
};

export const fetchPublicNavigation = async (location?: string) => {
  const params = new URLSearchParams();
  if (location) params.set("location", location);

  const payload = await publicCmsRequest<{ data: PublicNavigationItem[] }>(
    `/public/cms/navigation${params.size ? `?${params.toString()}` : ""}`,
  );

  return payload.data;
};

export const fetchPublicLegalPage = async (slug: string) => {
  const payload = await publicCmsRequest<{ data: PublicLegalPage }>(
    `/public/cms/legal/${encodeURIComponent(slug)}`,
  );

  return payload.data;
};

export const fetchPublicBlogPosts = async () => {
  const payload = await publicCmsRequest<{ data: PublicBlogPost[] }>(
    "/public/cms/blog/posts",
  );

  return payload.data;
};

export const fetchPublicBlogPost = async (slug: string) => {
  const payload = await publicCmsRequest<{ data: PublicBlogPost }>(
    `/public/cms/blog/posts/${encodeURIComponent(slug)}`,
  );

  return payload.data;
};

export type PublicPageSection = {
  id: string;
  sectionType: string;
  title: string | null;
  body: string | null;
  config: Record<string, unknown>;
  sortOrder: number;
  status?: string;
  media: CmsSectionMedia;
};

export type PublicPage = {
  id: string;
  slug: string;
  title: string;
  template: string;
  publishedAt: string | null;
  seo: {
    metaTitle: string | null;
    metaDescription: string | null;
    canonicalUrl: string | null;
    noindex: boolean;
    ogImage: CmsMedia | null;
  } | null;
  sections: PublicPageSection[];
};

export const fetchPublicPage = async (slug: string) => {
  const payload = await publicCmsRequest<{ data: PublicPage }>(
    `/public/cms/pages/${encodeURIComponent(slug)}`,
  );

  return payload.data;
};

export const fetchPublicGlobalMedia = async () => {
  const payload = await publicCmsRequest<{ data: PublicGlobalMedia }>(
    "/public/cms/media/globals",
  );
  return payload.data;
};

export const fetchPreviewPage = async (pageId: string, token: string) => {
  const response = await fetch(
    `${apiBaseUrl}/public/cms/preview/pages/${encodeURIComponent(pageId)}`,
    {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`CMS preview request failed: ${response.status}`);
  const payload = await response.json() as { data: PublicPage & { preview: true } };
  return payload.data;
};

export const findPublicSection = (
  page: PublicPage | null | undefined,
  sectionType: string,
) => page?.sections.find((section) => section.sectionType === sectionType) ?? null;
