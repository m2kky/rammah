import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";
import { getTestDatabase } from "./db.js";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const assetId = "11111111-1111-4111-8111-111111111111";
const pageId = "22222222-2222-4222-8222-222222222222";
const sectionId = "33333333-3333-4333-8333-333333333333";

const applyMigration = async (client: PoolClient, migration: MigrationMeta) => {
  for (const statement of migration.sql) {
    if (statement.trim()) await client.query(statement);
  }
};

const prepareCmsUpgrade = async (client: PoolClient) => {
  const migrations = readMigrationFiles({ migrationsFolder });
  expect(migrations.length).toBeGreaterThanOrEqual(10);
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  for (const migration of migrations.slice(0, 9)) await applyMigration(client, migration);
  return migrations[9]!;
};

describe.sequential("CMS media assignment migration", () => {
  it("creates the assignment foundation in a fresh migrated database", async () => {
    const result = await getTestDatabase().pool.query<{
      section_table: string | null;
      global_set_table: string | null;
      global_assignment_table: string | null;
    }>(
      `SELECT
         to_regclass('public.section_media_assignments')::text AS section_table,
         to_regclass('public.global_media_assignment_sets')::text AS global_set_table,
         to_regclass('public.global_media_assignments')::text AS global_assignment_table`,
    );
    expect(result.rows[0]).toEqual({
      section_table: "section_media_assignments",
      global_set_table: "global_media_assignment_sets",
      global_assignment_table: "global_media_assignments",
    });
  });

  it("backfills legacy media into a named slot without removing the compatibility field", async () => {
    const client = await getTestDatabase().pool.connect();
    await client.query("BEGIN");
    try {
      const migration = await prepareCmsUpgrade(client);
      await client.query(
        `INSERT INTO media_assets
           (id, file_name, mime_type, storage_key, public_url, alt_text, size_bytes, status)
         VALUES ($1, 'legacy-intro.mp4', 'video/mp4', 'legacy/intro.mp4',
           'https://cdn.example.test/legacy-intro.mp4', 'Introduction', 4096, 'published')`,
        [assetId],
      );
      await client.query(
        `INSERT INTO pages (id, slug, title, status) VALUES ($1, 'legacy-home', 'Legacy home', 'published')`,
        [pageId],
      );
      await client.query(
        `INSERT INTO page_sections
           (id, page_id, section_type, media_asset_id, sort_order, status)
         VALUES ($1, $2, 'video', $3, 10, 'published')`,
        [sectionId, pageId, assetId],
      );

      await applyMigration(client, migration);

      const asset = await client.query<{
        display_name: string;
        source_type: string;
        media_kind: string;
        processing_state: string;
      }>(
        `SELECT display_name, source_type, media_kind, processing_state
         FROM media_assets WHERE id = $1`,
        [assetId],
      );
      const section = await client.query<{ media_asset_id: string }>(
        "SELECT media_asset_id FROM page_sections WHERE id = $1",
        [sectionId],
      );
      const assignment = await client.query<{
        page_section_id: string;
        slot_key: string;
        media_asset_id: string;
        sort_order: number;
      }>(
        `SELECT page_section_id, slot_key, media_asset_id, sort_order
         FROM section_media_assignments WHERE page_section_id = $1`,
        [sectionId],
      );

      expect(asset.rows).toEqual([
        {
          display_name: "legacy-intro.mp4",
          source_type: "external",
          media_kind: "video",
          processing_state: "ready",
        },
      ]);
      expect(section.rows).toEqual([{ media_asset_id: assetId }]);
      expect(assignment.rows).toEqual([
        {
          page_section_id: sectionId,
          slot_key: "video",
          media_asset_id: assetId,
          sort_order: 0,
        },
      ]);

      await client.query("SAVEPOINT media_fk_check");
      await expect(client.query("DELETE FROM media_assets WHERE id = $1", [assetId])).rejects.toThrow(
        /foreign key/i,
      );
      await client.query("ROLLBACK TO SAVEPOINT media_fk_check");
      await client.query("DELETE FROM page_sections WHERE id = $1", [sectionId]);
      const remaining = await client.query(
        "SELECT id FROM section_media_assignments WHERE page_section_id = $1",
        [sectionId],
      );
      expect(remaining.rowCount).toBe(0);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });
});
