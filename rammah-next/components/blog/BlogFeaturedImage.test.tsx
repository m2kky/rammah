import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CmsMedia } from "@/lib/api/cms";
import { BlogFeaturedImage } from "./BlogFeaturedImage";

const image: CmsMedia = {
  id: "asset-id",
  kind: "image",
  mimeType: "image/webp",
  publicUrl: "https://media.example.test/blog.webp",
  altText: "Article cover",
  decorative: false,
  width: 1200,
  height: 630,
  durationMs: null,
  metadata: {},
};

describe("BlogFeaturedImage", () => {
  it("renders the configured image with its CMS alternative text", () => {
    render(<BlogFeaturedImage media={image} />);

    expect(screen.getByRole("img", { name: "Article cover" })).toHaveAttribute(
      "src",
      "https://media.example.test/blog.webp",
    );
  });

  it("renders nothing when no featured image is configured", () => {
    const { container } = render(<BlogFeaturedImage media={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
