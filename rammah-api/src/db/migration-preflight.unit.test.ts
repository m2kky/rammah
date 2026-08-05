import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type {
  MigrationHistoryInput,
  MigrationHistoryResult,
} from "./migration-preflight.js";

type ValidateMigrationHistory = (input: MigrationHistoryInput) => MigrationHistoryResult;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const makeValidHistory = (): MigrationHistoryInput => {
  const sql0 = "create table zero(id integer);\n";
  const sql1 = "create table one(id integer);\n";
  const snapshot0 = '{"id":"zero"}\n';
  const snapshot1 = '{"id":"one"}\n';

  return {
    journal: {
      entries: [
        { idx: 0, tag: "0000_zero" },
        { idx: 1, tag: "0001_one" },
      ],
    },
    manifest: {
      version: 1,
      lockedMigrations: [
        {
          tag: "0000_zero",
          sqlSha256: sha256(sql0),
          snapshotSha256: sha256(snapshot0),
        },
        {
          tag: "0001_one",
          sqlSha256: sha256(sql1),
          snapshotSha256: sha256(snapshot1),
        },
      ],
    },
    sqlFiles: {
      "0000_zero.sql": sql0,
      "0001_one.sql": sql1,
    },
    snapshotFiles: {
      "0000_snapshot.json": snapshot0,
      "0001_snapshot.json": snapshot1,
    },
  };
};

const loadValidator = async (): Promise<ValidateMigrationHistory> => {
  const loaded = await import("./migration-preflight.js").catch(() => null);
  return loaded?.validateMigrationHistory ?? (() => ({
    currentTag: "",
    currentPrefix: "",
    nextPrefix: "",
  }));
};

describe("migration history preflight", () => {
  it("reports the current tag and next journal prefix", async () => {
    const validateMigrationHistory = await loadValidator();

    expect(validateMigrationHistory(makeValidHistory())).toEqual({
      currentTag: "0001_one",
      currentPrefix: "0001",
      nextPrefix: "0002",
    });
  });

  it("rejects a historical migration renumber", async () => {
    const validateMigrationHistory = await loadValidator();
    const history = makeValidHistory();
    history.journal.entries[0]!.tag = "0001_zero";

    expect(() => validateMigrationHistory(history)).toThrow(/locked migration|renumber/i);
  });

  it("rejects edits to locked SQL and snapshot contents", async () => {
    const validateMigrationHistory = await loadValidator();
    const changedSql = makeValidHistory();
    changedSql.sqlFiles["0000_zero.sql"] = "drop table zero;\n";
    const changedSnapshot = makeValidHistory();
    changedSnapshot.snapshotFiles["0000_snapshot.json"] = '{"id":"changed"}\n';

    expect(() => validateMigrationHistory(changedSql)).toThrow(/SQL hash/i);
    expect(() => validateMigrationHistory(changedSnapshot)).toThrow(/snapshot hash/i);
  });

  it("requires every journal entry to be locked in the manifest", async () => {
    const validateMigrationHistory = await loadValidator();
    const history = makeValidHistory();
    history.journal.entries.push({ idx: 2, tag: "0002_unlocked" });
    history.sqlFiles["0002_unlocked.sql"] = "select 1;\n";
    history.snapshotFiles["0002_snapshot.json"] = '{"id":"two"}\n';

    expect(() => validateMigrationHistory(history)).toThrow(/manifest|locked/i);
  });
});
