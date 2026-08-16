import { and, asc, desc, eq, ilike, max, ne, or, type SQL } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../../db/client.js";
import { env } from "../../config/env.js";
import {
  blogCategories,
  blogPosts,
  legalPages,
  navigationItems,
  pageSections,
  pages,
  sectionMediaAssignments,
  seoMetadata,
  siteSettings,
} from "../../db/schema/index.js";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { globalMediaDefinitions, sectionDefinitions } from "./cms-definitions.js";
import { isValidIanaTimezone } from "../availability/booking-policy.js";
import {
  createDatabasePagePublicationRepository,
  createPagePublicationService,
  reservedPageSlugs,
} from "./page-publication.service.js";
import { issuePreviewToken } from "./preview-token.js";
import {
  createGlobalMediaAssignmentSet,
  listGlobalMediaVersions,
  listSectionMedia,
  publishGlobalMediaVersion,
  replaceGlobalMedia,
  replaceSectionMedia,
} from "./media-assignments.service.js";
import {
  blogCategoryBodySchema,
  blogPostBodySchema,
  blogPostPatchSchema,
  isScheduledBlogPublicationValid,
} from "./blog-input.js";

export const adminCmsRouter = Router();

const contentStatusSchema = z.enum(["draft", "published", "scheduled", "archived"]);

const idParamsSchema = z.object({ id: z.string().uuid() });
const pageSectionParamsSchema = z.object({
  id: z.string().uuid(),
  sectionId: z.string().uuid(),
});
const seoParamsSchema = z.object({
  resourceType: z.string().trim().min(1).max(80),
  resourceId: z.string().uuid(),
});
const globalDefinitionParamsSchema = z.object({
  definitionKey: z.string().trim().min(1).max(120),
});
const globalVersionParamsSchema = globalDefinitionParamsSchema.extend({
  assignmentSetId: z.string().uuid(),
});

const cmsSlugSchema = z.string().trim().min(1).max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase single-segment slug.");

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
  bookingDefaultTimezone: z.string().trim().min(1).max(80)
    .refine(isValidIanaTimezone, "Use a valid IANA timezone.")
    .optional(),
});

const navigationBodySchema = z.object({
  label: z.string().trim().min(1).max(120),
  url: z.string().trim().min(1),
  location: z.string().trim().min(1).max(40),
  sortOrder: z.number().int().default(0),
  status: contentStatusSchema.default("draft"),
});

const legalPageBodySchema = z.object({
  slug: cmsSlugSchema,
  title: z.string().trim().min(1).max(220),
  body: z.string().trim().min(1),
  version: z.string().trim().min(1).max(40).default("1.0"),
  status: contentStatusSchema.default("draft"),
  publishedAt: z.string().datetime().nullable().optional(),
});

const pageBodySchema = z.object({
  slug: cmsSlugSchema,
  title: z.string().trim().min(1).max(220),
  template: z.string().trim().min(1).max(80).default("default"),
  status: contentStatusSchema.default("draft"),
  publishedAt: z.string().datetime().nullable().optional(),
});

const pageSectionBodySchema = z.object({
  sectionType: z.string().trim().min(1).max(80).refine(
    (value) => sectionDefinitions.some(({ key }) => key === value),
    "Choose a supported section type.",
  ),
  title: z.string().trim().nullable().optional(),
  body: z.string().trim().nullable().optional(),
  config: z.record(z.unknown()).default({}),
  sortOrder: z.number().int().optional(),
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

const fieldConflict = (field: string, message: string) => new AppError({
  code: "CONFLICT",
  message,
  statusCode: httpStatus.conflict,
  details: [{ field, message }],
});

const assertPageSlugAvailable = async (slug: string, excludeId?: string) => {
  if (reservedPageSlugs.has(slug)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "This page slug is reserved.",
      statusCode: httpStatus.unprocessableEntity,
      details: [{ field: "slug", message: "Choose a slug that is not reserved." }],
    });
  }
  const conditions = [eq(pages.slug, slug)];
  if (excludeId) conditions.push(ne(pages.id, excludeId));
  const [existing] = await db.select({ id: pages.id }).from(pages)
    .where(and(...conditions)).limit(1);
  if (existing) throw fieldConflict("slug", "This page slug is already in use.");
};

const assertLegalSlugAvailable = async (slug: string, excludeId?: string) => {
  const conditions = [eq(legalPages.slug, slug)];
  if (excludeId) conditions.push(ne(legalPages.id, excludeId));
  const [existing] = await db.select({ id: legalPages.id }).from(legalPages)
    .where(and(...conditions)).limit(1);
  if (existing) throw fieldConflict("slug", "This legal-page slug is already in use.");
};

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

const assertScheduledDate = (status: string | undefined, publishedAt: Date | null | undefined) => {
  if (status === "scheduled" && (!publishedAt || publishedAt <= new Date())) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Scheduled publication requires a future date.",
      statusCode: httpStatus.unprocessableEntity,
      details: [{ field: "publishedAt", message: "Choose a future publication date." }],
    });
  }
};

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

adminCmsRouter.get("/definitions/sections", (_req, res) => {
  res.status(httpStatus.ok).json({ data: sectionDefinitions });
});

const sectionOrderBodySchema = z.object({
  sectionIds: z.array(z.string().uuid()).refine(
    (ids) => new Set(ids).size === ids.length,
    "Section order cannot contain duplicates.",
  ),
});

const sectionMediaAssignmentSchema = z.object({
  mediaAssetId: z.string().uuid(),
  altTextOverride: z.string().trim().max(2_000).nullable().optional(),
  decorative: z.boolean().optional(),
});

const sectionMediaBodySchema = z.object({
  slots: z.record(z.array(sectionMediaAssignmentSchema)),
});

const previewTokenBodySchema = z.object({
  expiresInSeconds: z.number().int().positive().max(3_600).optional(),
});

adminCmsRouter.get("/definitions/global-media", (_req, res) => {
  res.status(httpStatus.ok).json({ data: globalMediaDefinitions });
});

adminCmsRouter.get("/global-media", async (_req, res, next) => {
  try {
    const versions = await listGlobalMediaVersions();
    res.status(httpStatus.ok).json({
      data: versions.map((version) => ({
        ...version,
        publishedAt: serializeDate(version.publishedAt),
        createdAt: version.createdAt.toISOString(),
        updatedAt: version.updatedAt.toISOString(),
      })),
    });
  } catch (error) { next(error); }
});

adminCmsRouter.post(
  "/global-media/:definitionKey/versions",
  validateRequest({ params: globalDefinitionParamsSchema }),
  async (req, res, next) => {
    try {
      const version = await createGlobalMediaAssignmentSet(req.params.definitionKey);
      await audit(req, {
        action: "admin.cms.global_media_versions.create",
        resourceType: "global_media_assignment_set",
        resourceId: version.id,
        afterSnapshot: serializeRecord(version),
      });
      res.status(httpStatus.created).json({ data: serializeRecord(version) });
    } catch (error) { next(error); }
  },
);

adminCmsRouter.put(
  "/global-media/:definitionKey/versions/:assignmentSetId",
  validateRequest({ params: globalVersionParamsSchema, body: sectionMediaBodySchema }),
  async (req, res, next) => {
    try {
      const versions = await listGlobalMediaVersions();
      const owner = versions.find(({ id }) => id === req.params.assignmentSetId);
      if (!owner || owner.definitionKey !== req.params.definitionKey) {
        throw notFound("Global media assignment set was not found.");
      }
      const assignments = await replaceGlobalMedia({
        assignmentSetId: owner.id,
        slots: req.body.slots,
      });
      await audit(req, {
        action: "admin.cms.global_media_versions.update",
        resourceType: "global_media_assignment_set",
        resourceId: owner.id,
        afterSnapshot: { assignments },
      });
      res.status(httpStatus.ok).json({ data: assignments });
    } catch (error) { next(error); }
  },
);

adminCmsRouter.post(
  "/global-media/:definitionKey/versions/:assignmentSetId/publish",
  validateRequest({ params: globalVersionParamsSchema }),
  async (req, res, next) => {
    try {
      const versions = await listGlobalMediaVersions();
      const owner = versions.find(({ id }) => id === req.params.assignmentSetId);
      if (!owner || owner.definitionKey !== req.params.definitionKey) {
        throw notFound("Global media assignment set was not found.");
      }
      const published = await publishGlobalMediaVersion(owner.id);
      await audit(req, {
        action: "admin.cms.global_media_versions.publish",
        resourceType: "global_media_assignment_set",
        resourceId: owner.id,
        afterSnapshot: serializeRecord(published),
      });
      res.status(httpStatus.ok).json({ data: serializeRecord(published) });
    } catch (error) { next(error); }
  },
);

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
    await assertLegalSlugAvailable(req.body.slug);
    const publishedAt = parseDate(req.body.publishedAt);
    assertScheduledDate(req.body.status, publishedAt);
    const rows = await db.insert(legalPages).values({
      ...req.body,
      publishedAt: req.body.status === "published" ? publishedAt ?? new Date() : publishedAt,
      publicationError: null,
    }).returning();
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
    if (req.body.slug) await assertLegalSlugAvailable(req.body.slug, req.params.id);
    const status = req.body.status ?? before.status;
    let publishedAt = req.body.publishedAt === undefined
      ? before.publishedAt
      : parseDate(req.body.publishedAt);
    assertScheduledDate(status, publishedAt);
    if (status === "published" && !publishedAt) publishedAt = new Date();
    const rows = await db.update(legalPages).set({
      ...req.body,
      publishedAt,
      publicationError: null,
      updatedAt: new Date(),
    }).where(eq(legalPages.id, req.params.id)).returning();
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
    await assertPageSlugAvailable(req.body.slug);
    const publishedAt = parseDate(req.body.publishedAt);
    assertScheduledDate(req.body.status, publishedAt);
    const page = await db.transaction(async (tx) => {
      const [created] = await tx.insert(pages).values({
        ...req.body,
        publishedAt: req.body.status === "published" ? publishedAt ?? new Date() : publishedAt,
        publicationError: null,
      }).returning();
      if (created!.status === "published" || created!.status === "scheduled") {
        const service = createPagePublicationService({
          repository: createDatabasePagePublicationRepository(tx),
        });
        await service.validatePageForPublication(created!.id);
      }
      return created!;
    });
    await audit(req, { action: "admin.cms.pages.create", resourceType: "page", resourceId: page.id, afterSnapshot: serializeRecord(page) });
    res.status(httpStatus.created).json({ data: serializeRecord(page) });
  } catch (error) { next(error); }
});
adminCmsRouter.patch("/pages/:id", validateRequest({ params: idParamsSchema, body: patch(pageBodySchema) }), async (req, res, next) => {
  try {
    const beforeRows = await db.select().from(pages).where(eq(pages.id, req.params.id)).limit(1);
    const before = beforeRows[0] ?? null;
    if (!before) throw notFound("Page was not found.");
    if (req.body.slug) await assertPageSlugAvailable(req.body.slug, req.params.id);
    const status = req.body.status ?? before.status;
    let publishedAt = req.body.publishedAt === undefined
      ? before.publishedAt
      : parseDate(req.body.publishedAt);
    assertScheduledDate(status, publishedAt);
    if (status === "published" && !publishedAt) publishedAt = new Date();
    const page = await db.transaction(async (tx) => {
      const [updated] = await tx.update(pages).set({
        ...req.body,
        publishedAt,
        publicationError: null,
        updatedAt: new Date(),
      }).where(eq(pages.id, req.params.id)).returning();
      if (!updated) throw notFound("Page was not found.");
      if (updated.status === "published" || updated.status === "scheduled") {
        const service = createPagePublicationService({
          repository: createDatabasePagePublicationRepository(tx),
        });
        await service.validatePageForPublication(updated.id);
      }
      if (updated.status === "published") {
        await tx.update(pageSections).set({ status: "published", updatedAt: new Date() })
          .where(and(eq(pageSections.pageId, updated.id), ne(pageSections.status, "archived")));
      }
      return updated;
    });
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
    const data = await Promise.all(rows.map(async (row) => {
      const { mediaAssetId: _legacyMediaAssetId, ...safeRow } = row;
      const assignments = await listSectionMedia(row.id);
      const media = assignments.reduce<Record<string, typeof assignments>>((grouped, assignment) => {
        (grouped[assignment.slotKey] ??= []).push(assignment);
        return grouped;
      }, {});
      return { ...serializeRecord(safeRow), media };
    }));
    res.status(httpStatus.ok).json({ data });
  } catch (error) { next(error); }
});
adminCmsRouter.post("/pages/:id/sections", validateRequest({ params: idParamsSchema, body: pageSectionBodySchema }), async (req, res, next) => {
  try {
    const [owner] = await db.select({ id: pages.id }).from(pages)
      .where(eq(pages.id, req.params.id)).limit(1);
    if (!owner) throw notFound("Page was not found.");
    const [current] = await db.select({ sortOrder: max(pageSections.sortOrder) })
      .from(pageSections).where(eq(pageSections.pageId, req.params.id));
    const rows = await db.insert(pageSections).values({
      ...req.body,
      pageId: req.params.id,
      title: normalizeOptionalText(req.body.title) ?? null,
      body: normalizeOptionalText(req.body.body) ?? null,
      mediaAssetId: null,
      sortOrder: req.body.sortOrder ?? (current?.sortOrder ?? -1) + 1,
    }).returning();
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
    const rows = await db.update(pageSections).set({
      ...req.body,
      title: normalizeOptionalText(req.body.title),
      body: normalizeOptionalText(req.body.body),
      mediaAssetId: null,
      updatedAt: new Date(),
    }).where(eq(pageSections.id, req.params.sectionId)).returning();
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

adminCmsRouter.post(
  "/pages/:id/sections/:sectionId/duplicate",
  validateRequest({ params: pageSectionParamsSchema }),
  async (req, res, next) => {
    try {
      const duplicate = await db.transaction(async (tx) => {
        const [source] = await tx.select().from(pageSections).where(and(
          eq(pageSections.id, req.params.sectionId),
          eq(pageSections.pageId, req.params.id),
          ne(pageSections.status, "archived"),
        )).limit(1).for("update");
        if (!source) throw notFound("Page section was not found.");
        const [current] = await tx.select({ sortOrder: max(pageSections.sortOrder) })
          .from(pageSections).where(eq(pageSections.pageId, req.params.id));
        const [created] = await tx.insert(pageSections).values({
          pageId: source.pageId,
          sectionType: source.sectionType,
          title: source.title,
          body: source.body,
          config: source.config,
          mediaAssetId: null,
          sortOrder: (current?.sortOrder ?? -1) + 1,
          status: "draft",
        }).returning();
        const assignments = await tx.select().from(sectionMediaAssignments)
          .where(eq(sectionMediaAssignments.pageSectionId, source.id))
          .orderBy(asc(sectionMediaAssignments.slotKey), asc(sectionMediaAssignments.sortOrder));
        if (assignments.length > 0) {
          await tx.insert(sectionMediaAssignments).values(assignments.map((assignment) => ({
            pageSectionId: created!.id,
            slotKey: assignment.slotKey,
            mediaAssetId: assignment.mediaAssetId,
            sortOrder: assignment.sortOrder,
            altTextOverride: assignment.altTextOverride,
            decorative: assignment.decorative,
          })));
        }
        return created!;
      });
      await audit(req, {
        action: "admin.cms.page_sections.duplicate",
        resourceType: "page_section",
        resourceId: duplicate.id,
        afterSnapshot: serializeRecord(duplicate),
      });
      res.status(httpStatus.created).json({ data: serializeRecord(duplicate) });
    } catch (error) { next(error); }
  },
);

adminCmsRouter.put(
  "/pages/:id/sections/order",
  validateRequest({ params: idParamsSchema, body: sectionOrderBodySchema }),
  async (req, res, next) => {
    try {
      const ordered = await db.transaction(async (tx) => {
        const existing = await tx.select({ id: pageSections.id }).from(pageSections)
          .where(and(eq(pageSections.pageId, req.params.id), ne(pageSections.status, "archived")))
          .orderBy(asc(pageSections.sortOrder)).for("update");
        const expected = new Set(existing.map(({ id }) => id));
        if (
          expected.size !== req.body.sectionIds.length
          || req.body.sectionIds.some((id: string) => !expected.has(id))
        ) {
          throw new AppError({
            code: "VALIDATION_ERROR",
            message: "Section order must contain every active section exactly once.",
            statusCode: httpStatus.unprocessableEntity,
            details: [{ field: "sectionIds", message: "Refresh the page and submit the complete order." }],
          });
        }
        for (const [sortOrder, sectionId] of req.body.sectionIds.entries()) {
          await tx.update(pageSections).set({ sortOrder, updatedAt: new Date() })
            .where(and(eq(pageSections.id, sectionId), eq(pageSections.pageId, req.params.id)));
        }
        return tx.select().from(pageSections)
          .where(and(eq(pageSections.pageId, req.params.id), ne(pageSections.status, "archived")))
          .orderBy(asc(pageSections.sortOrder));
      });
      await audit(req, {
        action: "admin.cms.page_sections.reorder",
        resourceType: "page",
        resourceId: req.params.id,
        afterSnapshot: { sectionIds: ordered.map(({ id }) => id) },
      });
      res.status(httpStatus.ok).json({ data: ordered.map(serializeRecord) });
    } catch (error) { next(error); }
  },
);

adminCmsRouter.put(
  "/pages/:id/sections/:sectionId/media",
  validateRequest({ params: pageSectionParamsSchema, body: sectionMediaBodySchema }),
  async (req, res, next) => {
    try {
      const [section] = await db.select({ id: pageSections.id }).from(pageSections).where(and(
        eq(pageSections.id, req.params.sectionId),
        eq(pageSections.pageId, req.params.id),
      )).limit(1);
      if (!section) throw notFound("Page section was not found.");
      await replaceSectionMedia({ pageSectionId: section.id, slots: req.body.slots });
      await db.update(pageSections).set({ mediaAssetId: null, updatedAt: new Date() })
        .where(eq(pageSections.id, section.id));
      const assignments = await listSectionMedia(section.id);
      await audit(req, {
        action: "admin.cms.page_sections.media.replace",
        resourceType: "page_section",
        resourceId: section.id,
        afterSnapshot: { assignments },
      });
      res.status(httpStatus.ok).json({ data: assignments });
    } catch (error) { next(error); }
  },
);

adminCmsRouter.post(
  "/pages/:id/preview-token",
  validateRequest({ params: idParamsSchema, body: previewTokenBodySchema }),
  async (req, res, next) => {
    try {
      const [page] = await db.select({ id: pages.id, slug: pages.slug }).from(pages)
        .where(eq(pages.id, req.params.id)).limit(1);
      if (!page) throw notFound("Page was not found.");
      const expiresInSeconds = req.body.expiresInSeconds;
      const token = issuePreviewToken({ pageId: page.id, expiresInSeconds });
      const lifetime = expiresInSeconds ?? env.CMS_PREVIEW_MAX_AGE_SECONDS;
      res.status(httpStatus.created).json({
        data: {
          token,
          pageId: page.id,
          slug: page.slug,
          expiresAt: new Date(Date.now() + lifetime * 1_000).toISOString(),
        },
      });
    } catch (error) { next(error); }
  },
);

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
adminCmsRouter.patch("/blog/posts/:id", validateRequest({ params: idParamsSchema, body: blogPostPatchSchema }), async (req, res, next) => {
  try {
    const beforeRows = await db.select().from(blogPosts).where(eq(blogPosts.id, req.params.id)).limit(1);
    const before = beforeRows[0] ?? null;
    if (!before) throw notFound("Blog post was not found.");
    const nextStatus = req.body.status ?? before.status;
    const nextPublishedAt = req.body.publishedAt === undefined
      ? before.publishedAt
      : parseDate(req.body.publishedAt);
    if (!isScheduledBlogPublicationValid(nextStatus, nextPublishedAt)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Choose a publication time for a scheduled post.",
        statusCode: httpStatus.unprocessableEntity,
        details: [{ field: "publishedAt", message: "Choose a publication time." }],
      });
    }
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

adminCmsRouter.get(
  "/seo-metadata/:resourceType/:resourceId",
  validateRequest({ params: seoParamsSchema }),
  async (req, res, next) => {
    try {
      const [metadata] = await db.select().from(seoMetadata).where(and(
        eq(seoMetadata.resourceType, req.params.resourceType),
        eq(seoMetadata.resourceId, req.params.resourceId),
      )).limit(1);
      res.status(httpStatus.ok).json({ data: metadata ? serializeRecord(metadata) : null });
    } catch (error) { next(error); }
  },
);

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
