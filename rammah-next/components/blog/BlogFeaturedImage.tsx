/* eslint-disable @next/next/no-img-element */
import type { CmsMedia } from "@/lib/api/cms";

type BlogFeaturedImageProps = {
  media: CmsMedia | null | undefined;
  className?: string;
};

export function BlogFeaturedImage({ media, className = "aspect-video" }: BlogFeaturedImageProps) {
  if (!media || media.kind !== "image") return null;

  return (
    <img
      src={media.publicUrl}
      alt={media.decorative ? "" : media.altText ?? ""}
      width={media.width ?? 1200}
      height={media.height ?? 675}
      loading="lazy"
      decoding="async"
      className={`${className} w-full bg-[#102329]/6 object-cover`}
    />
  );
}
