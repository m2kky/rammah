import { and, asc, desc, eq, inArray, max, ne, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  globalMediaAssignments,
  globalMediaAssignmentSets,
  blogPosts,
  mediaAssets,
  offerings,
  pageSections,
  pages,
  seoMetadata,
  sectionMediaAssignments,
} from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  globalMediaDefinitions,
  resolveGlobalMediaSlot,
  resolveSectionMediaSlot,
  type CmsMediaSlotDefinition,
} from "./cms-definitions.js";

type MediaAssignmentInput = {
  mediaAssetId: string;
  altTextOverride?: string | null;
  decorative?: boolean;
};

type SetSectionMediaSlotInput = {
  pageSectionId: string;
  slotKey: string;
  assignments: MediaAssignmentInput[];
};

type SetGlobalMediaSlotInput = {
  assignmentSetId: string;
  slotKey: string;
  assignments: MediaAssignmentInput[];
};

export type ReplaceSectionMediaInput = {
  pageSectionId: string;
  slots: Record<string, MediaAssignmentInput[]>;
};

const cmsError = (
  code: "INVALID_MEDIA_SLOT" | "MEDIA_KIND_MISMATCH" | "SLOT_CARDINALITY_EXCEEDED",
  message: string,
) =>
  new AppError({
    code,
    message,
    statusCode: httpStatus.unprocessableEntity,
  });

const notFound = (message: string) =>
  new AppError({ code: "NOT_FOUND", message, statusCode: httpStatus.notFound });

const normalizeAltText = (value: string | null | undefined) => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const validateAssignments = async (
  slot: CmsMediaSlotDefinition,
  assignments: MediaAssignmentInput[],
) => {
  if (slot.cardinality === "single" && assignments.length > 1) {
    throw cmsError(
      "SLOT_CARDINALITY_EXCEEDED",
      `Media slot ${slot.key} accepts at most one asset.`,
    );
  }

  const assetIds = [...new Set(assignments.map(({ mediaAssetId }) => mediaAssetId))];
  if (assetIds.length === 0) return;

  const assets = await db
    .select({ id: mediaAssets.id, mediaKind: mediaAssets.mediaKind, status: mediaAssets.status })
    .from(mediaAssets)
    .where(inArray(mediaAssets.id, assetIds));
  if (assets.length !== assetIds.length) {
    throw notFound("One or more media assets were not found.");
  }

  const archived = assets.find(({ status }) => status === "archived");
  if (archived) {
    throw new AppError({
      code: "CONFLICT",
      message: "Archived media cannot be assigned.",
      statusCode: httpStatus.conflict,
    });
  }

  const incompatible = assets.find(({ mediaKind }) => !slot.accepts.includes(mediaKind));
  if (incompatible) {
    throw cmsError(
      "MEDIA_KIND_MISMATCH",
      `Media slot ${slot.key} accepts ${slot.accepts.join(", ")}, not ${incompatible.mediaKind}.`,
    );
  }
};

export const setSectionMediaSlot = async (input: SetSectionMediaSlotInput) => {
  const [owner] = await db
    .select({ id: pageSections.id, sectionType: pageSections.sectionType })
    .from(pageSections)
    .where(eq(pageSections.id, input.pageSectionId))
    .limit(1);
  if (!owner) throw notFound("Page section was not found.");

  const slot = resolveSectionMediaSlot(owner.sectionType, input.slotKey);
  if (!slot) {
    throw cmsError(
      "INVALID_MEDIA_SLOT",
      `Section type ${owner.sectionType} does not define media slot ${input.slotKey}.`,
    );
  }
  await validateAssignments(slot, input.assignments);

  return db.transaction(async (tx) => {
    await tx
      .delete(sectionMediaAssignments)
      .where(
        and(
          eq(sectionMediaAssignments.pageSectionId, input.pageSectionId),
          eq(sectionMediaAssignments.slotKey, input.slotKey),
        ),
      );
    if (input.assignments.length === 0) return [];
    return tx
      .insert(sectionMediaAssignments)
      .values(
        input.assignments.map((assignment, sortOrder) => ({
          pageSectionId: input.pageSectionId,
          slotKey: input.slotKey,
          mediaAssetId: assignment.mediaAssetId,
          sortOrder,
          altTextOverride: normalizeAltText(assignment.altTextOverride),
          decorative: assignment.decorative ?? false,
        })),
      )
      .returning();
  });
};

export const replaceSectionMedia = async (input: ReplaceSectionMediaInput) => {
  const [owner] = await db
    .select({ id: pageSections.id, sectionType: pageSections.sectionType })
    .from(pageSections)
    .where(eq(pageSections.id, input.pageSectionId))
    .limit(1);
  if (!owner) throw notFound("Page section was not found.");

  const normalizedSlots = Object.entries(input.slots);
  for (const [slotKey, assignments] of normalizedSlots) {
    const slot = resolveSectionMediaSlot(owner.sectionType, slotKey);
    if (!slot) {
      throw cmsError(
        "INVALID_MEDIA_SLOT",
        `Section type ${owner.sectionType} does not define media slot ${slotKey}.`,
      );
    }
    await validateAssignments(slot, assignments);
  }

  return db.transaction(async (tx) => {
    await tx.delete(sectionMediaAssignments)
      .where(eq(sectionMediaAssignments.pageSectionId, input.pageSectionId));
    const values = normalizedSlots.flatMap(([slotKey, assignments]) =>
      assignments.map((assignment, sortOrder) => ({
        pageSectionId: input.pageSectionId,
        slotKey,
        mediaAssetId: assignment.mediaAssetId,
        sortOrder,
        altTextOverride: normalizeAltText(assignment.altTextOverride),
        decorative: assignment.decorative ?? false,
      })));
    if (values.length === 0) return [];
    return tx.insert(sectionMediaAssignments).values(values).returning();
  });
};

export const listSectionMedia = async (pageSectionId: string) =>
  db.select({
    id: sectionMediaAssignments.id,
    slotKey: sectionMediaAssignments.slotKey,
    sortOrder: sectionMediaAssignments.sortOrder,
    altTextOverride: sectionMediaAssignments.altTextOverride,
    decorative: sectionMediaAssignments.decorative,
    assetId: mediaAssets.id,
    displayName: mediaAssets.displayName,
    mediaKind: mediaAssets.mediaKind,
    mimeType: mediaAssets.mimeType,
    publicUrl: mediaAssets.publicUrl,
    altText: mediaAssets.altText,
    width: mediaAssets.width,
    height: mediaAssets.height,
    durationMs: mediaAssets.durationMs,
    processingState: mediaAssets.processingState,
    status: mediaAssets.status,
  }).from(sectionMediaAssignments)
    .innerJoin(mediaAssets, eq(mediaAssets.id, sectionMediaAssignments.mediaAssetId))
    .where(eq(sectionMediaAssignments.pageSectionId, pageSectionId))
    .orderBy(asc(sectionMediaAssignments.slotKey), asc(sectionMediaAssignments.sortOrder));

export const createGlobalMediaAssignmentSet = async (definitionKey: string) => {
  if (!globalMediaDefinitions.some(({ key }) => key === definitionKey)) {
    throw cmsError("INVALID_MEDIA_SLOT", `Unknown global media definition ${definitionKey}.`);
  }

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`cms-global:${definitionKey}`}, 0))`,
    );
    const [current] = await tx
      .select({ version: max(globalMediaAssignmentSets.version) })
      .from(globalMediaAssignmentSets)
      .where(eq(globalMediaAssignmentSets.definitionKey, definitionKey));
    const [created] = await tx
      .insert(globalMediaAssignmentSets)
      .values({ definitionKey, version: (current?.version ?? 0) + 1 })
      .returning();
    return created!;
  });
};

export const setGlobalMediaSlot = async (input: SetGlobalMediaSlotInput) => {
  const [owner] = await db
    .select()
    .from(globalMediaAssignmentSets)
    .where(eq(globalMediaAssignmentSets.id, input.assignmentSetId))
    .limit(1);
  if (!owner) throw notFound("Global media assignment set was not found.");
  if (owner.status === "published") {
    throw new AppError({
      code: "CONFLICT",
      message: "Published global media versions are immutable; create a new draft version.",
      statusCode: httpStatus.conflict,
    });
  }

  const slot = resolveGlobalMediaSlot(owner.definitionKey, input.slotKey);
  if (!slot) {
    throw cmsError(
      "INVALID_MEDIA_SLOT",
      `Global definition ${owner.definitionKey} does not define media slot ${input.slotKey}.`,
    );
  }
  await validateAssignments(slot, input.assignments);

  return db.transaction(async (tx) => {
    const [lockedOwner] = await tx
      .select({ status: globalMediaAssignmentSets.status })
      .from(globalMediaAssignmentSets)
      .where(eq(globalMediaAssignmentSets.id, input.assignmentSetId))
      .limit(1)
      .for("update");
    if (!lockedOwner) throw notFound("Global media assignment set was not found.");
    if (lockedOwner.status === "published") {
      throw new AppError({
        code: "CONFLICT",
        message: "Published global media versions are immutable; create a new draft version.",
        statusCode: httpStatus.conflict,
      });
    }
    await tx
      .delete(globalMediaAssignments)
      .where(
        and(
          eq(globalMediaAssignments.assignmentSetId, input.assignmentSetId),
          eq(globalMediaAssignments.slotKey, input.slotKey),
        ),
      );
    if (input.assignments.length === 0) return [];
    return tx
      .insert(globalMediaAssignments)
      .values(
        input.assignments.map((assignment, sortOrder) => ({
          assignmentSetId: input.assignmentSetId,
          slotKey: input.slotKey,
          mediaAssetId: assignment.mediaAssetId,
          sortOrder,
          altTextOverride: normalizeAltText(assignment.altTextOverride),
          decorative: assignment.decorative ?? false,
        })),
      )
      .returning();
  });
};

export const replaceGlobalMedia = async (input: {
  assignmentSetId: string;
  slots: Record<string, MediaAssignmentInput[]>;
}) => {
  const [owner] = await db.select().from(globalMediaAssignmentSets)
    .where(eq(globalMediaAssignmentSets.id, input.assignmentSetId)).limit(1);
  if (!owner) throw notFound("Global media assignment set was not found.");
  if (owner.status === "published") {
    throw new AppError({
      code: "CONFLICT",
      message: "Published global media versions are immutable; create a new draft version.",
      statusCode: httpStatus.conflict,
    });
  }
  const normalizedSlots = Object.entries(input.slots);
  for (const [slotKey, assignments] of normalizedSlots) {
    const slot = resolveGlobalMediaSlot(owner.definitionKey, slotKey);
    if (!slot) {
      throw cmsError(
        "INVALID_MEDIA_SLOT",
        `Global definition ${owner.definitionKey} does not define media slot ${slotKey}.`,
      );
    }
    await validateAssignments(slot, assignments);
  }
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(globalMediaAssignmentSets)
      .where(eq(globalMediaAssignmentSets.id, owner.id)).limit(1).for("update");
    if (!locked) throw notFound("Global media assignment set was not found.");
    if (locked.status === "published") {
      throw new AppError({
        code: "CONFLICT",
        message: "Published global media versions are immutable; create a new draft version.",
        statusCode: httpStatus.conflict,
      });
    }
    await tx.delete(globalMediaAssignments)
      .where(eq(globalMediaAssignments.assignmentSetId, owner.id));
    const values = normalizedSlots.flatMap(([slotKey, assignments]) =>
      assignments.map((assignment, sortOrder) => ({
        assignmentSetId: owner.id,
        slotKey,
        mediaAssetId: assignment.mediaAssetId,
        sortOrder,
        altTextOverride: normalizeAltText(assignment.altTextOverride),
        decorative: assignment.decorative ?? false,
      })));
    if (values.length === 0) return [];
    return tx.insert(globalMediaAssignments).values(values).returning();
  });
};

export const listGlobalMediaVersions = async () => {
  const sets = await db.select().from(globalMediaAssignmentSets)
    .orderBy(asc(globalMediaAssignmentSets.definitionKey), desc(globalMediaAssignmentSets.version));
  if (sets.length === 0) return [];
  const assignments = await db.select({
    assignmentSetId: globalMediaAssignments.assignmentSetId,
    slotKey: globalMediaAssignments.slotKey,
    sortOrder: globalMediaAssignments.sortOrder,
    altTextOverride: globalMediaAssignments.altTextOverride,
    decorative: globalMediaAssignments.decorative,
    assetId: mediaAssets.id,
    displayName: mediaAssets.displayName,
    mediaKind: mediaAssets.mediaKind,
    mimeType: mediaAssets.mimeType,
    publicUrl: mediaAssets.publicUrl,
    altText: mediaAssets.altText,
    width: mediaAssets.width,
    height: mediaAssets.height,
    durationMs: mediaAssets.durationMs,
    processingState: mediaAssets.processingState,
    status: mediaAssets.status,
  }).from(globalMediaAssignments)
    .innerJoin(mediaAssets, eq(mediaAssets.id, globalMediaAssignments.mediaAssetId))
    .where(inArray(globalMediaAssignments.assignmentSetId, sets.map(({ id }) => id)))
    .orderBy(asc(globalMediaAssignments.slotKey), asc(globalMediaAssignments.sortOrder));
  return sets.map((set) => ({
    ...set,
    assignments: assignments.filter(({ assignmentSetId }) => assignmentSetId === set.id),
  }));
};

export const publishGlobalMediaVersion = async (assignmentSetId: string) =>
  db.transaction(async (tx) => {
    const [owner] = await tx.select().from(globalMediaAssignmentSets)
      .where(eq(globalMediaAssignmentSets.id, assignmentSetId)).limit(1).for("update");
    if (!owner) throw notFound("Global media assignment set was not found.");
    if (owner.status === "published") return owner;
    const definition = globalMediaDefinitions.find(({ key }) => key === owner.definitionKey);
    if (!definition) throw cmsError("INVALID_MEDIA_SLOT", "Global media definition is unavailable.");
    const assignments = await tx.select({
      slotKey: globalMediaAssignments.slotKey,
      decorative: globalMediaAssignments.decorative,
      altTextOverride: globalMediaAssignments.altTextOverride,
      mediaKind: mediaAssets.mediaKind,
      processingState: mediaAssets.processingState,
      status: mediaAssets.status,
      altText: mediaAssets.altText,
    }).from(globalMediaAssignments)
      .innerJoin(mediaAssets, eq(mediaAssets.id, globalMediaAssignments.mediaAssetId))
      .where(eq(globalMediaAssignments.assignmentSetId, owner.id));
    const errors: Array<{ field: string; message: string }> = [];
    for (const slot of definition.slots) {
      const selected = assignments.filter(({ slotKey }) => slotKey === slot.key);
      if (slot.required && selected.length === 0) {
        errors.push({ field: `slots.${slot.key}`, message: `${slot.label} is required.` });
      }
      for (const assignment of selected) {
        if (!slot.accepts.includes(assignment.mediaKind)) {
          errors.push({ field: `slots.${slot.key}`, message: "Selected media has the wrong kind." });
        }
        if (assignment.processingState !== "ready" || assignment.status === "archived") {
          errors.push({ field: `slots.${slot.key}`, message: "Selected media must be ready and active." });
        }
        if (
          assignment.mediaKind === "image"
          && !assignment.decorative
          && !(assignment.altTextOverride?.trim() || assignment.altText?.trim())
        ) {
          errors.push({ field: `slots.${slot.key}.altText`, message: "Alternative text is required." });
        }
      }
    }
    if (errors.length > 0) {
      throw new AppError({
        code: "CMS_PUBLICATION_INVALID",
        message: "Global media is not ready to publish.",
        statusCode: httpStatus.unprocessableEntity,
        details: errors,
      });
    }
    await tx.update(globalMediaAssignmentSets).set({
      status: "archived",
      updatedAt: new Date(),
    }).where(and(
      eq(globalMediaAssignmentSets.definitionKey, owner.definitionKey),
      eq(globalMediaAssignmentSets.status, "published"),
      ne(globalMediaAssignmentSets.id, owner.id),
    ));
    const [published] = await tx.update(globalMediaAssignmentSets).set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(globalMediaAssignmentSets.id, owner.id)).returning();
    return published!;
  });

export const listMediaAssetUsages = async (mediaAssetId: string) => {
  const [
    sectionUsages,
    globalUsages,
    legacySectionUsages,
    seoUsages,
    offeringUsages,
    blogPostUsages,
  ] = await Promise.all([
    db
      .select({
        pageId: pages.id,
        pageSlug: pages.slug,
        pageTitle: pages.title,
        sectionId: pageSections.id,
        sectionType: pageSections.sectionType,
        slotKey: sectionMediaAssignments.slotKey,
        sortOrder: sectionMediaAssignments.sortOrder,
      })
      .from(sectionMediaAssignments)
      .innerJoin(pageSections, eq(pageSections.id, sectionMediaAssignments.pageSectionId))
      .innerJoin(pages, eq(pages.id, pageSections.pageId))
      .where(eq(sectionMediaAssignments.mediaAssetId, mediaAssetId))
      .orderBy(asc(pages.slug), asc(pageSections.sortOrder), asc(sectionMediaAssignments.sortOrder)),
    db
      .select({
        assignmentSetId: globalMediaAssignmentSets.id,
        definitionKey: globalMediaAssignmentSets.definitionKey,
        version: globalMediaAssignmentSets.version,
        status: globalMediaAssignmentSets.status,
        slotKey: globalMediaAssignments.slotKey,
        sortOrder: globalMediaAssignments.sortOrder,
      })
      .from(globalMediaAssignments)
      .innerJoin(
        globalMediaAssignmentSets,
        eq(globalMediaAssignmentSets.id, globalMediaAssignments.assignmentSetId),
      )
      .where(eq(globalMediaAssignments.mediaAssetId, mediaAssetId))
      .orderBy(
        asc(globalMediaAssignmentSets.definitionKey),
        asc(globalMediaAssignmentSets.version),
        asc(globalMediaAssignments.sortOrder),
      ),
    db
      .select({
        pageId: pages.id,
        pageSlug: pages.slug,
        pageTitle: pages.title,
        sectionId: pageSections.id,
        sectionType: pageSections.sectionType,
      })
      .from(pageSections)
      .innerJoin(pages, eq(pages.id, pageSections.pageId))
      .where(eq(pageSections.mediaAssetId, mediaAssetId))
      .orderBy(asc(pages.slug), asc(pageSections.sortOrder)),
    db
      .select({
        id: seoMetadata.id,
        resourceType: seoMetadata.resourceType,
        resourceId: seoMetadata.resourceId,
      })
      .from(seoMetadata)
      .where(eq(seoMetadata.ogImageAssetId, mediaAssetId))
      .orderBy(asc(seoMetadata.resourceType)),
    db
      .select({ id: offerings.id, title: offerings.title, slug: offerings.slug })
      .from(offerings)
      .where(eq(offerings.featuredMediaAssetId, mediaAssetId))
      .orderBy(asc(offerings.title)),
    db
      .select({ id: blogPosts.id, title: blogPosts.title, slug: blogPosts.slug })
      .from(blogPosts)
      .where(eq(blogPosts.featuredMediaAssetId, mediaAssetId))
      .orderBy(asc(blogPosts.title)),
  ]);

  return [
    ...sectionUsages.map((usage) => ({
      ownerType: "section" as const,
      ownerId: usage.sectionId,
      ownerLabel: `${usage.pageTitle} / ${usage.sectionType}`,
      ...usage,
    })),
    ...globalUsages.map((usage) => ({
      ownerType: "global" as const,
      ownerId: usage.assignmentSetId,
      ownerLabel: `${usage.definitionKey} v${usage.version}`,
      ...usage,
    })),
    ...legacySectionUsages.map((usage) => ({
      ownerType: "section_legacy" as const,
      ownerId: usage.sectionId,
      ownerLabel: `${usage.pageTitle} / ${usage.sectionType}`,
      slotKey: "legacyMedia",
      ...usage,
    })),
    ...seoUsages.map((usage) => ({
      ownerType: "seo" as const,
      ownerId: usage.id,
      ownerLabel: `${usage.resourceType} SEO`,
      slotKey: "ogImage",
      ...usage,
    })),
    ...offeringUsages.map((usage) => ({
      ownerType: "offering" as const,
      ownerId: usage.id,
      ownerLabel: usage.title,
      slotKey: "featuredMedia",
      ...usage,
    })),
    ...blogPostUsages.map((usage) => ({
      ownerType: "blog_post" as const,
      ownerId: usage.id,
      ownerLabel: usage.title,
      slotKey: "featuredMedia",
      ...usage,
    })),
  ];
};
