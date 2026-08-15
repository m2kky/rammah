import { and, eq, inArray, lte, ne } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  auditLogs,
  legalPages,
  mediaAssets,
  pageSections,
  pages,
  sectionMediaAssignments,
} from "../../db/schema/index.js";
import { AppError, type AppErrorDetail } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { sectionDefinitions } from "./cms-definitions.js";

type ContentStatus = "draft" | "published" | "scheduled" | "archived";

export type PublicationPage = {
  id: string;
  slug: string;
  title: string;
  status: ContentStatus;
  template: string;
  publishedAt: Date | null;
};

export type PublicationMediaAsset = {
  id: string;
  mediaKind: "image" | "video" | "animation_bundle";
  processingState: "pending" | "ready" | "failed";
  status: ContentStatus;
  altText: string | null;
};

export type PublicationMediaAssignment = {
  slotKey: string;
  decorative: boolean;
  altTextOverride: string | null;
  asset: PublicationMediaAsset;
};

export type PublicationSection = {
  id: string;
  sectionType: string;
  title: string | null;
  body: string | null;
  config: Record<string, unknown>;
  status: ContentStatus;
  assignments: PublicationMediaAssignment[];
};

export interface PagePublicationRepository {
  findPage(id: string): Promise<PublicationPage | null>;
  isPageSlugTaken(slug: string, excludeId: string): Promise<boolean>;
  listSections(pageId: string): Promise<PublicationSection[]>;
}

export const reservedPageSlugs = new Set([
  "admin",
  "api",
  "booking",
  "blog",
  "services",
  "about",
  "contact",
  "legal",
  "privacy",
  "privacy-policy",
  "terms",
  "terms-and-conditions",
  "thank-you",
  "cms-preview",
]);

type PagePublicationExecutor = Pick<typeof db, "select">;

export const createDatabasePagePublicationRepository = (
  executor: PagePublicationExecutor = db,
): PagePublicationRepository => ({
  async findPage(id) {
    const [page] = await executor.select({
      id: pages.id,
      slug: pages.slug,
      title: pages.title,
      status: pages.status,
      template: pages.template,
      publishedAt: pages.publishedAt,
    }).from(pages).where(eq(pages.id, id)).limit(1);
    return page ?? null;
  },

  async isPageSlugTaken(slug, excludeId) {
    const [match] = await executor.select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.slug, slug), ne(pages.id, excludeId)))
      .limit(1);
    return Boolean(match);
  },

  async listSections(pageId) {
    const sections = await executor.select({
      id: pageSections.id,
      sectionType: pageSections.sectionType,
      title: pageSections.title,
      body: pageSections.body,
      config: pageSections.config,
      status: pageSections.status,
    }).from(pageSections)
      .where(and(eq(pageSections.pageId, pageId), ne(pageSections.status, "archived")))
      .orderBy(pageSections.sortOrder);
    if (sections.length === 0) return [];
    const assignments = await executor.select({
      sectionId: sectionMediaAssignments.pageSectionId,
      slotKey: sectionMediaAssignments.slotKey,
      decorative: sectionMediaAssignments.decorative,
      altTextOverride: sectionMediaAssignments.altTextOverride,
      assetId: mediaAssets.id,
      mediaKind: mediaAssets.mediaKind,
      processingState: mediaAssets.processingState,
      assetStatus: mediaAssets.status,
      assetAltText: mediaAssets.altText,
    }).from(sectionMediaAssignments)
      .innerJoin(mediaAssets, eq(mediaAssets.id, sectionMediaAssignments.mediaAssetId))
      .where(inArray(sectionMediaAssignments.pageSectionId, sections.map(({ id }) => id)))
      .orderBy(sectionMediaAssignments.sortOrder);
    return sections.map((section) => ({
      ...section,
      assignments: assignments
        .filter(({ sectionId }) => sectionId === section.id)
        .map((assignment) => ({
          slotKey: assignment.slotKey,
          decorative: assignment.decorative,
          altTextOverride: assignment.altTextOverride,
          asset: {
            id: assignment.assetId,
            mediaKind: assignment.mediaKind,
            processingState: assignment.processingState,
            status: assignment.assetStatus,
            altText: assignment.assetAltText,
          },
        })),
    }));
  },
});

export const databasePagePublicationRepository = createDatabasePagePublicationRepository();

const publicationError = (details: AppErrorDetail[]) => new AppError({
  code: "CMS_PUBLICATION_INVALID",
  message: "The page is not ready to publish.",
  statusCode: httpStatus.unprocessableEntity,
  details,
});

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const fieldValue = (section: PublicationSection, key: string) => {
  if (key === "title" || key === "heading") return section.title ?? section.config[key];
  if (key === "body") return section.body ?? section.config[key];
  return section.config[key];
};

const validateSection = (section: PublicationSection): AppErrorDetail[] => {
  const details: AppErrorDetail[] = [];
  const prefix = `sections.${section.id}`;
  const definition = sectionDefinitions.find(({ key }) => key === section.sectionType);
  if (!definition) {
    return [{ field: `${prefix}.sectionType`, message: "Choose a supported section type." }];
  }
  const assignmentsBySlot = new Map<string, PublicationMediaAssignment[]>();
  for (const assignment of section.assignments) {
    const current = assignmentsBySlot.get(assignment.slotKey) ?? [];
    current.push(assignment);
    assignmentsBySlot.set(assignment.slotKey, current);
  }

  for (const field of definition.fields) {
    const fieldPath = `${prefix}.${field.key}`;
    if (field.type === "media") {
      const assignments = assignmentsBySlot.get(field.key) ?? [];
      if (field.required && assignments.length === 0) {
        details.push({ field: `${fieldPath}.media`, message: `${field.label} is required.` });
      }
      if (field.cardinality === "single" && assignments.length > 1) {
        details.push({ field: `${fieldPath}.media`, message: `${field.label} accepts one asset.` });
      }
      for (const assignment of assignments) {
        if (!field.accepts.includes(assignment.asset.mediaKind)) {
          details.push({ field: `${fieldPath}.media`, message: "The selected media kind is not supported." });
        }
        if (assignment.asset.processingState !== "ready" || assignment.asset.status === "archived") {
          details.push({ field: `${fieldPath}.media`, message: "Selected media must be ready and active." });
        }
        if (
          assignment.asset.mediaKind === "image"
          && !assignment.decorative
          && !hasText(assignment.altTextOverride)
          && !hasText(assignment.asset.altText)
        ) {
          details.push({
            field: `${fieldPath}.altText`,
            message: "Non-decorative images require alternative text.",
          });
        }
      }
      continue;
    }

    const value = fieldValue(section, field.key);
    if (field.required) {
      const valid = field.type === "boolean"
        ? typeof value === "boolean"
        : field.type === "link"
          ? typeof value === "object" && value !== null && hasText((value as { url?: unknown }).url)
          : hasText(value);
      if (!valid) details.push({ field: fieldPath, message: `${field.label} is required.` });
    }
    if (value !== undefined && field.type === "boolean" && typeof value !== "boolean") {
      details.push({ field: fieldPath, message: `${field.label} must be true or false.` });
    }
    if (
      value !== undefined
      && field.type === "choice"
      && !field.options.some(({ value: option }) => option === value)
    ) {
      details.push({ field: fieldPath, message: `Choose a valid ${field.label.toLowerCase()}.` });
    }
  }

  if (section.sectionType === "hero") {
    const visualSlots = ["desktopImage", "mobileImage", "desktopVideo", "mobileVideo"];
    const hasVisual = visualSlots.some((slot) => (assignmentsBySlot.get(slot)?.length ?? 0) > 0);
    if (!hasVisual) {
      details.push({ field: `${prefix}.media`, message: "Hero sections require an image or video." });
    }
    const hasVideo = ["desktopVideo", "mobileVideo"]
      .some((slot) => (assignmentsBySlot.get(slot)?.length ?? 0) > 0);
    if (hasVideo && (assignmentsBySlot.get("poster")?.length ?? 0) === 0) {
      details.push({ field: `${prefix}.poster`, message: "Hero videos require a poster image." });
    }
  }

  if (section.sectionType === "video" && fieldValue(section, "autoplay") === true) {
    if (fieldValue(section, "muted") !== true) {
      details.push({ field: `${prefix}.muted`, message: "Autoplay video must be muted." });
    }
  }
  return details;
};

type PagePublicationDependencies = {
  repository?: PagePublicationRepository;
  now?: () => Date;
};

export const createPagePublicationService = (dependencies: PagePublicationDependencies = {}) => {
  const repository = dependencies.repository ?? databasePagePublicationRepository;
  const now = dependencies.now ?? (() => new Date());
  return {
    async validatePageForPublication(
      pageId: string,
      options: { allowDueSchedule?: boolean } = {},
    ) {
      const page = await repository.findPage(pageId);
      if (!page) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "Page was not found.",
          statusCode: httpStatus.notFound,
        });
      }
      const details: AppErrorDetail[] = [];
      if (
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)
        || (page.template === "default" && reservedPageSlugs.has(page.slug))
      ) {
        details.push({ field: "slug", message: "Use an available lowercase single-segment slug." });
      }
      if (await repository.isPageSlugTaken(page.slug, page.id)) {
        details.push({ field: "slug", message: "This page slug is already in use." });
      }
      if (
        page.status === "scheduled"
        && (!page.publishedAt || (!options.allowDueSchedule && page.publishedAt <= now()))
      ) {
        details.push({ field: "publishedAt", message: "Scheduled publication must be in the future." });
      }
      const sections = await repository.listSections(pageId);
      if (sections.length === 0) {
        details.push({ field: "sections", message: "Add at least one section before publishing." });
      }
      for (const section of sections) details.push(...validateSection(section));
      if (details.length > 0) throw publicationError(details);
      return { page, sections };
    },
  };
};

const pagePublicationService = createPagePublicationService();
export const validatePageForPublication = pagePublicationService.validatePageForPublication;

const storedPublicationError = (error: AppError) => JSON.stringify({
  message: error.message,
  details: error.details,
}).slice(0, 4_000);

const legalPublicationDetails = (page: { slug: string; title: string; body: string }) => {
  const details: AppErrorDetail[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug)) {
    details.push({ field: "slug", message: "Use a lowercase single-segment slug." });
  }
  if (!hasText(page.title)) details.push({ field: "title", message: "Title is required." });
  if (!hasText(page.body)) details.push({ field: "body", message: "Body is required." });
  return details;
};

export const publishDueCms = async (signal: AbortSignal, now: Date = new Date()) => {
  await db.transaction(async (tx) => {
    const duePages = await tx.select().from(pages).where(and(
      eq(pages.status, "scheduled"),
      lte(pages.publishedAt, now),
    )).for("update", { skipLocked: true });
    for (const page of duePages) {
      signal.throwIfAborted();
      try {
        const service = createPagePublicationService({
          repository: createDatabasePagePublicationRepository(tx),
          now: () => now,
        });
        await service.validatePageForPublication(page.id, { allowDueSchedule: true });
        await tx.update(pageSections).set({ status: "published", updatedAt: now })
          .where(and(eq(pageSections.pageId, page.id), ne(pageSections.status, "archived")));
        const [published] = await tx.update(pages).set({
          status: "published",
          publicationError: null,
          updatedAt: now,
        }).where(and(eq(pages.id, page.id), eq(pages.status, "scheduled"))).returning();
        if (published) {
          await tx.insert(auditLogs).values({
            action: "worker.cms.pages.publish_due",
            resourceType: "page",
            resourceId: page.id,
            beforeSnapshot: { status: page.status, publishedAt: page.publishedAt?.toISOString() ?? null },
            afterSnapshot: { status: published.status, publishedAt: published.publishedAt?.toISOString() ?? null },
          });
        }
      } catch (error) {
        if (!(error instanceof AppError) || error.code !== "CMS_PUBLICATION_INVALID") throw error;
        await tx.update(pages).set({
          publicationError: storedPublicationError(error),
          updatedAt: now,
        }).where(and(eq(pages.id, page.id), eq(pages.status, "scheduled")));
      }
    }

    const dueLegalPages = await tx.select().from(legalPages).where(and(
      eq(legalPages.status, "scheduled"),
      lte(legalPages.publishedAt, now),
    )).for("update", { skipLocked: true });
    for (const page of dueLegalPages) {
      signal.throwIfAborted();
      const details = legalPublicationDetails(page);
      if (details.length > 0) {
        await tx.update(legalPages).set({
          publicationError: storedPublicationError(publicationError(details)),
          updatedAt: now,
        }).where(and(eq(legalPages.id, page.id), eq(legalPages.status, "scheduled")));
        continue;
      }
      const [published] = await tx.update(legalPages).set({
        status: "published",
        publicationError: null,
        updatedAt: now,
      }).where(and(eq(legalPages.id, page.id), eq(legalPages.status, "scheduled"))).returning();
      if (published) {
        await tx.insert(auditLogs).values({
          action: "worker.cms.legal_pages.publish_due",
          resourceType: "legal_page",
          resourceId: page.id,
          beforeSnapshot: { status: page.status, publishedAt: page.publishedAt?.toISOString() ?? null },
          afterSnapshot: { status: published.status, publishedAt: published.publishedAt?.toISOString() ?? null },
        });
      }
    }
  });
};
