import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";
import { getTestDatabase } from "./db.js";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const legacyOfferingId = "11111111-1111-4111-8111-111111111111";
const legacySessionId = "22222222-2222-4222-8222-222222222222";
const legacyBookingId = "33333333-3333-4333-8333-333333333333";
const legacyHoldId = "44444444-4444-4444-8444-444444444444";
const legacyPaymentId = "55555555-5555-4555-8555-555555555555";

async function applyMigration(client: PoolClient, migration: MigrationMeta): Promise<void> {
  for (const statement of migration.sql) {
    if (statement.trim()) {
      await client.query(statement);
    }
  }
}

async function prepareLegacySchema(client: PoolClient): Promise<MigrationMeta[]> {
  const migrations = readMigrationFiles({ migrationsFolder });
  expect(migrations.length).toBeGreaterThanOrEqual(9);

  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  for (const migration of migrations.slice(0, 8)) {
    await applyMigration(client, migration);
  }

  return migrations;
}

async function seedFixedSessionHistory(client: PoolClient): Promise<void> {
  await client.query(
    `INSERT INTO offerings
       (id, title, slug, offering_type, attendance_mode, booking_mode, duration_minutes,
        capacity, requires_payment, quote_only, status)
     VALUES ($1, 'Legacy workshop', 'legacy-workshop', 'workshop', 'online', 'paid', 60,
       12, true, false, 'published')`,
    [legacyOfferingId],
  );
  await client.query(
    `INSERT INTO offering_sessions
       (id, offering_id, starts_at, ends_at, timezone, capacity, attendance_mode,
        google_calendar_event_id, status)
     VALUES ($1, $2, '2030-08-08T06:00:00Z', '2030-08-08T09:00:00Z', 'Africa/Cairo',
       12, 'online', 'legacy-google-event', 'published')`,
    [legacySessionId, legacyOfferingId],
  );
  await client.query(
    `INSERT INTO bookings
       (id, offering_id, offering_session_id, attendance_mode, status, customer_full_name,
        customer_email, slot_start_at, slot_end_at, timezone, price_currency,
        base_amount_minor, total_amount_minor, payment_required)
     VALUES ($1, $2, $3, 'online', 'confirmed', 'Legacy Customer', 'legacy@example.test',
       '2030-08-08T06:00:00Z', '2030-08-08T09:00:00Z', 'Africa/Cairo', 'EGP',
       120000, 120000, true)`,
    [legacyBookingId, legacyOfferingId, legacySessionId],
  );
  await client.query(
    `INSERT INTO booking_slot_holds
       (id, offering_id, offering_session_id, slot_start_at, slot_end_at, booking_id,
        hold_secret_hash, status, expires_at)
     VALUES ($1, $2, $3, '2030-08-08T06:00:00Z', '2030-08-08T09:00:00Z', $4,
       repeat('a', 64), 'converted', '2030-08-08T05:00:00Z')`,
    [legacyHoldId, legacyOfferingId, legacySessionId, legacyBookingId],
  );
  await client.query(
    `INSERT INTO payments
       (id, booking_id, provider, provider_payment_id, status, currency, amount_minor,
        idempotency_key, paid_at)
     VALUES ($1, $2, 'kashier', 'legacy-payment', 'paid', 'EGP', 120000,
       'legacy-payment-idempotency', '2026-08-01T10:00:00Z')`,
    [legacyPaymentId, legacyBookingId],
  );
}

describe.sequential("canonical booking schema upgrade", () => {
  it("converts fixed-session history to one Program and occurrence without losing compatibility", async () => {
    const client = await getTestDatabase().pool.connect();
    await client.query("BEGIN");

    try {
      const migrations = await prepareLegacySchema(client);
      await seedFixedSessionHistory(client);
      await applyMigration(client, migrations[8]!);

      const program = await client.query<{
        id: string;
        offering_id: string;
        title: string;
        timezone: string;
        capacity: number;
      }>("SELECT id, offering_id, title, timezone, capacity FROM scheduled_programs");
      const occurrence = await client.query<{
        id: string;
        scheduled_program_id: string;
        google_calendar_event_id: string;
      }>(
        "SELECT id, scheduled_program_id, google_calendar_event_id FROM scheduled_program_occurrences",
      );
      const booking = await client.query<{
        scheduled_program_id: string;
        offering_session_id: string;
        slot_start_at: Date | null;
        slot_end_at: Date | null;
        booking_reference: string;
      }>(
        "SELECT scheduled_program_id, offering_session_id, slot_start_at, slot_end_at, booking_reference FROM bookings WHERE id = $1",
        [legacyBookingId],
      );
      const hold = await client.query<{
        scheduled_program_id: string;
        offering_session_id: string;
        slot_start_at: Date | null;
        slot_end_at: Date | null;
        booking_id: string;
      }>(
        "SELECT scheduled_program_id, offering_session_id, slot_start_at, slot_end_at, booking_id FROM booking_slot_holds WHERE id = $1",
        [legacyHoldId],
      );
      const payment = await client.query<{
        id: string;
        booking_id: string;
        status: string;
        amount_minor: number;
      }>("SELECT id, booking_id, status, amount_minor FROM payments WHERE id = $1", [legacyPaymentId]);
      const offering = await client.query<{
        scheduling_mode: string;
        duration_minutes: number | null;
      }>("SELECT scheduling_mode, duration_minutes FROM offerings WHERE id = $1", [legacyOfferingId]);

      expect(program.rows).toEqual([
        {
          id: legacySessionId,
          offering_id: legacyOfferingId,
          title: "Legacy workshop",
          timezone: "Africa/Cairo",
          capacity: 12,
        },
      ]);
      expect(occurrence.rows).toEqual([
        {
          id: legacySessionId,
          scheduled_program_id: legacySessionId,
          google_calendar_event_id: "legacy-google-event",
        },
      ]);
      expect(booking.rows[0]).toMatchObject({
        scheduled_program_id: legacySessionId,
        offering_session_id: legacySessionId,
        slot_start_at: null,
        slot_end_at: null,
      });
      expect(booking.rows[0]?.booking_reference).toMatch(/^RMM-/);
      expect(hold.rows[0]).toEqual({
        scheduled_program_id: legacySessionId,
        offering_session_id: legacySessionId,
        slot_start_at: null,
        slot_end_at: null,
        booking_id: legacyBookingId,
      });
      expect(payment.rows).toEqual([
        {
          id: legacyPaymentId,
          booking_id: legacyBookingId,
          status: "paid",
          amount_minor: 120000,
        },
      ]);
      expect(offering.rows).toEqual([
        { scheduling_mode: "scheduled_program", duration_minutes: null },
      ]);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });

  it("rejects an Offering that has both active fixed sessions and recurring availability", async () => {
    const client = await getTestDatabase().pool.connect();
    await client.query("BEGIN");

    try {
      const migrations = await prepareLegacySchema(client);
      await seedFixedSessionHistory(client);
      await client.query(
        `INSERT INTO availability_rules
           (offering_id, weekday, start_time, end_time, timezone, slot_duration_minutes,
            buffer_before_minutes, buffer_after_minutes, status)
         VALUES ($1, 4, '09:00', '13:00', 'Africa/Cairo', 60, 0, 0, 'published')`,
        [legacyOfferingId],
      );

      await expect(applyMigration(client, migrations[8]!)).rejects.toThrow(legacyOfferingId);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });
});
