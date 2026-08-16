import type { PublicBlogPost } from "@/lib/api/cms";
import type { PublicOffering } from "@/lib/api/offerings";
import { buildMetadata, DEFAULT_SITE_DESCRIPTION, type SeoImage } from "./metadata";

export const blogPostMetadata = (
  post: PublicBlogPost,
  fallbackImage?: SeoImage | null,
) => buildMetadata({
  title: post.seo?.metaTitle || post.title,
  description:
    post.seo?.metaDescription || post.excerpt || "Insights from Ahmed Rammah.",
  pathname: `/blog/${post.slug}`,
  canonicalUrl: post.seo?.canonicalUrl,
  image: post.seo?.ogImage || fallbackImage,
  noindex: post.seo?.noindex,
  type: "article",
  publishedTime: post.publishedAt,
  modifiedTime: post.updatedAt,
});

export const offeringMetadata = (
  offering: PublicOffering,
  pathname: string,
  fallbackImage?: SeoImage | null,
) => buildMetadata({
  title: offering.title,
  description:
    offering.description || offering.subtitle || DEFAULT_SITE_DESCRIPTION,
  pathname,
  image: fallbackImage,
});
