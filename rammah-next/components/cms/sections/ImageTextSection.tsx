import Link from "next/link";
import type { PublicPageSection } from "../../../lib/api/cms";
import { SafeMarkdown } from "../SafeMarkdown";
import { CmsImage, firstMedia } from "../media";

export function ImageTextSection({ section }: { section: PublicPageSection }) {
  const image = firstMedia(section.media.image);
  const alignRight = section.config.alignment === "right";
  const cta = typeof section.config.cta === "object" && section.config.cta ? section.config.cta as { label?: string; url?: string } : null;
  return <section className="bg-[#f4f1e9] px-5 py-20 text-[#102329] md:px-8 md:py-28"><div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">{image ? <CmsImage media={image} className={`aspect-[4/5] w-full object-cover ${alignRight ? "lg:order-2" : ""}`} /> : null}<div className={alignRight ? "lg:order-1" : ""}>{section.title ? <h2 className="text-4xl font-semibold md:text-6xl">{section.title}</h2> : null}<SafeMarkdown className="mt-6 space-y-4 font-inter text-base leading-8 text-[#102329]/70">{section.body ?? ""}</SafeMarkdown>{cta?.url ? <Link href={cta.url} className="mt-8 inline-block border-b border-[#0F3B46] pb-1 text-sm font-semibold text-[#0F3B46]">{cta.label || "Learn more"}</Link> : null}</div></div></section>;
}
