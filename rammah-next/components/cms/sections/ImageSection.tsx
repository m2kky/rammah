import type { PublicPageSection } from "../../../lib/api/cms";
import { CmsImage, firstMedia } from "../media";

export function ImageSection({ section }: { section: PublicPageSection }) {
  const image = firstMedia(section.media.image);
  const width = section.config.width === "full" ? "max-w-none" : section.config.width === "content" ? "max-w-4xl" : "max-w-6xl";
  return <figure className="bg-white px-5 py-12 text-[#102329] md:px-8"><div className={`mx-auto ${width}`}>{image ? <CmsImage media={image} className="h-auto w-full object-cover" /> : null}{typeof section.config.caption === "string" && section.config.caption ? <figcaption className="mt-3 font-inter text-sm text-[#102329]/55">{section.config.caption}</figcaption> : null}</div></figure>;
}
