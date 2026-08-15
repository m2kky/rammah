import type { PublicPageSection } from "../../../lib/api/cms";

export function DividerSection({ section }: { section: PublicPageSection }) {
  const padding = section.config.size === "small" ? "py-6" : section.config.size === "large" ? "py-20" : "py-12";
  return <div aria-hidden="true" className={`bg-white px-5 ${padding}`}>{section.config.showDivider === true ? <hr className="mx-auto max-w-6xl border-[#102329]/15" /> : null}</div>;
}
