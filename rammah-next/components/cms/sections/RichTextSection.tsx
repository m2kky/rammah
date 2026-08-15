import type { PublicPageSection } from "../../../lib/api/cms";
import { SafeMarkdown } from "../SafeMarkdown";

export function RichTextSection({ section }: { section: PublicPageSection }) {
  return <section className="bg-white px-5 py-20 text-[#102329] md:px-8 md:py-28"><div className="mx-auto max-w-4xl">{section.title ? <h2 className="mb-8 text-4xl font-semibold md:text-6xl">{section.title}</h2> : null}<SafeMarkdown className="space-y-5 font-inter text-base leading-8 text-[#102329]/76 md:text-lg">{section.body ?? ""}</SafeMarkdown></div></section>;
}
