import type { Metadata } from "next";

export const DEFAULT_SITE_TITLE =
  "Ahmed Rammah — Engineer · Systematizer · Trainer · Coach";
export const DEFAULT_SITE_DESCRIPTION =
  "I map your psychological system, find the bugs, and rewrite the code.";
export const DEFAULT_OG_IMAGE: SeoImage = {
  publicUrl: "/opengraph-image.png",
  altText: "Ahmed Rammah",
  width: 1200,
  height: 630,
  mimeType: "image/png",
};

export type SeoImage = {
  publicUrl: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
};

export type MetadataInput = {
  title: string;
  description: string;
  pathname: string;
  canonicalUrl?: string | null;
  image?: SeoImage | null;
  noindex?: boolean;
  type?: "website" | "article";
  publishedTime?: string | null;
  modifiedTime?: string | null;
};

const invalidSiteUrl = () => new Error(
  "Invalid NEXT_PUBLIC_SITE_URL: expected an HTTP(S) origin without a path, query, or hash.",
);

export const siteUrl = () => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured && process.env.NODE_ENV !== "production") {
    return new URL("http://localhost:3000");
  }
  if (!configured) throw invalidSiteUrl();

  try {
    const url = new URL(configured);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw invalidSiteUrl();
    }
    return url;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid NEXT_PUBLIC_SITE_URL")) {
      throw error;
    }
    throw invalidSiteUrl();
  }
};

export const absoluteUrl = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return null;

  try {
    const url = new URL(normalized, siteUrl());
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const plainText = (value: string, fallback: string) => {
  const normalized = value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
};

const imageMetadata = (image: SeoImage) => {
  const url = absoluteUrl(image.publicUrl) ?? absoluteUrl(DEFAULT_OG_IMAGE.publicUrl)!;
  const dimensions =
    typeof image.width === "number" && image.width > 0 &&
    typeof image.height === "number" && image.height > 0
      ? { width: image.width, height: image.height }
      : {};

  return {
    url,
    alt: plainText(image.altText ?? "", "Ahmed Rammah"),
    ...dimensions,
    ...(image.mimeType ? { type: image.mimeType } : {}),
  };
};

export const buildMetadata = (input: MetadataInput): Metadata => {
  const title = plainText(input.title, DEFAULT_SITE_TITLE);
  const description = plainText(input.description, DEFAULT_SITE_DESCRIPTION);
  const routeCanonical = absoluteUrl(input.pathname)!;
  const canonical = input.canonicalUrl
    ? absoluteUrl(input.canonicalUrl) ?? routeCanonical
    : routeCanonical;
  const image = imageMetadata(input.image ?? DEFAULT_OG_IMAGE);
  const commonOpenGraph = {
    title,
    description,
    url: canonical,
    siteName: "Ahmed Rammah",
    locale: "en",
    images: [image],
  };
  const openGraph: NonNullable<Metadata["openGraph"]> = input.type === "article"
    ? {
        ...commonOpenGraph,
        type: "article",
        ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
        ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
      }
    : { ...commonOpenGraph, type: "website" };

  return {
    title,
    description,
    alternates: { canonical },
    ...(input.noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
};

export const privateMetadata = (title: string): Metadata => ({
  title: plainText(title, "Private page"),
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
});
