import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface ApiPackage {
  scripts: Record<string, string>;
}

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as ApiPackage;

describe("test database Compose scripts", () => {
  it.each(["test:db:start", "test:db:wait", "test:db:stop"])(
    "pins the rammah-test project in %s",
    (scriptName) => {
      expect(packageJson.scripts[scriptName]).toMatch(
        /^docker compose --project-name rammah-test -f docker-compose\.test\.yml /,
      );
    },
  );
});
