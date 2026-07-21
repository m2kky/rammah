import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema/index.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

interface ClosablePool {
  end(): Promise<void>;
}

export const createDatabaseCloser = (closablePool: ClosablePool) => {
  let closePromise: Promise<void> | undefined;
  return (): Promise<void> => {
    closePromise ??= closablePool.end();
    return closePromise;
  };
};

export const closeDatabase = createDatabaseCloser(pool);
