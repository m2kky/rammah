import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  mediaAssets,
  pageSections,
  pages,
  sectionMediaAssignments,
} from "../db/schema/index.js";
import { getTestDatabase } from "./db.js";

const migrationSql = readFileSync(
  new URL("../../drizzle/0014_acrl_recognition.sql", import.meta.url),
  "utf8",
).replaceAll("--> statement-breakpoint", "");

describe.sequential("aCRL recognition migration", () => {
  it("is idempotent, preserves custom titles, and assigns the local portrait", async () => {
    const { db, pool } = getTestDatabase();
    const [about] = await db.insert(pages).values({
      slug: "about",
      title: "About Ahmed Rammah",
      template: "about",
      status: "published",
    }).returning();
    const [otherPage] = await db.insert(pages).values({
      slug: "migration-unrelated",
      title: "Unrelated page",
      template: "default",
      status: "published",
    }).returning();

    const insertedSections = await db.insert(pageSections).values([
      {
        pageId: about!.id,
        sectionType: "reach",
        title: "(04) The reach",
        sortOrder: 60,
        status: "published",
      },
      {
        pageId: about!.id,
        sectionType: "cta",
        title: "A custom CTA title",
        sortOrder: 70,
        status: "published",
      },
      {
        pageId: about!.id,
        sectionType: "reach",
        title: "Archived reach",
        sortOrder: 600,
        status: "archived",
      },
      {
        pageId: otherPage!.id,
        sectionType: "reach",
        title: "Unrelated reach",
        sortOrder: 60,
        status: "published",
      },
    ]).returning();
    const archivedReach = insertedSections.find(({ title }) => title === "Archived reach")!;
    const unrelatedReach = insertedSections.find(({ title }) => title === "Unrelated reach")!;

    await pool.query(migrationSql);
    await pool.query(migrationSql);

    const sections = await db.select().from(pageSections)
      .where(eq(pageSections.pageId, about!.id));
    const recognition = sections.filter(({ sectionType }) => sectionType === "recognition");
    expect(recognition).toHaveLength(1);
    expect(recognition[0]).toMatchObject({
      title: "(04) Official recognition",
      sortOrder: 60,
      status: "published",
    });
    expect(sections.find(({ sectionType, status }) =>
      sectionType === "reach" && status !== "archived"
    )).toMatchObject({
      title: "(05) The reach",
      sortOrder: 70,
    });
    expect(sections.find(({ sectionType }) => sectionType === "cta")).toMatchObject({
      title: "A custom CTA title",
      sortOrder: 80,
    });

    const portraits = await db.select().from(mediaAssets).where(
      and(
        eq(mediaAssets.sourceType, "external"),
        eq(mediaAssets.publicUrl, "/acrl-ahmed-rammah.webp"),
      ),
    );
    expect(portraits).toHaveLength(1);

    const assignments = await db.select().from(sectionMediaAssignments).where(
      and(
        eq(sectionMediaAssignments.pageSectionId, recognition[0]!.id),
        eq(sectionMediaAssignments.slotKey, "portrait"),
      ),
    );
    expect(assignments).toHaveLength(1);
    expect(assignments[0]!.mediaAssetId).toBe(portraits[0]!.id);

    const [archivedAfter] = await db.select().from(pageSections)
      .where(eq(pageSections.id, archivedReach.id));
    const [unrelatedAfter] = await db.select().from(pageSections)
      .where(eq(pageSections.id, unrelatedReach.id));
    expect(archivedAfter).toMatchObject({ title: "Archived reach", sortOrder: 600 });
    expect(unrelatedAfter).toMatchObject({ title: "Unrelated reach", sortOrder: 60 });
  });
});
