import type { CmsMedia, PublicPageSection } from "../../../lib/api/cms";
import { CmsImage } from "../media";

export function GallerySection({ section }: { section: PublicPageSection }) {
  const value = section.media.galleryImages;
  const images: CmsMedia[] = value ? Array.isArray(value) ? value : [value] : [];
  return <section className="bg-[#f4f1e9] px-5 py-20 text-[#102329] md:px-8"><div className="mx-auto max-w-6xl">{section.title ? <h2 className="mb-8 text-4xl font-semibold md:text-6xl">{section.title}</h2> : null}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map((image) => <CmsImage key={image.id} media={image} className="aspect-square w-full object-cover" />)}</div></div></section>;
}
