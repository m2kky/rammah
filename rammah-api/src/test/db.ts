import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { fileURLToPath } from "node:url";
import * as schema from "../db/schema/index.js";

export const DEFAULT_TEST_DATABASE_URL =
  "postgres://rammah_test:rammah_test@127.0.0.1:55433/rammah_test";

interface TestEnvironment {
  NODE_ENV?: string;
  TEST_DATABASE_URL?: string;
  DATABASE_URL?: string;
}

export interface TestDatabaseContext {
  connectionString: string;
  pool: pg.Pool;
  db: NodePgDatabase<typeof schema>;
}

const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const composeTestHosts = new Set(["postgres-test"]);
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

let activeTestDatabase: TestDatabaseContext | undefined;

export function resolveTestDatabaseUrl(env: TestEnvironment = process.env): string {
  return env.TEST_DATABASE_URL?.trim() || DEFAULT_TEST_DATABASE_URL;
}

export function configureIntegrationTestEnvironment(env: TestEnvironment = process.env): string {
  env.NODE_ENV = "test";
  const testDatabaseUrl = resolveTestDatabaseUrl(env);
  assertSafeTestDatabaseUrl(testDatabaseUrl, env.NODE_ENV);
  env.TEST_DATABASE_URL = testDatabaseUrl;
  env.DATABASE_URL = testDatabaseUrl;
  return testDatabaseUrl;
}

export function assertSafeTestDatabaseUrl(databaseUrl: string, nodeEnv: string | undefined): URL {
  if (nodeEnv !== "test") {
    throw new Error("Refusing test database access unless NODE_ENV=test");
  }

  if (!databaseUrl?.trim()) {
    throw new Error("Refusing database access: missing test database URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("Refusing database access: invalid test database URL");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("Refusing database access: test database URL must use PostgreSQL");
  }

  if (parsed.search) {
    throw new Error("Refusing database access: test database URL query parameters are not allowed");
  }

  const isLocalHost = localHosts.has(parsed.hostname);
  const isComposeTestHost = composeTestHosts.has(parsed.hostname);
  if (!isLocalHost && !isComposeTestHost) {
    throw new Error(`Refusing remote test database host: ${parsed.hostname || "<missing>"}`);
  }

  if (isLocalHost && parsed.port !== "55433") {
    throw new Error(`Refusing local test database outside port 55433: ${parsed.port || "5432"}`);
  }

  if (isComposeTestHost && parsed.port !== "5432") {
    throw new Error(`Refusing Compose test database outside port 5432: ${parsed.port || "<missing>"}`);
  }

  const databaseName = decodeURI(parsed.pathname.slice(1));
  if (databaseName === "rammah" || databaseName === "postgres" || !databaseName.endsWith("_test")) {
    throw new Error(`Refusing non-test database: ${databaseName || "<missing>"}`);
  }

  return parsed;
}

export function getTestDatabaseName(databaseUrl: string, nodeEnv: string | undefined): string {
  const parsed = assertSafeTestDatabaseUrl(databaseUrl, nodeEnv);
  return decodeURI(parsed.pathname.slice(1));
}

export async function connectTestDatabase(
  env: TestEnvironment = process.env,
): Promise<TestDatabaseContext> {
  const connectionString = resolveTestDatabaseUrl(env);
  assertSafeTestDatabaseUrl(connectionString, env.NODE_ENV);

  const pool = new pg.Pool({ connectionString });
  const context: TestDatabaseContext = {
    connectionString,
    pool,
    db: drizzle(pool, { schema }),
  };

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    await pool.end();
    throw new Error(`Unable to connect to the guarded test database at ${new URL(connectionString).host}`, {
      cause: error,
    });
  }

  activeTestDatabase = context;
  return context;
}

export function getTestDatabase(): TestDatabaseContext {
  if (!activeTestDatabase) {
    throw new Error("Test database is not connected; integration setup did not complete");
  }
  return activeTestDatabase;
}

export async function closeTestDatabase(
  context: TestDatabaseContext,
  env: TestEnvironment = process.env,
): Promise<void> {
  assertSafeTestDatabaseUrl(context.connectionString, env.NODE_ENV);
  await context.pool.end();
  if (activeTestDatabase === context) {
    activeTestDatabase = undefined;
  }
}

export async function resetTestDatabase(
  context: TestDatabaseContext,
  env: TestEnvironment = process.env,
): Promise<void> {
  assertSafeTestDatabaseUrl(context.connectionString, env.NODE_ENV);
  await context.pool.query(
    "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
  );
}

export async function migrateTestDatabase(
  context: TestDatabaseContext,
  env: TestEnvironment = process.env,
): Promise<void> {
  assertSafeTestDatabaseUrl(context.connectionString, env.NODE_ENV);
  await migrate(context.db, { migrationsFolder });
}

export async function truncateTestData(
  context: TestDatabaseContext,
  env: TestEnvironment = process.env,
): Promise<void> {
  assertSafeTestDatabaseUrl(context.connectionString, env.NODE_ENV);
  const result = await context.pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  if (result.rows.length === 0) {
    return;
  }

  const tableNames = result.rows.map(({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`);
  assertSafeTestDatabaseUrl(context.connectionString, env.NODE_ENV);
  await context.pool.query(`TRUNCATE TABLE ${tableNames.join(", ")} RESTART IDENTITY CASCADE`);
}

export async function seedTestDatabase(
  context: TestDatabaseContext,
  seed: (db: NodePgDatabase<typeof schema>) => Promise<void>,
  env: TestEnvironment = process.env,
): Promise<void> {
  assertSafeTestDatabaseUrl(context.connectionString, env.NODE_ENV);
  await seed(context.db);
}
