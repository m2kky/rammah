import { afterEach, describe, expect, it, vi } from "vitest";
import {
  absoluteUrl,
  buildMetadata,
  privateMetadata,
  siteUrl,
} from "./metadata";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("site metadata", () => {
  it("normalizes the configured canonical site origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ahmedrammah.com/");

    expect(siteUrl().href).toBe("https://ahmedrammah.com/");
    expect(absoluteUrl("/about")).toBe("https://ahmedrammah.com/about");
    expect(absoluteUrl("https://media.example.com/card.png")).toBe(
      "https://media.example.com/card.png",
    );
  });

  it("rejects an invalid production origin instead of emitting localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ahmedrammah.com/path?bad=1");

    expect(() => siteUrl()).toThrow("Invalid NEXT_PUBLIC_SITE_URL");
  });

  it("builds complete canonical, Open Graph, and Twitter metadata", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ahmedrammah.com");

    expect(
      buildMetadata({
        title: "About",
        description: "About Ahmed",
        pathname: "/about",
        image: {
          publicUrl: "/opengraph-image.png",
          altText: "Ahmed Rammah",
          width: 1200,
          height: 630,
          mimeType: "image/png",
        },
      }),
    ).toMatchObject({
      title: "About",
      description: "About Ahmed",
      alternates: { canonical: "https://ahmedrammah.com/about" },
      openGraph: {
        title: "About",
        description: "About Ahmed",
        url: "https://ahmedrammah.com/about",
        siteName: "Ahmed Rammah",
        locale: "en",
        type: "website",
        images: [
          {
            url: "https://ahmedrammah.com/opengraph-image.png",
            alt: "Ahmed Rammah",
            width: 1200,
            height: 630,
            type: "image/png",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "About",
        description: "About Ahmed",
        images: ["https://ahmedrammah.com/opengraph-image.png"],
      },
    });
  });

  it("uses the route canonical and default portrait card when overrides are invalid", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ahmedrammah.com");

    expect(
      buildMetadata({
        title: " <b>Services</b> ",
        description: " Work   on the system. ",
        pathname: "/services",
        canonicalUrl: "javascript:alert(1)",
      }),
    ).toMatchObject({
      title: "Services",
      description: "Work on the system.",
      alternates: { canonical: "https://ahmedrammah.com/services" },
      openGraph: {
        images: [
          expect.objectContaining({
            url: "https://ahmedrammah.com/opengraph-image.png",
          }),
        ],
      },
    });
  });

  it("adds article timestamps only for article metadata", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ahmedrammah.com");

    expect(
      buildMetadata({
        title: "A post",
        description: "An essay",
        pathname: "/blog/a-post",
        type: "article",
        publishedTime: "2026-08-01T10:00:00.000Z",
        modifiedTime: "2026-08-02T10:00:00.000Z",
      }).openGraph,
    ).toMatchObject({
      type: "article",
      publishedTime: "2026-08-01T10:00:00.000Z",
      modifiedTime: "2026-08-02T10:00:00.000Z",
    });
  });

  it("builds private metadata without accepting a path or token", () => {
    expect(privateMetadata("Payment")).toEqual({
      title: "Payment",
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
  });
});
