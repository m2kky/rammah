import { and, asc, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/client.js";
import {
  blogCategories,
  blogPosts,
  legalPages,
  navigationItems,
  pageSections,
  pages,
  seoMetadata,
  siteSettings,
} from "../../db/schema/index.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";

export const publicCmsRouter = Router();

const slugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(180),
});

const navigationQuerySchema = z.object({
  location: z.string().trim().min(1).max(40).optional(),
});

const blogPostsQuerySchema = z.object({
  categorySlug: z.string().trim().min(1).max(180).optional(),
});

const notFound = (message: string) =>
  new AppError({
    code: "NOT_FOUND",
    message,
    statusCode: httpStatus.notFound,
  });

const serializeDate = (value: Date | null) => value?.toISOString() ?? null;

const findSeo = async (resourceType: string, resourceId: string) => {
  const rows = await db
    .select({
      metaTitle: seoMetadata.metaTitle,
      metaDescription: seoMetadata.metaDescription,
      canonicalUrl: seoMetadata.canonicalUrl,
      ogImageAssetId: seoMetadata.ogImageAssetId,
      noindex: seoMetadata.noindex,
    })
    .from(seoMetadata)
    .where(and(eq(seoMetadata.resourceType, resourceType), eq(seoMetadata.resourceId, resourceId)))
    .limit(1);

  return rows[0] ?? null;
};

publicCmsRouter.get("/settings", async (_req, res, next) => {
  try {
    const rows = await db.select().from(siteSettings).limit(1);
    const settings = rows[0] ?? null;

    res.status(httpStatus.ok).json({
      data: settings
        ? {
            ...settings,
            createdAt: settings.createdAt.toISOString(),
            updatedAt: settings.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

publicCmsRouter.get(
  "/navigation",
  validateRequest({ query: navigationQuerySchema }),
  async (req, res, next) => {
    try {
      const query = req.query as z.infer<typeof navigationQuerySchema>;
      const conditions = [eq(navigationItems.status, "published")];

      if (query.location) {
        conditions.push(eq(navigationItems.location, query.location));
      }

      const items = await db
        .select({
          id: navigationItems.id,
          label: navigationItems.label,
          url: navigationItems.url,
          location: navigationItems.location,
          sortOrder: navigationItems.sortOrder,
        })
        .from(navigationItems)
        .where(and(...conditions))
        .orderBy(asc(navigationItems.location), asc(navigationItems.sortOrder));

      res.status(httpStatus.ok).json({ data: items });
    } catch (error) {
      next(error);
    }
  },
);

publicCmsRouter.get(
  "/legal/:slug",
  validateRequest({ params: slugParamsSchema }),
  async (req, res, next) => {
    try {
      const rows = await db
        .select()
        .from(legalPages)
        .where(and(eq(legalPages.slug, req.params.slug), eq(legalPages.status, "published")))
        .limit(1);
      const page = rows[0] ?? null;

      if (!page) throw notFound("Legal page was not found.");

      res.status(httpStatus.ok).json({
        data: {
          ...page,
          publishedAt: serializeDate(page.publishedAt),
          createdAt: page.createdAt.toISOString(),
          updatedAt: page.updatedAt.toISOString(),
          seo: await findSeo("legal_page", page.id),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

publicCmsRouter.get(
  "/pages/:slug",
  validateRequest({ params: slugParamsSchema }),
  async (req, res, next) => {
    try {
      const rows = await db
        .select()
        .from(pages)
        .where(and(eq(pages.slug, req.params.slug), eq(pages.status, "published")))
        .limit(1);
      const page = rows[0] ?? null;

      if (!page) throw notFound("Page was not found.");

      const sections = await db
        .select()
        .from(pageSections)
        .where(and(eq(pageSections.pageId, page.id), eq(pageSections.status, "published")))
        .orderBy(asc(pageSections.sortOrder));

      res.status(httpStatus.ok).json({
        data: {
          ...page,
          publishedAt: serializeDate(page.publishedAt),
          createdAt: page.createdAt.toISOString(),
          updatedAt: page.updatedAt.toISOString(),
          seo: await findSeo("page", page.id),
          sections: sections.map((section) => ({
            ...section,
            createdAt: section.createdAt.toISOString(),
            updatedAt: section.updatedAt.toISOString(),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

publicCmsRouter.get(
  "/blog/posts",
  validateRequest({ query: blogPostsQuerySchema }),
  async (req, res, next) => {
    try {
      const query = req.query as z.infer<typeof blogPostsQuerySchema>;
      const conditions = [eq(blogPosts.status, "published")];

      if (query.categorySlug) {
        const categoryRows = await db
          .select({ id: blogCategories.id })
          .from(blogCategories)
          .where(
            and(
              eq(blogCategories.slug, query.categorySlug),
              eq(blogCategories.status, "published"),
            ),
          )
          .limit(1);
        const category = categoryRows[0] ?? null;

        if (!category) {
          res.status(httpStatus.ok).json({ data: [] });
          return;
        }

        conditions.push(eq(blogPosts.categoryId, category.id));
      }

      const posts = await db
        .select({
          id: blogPosts.id,
          categoryId: blogPosts.categoryId,
          title: blogPosts.title,
          slug: blogPosts.slug,
          excerpt: blogPosts.excerpt,
          featuredMediaAssetId: blogPosts.featuredMediaAssetId,
          publishedAt: blogPosts.publishedAt,
          createdAt: blogPosts.createdAt,
          updatedAt: blogPosts.updatedAt,
        })
        .from(blogPosts)
        .where(and(...conditions))
        .orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt));

      res.status(httpStatus.ok).json({
        data: posts.map((post) => ({
          ...post,
          publishedAt: serializeDate(post.publishedAt),
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

publicCmsRouter.get(
  "/blog/posts/:slug",
  validateRequest({ params: slugParamsSchema }),
  async (req, res, next) => {
    try {
      const rows = await db
        .select({
          id: blogPosts.id,
          categoryId: blogPosts.categoryId,
          categoryName: blogCategories.name,
          categorySlug: blogCategories.slug,
          title: blogPosts.title,
          slug: blogPosts.slug,
          excerpt: blogPosts.excerpt,
          body: blogPosts.body,
          featuredMediaAssetId: blogPosts.featuredMediaAssetId,
          publishedAt: blogPosts.publishedAt,
          createdAt: blogPosts.createdAt,
          updatedAt: blogPosts.updatedAt,
        })
        .from(blogPosts)
        .leftJoin(blogCategories, eq(blogPosts.categoryId, blogCategories.id))
        .where(and(eq(blogPosts.slug, req.params.slug), eq(blogPosts.status, "published")))
        .limit(1);
      const post = rows[0] ?? null;

      if (!post) throw notFound("Blog post was not found.");

      res.status(httpStatus.ok).json({
        data: {
          ...post,
          category: post.categoryId
            ? {
                id: post.categoryId,
                name: post.categoryName,
                slug: post.categorySlug,
              }
            : null,
          publishedAt: serializeDate(post.publishedAt),
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
          seo: await findSeo("blog_post", post.id),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
