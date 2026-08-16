import { describe, expect, it } from "vitest";
import { blogCategoryBodySchema, blogPostBodySchema } from "./blog-input.js";

const validPost = {
  categoryId: null,
  title: "A useful post",
  slug: "a-useful-post",
  excerpt: null,
  body: "Post body",
  featuredMediaAssetId: null,
  status: "draft" as const,
  publishedAt: null,
};

describe("blog admin input", () => {
  it.each(["With Spaces", "nested/slug", "-leading", "trailing-"])(
    "rejects invalid category slug %j",
    (slug) => {
      expect(blogCategoryBodySchema.safeParse({
        name: "Category",
        slug,
        status: "draft",
      }).success).toBe(false);
    },
  );

  it.each(["With Spaces", "nested/slug", "-leading", "trailing-"])(
    "rejects invalid post slug %j",
    (slug) => {
      expect(blogPostBodySchema.safeParse({ ...validPost, slug }).success).toBe(false);
    },
  );

  it("requires a publication time for scheduled posts", () => {
    const result = blogPostBodySchema.safeParse({
      ...validPost,
      status: "scheduled",
      publishedAt: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(expect.objectContaining({
        path: ["publishedAt"],
      }));
    }
  });

  it("accepts a scheduled post with an ISO publication time", () => {
    expect(blogPostBodySchema.safeParse({
      ...validPost,
      status: "scheduled",
      publishedAt: "2030-01-02T09:00:00.000Z",
    }).success).toBe(true);
  });
});
