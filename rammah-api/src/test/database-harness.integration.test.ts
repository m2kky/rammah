import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { contactInquiries } from "../db/schema/index.js";
import { getTestDatabase, getTestDatabaseName, seedTestDatabase } from "./db.js";

const markerEmail = "database-harness-marker@example.test";

describe.sequential("real PostgreSQL integration harness", () => {
  it("connects, applies every migration, and writes and reads with Drizzle", async () => {
    const context = getTestDatabase();
    const databaseResult = await context.pool.query<{ current_database: string }>(
      "SELECT current_database()",
    );
    const migrationResult = await context.pool.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM "drizzle"."__drizzle_migrations"',
    );

    expect(databaseResult.rows[0]?.current_database).toBe(
      getTestDatabaseName(context.connectionString, process.env.NODE_ENV),
    );
    expect(Number(migrationResult.rows[0]?.count)).toBe(9);

    await seedTestDatabase(context, async (db) => {
      await db.insert(contactInquiries).values({
        fullName: "Database Harness Marker",
        email: markerEmail,
        message: "This row must be removed by per-test isolation.",
      });
    });

    const rows = await context.db
      .select({ email: contactInquiries.email })
      .from(contactInquiries)
      .where(eq(contactInquiries.email, markerEmail));
    expect(rows).toEqual([{ email: markerEmail }]);
  });

  it("starts the next test without data left by the previous test", async () => {
    const context = getTestDatabase();
    const rows = await context.db
      .select({ email: contactInquiries.email })
      .from(contactInquiries)
      .where(eq(contactInquiries.email, markerEmail));

    expect(rows).toEqual([]);
  });
});
