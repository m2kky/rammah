import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  globalMediaAssignmentSets,
  mediaAssets,
  pageSections,
  pages,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import {
  createGlobalMediaAssignmentSet,
  listMediaAssetUsages,
  setGlobalMediaSlot,
  setSectionMediaSlot,
} from "./media-assignments.service.js";

const seedAsset = async (
  kind: "image" | "video" | "animation_bundle",
  label: string = kind,
) => {
  const [asset] = await getTestDatabase().db
    .insert(mediaAssets)
    .values({
      displayName: label,
      fileName: `${label}.${kind === "video" ? "mp4" : "webp"}`,
      mimeType: kind === "video" ? "video/mp4" : "image/webp",
      mediaKind: kind,
      sourceType: "r2",
      storageKey: `cms-test/${crypto.randomUUID()}`,
      sizeBytes: 1024,
      processingState: "ready",
      status: "published",
    })
    .returning();
  return asset!;
};

const seedSection = async (sectionType: string) => {
  const [page] = await getTestDatabase().db
    .insert(pages)
    .values({
      slug: `cms-test-${crypto.randomUUID()}`,
      title: "CMS assignment test page",
    })
    .returning();
  const [section] = await getTestDatabase().db
    .insert(pageSections)
    .values({ pageId: page!.id, sectionType })
    .returning();
  return { page: page!, section: section! };
};

describe.sequential("CMS media assignments", () => {
  it("replaces a named section slot and reports its page usage", async () => {
    const image = await seedAsset("image", "hero");
    const { page, section } = await seedSection("hero");

    const assignments = await setSectionMediaSlot({
      pageSectionId: section.id,
      slotKey: "desktopImage",
      assignments: [
        {
          mediaAssetId: image.id,
          altTextOverride: "Coach speaking to a client",
          decorative: false,
        },
      ],
    });

    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({
      pageSectionId: section.id,
      slotKey: "desktopImage",
      mediaAssetId: image.id,
      sortOrder: 0,
      altTextOverride: "Coach speaking to a client",
      decorative: false,
    });
    await expect(listMediaAssetUsages(image.id)).resolves.toEqual([
      expect.objectContaining({
        ownerType: "section",
        pageId: page.id,
        pageSlug: page.slug,
        sectionId: section.id,
        sectionType: "hero",
        slotKey: "desktopImage",
      }),
    ]);
  });

  it("enforces media kind and slot cardinality before writing", async () => {
    const video = await seedAsset("video", "wrong-kind");
    const imageOne = await seedAsset("image", "one");
    const imageTwo = await seedAsset("image", "two");
    const { section } = await seedSection("hero");

    await expect(
      setSectionMediaSlot({
        pageSectionId: section.id,
        slotKey: "desktopImage",
        assignments: [{ mediaAssetId: video.id }],
      }),
    ).rejects.toMatchObject({ code: "MEDIA_KIND_MISMATCH" });

    await expect(
      setSectionMediaSlot({
        pageSectionId: section.id,
        slotKey: "desktopImage",
        assignments: [{ mediaAssetId: imageOne.id }, { mediaAssetId: imageTwo.id }],
      }),
    ).rejects.toMatchObject({ code: "SLOT_CARDINALITY_EXCEEDED" });
  });

  it("stores gallery media in deterministic order and replaces the full slot", async () => {
    const first = await seedAsset("image", "first");
    const second = await seedAsset("image", "second");
    const replacement = await seedAsset("image", "replacement");
    const { section } = await seedSection("gallery");

    await expect(
      setSectionMediaSlot({
        pageSectionId: section.id,
        slotKey: "galleryImages",
        assignments: [{ mediaAssetId: second.id }, { mediaAssetId: first.id }],
      }),
    ).resolves.toMatchObject([
      { mediaAssetId: second.id, sortOrder: 0 },
      { mediaAssetId: first.id, sortOrder: 1 },
    ]);

    const replaced = await setSectionMediaSlot({
      pageSectionId: section.id,
      slotKey: "galleryImages",
      assignments: [{ mediaAssetId: replacement.id, decorative: true }],
    });
    expect(replaced).toMatchObject([
      { mediaAssetId: replacement.id, sortOrder: 0, decorative: true },
    ]);
    await expect(listMediaAssetUsages(first.id)).resolves.toEqual([]);
  });

  it("versions global loading assignments and exposes their usages", async () => {
    const video = await seedAsset("video", "loading");
    const firstSet = await createGlobalMediaAssignmentSet("loadingMatchCut");
    const secondSet = await createGlobalMediaAssignmentSet("loadingMatchCut");

    expect([firstSet.version, secondSet.version]).toEqual([1, 2]);
    await setGlobalMediaSlot({
      assignmentSetId: secondSet.id,
      slotKey: "video",
      assignments: [{ mediaAssetId: video.id }],
    });

    await expect(listMediaAssetUsages(video.id)).resolves.toEqual([
      expect.objectContaining({
        ownerType: "global",
        assignmentSetId: secondSet.id,
        definitionKey: "loadingMatchCut",
        version: 2,
        status: "draft",
        slotKey: "video",
      }),
    ]);

    await getTestDatabase().db
      .update(globalMediaAssignmentSets)
      .set({ status: "published", publishedAt: new Date() })
      .where(eq(globalMediaAssignmentSets.id, secondSet.id));
    await expect(
      setGlobalMediaSlot({
        assignmentSetId: secondSet.id,
        slotKey: "video",
        assignments: [],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(listMediaAssetUsages(video.id)).resolves.toHaveLength(1);
  });
});
