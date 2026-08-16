import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";
import { getTestDatabase } from "./db.js";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const offeringOneId = "11111111-1111-4111-8111-111111111111";
const offeringTwoId = "22222222-2222-4222-8222-222222222222";
const egyptPriceId = "33333333-3333-4333-8333-333333333333";
const usPriceId = "44444444-4444-4444-8444-444444444444";

const applyMigration = async (client: PoolClient, migration: MigrationMeta) => {
  for (const statement of migration.sql) {
    if (statement.trim()) await client.query(statement);
  }
};

const preparePricingGroupsUpgrade = async (client: PoolClient) => {
  const migrations = readMigrationFiles({ migrationsFolder });
  expect(migrations.length).toBeGreaterThanOrEqual(14);
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  for (const migration of migrations.slice(0, 13)) await applyMigration(client, migration);
  return migrations[13]!;
};

const insertOffering = async (client: PoolClient, input: { id: string; slug: string }) => {
  await client.query(
    `INSERT INTO offerings
       (id, title, slug, offering_type, attendance_mode, booking_mode,
        scheduling_mode, duration_minutes, capacity, requires_payment, quote_only, status)
     VALUES ($1, $2, $2, 'coaching', 'online', 'paid',
       'appointment', 60, 1, true, false, 'published')`,
    [input.id, input.slug],
  );
};

describe.sequential("country price-group migration", () => {
  it("backfills memberships, names, scheduled audit, indexes, and booking price integrity", async () => {
    const client = await getTestDatabase().pool.connect();
    await client.query("BEGIN");
    try {
      const migration = await preparePricingGroupsUpgrade(client);
      await insertOffering(client, { id: offeringOneId, slug: "offering-one" });
      await insertOffering(client, { id: offeringTwoId, slug: "offering-two" });
      await client.query(
        `INSERT INTO offering_prices
           (id, offering_id, country_code, currency, base_amount_minor,
            early_bird_amount_minor, early_bird_ends_at, status)
         VALUES
           ($1, $2, 'EG', 'EGP', 10000, 8000, '2026-09-01T00:00:00Z', 'scheduled'),
           ($3, $4, 'US', 'USD', 20000, NULL, NULL, 'published')`,
        [egyptPriceId, offeringOneId, usPriceId, offeringTwoId],
      );

      await applyMigration(client, migration);

      const prices = await client.query<{
        id: string;
        name: string;
        status: string;
        country_code: string;
      }>(
        `SELECT id::text, name, status, country_code
         FROM offering_prices ORDER BY id`,
      );
      expect(prices.rows).toEqual([
        { id: egyptPriceId, name: "Egypt", status: "draft", country_code: "EG" },
        { id: usPriceId, name: "United States", status: "published", country_code: "US" },
      ]);
      const memberships = await client.query<{
        price_id: string;
        offering_id: string;
        country_code: string;
        active: boolean;
      }>(
        `SELECT price_id::text, offering_id::text, country_code, active
         FROM offering_price_countries ORDER BY price_id`,
      );
      expect(memberships.rows).toEqual([
        { price_id: egyptPriceId, offering_id: offeringOneId, country_code: "EG", active: true },
        { price_id: usPriceId, offering_id: offeringTwoId, country_code: "US", active: true },
      ]);
      const audits = await client.query<{ resource_id: string; action: string }>(
        `SELECT resource_id::text, action FROM audit_logs
         WHERE resource_type = 'offering_price' ORDER BY resource_id`,
      );
      expect(audits.rows).toContainEqual({
        resource_id: egyptPriceId,
        action: "migration.offering_prices.scheduled_to_draft",
      });

      await client.query(
        `INSERT INTO bookings
           (offering_id, attendance_mode, customer_full_name, customer_email,
            slot_start_at, slot_end_at, offering_price_id)
         VALUES ($1, 'online', 'Customer', 'customer@example.test',
           '2026-10-01T09:00:00Z', '2026-10-01T10:00:00Z', $2)`,
        [offeringOneId, egyptPriceId],
      );
      await client.query("SAVEPOINT cross_offering_price");
      await expect(
        client.query(
          `INSERT INTO bookings
             (offering_id, attendance_mode, customer_full_name, customer_email,
              slot_start_at, slot_end_at, offering_price_id)
           VALUES ($1, 'online', 'Wrong', 'wrong@example.test',
             '2026-10-02T09:00:00Z', '2026-10-02T10:00:00Z', $2)`,
          [offeringTwoId, egyptPriceId],
        ),
      ).rejects.toThrow(/foreign key/i);
      await client.query("ROLLBACK TO SAVEPOINT cross_offering_price");
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });

  it("stops before writes when one offering has duplicate active country prices", async () => {
    const client = await getTestDatabase().pool.connect();
    await client.query("BEGIN");
    try {
      const migration = await preparePricingGroupsUpgrade(client);
      await insertOffering(client, { id: offeringOneId, slug: "duplicate-country" });
      await client.query(
        `INSERT INTO offering_prices
           (id, offering_id, country_code, currency, base_amount_minor, status)
         VALUES
           ($1, $2, 'EG', 'EGP', 10000, 'published'),
           ($3, $2, 'EG', 'USD', 20000, 'draft')`,
        [egyptPriceId, offeringOneId, usPriceId],
      );

      await client.query("SAVEPOINT migration_attempt");
      await expect(applyMigration(client, migration)).rejects.toThrow(
        new RegExp(`${egyptPriceId}.*${usPriceId}|${usPriceId}.*${egyptPriceId}`, "i"),
      );
      await client.query("ROLLBACK TO SAVEPOINT migration_attempt");
      const table = await client.query<{ table_name: string | null }>(
        `SELECT to_regclass('public.offering_price_countries')::text AS table_name`,
      );
      expect(table.rows[0]?.table_name).toBeNull();
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });
});
