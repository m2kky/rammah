import Link from "next/link";
import type { PublicPageSection } from "../../../lib/api/cms";
import { SafeMarkdown } from "../SafeMarkdown";
import { CmsImage, CmsVideo, firstMedia } from "../media";

const link = (value: unknown) => typeof value === "object" && value ? value as { label?: string; url?: string } : null;

export function HeroSection({ section }: { section: PublicPageSection }) {
  const desktopVideo = firstMedia(section.media.desktopVideo);
  const mobileVideo = firstMedia(section.media.mobileVideo);
  const desktopImage = firstMedia(section.media.desktopImage);
  const mobileImage = firstMedia(section.media.mobileImage);
  const poster = firstMedia(section.media.poster);
  const primary = link(section.config.primaryCta);
  const secondary = link(section.config.secondaryCta);
  return (
    <section className="relative isolate min-h-[72svh] overflow-hidden bg-[#06171c] px-5 py-28 text-white md:px-8 md:py-36">
      <div className="absolute inset-0 -z-10 opacity-55">
        {desktopVideo || mobileVideo ? (
          <video autoPlay muted playsInline loop poster={poster?.publicUrl} className="h-full w-full object-cover"><source src={mobileVideo?.publicUrl} media="(max-width: 767px)" type={mobileVideo?.mimeType} /><source src={desktopVideo?.publicUrl ?? mobileVideo?.publicUrl} type={desktopVideo?.mimeType ?? mobileVideo?.mimeType} /></video>
        ) : mobileImage || desktopImage ? (
          <picture>{mobileImage ? <source srcSet={mobileImage.publicUrl} media="(max-width: 767px)" /> : null}{desktopImage ? <CmsImage media={desktopImage} className="h-full w-full object-cover" /> : mobileImage ? <CmsImage media={mobileImage} className="h-full w-full object-cover" /> : null}</picture>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-[#06171c] via-[#06171c]/80 to-transparent" />
      </div>
      <div className="mx-auto max-w-6xl"><h1 className="max-w-4xl text-[clamp(3.5rem,10vw,8.5rem)] font-extrabold leading-[0.86] tracking-[-0.04em]">{section.title}</h1>{section.body ? <SafeMarkdown className="mt-8 max-w-2xl space-y-4 font-inter text-lg leading-8 text-white/75">{section.body}</SafeMarkdown> : null}<div className="mt-9 flex flex-wrap gap-3">{primary?.url ? <Link href={primary.url} className="bg-white px-5 py-3 font-inter text-sm font-semibold text-[#0F3B46]">{primary.label || "Learn more"}</Link> : null}{secondary?.url ? <Link href={secondary.url} className="border border-white/40 px-5 py-3 font-inter text-sm font-semibold text-white">{secondary.label || "Explore"}</Link> : null}</div></div>
    </section>
  );
}
