import { and, asc, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../../db/client.js";
import {
  blogCategories,
  blogPosts,
  legalPages,
  mediaAssets,
  navigationItems,
  pageSections,
  pages,
  seoMetadata,
  siteSettings,
} from "../../db/schema/index.js";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog } from "../audit/audit.service.js";

export const adminCmsRouter = Router();

const contentStatusSchema = z.enum(["draft", "published", "scheduled", "archived"]);

const idParamsSchema = z.object({ id: z.string().uuid() });
const pageSectionParamsSchema = z.object({
  id: z.string().uuid(),
  sectionId: z.string().uuid(),
});

const listQuerySchema = z.object({
  status: contentStatusSchema.optional(),
  search: z.string().trim().max(255).optional(),
});

const navigationListQuerySchema = listQuerySchema.extend({
  location: z.string().trim().max(40).optional(),
});

const settingsBodySchema = z.object({
  siteName: z.string().trim().min(1).max(180).optional(),
  defaultLocale: z.string().trim().min(1).max(16).optional(),
  contactEmail: z.string().trim().email().max(255).nullable().optional(),
  contactPhone: z.string().trim().max(80).nullable().optional(),
  socialLinks: z.record(z.string()).optional(),
  bookingDefaultTimezone: z.string().trim().min(1).max(80).optional(),
});

const navigationBodySchema = z.object({
  label: z.string().trim().min(1).max(120),
  url: z.string().trim().min(1),
  location: z.string().trim().min(1).max(40),
  sortOrder: z.number().int().default(0),
  status: contentStatusSchema.default("draft"),
});

const legalPageBodySchema = z.object({
  slug: z.string().trim().min(1).max(180),
  title: z.string().trim().min(1).max(220),
  body: z.string().trim().min(1),
  version: z.string().trim().min(1).max(40).default("1.0"),
  status: contentStatusSchema.default("draft"),
  publishedAt: z.string().datetime().nullable().optional(),
});

const pageBodySchema = z.object({
  slug: z.string().trim().min(1).max(180),
  title: z.string().trim().min(1).max(220),
  template: z.string().trim().min(1).max(80).default("default"),
  status: contentStatusSchema.default("draft"),
  publishedAt: z.string().datetime().nullable().optional(),
});

const pageSectionBodySchema = z.object({
  sectionType: z.string().trim().min(1).max(80),
  title: z.string().trim().nullable().optional(),
  body: z.string().trim().nullable().optional(),
  config: z.record(z.unknown()).default({}),
  mediaAssetId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().default(0),
  status: contentStatusSchema.default("draft"),
});

const blogCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(180),
  status: contentStatusSchema.default("draft"),
});

const blogPostBodySchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(220),
  slug: z.string().trim().min(1).max(180),
  excerpt: z.string().trim().nullable().optional(),
  body: z.string().trim().min(1),
  featuredMediaAssetId: z.string().uuid().nullable().optional(),
  status: contentStatusSchema.default("draft"),
  publishedAt: z.string().datetime().nullable().optional(),
});

const mediaAssetBodySchema = z.object({
  fileName: z.string().trim().min(1),
  mimeType: z.string().trim().min(1).max(120),
  storageKey: z.string().trim().min(1),
  publicUrl: z.string().trim().url().nullable().optional(),
  altText: z.string().trim().nullable().optional(),
  sizeBytes: z.number().int().nonnegative(),
  status: contentStatusSchema.default("draft"),
});

const seoMetadataBodySchema = z.object({
  resourceType: z.string().trim().min(1).max(80),
  resourceId: z.string().uuid(),
  metaTitle: z.string().trim().max(220).nullable().optional(),
  metaDescription: z.string().trim().nullable().optional(),
  canonicalUrl: z.string().trim().url().nullable().optional(),
  ogImageAssetId: z.string().uuid().nullable().optional(),
  noindex: z.boolean().default(false),
});

const patch = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.partial().refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required.",
  });

const notFound = (message: string) =>
  new AppError({
    code: "NOT_FOUND",
    message,
    statusCode: httpStatus.notFound,
  });

const getAuditContext = (req: Request) => ({
  adminUserId: req.admin?.id,
  ipAddress: req.ip,
});

const normalizeOptionalText = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const parseDate = (value: string | null | undefined) =>
  value === undefined ? undefined : value ? new Date(value) : null;

const serializeDate = (value: Date | null) => value?.toISOString() ?? null;

const serializeRecord = <T extends { createdAt: Date; updatedAt: Date }>(row: T) => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const audit = async (
  req: Request,
  input: {
    action: string;
    resourceType: string;
    resourceId?: string | null;
    beforeSnapshot?: Record<string, unknown> | null;
    afterSnapshot?: Record<string, unknown> | null;
  },
) =>
  writeAuditLog(getAuditContext(req), {
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    beforeSnapshot: input.beforeSnapshot ?? null,
    afterSnapshot: input.afterSnapshot ?? null,
  });

adminCmsRouter.use(requireAdmin);

adminCmsRouter.get("/settings", async (_req, res, next) => {
  try {
    const rows = await db.select().from(siteSettings).limit(1);
    const settings = rows[0] ?? null;

    res.status(httpStatus.ok).json({
      data: settings ? serializeRecord(settings) : null,
    });
  } catch (error) {
    next(error);
  }
});

adminCmsRouter.patch(
  "/settings",
  validateRequest({ body: settingsBodySchema }),
  async (req, res, next) => {
    try {
      const rows = await db.select().from(siteSettings).limit(1);
      const before = rows[0] ?? null;
      const payload = {
        ...req.body,
        contactEmail: normalizeOptionalText(req.body.contactEmail),
        contactPhone: normalizeOptionalText(req.body.contactPhone),
        updatedAt: new Date(),
      };
      const savedRows = before
        ? await db
            .update(siteSettings)
            .set(payload)
            .where(eq(siteSettings.id, before.id))
            .returning()
        : await db
            .insert(siteSettings)
            .values({
              siteName: req.body.siteName ?? "Ahmed Ramah Coaching Platform",
              defaultLocale: req.body.defaultLocale ?? "en",
              contactEmail: normalizeOptionalText(req.body.contactEmail) ?? null,
              contactPhone: normalizeOptionalText(req.body.contactPhone) ?? null,
              socialLinks: req.body.socialLinks ?? {},
              bookingDefaultTimezone: req.body.bookingDefaultTimezone ?? "Africa/Cairo",
            })
            .returning();
      const saved = savedRows[0];

      await audit(req, {
        action: "admin.cms.settings.update",
        resourceType: "site_settings",
        resourceId: saved.id,
        beforeSnapshot: before ? serializeRecord(before) : null,
        afterSnapshot: serializeRecord(saved),
      });

      res.status(httpStatus.ok).json({ data: serializeRecord(saved) });
    } catch (error) {
      next(error);
    }
  },
);

adminCmsRouter.get(
  "/navigation",
  validateRequest({ query: navigationListQuerySchema }),
  async (req, res, next) => {
    try {
      const listQuery = req.query as z.infer<typeof navigationListQuerySchema>;
      const conditions: SQL[] = [];
      if (listQuery.status) conditions.push(eq(navigationItems.status, listQuery.status));
      if (listQuery.location) conditions.push(eq(navigationItems.location, listQuery.location));
      if (listQuery.search) {
        conditions.push(
          or(ilike(navigationItems.label, `%${listQuery.search}%`), ilike(navigationItems.url, `%${listQuery.search}%`))!,
        );
      }
      let query = db.select().from(navigationItems).$dynamic();
      if (conditions.length) query = query.where(and(...conditions));
      const rows = await query.orderBy(asc(navigationItems.location), asc(navigationItems.sortOrder));
      res.status(httpStatus.ok).json({ data: rows.map(serializeRecord) });
    } catch (error) {
      next(error);
    }
  },
);

adminCmsRouter.post(
  "/navigation",
  validateRequest({ body: navigationBodySchema }),
  async (req, res, next) => {
    try {
      const rows = await db.insert(navigationItems).values(req.body).returning();
      const item = rows[0];
      await audit(req, {
        action: "admin.cms.navigation.create",
        resourceType: "navigation_item",
        resourceId: item.id,
        afterSnapshot: serializeRecord(item),
      });
      res.status(httpStatus.created).json({ data: serializeRecord(item) });
    } catch (error) {
      next(error);
    }
  },
);

adminCmsRouter.patch(
  "/navigation/:id",
  validateRequest({ params: idParamsSchema, body: patch(navigationBodySchema) }),
  async (req, res, next) => {
    try {
      const beforeRows = await db.select().from(navigationItems).where(eq(navigationItems.id, req.params.id)).limit(1);
      const before = beforeRows[0] ?? null;
      if (!before) throw notFound("Navigation item was not found.");
      const rows = await db
        .update(navigationItems)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(navigationItems.id, req.params.id))
        .returning();
      const item = rows[0];
      await audit(req, {
        action: "admin.cms.navigation.update",
        resourceType: "navigation_item",
        resourceId: item.id,
        beforeSnapshot: serializeRecord(before),
        afterSnapshot: serializeRecord(item),
      });
      res.status(httpStatus.ok).json({ data: serializeRecord(item) });
    } catch (error) {
      next(error);
    }
  },
);

adminCmsRouter.delete(
  "/navigation/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const rows = await db
        .update(navigationItems)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(navigationItems.id, req.params.id))
        .returning();
      const item = rows[0] ?? null;
      if (!item) throw notFound("Navigation item was not found.");
      await audit(req, {
        action: "admin.cms.navigation.archive",
        resourceType: "navigation_item",
        resourceId: item.id,
        afterSnapshot: serializeRecord(item),
      });
      res.status(httpStatus.noContent).send();
    } catch (error) {
      next(error);
    }
  },
);

const makeList = <T extends { status: typeof contentStatusSchema._type; createdAt: Date }>(
  table: any,
  statusColumn: any,
  searchColumns: any[],
) => async (req: Request, res: any, next: any) => {
  try {
    const listQuery = req.query as z.infer<typeof listQuerySchema>;
    const conditions: SQL[] = [];
    if (listQuery.status) conditions.push(eq(statusColumn, listQuery.status));
    if (listQuery.search) {
      const pattern = `%${listQuery.search}%`;
      const search = or(...searchColumns.map((column) => ilike(column, pattern)));
      if (search) conditions.push(search);
    }
    let query = db.select().from(table).$dynamic();
    if (conditions.length) query = query.where(and(...conditions));
    const rows = await query.orderBy(desc(table.createdAt));
    res.status(httpStatus.ok).json({ data: rows.map((row: any) => serializeRecord(row)) });
  } catch (error) {
    next(error);
  }
};

adminCmsRouter.get("/legal-pages", validateRequest({ query: listQuerySchema }), makeList(legalPages, legalPages.status, [legalPages.title, legalPages.slug]));
adminCmsRouter.post("/legal-pages", validateRequest({ body: legalPageBodySchema }), async (req, res, next) => {
  try {
    const rows = await db.insert(legalPages).values({ ...req.body, publishedAt: parseDate(req.body.publishedAt) }).returning();
    const page = rows[0];
    await audit(req, { action: "admin.cms.legal_pages.create", resourceType: "legal_page", resourceId: page.id, afterSnapshot: serializeRecord(page) });
    res.status(httpStatus.created).json({ data: serializeRecord({ ...page, publishedAt: page.publishedAt }) });
  } catch (error) { next(error); }
});
adminCmsRouter.patch("/legal-pages/:id", validateRequest({ params: idParamsSchema, body: patch(legalPageBodySchema) }), async (req, res, next) => {
  try {
    const beforeRows = await db.select().from(legalPages).where(eq(legalPages.id, req.params.id)).limit(1);
    const before = beforeRows[0] ?? null;
    if (!before) throw notFound("Legal page was not found.");
    const rows = await db.update(legalPages).set({ ...req.body, publishedAt: parseDate(req.body.publishedAt), updatedAt: new Date() }).where(eq(legalPages.id, req.params.id)).returning();
    const page = rows[0];
    await audit(req, { action: "admin.cms.legal_pages.update", resourceType: "legal_page", resourceId: page.id, beforeSnapshot: serializeRecord(before), afterSnapshot: serializeRecord(page) });
    res.status(httpStatus.ok).json({ data: serializeRecord(page) });
  } catch (error) { next(error); }
});
adminCmsRouter.delete("/legal-pages/:id", validateRequest({ params: idParamsSchema }), async (req, res, next) => {
  try {
    const rows = await db.update(legalPages).set({ status: "archived", updatedAt: new Date() }).where(eq(legalPages.id, req.params.id)).returning();
    const page = rows[0] ?? null;
    if (!page) throw notFound("Legal page was not found.");
    await audit(req, { action: "admin.cms.legal_pages.archive", resourceType: "legal_page", resourceId: page.id, afterSnapshot: serializeRecord(page) });
    res.status(httpStatus.noContent).send();
  } catch (error) { next(error); }
});

adminCmsRouter.get("/pages", validateRequest({ query: listQuerySchema }), makeList(pages, pages.status, [pages.title, pages.slug]));
adminCmsRouter.post("/pages", validateRequest({ body: pageBodySchema }), async (req, res, next) => {
  try {
    const rows = await db.insert(pages).values({ ...req.body, publishedAt: parseDate(req.body.publishedAt) }).returning();
    const page = rows[0];
    await audit(req, { action: "admin.cms.pages.create", resourceType: "page", resourceId: page.id, afterSnapshot: serializeRecord(page) });
    res.status(httpStatus.created).json({ data: serializeRecord(page) });
  } catch (error) { next(error); }
});
adminCmsRouter.patch("/pages/:id", validateRequest({ params: idParamsSchema, body: patch(pageBodySchema) }), async (req, res, next) => {
  try {
    const beforeRows = await db.select().from(pages).where(eq(pages.id, req.params.id)).limit(1);
    const before = beforeRows[0] ?? null;
    if (!before) throw notFound("Page was not found.");
    const rows = await db.update(pages).set({ ...req.body, publishedAt: parseDate(req.body.publishedAt), updatedAt: new Date() }).where(eq(pages.id, req.params.id)).returning();
    const page = rows[0];
    await audit(req, { action: "admin.cms.pages.update", resourceType: "page", resourceId: page.id, beforeSnapshot: serializeRecord(before), afterSnapshot: serializeRecord(page) });
    res.status(httpStatus.ok).json({ data: serializeRecord(page) });
  } catch (error) { next(error); }
});
adminCmsRouter.delete("/pages/:id", validateRequest({ params: idParamsSchema }), async (req, res, next) => {
  try {
    const rows = await db.update(pages).set({ status: "archived", updatedAt: new Date() }).where(eq(pages.id, req.params.id)).returning();
    const page = rows[0] ?? null;
    if (!page) throw notFound("Page was not found.");
    await audit(req, { action: "admin.cms.pages.archive", resourceType: "page", resourceId: page.id, afterSnapshot: serializeRecord(page) });
    res.status(httpStatus.noContent).send();
  } catch (error) { next(error); }
});

adminCmsRouter.get("/pages/:id/sections", validateRequest({ params: idParamsSchema }), async (req, res, next) => {
  try {
    const rows = await db.select().from(pageSections).where(eq(pageSections.pageId, req.params.id)).orderBy(asc(pageSections.sortOrder));
    res.status(httpStatus.ok).json({ data: rows.map(serializeRecord) });
  } catch (error) { next(error); }
});
adminCmsRouter.post("/pages/:id/sections", validateRequest({ params: idParamsSchema, body: pageSectionBodySchema }), async (req, res, next) => {
  try {
    const rows = await db.insert(pageSections).values({ ...req.body, pageId: req.params.id, title: normalizeOptionalText(req.body.title) ?? null, body: normalizeOptionalText(req.body.body) ?? null, mediaAssetId: req.body.mediaAssetId ?? null }).returning();
    const section = rows[0];
    await audit(req, { action: "admin.cms.page_sections.create", resourceType: "page_section", resourceId: section.id, afterSnapshot: serializeRecord(section) });
    res.status(httpStatus.created).json({ data: serializeRecord(section) });
  } catch (error) { next(error); }
});
adminCmsRouter.patch("/pages/:id/sections/:sectionId", validateRequest({ params: pageSectionParamsSchema, body: patch(pageSectionBodySchema) }), async (req, res, next) => {
  try {
    const beforeRows = await db.select().from(pageSections).where(and(eq(pageSections.id, req.params.sectionId), eq(pageSections.pageId, req.params.id))).limit(1);
    const before = beforeRows[0] ?? null;
    if (!before) throw notFound("Page section was not found.");
    const rows = await db.update(pageSections).set({ ...req.body, title: normalizeOptionalText(req.body.title), body: normalizeOptionalText(req.body.body), updatedAt: new Date() }).where(eq(pageSections.id, req.params.sectionId)).returning();
    const section = rows[0];
    await audit(req, { action: "admin.cms.page_sections.update", resourceType: "page_section", resourceId: section.id, beforeSnapshot: serializeRecord(before), afterSnapshot: serializeRecord(section) });
    res.status(httpStatus.ok).json({ data: serializeRecord(section) });
  } catch (error) { next(error); }
});
adminCmsRouter.delete("/pages/:id/sections/:sectionId", validateRequest({ params: pageSectionParamsSchema }), async (req, res, next) => {
  try {
    const rows = await db.update(pageSections).set({ status: "archived", updatedAt: new Date() }).where(and(eq(pageSections.id, req.params.sectionId), eq(pageSections.pageId, req.params.id))).returning();
    const section = rows[0] ?? null;
    if (!section) throw notFound("Page section was not found.");
    await audit(req, { action: "admin.cms.page_sections.archive", resourceType: "page_section", resourceId: section.id, afterSnapshot: serializeRecord(section) });
    res.status(httpStatus.noContent).send();
  } catch (error) { next(error); }
});

adminCmsRouter.get("/blog/categories", validateRequest({ query: listQuerySchema }), makeList(blogCategories, blogCategories.status, [blogCategories.name, blogCategories.slug]));
adminCmsRouter.post("/blog/categories", validateRequest({ body: blogCategoryBodySchema }), async (req, res, next) => {
  try {
    const rows = await db.insert(blogCategories).values(req.body).returning();
    const category = rows[0];
    await audit(req, { action: "admin.cms.blog_categories.create", resourceType: "blog_category", resourceId: category.id, afterSnapshot: serializeRecord(category) });
    res.status(httpStatus.created).json({ data: serializeRecord(category) });
  } catch (error) { next(error); }
});
adminCmsRouter.patch("/blog/categories/:id", validateRequest({ params: idParamsSchema, body: patch(blogCategoryBodySchema) }), async (req, res, next) => {
  try {
    const beforeRows = await db.select().from(blogCategories).where(eq(blogCategories.id, req.params.id)).limit(1);
    const before = beforeRows[0] ?? null;
    if (!before) throw notFound("Blog category was not found.");
    const rows = await db.update(blogCategories).set({ ...req.body, updatedAt: new Date() }).where(eq(blogCategories.id, req.params.id)).returning();
    const category = rows[0];
    await audit(req, { action: "admin.cms.blog_categories.update", resourceType: "blog_category", resourceId: category.id, beforeSnapshot: serializeRecord(before), afterSnapshot: serializeRecord(category) });
    res.status(httpStatus.ok).json({ data: serializeRecord(category) });
  } catch (error) { next(error); }
});
adminCmsRouter.delete("/blog/categories/:id", validateRequest({ params: idParamsSchema }), async (req, res, next) => {
  try {
    const rows = await db.update(blogCategories).set({ status: "archived", updatedAt: new Date() }).where(eq(blogCategories.id, req.params.id)).returning();
    const category = rows[0] ?? null;
    if (!category) throw notFound("Blog category was not found.");
    await audit(req, { action: "admin.cms.blog_categories.archive", resourceType: "blog_category", resourceId: category.id, afterSnapshot: serializeRecord(category) });
    res.status(httpStatus.noContent).send();
  } catch (error) { next(error); }
});

adminCmsRouter.get("/blog/posts", validateRequest({ query: listQuerySchema }), makeList(blogPosts, blogPosts.status, [blogPosts.title, blogPosts.slug]));
adminCmsRouter.post("/blog/posts", validateRequest({ body: blogPostBodySchema }), async (req, res, next) => {
  try {
    const rows = await db.insert(blogPosts).values({ ...req.body, excerpt: normalizeOptionalText(req.body.excerpt) ?? null, categoryId: req.body.categoryId ?? null, featuredMediaAssetId: req.body.featuredMediaAssetId ?? null, publishedAt: parseDate(req.body.publishedAt) }).returning();
    const post = rows[0];
    await audit(req, { action: "admin.cms.blog_posts.create", resourceType: "blog_post", resourceId: post.id, afterSnapshot: serializeRecord(post) });
    res.status(httpStatus.created).json({ data: serializeRecord(post) });
  } catch (error) { next(error); }
});
adminCmsRouter.patch("/blog/posts/:id", validateRequest({ params: idParamsSchema, body: patch(blogPostBodySchema) }), async (req, res, next) => {
  try {
    const beforeRows = await db.select().from(blogPosts).where(eq(blogPosts.id, req.params.id)).limit(1);
    const before = beforeRows[0] ?? null;
    if (!before) throw notFound("Blog post was not found.");
    const rows = await db.update(blogPosts).set({ ...req.body, excerpt: normalizeOptionalText(req.body.excerpt), publishedAt: parseDate(req.body.publishedAt), updatedAt: new Date() }).where(eq(blogPosts.id, req.params.id)).returning();
    const post = rows[0];
    await audit(req, { action: "admin.cms.blog_posts.update", resourceType: "blog_post", resourceId: post.id, beforeSnapshot: serializeRecord(before), afterSnapshot: serializeRecord(post) });
    res.status(httpStatus.ok).json({ data: serializeRecord(post) });
  } catch (error) { next(error); }
});
adminCmsRouter.delete("/blog/posts/:id", validateRequest({ params: idParamsSchema }), async (req, res, next) => {
  try {
    const rows = await db.update(blogPosts).set({ status: "archived", updatedAt: new Date() }).where(eq(blogPosts.id, req.params.id)).returning();
    const post = rows[0] ?? null;
    if (!post) throw notFound("Blog post was not found.");
    await audit(req, { action: "admin.cms.blog_posts.archive", resourceType: "blog_post", resourceId: post.id, afterSnapshot: serializeRecord(post) });
    res.status(httpStatus.noContent).send();
  } catch (error) { next(error); }
});

adminCmsRouter.get("/media-assets", validateRequest({ query: listQuerySchema }), makeList(mediaAssets, mediaAssets.status, [mediaAssets.fileName, mediaAssets.storageKey]));
adminCmsRouter.post("/media-assets", validateRequest({ body: mediaAssetBodySchema }), async (req, res, next) => {
  try {
    const rows = await db.insert(mediaAssets).values({ ...req.body, publicUrl: normalizeOptionalText(req.body.publicUrl) ?? null, altText: normalizeOptionalText(req.body.altText) ?? null }).returning();
    const asset = rows[0];
    await audit(req, { action: "admin.cms.media_assets.create", resourceType: "media_asset", resourceId: asset.id, afterSnapshot: serializeRecord(asset) });
    res.status(httpStatus.created).json({ data: serializeRecord(asset) });
  } catch (error) { next(error); }
});
adminCmsRouter.patch("/media-assets/:id", validateRequest({ params: idParamsSchema, body: patch(mediaAssetBodySchema) }), async (req, res, next) => {
  try {
    const beforeRows = await db.select().from(mediaAssets).where(eq(mediaAssets.id, req.params.id)).limit(1);
    const before = beforeRows[0] ?? null;
    if (!before) throw notFound("Media asset was not found.");
    const rows = await db.update(mediaAssets).set({ ...req.body, publicUrl: normalizeOptionalText(req.body.publicUrl), altText: normalizeOptionalText(req.body.altText), updatedAt: new Date() }).where(eq(mediaAssets.id, req.params.id)).returning();
    const asset = rows[0];
    await audit(req, { action: "admin.cms.media_assets.update", resourceType: "media_asset", resourceId: asset.id, beforeSnapshot: serializeRecord(before), afterSnapshot: serializeRecord(asset) });
    res.status(httpStatus.ok).json({ data: serializeRecord(asset) });
  } catch (error) { next(error); }
});
adminCmsRouter.delete("/media-assets/:id", validateRequest({ params: idParamsSchema }), async (req, res, next) => {
  try {
    const rows = await db.update(mediaAssets).set({ status: "archived", updatedAt: new Date() }).where(eq(mediaAssets.id, req.params.id)).returning();
    const asset = rows[0] ?? null;
    if (!asset) throw notFound("Media asset was not found.");
    await audit(req, { action: "admin.cms.media_assets.archive", resourceType: "media_asset", resourceId: asset.id, afterSnapshot: serializeRecord(asset) });
    res.status(httpStatus.noContent).send();
  } catch (error) { next(error); }
});

adminCmsRouter.put("/seo-metadata", validateRequest({ body: seoMetadataBodySchema }), async (req, res, next) => {
  try {
    const rows = await db
      .insert(seoMetadata)
      .values(req.body)
      .onConflictDoUpdate({
        target: [seoMetadata.resourceType, seoMetadata.resourceId],
        set: {
          metaTitle: req.body.metaTitle ?? null,
          metaDescription: req.body.metaDescription ?? null,
          canonicalUrl: req.body.canonicalUrl ?? null,
          ogImageAssetId: req.body.ogImageAssetId ?? null,
          noindex: req.body.noindex,
          updatedAt: new Date(),
        },
      })
      .returning();
    const metadata = rows[0];
    await audit(req, { action: "admin.cms.seo_metadata.upsert", resourceType: "seo_metadata", resourceId: metadata.id, afterSnapshot: serializeRecord(metadata) });
    res.status(httpStatus.ok).json({ data: serializeRecord(metadata) });
  } catch (error) { next(error); }
});
