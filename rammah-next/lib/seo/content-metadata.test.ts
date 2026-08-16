import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicBlogPost } from "@/lib/api/cms";
import type { PublicOffering } from "@/lib/api/offerings";
import { blogPostMetadata, offeringMetadata } from "./content-metadata";

afterEach(() => vi.unstubAllEnvs());

describe("dynamic content metadata", () => {
  it("maps blog SEO and timestamps to article metadata", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ahmedrammah.com");
    const post = {
      id: "post-id",
      title: "Post title",
      slug: "post-title",
      excerpt: "Post excerpt",
      publishedAt: "2026-08-01T10:00:00.000Z",
      createdAt: "2026-07-31T10:00:00.000Z",
      updatedAt: "2026-08-02T10:00:00.000Z",
      seo: {
        metaTitle: "Edited post title",
        metaDescription: "Edited post description",
        canonicalUrl: null,
        noindex: false,
        ogImage: {
          id: "media-id",
          kind: "image",
          mimeType: "image/png",
          publicUrl: "https://media.example.test/post.png",
          altText: "Post cover",
          decorative: false,
          width: 1200,
          height: 630,
          durationMs: null,
          metadata: {},
        },
      },
    } satisfies PublicBlogPost;

    expect(blogPostMetadata(post)).toMatchObject({
      title: "Edited post title",
      alternates: { canonical: "https://ahmedrammah.com/blog/post-title" },
      openGraph: {
        type: "article",
        publishedTime: post.publishedAt,
        modifiedTime: post.updatedAt,
        images: [expect.objectContaining({ url: "https://media.example.test/post.png" })],
      },
    });
  });

  it("uses offering content for service and booking routes", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ahmedrammah.com");
    const offering = {
      id: "offering-id",
      slug: "one-to-one",
      title: "1:1 Coaching",
      subtitle: "Decode the pattern",
      description: null,
      category: null,
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode: "paid",
      schedulingMode: "appointment",
      durationMinutes: 60,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      capacity: 1,
      requiresPayment: true,
      quoteOnly: false,
      colors: { background: "#0F3B46", text: "#FFFFFF" },
    } satisfies PublicOffering;

    expect(offeringMetadata(offering, `/booking/${offering.slug}`)).toMatchObject({
      title: "1:1 Coaching",
      description: "Decode the pattern",
      alternates: { canonical: "https://ahmedrammah.com/booking/one-to-one" },
      openGraph: { type: "website" },
    });
  });
});
