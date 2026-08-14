import { createHash } from "node:crypto";

export type MigrationJournal = {
  entries: Array<{ idx: number; tag: string }>;
};

export type LockedMigrationManifest = {
  version: number;
  lockedMigrations: Array<{
    tag: string;
    sqlSha256: string;
    snapshotSha256: string;
  }>;
};

export type MigrationHistoryInput = {
  journal: MigrationJournal;
  manifest: LockedMigrationManifest;
  sqlFiles: Record<string, string>;
  snapshotFiles: Record<string, string>;
};

export type MigrationHistoryResult = {
  currentTag: string;
  currentPrefix: string;
  nextPrefix: string;
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const assertExactFileSet = (actual: string[], expected: string[], label: string) => {
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) {
    throw new Error(
      `${label} files do not match the locked migration manifest. Expected ${sortedExpected.join(", ")}; received ${sortedActual.join(", ")}.`,
    );
  }
};

export const validateMigrationHistory = (
  input: MigrationHistoryInput,
): MigrationHistoryResult => {
  if (input.manifest.version !== 1) {
    throw new Error(`Unsupported migration manifest version ${input.manifest.version}.`);
  }
  if (input.journal.entries.length === 0) {
    throw new Error("Migration journal has no entries.");
  }
  if (input.journal.entries.length !== input.manifest.lockedMigrations.length) {
    throw new Error(
      "Every journal entry must be locked in the migration manifest before preflight can pass.",
    );
  }

  const expectedSqlFiles: string[] = [];
  const expectedSnapshotFiles: string[] = [];

  for (const [position, entry] of input.journal.entries.entries()) {
    const expectedPrefix = position.toString().padStart(4, "0");
    const actualPrefix = entry.tag.match(/^(\d{4})_/)?.[1];
    if (entry.idx !== position || actualPrefix !== expectedPrefix) {
      throw new Error(
        `Historical migration renumber detected at position ${position}: idx=${entry.idx}, tag=${entry.tag}.`,
      );
    }

    const locked = input.manifest.lockedMigrations[position];
    if (!locked || locked.tag !== entry.tag) {
      throw new Error(
        `Locked migration ${position} changed from ${locked?.tag ?? "<missing>"} to ${entry.tag}.`,
      );
    }

    const sqlFileName = `${entry.tag}.sql`;
    const snapshotFileName = `${expectedPrefix}_snapshot.json`;
    expectedSqlFiles.push(sqlFileName);
    expectedSnapshotFiles.push(snapshotFileName);

    const sqlContents = input.sqlFiles[sqlFileName];
    const snapshotContents = input.snapshotFiles[snapshotFileName];
    if (sqlContents === undefined) {
      throw new Error(`Locked migration SQL file is missing: ${sqlFileName}.`);
    }
    if (snapshotContents === undefined) {
      throw new Error(`Locked migration snapshot file is missing: ${snapshotFileName}.`);
    }
    if (sha256(sqlContents) !== locked.sqlSha256) {
      throw new Error(`Locked migration SQL hash changed: ${sqlFileName}.`);
    }
    if (sha256(snapshotContents) !== locked.snapshotSha256) {
      throw new Error(`Locked migration snapshot hash changed: ${snapshotFileName}.`);
    }
  }

  assertExactFileSet(Object.keys(input.sqlFiles), expectedSqlFiles, "Migration SQL");
  assertExactFileSet(Object.keys(input.snapshotFiles), expectedSnapshotFiles, "Migration snapshot");

  const current = input.journal.entries.at(-1)!;
  const currentPrefix = current.tag.slice(0, 4);
  return {
    currentTag: current.tag,
    currentPrefix,
    nextPrefix: (Number(currentPrefix) + 1).toString().padStart(4, "0"),
  };
};
