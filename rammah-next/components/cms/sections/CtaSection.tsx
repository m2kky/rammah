import Link from "next/link";
import type { PublicPageSection } from "../../../lib/api/cms";
import { SafeMarkdown } from "../SafeMarkdown";
import { CmsImage, firstMedia } from "../media";

export function CtaSection({ section }: { section: PublicPageSection }) {
  const background = firstMedia(section.media.backgroundImage);
  const button = typeof section.config.button === "object" && section.config.button ? section.config.button as { label?: string; url?: string } : null;
  return <section className="relative isolate overflow-hidden bg-[#0F3B46] px-5 py-24 text-center text-white md:px-8 md:py-32">{background ? <div className="absolute inset-0 -z-10 opacity-25"><CmsImage media={background} className="h-full w-full object-cover" /></div> : null}<div className="mx-auto max-w-4xl"><h2 className="text-5xl font-semibold md:text-7xl">{section.title}</h2>{section.body ? <SafeMarkdown className="mx-auto mt-6 max-w-2xl space-y-3 font-inter text-lg leading-8 text-white/70">{section.body}</SafeMarkdown> : null}{button?.url ? <Link href={button.url} className="mt-9 inline-block bg-white px-6 py-3 font-inter text-sm font-semibold text-[#0F3B46]">{button.label || "Continue"}</Link> : null}</div></section>;
}
