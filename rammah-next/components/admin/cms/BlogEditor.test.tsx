import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  archiveAdminBlogCategory: vi.fn(),
  archiveAdminBlogPost: vi.fn(),
  createAdminBlogCategory: vi.fn(),
  createAdminBlogPost: vi.fn(),
  fetchAdminBlogCategories: vi.fn(),
  fetchAdminBlogPosts: vi.fn(),
  fetchAdminMediaAssets: vi.fn(),
  updateAdminBlogCategory: vi.fn(),
  updateAdminBlogPost: vi.fn(),
}));

vi.mock("@/lib/api/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin")>();
  return { ...actual, ...apiMocks };
});

vi.mock("./MediaPicker", () => ({
  MediaPicker: ({ value, onChange }: {
    value: Array<{ id: string }>;
    onChange(value: Array<{ id: string }>): void;
  }) => value.length ? <span>Featured image selected</span> : (
    <button type="button" onClick={() => onChange([image])}>Choose featured image</button>
  ),
}));

vi.mock("./SeoEditor", () => ({
  SeoEditor: ({ resourceType }: { resourceType: string }) => <div>SEO editor for {resourceType}</div>,
}));

import type { AdminBlogCategory, AdminMediaAsset } from "@/lib/api/admin";
import { BlogEditor } from "./BlogEditor";

const CATEGORY_ID = "11111111-1111-4111-8111-111111111111";
const IMAGE_ID = "22222222-2222-4222-8222-222222222222";
const category: AdminBlogCategory = {
  id: CATEGORY_ID,
  name: "Leadership",
  slug: "leadership",
  status: "published",
  createdAt: "2026-08-16T00:00:00.000Z",
  updatedAt: "2026-08-16T00:00:00.000Z",
};
const image: AdminMediaAsset = {
  id: IMAGE_ID,
  displayName: "Blog cover",
  fileName: "blog.webp",
  mimeType: "image/webp",
  sourceType: "r2",
  mediaKind: "image",
  publicUrl: "https://media.example.test/blog.webp",
  altText: "Article cover",
  sizeBytes: 123,
  width: 1200,
  height: 630,
  durationMs: null,
  metadata: {},
  processingState: "ready",
  processingError: null,
  status: "published",
  createdAt: "2026-08-16T00:00:00.000Z",
  updatedAt: "2026-08-16T00:00:00.000Z",
};

describe("BlogEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchAdminBlogCategories.mockResolvedValue([category]);
    apiMocks.fetchAdminBlogPosts.mockResolvedValue([]);
    apiMocks.fetchAdminMediaAssets.mockResolvedValue([image]);
    apiMocks.createAdminBlogPost.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      categoryId: CATEGORY_ID,
      title: "A useful post",
      slug: "a-useful-post",
      excerpt: null,
      body: "Post body",
      featuredMediaAssetId: IMAGE_ID,
      status: "draft",
      publishedAt: null,
      createdAt: "2026-08-16T00:00:00.000Z",
      updatedAt: "2026-08-16T00:00:00.000Z",
    });
  });

  it("creates a valid post with its category and featured image", async () => {
    const user = userEvent.setup();
    render(<BlogEditor />);

    const create = await screen.findByRole("button", { name: "Create post" });
    expect(create).toBeDisabled();
    await user.type(screen.getByLabelText("Post title"), "A useful post");
    await user.type(screen.getByLabelText("Post slug"), "a-useful-post");
    await user.selectOptions(screen.getByLabelText("Category"), CATEGORY_ID);
    await user.type(screen.getByLabelText("Post body"), "Post body");
    await user.click(screen.getByRole("button", { name: "Choose featured image" }));
    expect(create).toBeEnabled();
    await user.click(create);

    await waitFor(() => expect(apiMocks.createAdminBlogPost).toHaveBeenCalledWith({
      categoryId: CATEGORY_ID,
      title: "A useful post",
      slug: "a-useful-post",
      excerpt: null,
      body: "Post body",
      featuredMediaAssetId: IMAGE_ID,
      status: "draft",
      publishedAt: null,
    }));
  });

  it("requires a publication time for scheduled posts", async () => {
    const user = userEvent.setup();
    render(<BlogEditor />);

    await user.type(await screen.findByLabelText("Post title"), "Scheduled post");
    await user.type(screen.getByLabelText("Post slug"), "scheduled-post");
    await user.type(screen.getByLabelText("Post body"), "Post body");
    await user.selectOptions(screen.getByLabelText("Post status"), "scheduled");

    expect(screen.getByRole("button", { name: "Create post" })).toBeDisabled();
    expect(screen.getByText("Choose a publication time for a scheduled post.")).toBeInTheDocument();
  });

  it("retains post input when the API save fails", async () => {
    apiMocks.createAdminBlogPost.mockRejectedValue(new Error("Could not save post"));
    const user = userEvent.setup();
    render(<BlogEditor />);

    const title = await screen.findByLabelText("Post title");
    await user.type(title, "Keep this title");
    await user.type(screen.getByLabelText("Post slug"), "keep-this-title");
    await user.type(screen.getByLabelText("Post body"), "Keep this body");
    await user.click(screen.getByRole("button", { name: "Create post" }));

    expect(await screen.findByText("Could not save post")).toBeInTheDocument();
    expect(title).toHaveValue("Keep this title");
  });

  it("archives a category only after confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<BlogEditor />);

    await user.click(await screen.findByRole("button", { name: "Categories" }));
    await user.click(screen.getByRole("button", { name: "Archive Leadership" }));

    await waitFor(() => expect(apiMocks.archiveAdminBlogCategory).toHaveBeenCalledWith(CATEGORY_ID));
  });
});
