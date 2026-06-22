import { apiBaseUrl } from "./config";

export type PublicSiteSettings = {
  siteName: string;
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
  } | null;
};

export type PublicBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body?: string;
  publishedAt: string | null;
  createdAt: string;
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
