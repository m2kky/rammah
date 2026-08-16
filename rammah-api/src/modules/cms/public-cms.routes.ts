import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../../db/client.js";
import {
  blogCategories,
  blogPosts,
  globalMediaAssignments,
  globalMediaAssignmentSets,
  legalPages,
  mediaAssets,
  navigationItems,
  pageSections,
  pages,
  sectionMediaAssignments,
  seoMetadata,
  siteSettings,
} from "../../db/schema/index.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { resolveSectionMediaSlot } from "./cms-definitions.js";
import { verifyPreviewToken } from "./preview-token.js";

export const publicCmsRouter = Router();

const slugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(180),
});
const pageIdParamsSchema = z.object({ id: z.string().uuid() });
const previewQuerySchema = z.object({ token: z.string().min(1).optional() });

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

type ResolvedMediaRow = {
  id: string;
  mediaKind: "image" | "video" | "animation_bundle";
  mimeType: string;
  publicUrl: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
};

const publicMediaMetadata = (metadata: Record<string, unknown>) => {
  const result: Record<string, unknown> = {};
  for (const key of ["frameCount", "manifestUrl", "posterUrl", "fileExtension", "urlPattern"]) {
    if (metadata[key] !== undefined) result[key] = metadata[key];
  }
  return result;
};

const cmsMedia = (
  row: ResolvedMediaRow,
  usage?: { altTextOverride: string | null; decorative: boolean },
) => ({
  id: row.id,
  kind: row.mediaKind,
  mimeType: row.mimeType,
  publicUrl: row.publicUrl!,
  altText: usage?.decorative ? "" : usage?.altTextOverride?.trim() || row.altText,
  decorative: usage?.decorative ?? false,
  width: row.width,
  height: row.height,
  durationMs: row.durationMs,
  metadata: publicMediaMetadata(row.metadata),
});

const resolveFeaturedMedia = async (assetIds: Array<string | null>) => {
  const ids = [...new Set(assetIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map<string, ReturnType<typeof cmsMedia>>();

  const assets = await db.select({
    id: mediaAssets.id,
    mediaKind: mediaAssets.mediaKind,
    mimeType: mediaAssets.mimeType,
    publicUrl: mediaAssets.publicUrl,
    altText: mediaAssets.altText,
    width: mediaAssets.width,
    height: mediaAssets.height,
    durationMs: mediaAssets.durationMs,
    metadata: mediaAssets.metadata,
  }).from(mediaAssets).where(and(
    inArray(mediaAssets.id, ids),
    eq(mediaAssets.mediaKind, "image"),
    eq(mediaAssets.processingState, "ready"),
    ne(mediaAssets.status, "archived"),
  ));

  return new Map(assets
    .filter((asset) => Boolean(asset.publicUrl))
    .map((asset) => [asset.id, cmsMedia(asset)]));
};

const resolveSections = async (sectionRows: Array<typeof pageSections.$inferSelect>) => {
  if (sectionRows.length === 0) return [];
  const assignments = await db.select({
    sectionId: sectionMediaAssignments.pageSectionId,
    slotKey: sectionMediaAssignments.slotKey,
    sortOrder: sectionMediaAssignments.sortOrder,
    altTextOverride: sectionMediaAssignments.altTextOverride,
    decorative: sectionMediaAssignments.decorative,
    id: mediaAssets.id,
    mediaKind: mediaAssets.mediaKind,
    mimeType: mediaAssets.mimeType,
    publicUrl: mediaAssets.publicUrl,
    altText: mediaAssets.altText,
    width: mediaAssets.width,
    height: mediaAssets.height,
    durationMs: mediaAssets.durationMs,
    metadata: mediaAssets.metadata,
  }).from(sectionMediaAssignments)
    .innerJoin(mediaAssets, eq(mediaAssets.id, sectionMediaAssignments.mediaAssetId))
    .where(and(
      inArray(sectionMediaAssignments.pageSectionId, sectionRows.map(({ id }) => id)),
      eq(mediaAssets.processingState, "ready"),
      ne(mediaAssets.status, "archived"),
    ))
    .orderBy(
      asc(sectionMediaAssignments.pageSectionId),
      asc(sectionMediaAssignments.slotKey),
      asc(sectionMediaAssignments.sortOrder),
    );

  return sectionRows.map((section) => {
    const sectionAssignments = assignments.filter(({ sectionId }) => sectionId === section.id);
    const media: Record<string, ReturnType<typeof cmsMedia> | ReturnType<typeof cmsMedia>[]> = {};
    for (const assignment of sectionAssignments) {
      const resolved = cmsMedia(assignment, assignment);
      const slot = resolveSectionMediaSlot(section.sectionType, assignment.slotKey);
      if (slot?.cardinality === "multiple") {
        const current = media[assignment.slotKey];
        media[assignment.slotKey] = Array.isArray(current)
          ? [...current, resolved]
          : [resolved];
      } else {
        media[assignment.slotKey] = resolved;
      }
    }
    const { mediaAssetId: _legacyMediaAssetId, ...safeSection } = section;
    return {
      ...safeSection,
      createdAt: section.createdAt.toISOString(),
      updatedAt: section.updatedAt.toISOString(),
      media,
    };
  });
};

const previewTokenFrom = (req: Request) => {
  const authorization = req.header("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim();
  const query = req.query as z.infer<typeof previewQuerySchema>;
  return query.token ?? "";
};

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

  const metadata = rows[0] ?? null;
  if (!metadata) return null;
  let ogImage: ReturnType<typeof cmsMedia> | null = null;
  if (metadata.ogImageAssetId) {
    const [asset] = await db.select({
      id: mediaAssets.id,
      mediaKind: mediaAssets.mediaKind,
      mimeType: mediaAssets.mimeType,
      publicUrl: mediaAssets.publicUrl,
      altText: mediaAssets.altText,
      width: mediaAssets.width,
      height: mediaAssets.height,
      durationMs: mediaAssets.durationMs,
      metadata: mediaAssets.metadata,
    }).from(mediaAssets).where(and(
      eq(mediaAssets.id, metadata.ogImageAssetId),
      eq(mediaAssets.processingState, "ready"),
      ne(mediaAssets.status, "archived"),
    )).limit(1);
    if (asset?.publicUrl) ogImage = cmsMedia(asset);
  }
  const { ogImageAssetId: _ogImageAssetId, ...safe } = metadata;
  return { ...safe, ogImage };
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

publicCmsRouter.get("/media/globals", async (_req, res, next) => {
  try {
    const rows = await db.select({
      definitionKey: globalMediaAssignmentSets.definitionKey,
      slotKey: globalMediaAssignments.slotKey,
      sortOrder: globalMediaAssignments.sortOrder,
      altTextOverride: globalMediaAssignments.altTextOverride,
      decorative: globalMediaAssignments.decorative,
      id: mediaAssets.id,
      mediaKind: mediaAssets.mediaKind,
      mimeType: mediaAssets.mimeType,
      publicUrl: mediaAssets.publicUrl,
      altText: mediaAssets.altText,
      width: mediaAssets.width,
      height: mediaAssets.height,
      durationMs: mediaAssets.durationMs,
      metadata: mediaAssets.metadata,
    }).from(globalMediaAssignments)
      .innerJoin(
        globalMediaAssignmentSets,
        eq(globalMediaAssignmentSets.id, globalMediaAssignments.assignmentSetId),
      )
      .innerJoin(mediaAssets, eq(mediaAssets.id, globalMediaAssignments.mediaAssetId))
      .where(and(
        eq(globalMediaAssignmentSets.status, "published"),
        eq(mediaAssets.processingState, "ready"),
        ne(mediaAssets.status, "archived"),
      ))
      .orderBy(
        asc(globalMediaAssignmentSets.definitionKey),
        asc(globalMediaAssignments.slotKey),
        asc(globalMediaAssignments.sortOrder),
      );
    const groups: Record<string, Record<string, ReturnType<typeof cmsMedia> | ReturnType<typeof cmsMedia>[]>> = {};
    for (const row of rows) {
      const group = groups[row.definitionKey] ??= {};
      const media = cmsMedia(row, row);
      const current = group[row.slotKey];
      group[row.slotKey] = current
        ? Array.isArray(current) ? [...current, media] : [current, media]
        : media;
    }
    const first = (definitionKey: string, slotKey: string) => {
      const value = groups[definitionKey]?.[slotKey];
      return Array.isArray(value) ? value[0] ?? null : value ?? null;
    };
    res.status(httpStatus.ok).json({
      data: {
        groups,
        loadingVideo: first("loadingMatchCut", "video"),
        loadingPoster: first("loadingMatchCut", "poster"),
        matchedHeroFrame: first("loadingMatchCut", "matchedHeroFrame"),
        desktopMenuVideo: first("navigation", "desktopMenuVideo"),
        mobileMenuVideo: first("navigation", "mobileMenuVideo"),
        defaultOgImage: first("seo", "defaultOgImage"),
      },
    });
  } catch (error) { next(error); }
});

publicCmsRouter.get(
  "/preview/pages/:id",
  validateRequest({ params: pageIdParamsSchema, query: previewQuerySchema }),
  async (req, res, next) => {
    try {
      verifyPreviewToken(previewTokenFrom(req), req.params.id);
      const [page] = await db.select().from(pages).where(and(
        eq(pages.id, req.params.id),
        ne(pages.status, "archived"),
      )).limit(1);
      if (!page) throw notFound("Page was not found.");
      const sections = await db.select().from(pageSections).where(and(
        eq(pageSections.pageId, page.id),
        ne(pageSections.status, "archived"),
      )).orderBy(asc(pageSections.sortOrder));
      const seo = await findSeo("page", page.id);
      res.setHeader("cache-control", "private, no-store");
      res.status(httpStatus.ok).json({
        data: {
          ...page,
          publishedAt: serializeDate(page.publishedAt),
          createdAt: page.createdAt.toISOString(),
          updatedAt: page.updatedAt.toISOString(),
          seo: { ...seo, noindex: true },
          sections: await resolveSections(sections),
          preview: true,
        },
      });
    } catch (error) { next(error); }
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
          sections: await resolveSections(sections),
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
      const featuredMedia = await resolveFeaturedMedia(
        posts.map((post) => post.featuredMediaAssetId),
      );

      res.status(httpStatus.ok).json({
        data: posts.map((post) => {
          const { featuredMediaAssetId, ...safePost } = post;
          return {
            ...safePost,
            featuredMedia: featuredMediaAssetId
              ? featuredMedia.get(featuredMediaAssetId) ?? null
              : null,
            publishedAt: serializeDate(post.publishedAt),
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString(),
          };
        }),
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
      const featuredMedia = await resolveFeaturedMedia([post.featuredMediaAssetId]);
      const { featuredMediaAssetId, ...safePost } = post;

      res.status(httpStatus.ok).json({
        data: {
          ...safePost,
          featuredMedia: featuredMediaAssetId
            ? featuredMedia.get(featuredMediaAssetId) ?? null
            : null,
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
