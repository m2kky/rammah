import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  archiveAdminCmsPage: vi.fn(),
  archiveAdminCmsPageSection: vi.fn(),
  createAdminCmsPage: vi.fn(),
  createAdminCmsPageSection: vi.fn(),
  createAdminPagePreviewToken: vi.fn(),
  duplicateAdminCmsPageSection: vi.fn(),
  fetchAdminCmsPageSections: vi.fn(),
  fetchAdminCmsPages: vi.fn(),
  fetchAdminCmsSectionDefinitions: vi.fn(),
  reorderAdminCmsPageSections: vi.fn(),
  replaceAdminCmsSectionMedia: vi.fn(),
  updateAdminCmsPage: vi.fn(),
  updateAdminCmsPageSection: vi.fn(),
}));

vi.mock("@/lib/api/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin")>();
  return { ...actual, ...apiMocks };
});

vi.mock("./SectionEditor", () => ({
  SectionEditor: () => <div>Hero fields</div>,
}));

vi.mock("./SeoEditor", () => ({
  SeoEditor: () => <div>SEO fields</div>,
}));

import type {
  AdminCmsPage,
  AdminCmsPageSection,
  AdminCmsSectionDefinition,
} from "@/lib/api/admin";
import { CmsPagesEditor } from "./CmsPagesEditor";

const page: AdminCmsPage = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "about",
  title: "About",
  template: "default",
  status: "published",
  publishedAt: "2026-08-23T00:00:00.000Z",
  publicationError: null,
  createdAt: "2026-08-23T00:00:00.000Z",
  updatedAt: "2026-08-23T00:00:00.000Z",
};

const heroSection: AdminCmsPageSection = {
  id: "22222222-2222-4222-8222-222222222222",
  pageId: page.id,
  sectionType: "hero",
  title: "Ahmed Rammah",
  body: "About body",
  config: {},
  media: {},
  sortOrder: 10,
  status: "published",
  createdAt: "2026-08-23T00:00:00.000Z",
  updatedAt: "2026-08-23T00:00:00.000Z",
};

const heroDefinition: AdminCmsSectionDefinition = {
  key: "hero",
  label: "Hero",
  description: "Hero section",
  fields: [],
};

describe("CmsPagesEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchAdminCmsPages.mockResolvedValue([page]);
    apiMocks.fetchAdminCmsSectionDefinitions.mockResolvedValue([heroDefinition]);
    apiMocks.fetchAdminCmsPageSections.mockResolvedValue([heroSection]);
    apiMocks.replaceAdminCmsSectionMedia.mockResolvedValue([]);
  });

  it("shows progress and success feedback while saving a section", async () => {
    let resolveUpdate: (() => void) | undefined;
    apiMocks.updateAdminCmsPageSection.mockImplementation(() => new Promise((resolve) => {
      resolveUpdate = () => resolve(heroSection);
    }));
    const user = userEvent.setup();
    render(<CmsPagesEditor />);

    await user.click(await screen.findByRole("button", { name: /About/ }));
    const heroButton = (await screen.findByText("Hero", { selector: "strong" })).closest("button");
    expect(heroButton).not.toBeNull();
    await user.click(heroButton!);
    await user.click(screen.getByRole("button", { name: "Save section" }));

    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    resolveUpdate?.();

    await waitFor(() => expect(apiMocks.replaceAdminCmsSectionMedia).toHaveBeenCalled());
    expect(await screen.findByRole("status")).toHaveTextContent("Section saved.");
  });
});
