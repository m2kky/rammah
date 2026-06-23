import { and, eq } from "drizzle-orm";
import { db, pool } from "../db/client.js";
import {
  auditLogs,
  emailDeliveries,
  legalPages,
  quoteRequests,
} from "../db/schema/index.js";

const baseUrl = process.env.SMOKE_API_BASE_URL ?? "http://localhost:4000/api/v1";
const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? process.env.ADMIN_SEED_EMAIL ?? "admin@rammah.local";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? process.env.ADMIN_SEED_PASSWORD ?? "ChangeMe123!";
const mutate = process.env.SMOKE_MUTATE === "true";

type SmokeState = {
  adminCookie?: string;
  legalPageId?: string;
  quoteRequestId?: string;
};

const state: SmokeState = {};

const ensure = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const readJson = async (response: Response) => {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
};

const request = async (
  path: string,
  options: RequestInit & { auth?: boolean } = {},
) => {
  const headers = new Headers(options.headers);

  if (options.auth) {
    if (!state.adminCookie) {
      throw new Error("Admin cookie is missing.");
    }
    headers.set("Cookie", state.adminCookie);
  }

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return { response, payload };
};

const cleanup = async () => {
  if (state.quoteRequestId) {
    await db.delete(emailDeliveries).where(eq(emailDeliveries.resourceId, state.quoteRequestId));
    await db.delete(auditLogs).where(eq(auditLogs.resourceId, state.quoteRequestId));
    await db.delete(quoteRequests).where(eq(quoteRequests.id, state.quoteRequestId));
  }

  if (state.legalPageId) {
    await db.delete(auditLogs).where(eq(auditLogs.resourceId, state.legalPageId));
    await db.delete(legalPages).where(eq(legalPages.id, state.legalPageId));
  }
};

const run = async () => {
  const results: Array<{ name: string; ok: true }> = [];

  await request("/health/live");
  results.push({ name: "health", ok: true });

  const offerings = await request("/public/offerings");
  ensure(Array.isArray(offerings.payload?.data), "Public offerings did not return an array.");
  results.push({ name: "public offerings", ok: true });

  const openApi = await request("/openapi.json");
  ensure(openApi.payload?.openapi === "3.1.0", "OpenAPI document version is invalid.");
  ensure(Object.keys(openApi.payload?.paths ?? {}).length > 0, "OpenAPI document has no paths.");
  results.push({ name: "openapi", ok: true });

  const login = await request("/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const setCookie = login.response.headers.get("set-cookie");
  state.adminCookie = setCookie?.split(";")[0];
  ensure(state.adminCookie, "Admin login did not return a cookie.");
  results.push({ name: "admin login", ok: true });

  const me = await request("/admin/auth/me", { auth: true });
  ensure(me.payload?.data?.admin?.email === adminEmail, "Admin /me returned unexpected user.");
  results.push({ name: "admin me", ok: true });

  const cmsSettings = await request("/public/cms/settings");
  ensure("data" in cmsSettings.payload, "CMS settings response is malformed.");
  results.push({ name: "public cms settings", ok: true });

  if (mutate) {
    const slug = `legal-smoke-${Date.now()}`;
    const legal = await request("/admin/cms/legal-pages", {
      method: "POST",
      auth: true,
      body: JSON.stringify({
        slug,
        title: "Smoke Legal Page",
        body: "Temporary smoke legal page.",
        status: "published",
        publishedAt: new Date().toISOString(),
      }),
    });
    state.legalPageId = legal.payload?.data?.id;
    ensure(state.legalPageId, "Legal page create did not return an id.");

    await request(`/public/cms/legal/${slug}`);

    await request(`/admin/cms/legal-pages/${state.legalPageId}`, {
      method: "DELETE",
      auth: true,
    });
    results.push({ name: "cms legal create/read/archive", ok: true });

    const quote = await request("/public/quote-requests", {
      method: "POST",
      body: JSON.stringify({
        fullName: "Smoke Quote",
        email: "smoke-quote@example.com",
        message: "Temporary smoke quote.",
      }),
    });
    state.quoteRequestId = quote.payload?.data?.id;
    ensure(state.quoteRequestId, "Quote request create did not return an id.");
    if (!state.quoteRequestId) {
      throw new Error("Quote request id is missing.");
    }
    const quoteRequestId = state.quoteRequestId;

    await request(`/admin/quote-requests/${quoteRequestId}`, { auth: true });
    await request(`/admin/quote-requests/${quoteRequestId}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ status: "reviewing", adminNotes: "smoke note" }),
    });
    results.push({ name: "quote create/admin update", ok: true });

    const quoteDeliveries = await db
      .select({ id: emailDeliveries.id, status: emailDeliveries.status })
      .from(emailDeliveries)
      .where(
        and(
          eq(emailDeliveries.resourceType, "quote_request"),
          eq(emailDeliveries.resourceId, quoteRequestId),
        ),
      );
    ensure(quoteDeliveries.length >= 1, "Quote smoke did not create email delivery rows.");
    results.push({ name: "email delivery record", ok: true });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        mutate,
        checks: results.map((result) => result.name),
      },
      null,
      2,
    ),
  );
};

run()
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => {
      console.error(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
    await pool.end();
  });
