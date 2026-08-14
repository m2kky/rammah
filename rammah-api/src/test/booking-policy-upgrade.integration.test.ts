import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";
import { getTestDatabase } from "./db.js";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

const applyMigration = async (client: PoolClient, migration: MigrationMeta) => {
  for (const statement of migration.sql) {
    if (statement.trim()) await client.query(statement);
  }
};

const preparePrePolicySchema = async (client: PoolClient) => {
  const migrations = readMigrationFiles({ migrationsFolder });
  expect(migrations).toHaveLength(11);
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  for (const migration of migrations.slice(0, 10)) await applyMigration(client, migration);
  return migrations[10]!;
};

describe.sequential("booking policy migration", () => {
  it("backfills the existing singleton settings row", async () => {
    const client = await getTestDatabase().pool.connect();
    await client.query("BEGIN");
    try {
      const migration = await preparePrePolicySchema(client);
      await client.query(
        `INSERT INTO site_settings (site_name, booking_default_timezone)
         VALUES ('Rammah', 'Africa/Cairo')`,
      );

      await applyMigration(client, migration);

      const result = await client.query<{
        site_name: string;
        settings_key: string;
        booking_minimum_advance_days: number;
        booking_default_timezone: string;
      }>(
        `SELECT site_name, settings_key, booking_minimum_advance_days, booking_default_timezone
         FROM site_settings`,
      );
      expect(result.rows).toEqual([
        {
          site_name: "Rammah",
          settings_key: "global",
          booking_minimum_advance_days: 1,
          booking_default_timezone: "Africa/Cairo",
        },
      ]);
      await expect(
        client.query(
          `INSERT INTO site_settings (site_name, settings_key, booking_minimum_advance_days)
           VALUES ('Duplicate', 'global', 2)`,
        ),
      ).rejects.toThrow(/unique/i);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });

  it("stops the upgrade when duplicate settings rows need operator resolution", async () => {
    const client = await getTestDatabase().pool.connect();
    await client.query("BEGIN");
    try {
      const migration = await preparePrePolicySchema(client);
      await client.query(
        `INSERT INTO site_settings (site_name) VALUES ('One'), ('Two')`,
      );

      await expect(applyMigration(client, migration)).rejects.toThrow(/duplicate site_settings/i);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });
});
