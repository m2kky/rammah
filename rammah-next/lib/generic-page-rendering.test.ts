import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SECTION_RENDERERS } from "../components/cms/sectionRenderers";
import { SafeMarkdown } from "../components/cms/SafeMarkdown";

describe("generic CMS rendering", () => {
  it("maps every approved section type to one renderer", () => {
    expect(Object.keys(SECTION_RENDERERS).sort()).toEqual([
      "cta",
      "divider_spacer",
      "gallery",
      "hero",
      "image_with_text",
      "recognition",
      "rich_text",
      "standalone_image",
      "video",
    ]);
  });

  it("does not render raw HTML from Markdown", () => {
    const html = renderToStaticMarkup(createElement(SafeMarkdown, null, "<script>alert(1)</script>\n\n**Safe**"));
    expect(html).not.toContain("<script");
    expect(html).toContain("<strong>Safe</strong>");
  });
});
