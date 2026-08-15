import type { PublicPage } from "../../lib/api/cms";
import PublicFrame from "../PublicFrame";
import { SECTION_RENDERERS } from "./sectionRenderers";

export { SECTION_RENDERERS } from "./sectionRenderers";

export function GenericPage({ page, preview = false }: { page: PublicPage; preview?: boolean }) {
  return <PublicFrame><main className="min-h-screen bg-white">{preview ? <div className="fixed left-0 right-0 top-0 z-[90] bg-amber-300 px-4 py-2 text-center font-inter text-xs font-semibold text-black">Preview · changes are not public</div> : null}{page.sections.map((section) => { const Renderer = SECTION_RENDERERS[section.sectionType]; return Renderer ? <Renderer key={section.id} section={section} /> : null; })}</main></PublicFrame>;
}
