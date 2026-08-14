import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("API tooling contract", () => {
  it("keeps every documented contract and test-migration command executable", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(apiRoot, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(packageJson.scripts).toMatchObject({
      "openapi:check": "vitest run --config vitest.config.ts src/modules/openapi/openapi.contract.unit.test.ts",
      "db:migrate:test": "tsx src/scripts/migrate-test-database.ts",
      "db:migrations:preflight": "tsx src/scripts/migration-preflight.ts",
    });
    expect(existsSync(resolve(apiRoot, "src/scripts/migrate-test-database.ts"))).toBe(true);
    expect(existsSync(resolve(apiRoot, "src/scripts/migration-preflight.ts"))).toBe(true);
  });
});
