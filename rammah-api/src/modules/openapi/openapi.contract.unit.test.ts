import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as openApiModule from "./openapi.routes.js";

type HttpMethod = "get" | "post" | "patch" | "put" | "delete";
type OpenApiDocument = {
  openapi: string;
  servers: Array<{ url: string }>;
  paths: Record<string, Partial<Record<HttpMethod, unknown>>>;
};

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const httpMethods = new Set<HttpMethod>(["get", "post", "patch", "put", "delete"]);

const normalizePath = (mountPath: string, routePath: string) => {
  const suffix = routePath === "/" ? "" : routePath;
  const joined = `${mountPath}${suffix}`.replace(/\/+/g, "/") || "/";
  return joined.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, "{$1}");
};

const listMountedExpressOperations = () => {
  const appSource = readFileSync(resolve(apiRoot, "src/app.ts"), "utf8");
  const importByRouter = new Map<string, string>();

  for (const match of appSource.matchAll(
    /import\s*\{([^}]+)\}\s*from\s*"([^"]+\.routes\.js)";/gs,
  )) {
    const sourcePath = match[2]!.replace(/\.js$/, ".ts");
    for (const importedName of match[1]!.split(",")) {
      const [name] = importedName.trim().split(/\s+as\s+/);
      if (name) importByRouter.set(name, sourcePath);
    }
  }

  const operations = new Set<string>();
  const mountedRouters = [
    ...appSource.matchAll(
      /app\.use\(\s*`\$\{env\.API_BASE_PATH\}([^`]*)`\s*,\s*(\w+)\s*\);/gs,
    ),
  ];

  expect(mountedRouters.length).toBeGreaterThan(0);

  for (const mount of mountedRouters) {
    const mountPath = mount[1]!;
    const routerName = mount[2]!;
    const relativeSource = importByRouter.get(routerName);
    if (!relativeSource) {
      throw new Error(`Cannot resolve source import for mounted router ${routerName}`);
    }

    const routerSource = readFileSync(resolve(apiRoot, "src", relativeSource), "utf8");
    const routePattern = /\b(\w+)\.(get|post|patch|put|delete)\(\s*["'`]([^"'`]*)["'`]/g;
    const matches = [...routerSource.matchAll(routePattern)].filter(
      (route) => route[1] === routerName,
    );

    if (matches.length === 0) {
      throw new Error(`Mounted router ${routerName} has no literal HTTP routes`);
    }

    for (const route of matches) {
      const method = route[2]!.toUpperCase();
      operations.add(`${method} ${normalizePath(mountPath, route[3]!)}`);
    }
  }

  return [...operations].sort();
};

const listOpenApiOperations = (document: OpenApiDocument) =>
  Object.entries(document.paths)
    .flatMap(([path, pathItem]) =>
      Object.keys(pathItem)
        .filter((method): method is HttpMethod => httpMethods.has(method as HttpMethod))
        .map((method) => `${method.toUpperCase()} ${path}`),
    )
    .sort();

describe("OpenAPI contract", () => {
  it("exports one OpenAPI 3.1 document at the configured API base path", () => {
    const document = (openApiModule as unknown as { openApiDocument?: OpenApiDocument })
      .openApiDocument;

    expect(document).toBeDefined();
    expect(document?.openapi).toBe("3.1.0");
    expect(document?.servers).toEqual([{ url: "/api/v1" }]);
  });

  it("documents every mounted literal Express operation without stale operations", () => {
    const document = (openApiModule as unknown as { openApiDocument?: OpenApiDocument })
      .openApiDocument;
    if (!document) throw new Error("OpenAPI document is not exported");

    expect(listOpenApiOperations(document)).toEqual(listMountedExpressOperations());
  });
});
