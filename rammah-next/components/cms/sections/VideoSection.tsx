import type { PublicPageSection } from "../../../lib/api/cms";
import { CmsVideo, firstMedia } from "../media";

export function VideoSection({ section }: { section: PublicPageSection }) {
  const video = firstMedia(section.media.video);
  const poster = firstMedia(section.media.poster);
  const autoplay = section.config.autoplay === true;
  return <figure className="bg-[#06171c] px-5 py-16 text-white md:px-8 md:py-24"><div className="mx-auto max-w-6xl">{video ? <CmsVideo media={video} poster={poster} autoplay={autoplay} loop={section.config.loop === true} controls={section.config.controls !== false} className="aspect-video w-full bg-black object-cover" /> : null}{typeof section.config.caption === "string" && section.config.caption ? <figcaption className="mt-3 font-inter text-sm text-white/55">{section.config.caption}</figcaption> : null}</div></figure>;
}
