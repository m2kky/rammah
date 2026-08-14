import { describe, expect, it } from "vitest";
import rendererRegistry from "./section-renderer-registry.json";

describe("CMS section renderer registry", () => {
  it("maps every supported section type to a named public renderer", () => {
    expect(rendererRegistry).toEqual({
      hero: "HeroSection",
      rich_text: "RichTextSection",
      image_with_text: "ImageWithTextSection",
      standalone_image: "StandaloneImageSection",
      video: "VideoSection",
      gallery: "GallerySection",
      cta: "CtaSection",
      divider_spacer: "DividerSpacerSection",
    });
  });
});
