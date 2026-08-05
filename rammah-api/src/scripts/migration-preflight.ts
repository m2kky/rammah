import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateMigrationHistory,
  type LockedMigrationManifest,
  type MigrationJournal,
} from "../db/migration-preflight.js";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const drizzleDirectory = resolve(apiRoot, "drizzle");
const metaDirectory = resolve(drizzleDirectory, "meta");

const readJson = <T>(path: string) => JSON.parse(readFileSync(path, "utf8")) as T;
const readMatchingFiles = (directory: string, pattern: RegExp) =>
  Object.fromEntries(
    readdirSync(directory)
      .filter((fileName) => pattern.test(fileName))
      .map((fileName) => [fileName, readFileSync(resolve(directory, fileName), "utf8")]),
  );

const result = validateMigrationHistory({
  journal: readJson<MigrationJournal>(resolve(metaDirectory, "_journal.json")),
  manifest: readJson<LockedMigrationManifest>(resolve(drizzleDirectory, "migration-lock.json")),
  sqlFiles: readMatchingFiles(drizzleDirectory, /^\d{4}_.+\.sql$/),
  snapshotFiles: readMatchingFiles(metaDirectory, /^\d{4}_snapshot\.json$/),
});

console.log(
  `Migration preflight OK: current=${result.currentTag}; currentPrefix=${result.currentPrefix}; nextPrefix=${result.nextPrefix}.`,
);
