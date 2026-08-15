/* eslint-disable @next/next/no-img-element */
import type { CmsMedia } from "../../lib/api/cms";

export const firstMedia = (value: CmsMedia | CmsMedia[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export function CmsImage({ media, className }: { media: CmsMedia; className?: string }) {
  return <img src={media.publicUrl} alt={media.decorative ? "" : media.altText ?? ""} width={media.width ?? undefined} height={media.height ?? undefined} className={className} />;
}

export function CmsVideo({ media, poster, className, autoplay = false, loop = false, controls = true }: {
  media: CmsMedia;
  poster?: CmsMedia;
  className?: string;
  autoplay?: boolean;
  loop?: boolean;
  controls?: boolean;
}) {
  return <video src={media.publicUrl} poster={poster?.publicUrl} autoPlay={autoplay} muted={autoplay} playsInline loop={loop} controls={controls} className={className} preload="metadata" />;
}
