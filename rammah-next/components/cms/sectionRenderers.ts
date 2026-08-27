import type { ComponentType } from "react";
import type { PublicPageSection } from "../../lib/api/cms";
import { RecognitionSection } from "../about/RecognitionSection";
import { CtaSection } from "./sections/CtaSection";
import { DividerSection } from "./sections/DividerSection";
import { GallerySection } from "./sections/GallerySection";
import { HeroSection } from "./sections/HeroSection";
import { ImageSection } from "./sections/ImageSection";
import { ImageTextSection } from "./sections/ImageTextSection";
import { RichTextSection } from "./sections/RichTextSection";
import { VideoSection } from "./sections/VideoSection";

export const SECTION_RENDERERS: Record<string, ComponentType<{ section: PublicPageSection }>> = {
  hero: HeroSection,
  rich_text: RichTextSection,
  image_with_text: ImageTextSection,
  standalone_image: ImageSection,
  video: VideoSection,
  gallery: GallerySection,
  recognition: RecognitionSection,
  cta: CtaSection,
  divider_spacer: DividerSection,
};
