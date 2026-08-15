import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectionEditor } from "../components/admin/cms/SectionEditor";
import type { AdminCmsPageSection, AdminCmsSectionDefinition } from "./api/admin";

const definition: AdminCmsSectionDefinition = {
  key: "hero",
  label: "Hero",
  description: "Page introduction",
  fields: [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "body", label: "Body", type: "markdown" },
    { key: "desktopImage", label: "Desktop image", type: "media", accepts: ["image"], cardinality: "single" },
    { key: "mobileImage", label: "Mobile image", type: "media", accepts: ["image"], cardinality: "single" },
  ],
};

const section: AdminCmsPageSection = {
  id: "section-id",
  pageId: "page-id",
  sectionType: "hero",
  title: "Lead with clarity",
  body: null,
  config: {},
  media: {},
  sortOrder: 0,
  status: "draft",
  createdAt: "2026-08-15T00:00:00.000Z",
  updatedAt: "2026-08-15T00:00:00.000Z",
};

describe("registry-driven section editor", () => {
  it("renders named hero controls without raw config or IDs", () => {
    const html = renderToStaticMarkup(createElement(SectionEditor, {
      definition,
      section,
      onChange: () => undefined,
    }));
    expect(html).toContain("Desktop image");
    expect(html).toContain("Mobile image");
    expect(html).not.toContain("Section config JSON");
    expect(html).not.toContain("Media asset ID");
  });
});
