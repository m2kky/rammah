# Complete CMS Media and Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-ready CMS where administrators manage all displayed media through R2 or external URLs, build standard pages from named sections, manage legal pages, preview drafts, and publish immediately or on a schedule.

**Architecture:** Extend the existing Express/Drizzle CMS with an authoritative section registry, normalized media assignments, an R2 storage adapter, and publication/preview services. Split the oversized Next.js CMS screen into focused editors and render generic pages from resolved public CMS contracts while adapting existing animated pages to named media slots.

**Tech Stack:** Node.js 24.14.0, npm 11.9.0, TypeScript, Express 4, Zod, Drizzle/PostgreSQL, Vitest, AWS SDK v3 for Cloudflare R2, Next.js 16.2.1, React 19.2.4, Tailwind CSS 4, React Markdown, GSAP.

## Global Constraints

- Preserve all unrelated dirty-worktree changes; stage only files owned by the current task.
- Follow red-green-refactor: every production behavior gets a failing test first and the failure must be observed.
- R2 credentials remain API-only; uploads use short-lived presigned URLs and immutable object keys.
- Support `r2`, `external`, and `animation_bundle` media without exposing raw UUID or JSON fields to administrators.
- Existing custom page layouts and animations must remain visually unchanged.
- General pages use only single-segment lowercase slugs and the approved fixed section catalog.
- Rich text is Markdown with raw HTML disabled.
- Draft and archived content is never public; scheduled content becomes public only through the worker.
- Permanent deletion is allowed only for unused archived media.
- Read the relevant Next.js 16 guides under `rammah-next/node_modules/next/dist/docs/` before changing routes, metadata, cookies, or image rendering.

---

## File Map

### API contracts and persistence

- `rammah-api/src/modules/cms/section-definitions.ts` — authoritative section field and media-slot registry.
- `rammah-api/src/modules/cms/cms.types.ts` — shared CMS media/page DTOs used within the API.
- `rammah-api/src/db/schema/index.ts` — media metadata and assignment tables.
- `rammah-api/drizzle/0008_complete_cms_media.sql` — generated schema migration and backfill.
- `rammah-api/src/db/seed.ts` — seed current static media as external assets and assignments.

### API media subsystem

- `rammah-api/src/modules/cms/media-storage.ts` — R2 interface and AWS SDK implementation.
- `rammah-api/src/modules/cms/media-signature.ts` — file-signature checks independent of R2.
- `rammah-api/src/modules/cms/media.service.ts` — upload intent/finalization, usage lookup, archival, deletion.
- `rammah-api/src/modules/cms/media.routes.ts` — focused admin media endpoints mounted below `/admin/cms`.
- `rammah-api/src/modules/cms/animation-bundle.service.ts` — safe ZIP validation and bundle expansion.
- `rammah-api/src/config/env.ts`, `rammah-api/.env.example`, `deploy/.env.example` — validated R2 and preview configuration.

### API pages, preview, publication, and public DTOs

- `rammah-api/src/modules/cms/page-publication.service.ts` — publication validation and scheduled publishing.
- `rammah-api/src/modules/cms/preview-token.ts` — signed, scoped, expiring preview tokens.
- `rammah-api/src/modules/cms/admin-cms.routes.ts` — page/section/legal/SEO CRUD, reorder, preview issuance.
- `rammah-api/src/modules/cms/public-cms.routes.ts` — resolved media, generic pages, legal pages, preview reads.
- `rammah-api/src/worker/product-handlers.ts`, `rammah-api/src/worker/scheduled-jobs.ts` — bundle processing and due-publication jobs.

### Frontend admin

- `rammah-next/lib/api/admin.ts` — typed CMS/media API client.
- `rammah-next/components/admin/AdminCms.tsx` — small CMS shell and tab routing.
- `rammah-next/components/admin/cms/CmsPagesEditor.tsx` — page list and page editor.
- `rammah-next/components/admin/cms/SectionEditor.tsx` — registry-driven named section form.
- `rammah-next/components/admin/cms/MediaLibrary.tsx` — media grid/list, upload, archive, delete.
- `rammah-next/components/admin/cms/MediaPicker.tsx` — choose/upload/external media modal.
- `rammah-next/components/admin/cms/GlobalMediaEditor.tsx` — global named media slots.
- `rammah-next/components/admin/cms/LegalPagesEditor.tsx` — legal CRUD and Markdown preview.
- `rammah-next/components/admin/cms/MarkdownEditor.tsx` — safe reusable Markdown editor.

### Frontend public rendering

- `rammah-next/lib/api/cms.ts` — resolved public media/page/legal DTOs.
- `rammah-next/lib/api/cms-content.ts` — custom-page media selectors and fallbacks.
- `rammah-next/components/cms/GenericPage.tsx` — ordered section renderer.
- `rammah-next/components/cms/sections/HeroSection.tsx`, `RichTextSection.tsx`, `ImageTextSection.tsx`, `ImageSection.tsx`, `VideoSection.tsx`, `GallerySection.tsx`, `CtaSection.tsx`, and `DividerSection.tsx` — one focused component per approved section type.
- `rammah-next/components/cms/SafeMarkdown.tsx` — Markdown safe-subset renderer.
- `rammah-next/app/[slug]/page.tsx` — public generic page route.
- `rammah-next/app/legal/[slug]/page.tsx` — arbitrary legal route.
- `rammah-next/app/cms-preview/route.ts`, `rammah-next/app/preview/[slug]/page.tsx` — one-time token exchange and draft preview.
- Existing custom media consumers under `rammah-next/components/` and `rammah-next/components/about/` / `corporate/` — replace hard-coded rendered media with named assignments.

---

### Task 1: Authoritative Section Registry and Contracts

**Files:**
- Create: `rammah-api/src/modules/cms/section-definitions.ts`
- Create: `rammah-api/src/modules/cms/section-definitions.unit.test.ts`
- Create: `rammah-api/src/modules/cms/cms.types.ts`

**Interfaces:**
- Produces: `SECTION_DEFINITIONS`, `GLOBAL_MEDIA_SLOTS`, `RESERVED_PAGE_SLUGS`, `validateSectionConfig(sectionType, input)`, and DTO types consumed by every later task.

- [ ] **Step 1: Write failing registry tests**

```ts
import { describe, expect, it } from "vitest";
import {
  GLOBAL_MEDIA_SLOTS,
  RESERVED_PAGE_SLUGS,
  SECTION_DEFINITIONS,
  validateSectionConfig,
} from "./section-definitions.js";

describe("CMS section definitions", () => {
  it("defines named media fields for every media-bearing section", () => {
    expect(SECTION_DEFINITIONS.hero.mediaSlots.map((slot) => slot.key)).toEqual([
      "desktopImage", "mobileImage", "video", "poster",
    ]);
    expect(SECTION_DEFINITIONS.gallery.mediaSlots[0]).toMatchObject({ key: "galleryImages", multiple: true });
  });

  it("rejects raw unknown config fields", () => {
    expect(() => validateSectionConfig("video", { autoplay: true, rawHtml: "<script />" })).toThrow("rawHtml");
  });

  it("protects all top-level application routes", () => {
    expect(RESERVED_PAGE_SLUGS).toEqual(expect.arrayContaining(["admin", "booking", "legal", "services", "thank-you"]));
  });

  it("defines every approved global media slot", () => {
    expect(GLOBAL_MEDIA_SLOTS.map((slot) => slot.key)).toEqual([
      "loadingVideo", "loadingPoster", "menuVideo", "defaultOgImage",
    ]);
  });
});
```

- [ ] **Step 2: Run the test and observe the missing-module failure**

Run: `npm run test:unit --workspace=rammah-api -- src/modules/cms/section-definitions.unit.test.ts`

Expected: FAIL because `section-definitions.ts` does not exist.

- [ ] **Step 3: Implement typed definitions and strict validation**

```ts
export type MediaKind = "image" | "video" | "animation_bundle";
export type CmsFieldDefinition = { key: string; label: string; kind: "text" | "markdown" | "url" | "boolean" | "select"; required?: boolean; options?: string[] };
export type CmsMediaSlotDefinition = { key: string; label: string; accepts: MediaKind[]; required?: boolean; multiple?: boolean; posterFor?: string };
export type CmsSectionDefinition = { label: string; fields: CmsFieldDefinition[]; mediaSlots: CmsMediaSlotDefinition[] };

export const RESERVED_PAGE_SLUGS = ["admin", "api", "booking", "blog", "services", "about", "contact", "legal", "privacy", "privacy-policy", "terms", "terms-and-conditions", "thank-you"] as const;
export const GLOBAL_MEDIA_SLOTS: CmsMediaSlotDefinition[] = [
  { key: "loadingVideo", label: "Loading video", accepts: ["video"], required: true },
  { key: "loadingPoster", label: "Loading poster", accepts: ["image"], required: true, posterFor: "loadingVideo" },
  { key: "menuVideo", label: "Menu video", accepts: ["video"] },
  { key: "defaultOgImage", label: "Default social image", accepts: ["image"] },
];
```

Define `hero`, `rich_text`, `image_text`, `image`, `video`, `gallery`, `cta`, and `divider` completely, construct one strict Zod schema per definition, and make `validateSectionConfig` reject unknown keys.

- [ ] **Step 4: Run the registry tests**

Run: `npm run test:unit --workspace=rammah-api -- src/modules/cms/section-definitions.unit.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- rammah-api/src/modules/cms/section-definitions.ts rammah-api/src/modules/cms/section-definitions.unit.test.ts rammah-api/src/modules/cms/cms.types.ts
git commit -m "feat(cms): define section and media contracts"
```

### Task 2: Media Schema and Migration

**Files:**
- Modify: `rammah-api/src/db/schema/index.ts`
- Create: `rammah-api/drizzle/0008_complete_cms_media.sql` via Drizzle generation
- Modify: `rammah-api/drizzle/meta/_journal.json` and generated snapshot
- Create: `rammah-api/src/modules/cms/media-schema.integration.test.ts`

**Interfaces:**
- Consumes: `MediaKind` and slot naming from Task 1.
- Produces: `mediaAssets`, `pageSectionMedia`, and `globalMediaAssignments` persistence contracts.

- [ ] **Step 1: Write a failing database integration test**

```ts
it("stores ordered named media assignments and blocks referenced asset deletion", async () => {
  const [asset] = await testDb.insert(mediaAssets).values({
    fileName: "hero.webp", mimeType: "image/webp", mediaKind: "image",
    sourceType: "external", publicUrl: "https://cdn.example.com/hero.webp",
    sizeBytes: 0, processingStatus: "ready", status: "published",
  }).returning();
  const [page] = await testDb.insert(pages).values({ slug: uniqueSlug("media-page"), title: "Media", status: "draft" }).returning();
  const [section] = await testDb.insert(pageSections).values({ pageId: page.id, sectionType: "hero", config: {}, status: "draft" }).returning();
  await testDb.insert(pageSectionMedia).values({ pageSectionId: section.id, slotKey: "desktopImage", mediaAssetId: asset.id, sortOrder: 0, decorative: false, altTextOverride: "Portrait" });
  await expect(testDb.delete(mediaAssets).where(eq(mediaAssets.id, asset.id))).rejects.toThrow();
});
```

- [ ] **Step 2: Run and observe missing schema exports**

Run: `npm run test:integration --workspace=rammah-api -- src/modules/cms/media-schema.integration.test.ts`

Expected: FAIL because assignment tables and media metadata columns do not exist.

- [ ] **Step 3: Add schema**

Add `sourceType`, `mediaKind`, `processingStatus`, `processingError`, dimensions/duration, nullable `storageKey`, and JSON metadata to `mediaAssets`. Add `publicationError` to pages and legal pages so scheduled validation failures remain actionable. Add unique `(pageSectionId, slotKey, sortOrder)` and `(slotKey, sortOrder)` constraints to assignment tables, indexes on asset IDs, `onDelete: restrict` for assets, and `onDelete: cascade` for owning sections.

```ts
export const pageSectionMedia = pgTable("page_section_media", {
  id: id(),
  pageSectionId: uuid("page_section_id").notNull().references(() => pageSections.id, { onDelete: "cascade" }),
  slotKey: varchar("slot_key", { length: 80 }).notNull(),
  mediaAssetId: uuid("media_asset_id").notNull().references(() => mediaAssets.id, { onDelete: "restrict" }),
  sortOrder: integer("sort_order").notNull().default(0),
  altTextOverride: text("alt_text_override"),
  decorative: boolean("decorative").notNull().default(false),
  createdAt: createdAt(), updatedAt: updatedAt(),
});
```

- [ ] **Step 4: Generate and inspect the migration**

Run: `npm run db:generate --workspace=rammah-api -- --name complete_cms_media`

Expected: `rammah-api/drizzle/0008_complete_cms_media.sql` plus journal/snapshot changes. Do not hand-edit generated snapshot JSON.

- [ ] **Step 5: Run the integration test**

Run: `npm run test:integration --workspace=rammah-api -- src/modules/cms/media-schema.integration.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- rammah-api/src/db/schema/index.ts rammah-api/drizzle rammah-api/src/modules/cms/media-schema.integration.test.ts
git commit -m "feat(cms): persist named media assignments"
```

### Task 3: R2 Upload and File Verification

**Files:**
- Modify: `rammah-api/package.json`, `package-lock.json`
- Modify: `rammah-api/src/config/env.ts`, `rammah-api/src/config/env.*.unit.test.ts`
- Modify: `rammah-api/.env.example`, `deploy/.env.example`
- Create: `rammah-api/src/modules/cms/media-storage.ts`
- Create: `rammah-api/src/modules/cms/media-signature.ts`
- Create: `rammah-api/src/modules/cms/media-storage.unit.test.ts`

**Interfaces:**
- Produces: `MediaStorage` with `createUploadIntent`, `headObject`, `readRange`, `copyObject`, `deleteObjects`, `putObject`; `detectAllowedMedia(bytes, declaredType)`.

- [ ] **Step 1: Add dependencies**

Run: `npm install --workspace=rammah-api @aws-sdk/client-s3 @aws-sdk/s3-request-presigner file-type unzipper && npm install --workspace=rammah-api --save-dev @types/unzipper`

Expected: package manifests and lockfile update successfully.

- [ ] **Step 2: Write failing environment and signature tests**

```ts
it("requires complete R2 configuration when uploads are enabled", () => {
  expect(() => parseEnv(baseEnv({ R2_UPLOADS_ENABLED: "true" }))).toThrow(/R2_ACCESS_KEY_ID/);
});

it("rejects bytes that do not match the declared image type", async () => {
  await expect(detectAllowedMedia(Buffer.from("not an image"), "image/png")).rejects.toThrow("signature");
});
```

- [ ] **Step 3: Run and observe failures**

Run: `npm run test:unit --workspace=rammah-api -- src/config/env.cms-media.unit.test.ts src/modules/cms/media-storage.unit.test.ts`

Expected: FAIL because R2 env fields and signature detection are missing.

- [ ] **Step 4: Implement configuration, adapter, immutable keys, and signature detection**

```ts
export interface MediaStorage {
  createUploadIntent(input: { fileName: string; mimeType: string; sizeBytes: number }): Promise<{ assetId: string; temporaryStorageKey: string; finalStorageKey: string; uploadUrl: string; publicUrl: string; expiresAt: string }>;
  headObject(storageKey: string): Promise<{ sizeBytes: number; contentType: string | null }>;
  readRange(storageKey: string, start: number, end: number): Promise<Uint8Array>;
  copyObject(sourceStorageKey: string, destinationStorageKey: string): Promise<void>;
  putObject(storageKey: string, body: Uint8Array, contentType: string): Promise<void>;
  deleteObjects(storageKeys: string[]): Promise<void>;
}
```

Generate an asset UUID plus `tmp/YYYY/MM/<asset-id>/<sanitized-name>` and `media/<asset-id>/<sanitized-name>` keys, presign only `PutObjectCommand`, cap expiry, require allowlisted image/video/ZIP MIME and the matching byte limit before signing, and use `file-type` plus explicit SVG rejection to validate object bytes.

- [ ] **Step 5: Run tests**

Run: `npm run test:unit --workspace=rammah-api -- src/config/env.cms-media.unit.test.ts src/modules/cms/media-storage.unit.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- package-lock.json rammah-api/package.json rammah-api/src/config rammah-api/.env.example deploy/.env.example rammah-api/src/modules/cms/media-storage.ts rammah-api/src/modules/cms/media-signature.ts rammah-api/src/modules/cms/media-storage.unit.test.ts
git commit -m "feat(cms): add secure R2 upload adapter"
```

### Task 4: Media Library Service and Routes

**Files:**
- Create: `rammah-api/src/modules/cms/media.service.ts`
- Create: `rammah-api/src/modules/cms/media.routes.ts`
- Create: `rammah-api/src/modules/cms/media.service.unit.test.ts`
- Create: `rammah-api/src/modules/cms/media.routes.integration.test.ts`
- Modify: `rammah-api/src/modules/cms/admin-cms.routes.ts`

**Interfaces:**
- Consumes: storage adapter and media tables.
- Produces: upload-intent/finalize, external-create, list, usage, patch, archive, and permanent-delete endpoints.

- [ ] **Step 1: Write failing service tests**

```ts
it("refuses to archive a used asset and returns its named usages", async () => {
  await expect(service.archive(assetId)).rejects.toMatchObject({
    code: "MEDIA_IN_USE",
    details: { usages: [{ ownerType: "page_section", slotKey: "desktopImage" }] },
  });
});

it("deletes R2 objects only after an unused asset is archived", async () => {
  await service.permanentlyDelete(archivedAssetId);
  expect(storage.deleteObjects).toHaveBeenCalledWith(expect.arrayContaining([expect.stringContaining(archivedAssetId)]));
});
```

- [ ] **Step 2: Run and observe missing service**

Run: `npm run test:unit --workspace=rammah-api -- src/modules/cms/media.service.unit.test.ts`

Expected: FAIL because `media.service.ts` does not exist.

- [ ] **Step 3: Implement service and focused router**

Use injected `MediaStorage`, validate HTTPS external URLs without server-side fetching, create a pending database row when issuing an upload intent, verify R2 object size and signature during finalization, copy the verified temporary object to its immutable final key, delete the temporary object, serialize only safe fields, query all assignment and SEO references for usages, and audit archive/delete actions. Remove the legacy media route handlers from `admin-cms.routes.ts` when mounting the focused router so no duplicate routes remain.

```ts
mediaRouter.post("/media-assets/upload-intents", validateRequest({ body: uploadIntentSchema }), createUploadIntent);
mediaRouter.post("/media-assets/finalize", validateRequest({ body: finalizeSchema }), finalizeUpload);
mediaRouter.post("/media-assets/external", validateRequest({ body: externalSchema }), createExternalAsset);
mediaRouter.get("/media-assets", validateRequest({ query: mediaListSchema }), listAssets);
mediaRouter.get("/media-assets/:id/usages", validateRequest({ params: idParamsSchema }), listUsages);
mediaRouter.patch("/media-assets/:id", validateRequest({ params: idParamsSchema, body: mediaPatchSchema }), patchAsset);
mediaRouter.delete("/media-assets/:id", validateRequest({ params: idParamsSchema }), archiveAsset);
mediaRouter.delete("/media-assets/:id/permanent", validateRequest({ params: idParamsSchema }), permanentlyDeleteAsset);
```

- [ ] **Step 4: Add integration tests for status codes and response DTOs**

Test `201` external create, `409 MEDIA_IN_USE`, `422` finalize signature mismatch, and `204` permanent delete for an unused archived external asset.

- [ ] **Step 5: Run media tests**

Run: `npm run test:unit --workspace=rammah-api -- src/modules/cms/media.service.unit.test.ts && npm run test:integration --workspace=rammah-api -- src/modules/cms/media.routes.integration.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- rammah-api/src/modules/cms
git commit -m "feat(cms): expose media library API"
```

### Task 5: Animation Bundle Processing

**Files:**
- Create: `rammah-api/src/modules/cms/animation-bundle.service.ts`
- Create: `rammah-api/src/modules/cms/animation-bundle.service.unit.test.ts`
- Modify: `rammah-api/src/worker/product-handlers.ts`
- Create: `rammah-api/src/worker/cms-handlers.unit.test.ts`

**Interfaces:**
- Produces: `processAnimationBundle(assetId, signal)` and worker topic `cms.media.animation_bundle.process`.

- [ ] **Step 1: Write ZIP safety tests**

```ts
it.each(["../escape.webp", "/absolute.webp", "run.exe"])("rejects unsafe entry %s", async (entry) => {
  await expect(processArchive(makeZip([{ name: entry, bytes: frameBytes }]))).rejects.toThrow("unsafe bundle entry");
});

it("writes ordered frames and a manifest then marks the asset ready", async () => {
  await processAnimationBundle(assetId, AbortSignal.timeout(5_000));
  expect(storage.putObject).toHaveBeenCalledWith(expect.stringMatching(/manifest\.json$/), expect.any(Uint8Array), "application/json");
  expect(repository.markReady).toHaveBeenCalledWith(assetId, expect.objectContaining({ frameCount: 3 }));
});
```

- [ ] **Step 2: Run and observe failure**

Run: `npm run test:unit --workspace=rammah-api -- src/modules/cms/animation-bundle.service.unit.test.ts`

Expected: FAIL because bundle processing is missing.

- [ ] **Step 3: Implement bounded ZIP expansion and worker registration**

Stream entries, reject traversal/absolute/executable/unexpected files, enforce ZIP bytes/expanded bytes/frame count, verify consecutive names and dimensions, write immutable frame objects plus `manifest.json`, delete the source ZIP after success, and persist a safe processing error after failure.

```ts
"cms.media.animation_bundle.process": async (event, { signal }) => {
  await processAnimationBundle(requiredAssetId(event.payload), signal);
},
```

Add that property to the existing `productHandlers` object literal without changing its current calendar, email, hold, payment, or busy-sync handlers.

- [ ] **Step 4: Run bundle and handler tests**

Run: `npm run test:unit --workspace=rammah-api -- src/modules/cms/animation-bundle.service.unit.test.ts src/worker/cms-handlers.unit.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- rammah-api/src/modules/cms/animation-bundle.service.ts rammah-api/src/modules/cms/animation-bundle.service.unit.test.ts rammah-api/src/worker
git commit -m "feat(cms): process animation bundles"
```

### Task 6: Complete Page, Section, SEO, Preview, and Scheduling APIs

**Files:**
- Create: `rammah-api/src/modules/cms/page-publication.service.ts`
- Create: `rammah-api/src/modules/cms/page-publication.service.unit.test.ts`
- Create: `rammah-api/src/modules/cms/preview-token.ts`
- Create: `rammah-api/src/modules/cms/preview-token.unit.test.ts`
- Modify: `rammah-api/src/modules/cms/admin-cms.routes.ts`
- Modify: `rammah-api/src/modules/cms/public-cms.routes.ts`
- Modify: `rammah-api/src/worker/product-handlers.ts`
- Modify: `rammah-api/src/worker/scheduled-jobs.ts`
- Create: `rammah-api/src/modules/cms/pages.integration.test.ts`

**Interfaces:**
- Produces: page/section create/archive/duplicate/reorder, SEO read/upsert, media assignment replacement, preview token, preview read, and scheduled publication.

- [ ] **Step 1: Write publication and preview unit tests**

```ts
it("rejects publishing a hero without required media", async () => {
  await expect(validatePageForPublication(pageId)).rejects.toMatchObject({ code: "CMS_PUBLICATION_INVALID" });
});

it("scopes preview tokens to one page and expiry", () => {
  const token = issuePreviewToken({ pageId, expiresInSeconds: 60 });
  expect(verifyPreviewToken(token, pageId)).toMatchObject({ pageId });
  expect(() => verifyPreviewToken(token, otherPageId)).toThrow("scope");
});
```

- [ ] **Step 2: Run and observe missing services**

Run: `npm run test:unit --workspace=rammah-api -- src/modules/cms/page-publication.service.unit.test.ts src/modules/cms/preview-token.unit.test.ts`

Expected: FAIL because publication and preview services do not exist.

- [ ] **Step 3: Implement page validation and signed preview tokens**

Validate reserved/duplicate slugs, section config, required ready media, alt/decorative rules, poster rules, scheduled dates, and autoplay invariants. Sign tokens with HMAC-SHA256 using `CMS_PREVIEW_SECRET`, include `pageId`, `exp`, and nonce, and compare signatures timing-safely.

- [ ] **Step 4: Add missing routes and transaction boundaries**

```ts
adminCmsRouter.post("/pages", createPage);
adminCmsRouter.delete("/pages/:id", archivePage);
adminCmsRouter.post("/pages/:id/sections", createSection);
adminCmsRouter.post("/pages/:id/sections/:sectionId/duplicate", duplicateSection);
adminCmsRouter.put("/pages/:id/sections/order", reorderSectionsInTransaction);
adminCmsRouter.put("/pages/:id/sections/:sectionId/media", replaceSectionMediaInTransaction);
adminCmsRouter.get("/seo-metadata/:resourceType/:resourceId", getSeoMetadata);
adminCmsRouter.post("/pages/:id/preview-token", issuePagePreviewToken);
publicCmsRouter.get("/preview/pages/:id", requirePreviewToken, getPreviewPage);
```

- [ ] **Step 5: Register idempotent scheduled publishing**

Add a minutely scheduler event `cms.publish-due`; in one transaction lock due scheduled pages/legal pages, revalidate each, publish valid rows, record validation errors for invalid rows, and write one audit event per transition. Re-running the same bucket must not duplicate transitions or audit events.

- [ ] **Step 6: Run CMS API tests**

Run: `npm run test:unit --workspace=rammah-api -- src/modules/cms/page-publication.service.unit.test.ts src/modules/cms/preview-token.unit.test.ts && npm run test:integration --workspace=rammah-api -- src/modules/cms/pages.integration.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- rammah-api/src/modules/cms rammah-api/src/worker rammah-api/src/config/env.ts rammah-api/.env.example deploy/.env.example
git commit -m "feat(cms): complete page publication workflows"
```

### Task 7: Resolve Public Media and Seed Existing Site Assets

**Files:**
- Modify: `rammah-api/src/modules/cms/public-cms.routes.ts`
- Modify: `rammah-api/src/db/seed.ts`
- Create: `rammah-api/src/modules/cms/public-cms.integration.test.ts`

**Interfaces:**
- Produces: public `CmsMedia`, `CmsMediaAssignment`, resolved page sections, `globalMedia`, and legal DTOs.

- [ ] **Step 1: Write failing public contract tests**

```ts
it("returns resolved named media instead of a raw mediaAssetId", async () => {
  const response = await request(app).get(`/api/v1/public/cms/pages/${slug}`).expect(200);
  expect(response.body.data.sections[0].media.desktopImage).toMatchObject({ kind: "image", publicUrl: expect.any(String) });
  expect(response.body.data.sections[0]).not.toHaveProperty("mediaAssetId");
});

it("returns global media slots", async () => {
  const response = await request(app).get("/api/v1/public/cms/media/globals").expect(200);
  expect(response.body.data.loadingVideo.kind).toBe("video");
});
```

- [ ] **Step 2: Run and observe raw-ID failure**

Run: `npm run test:integration --workspace=rammah-api -- src/modules/cms/public-cms.integration.test.ts`

Expected: FAIL because current public routes return `mediaAssetId` only and no global media endpoint.

- [ ] **Step 3: Implement resolved DTO queries and deterministic seeds**

Join assignments to ready, non-archived assets, group by slot/order, apply per-use alt/decorative values, and serialize safe fields only. Seed every currently rendered hard-coded file as an external `/...` asset and assign the homepage/About/Services/Corporate/global slots. Register existing frame manifests as ready animation bundles.

- [ ] **Step 4: Run public contract tests**

Run: `npm run test:integration --workspace=rammah-api -- src/modules/cms/public-cms.integration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- rammah-api/src/modules/cms/public-cms.routes.ts rammah-api/src/modules/cms/public-cms.integration.test.ts rammah-api/src/db/seed.ts
git commit -m "feat(cms): resolve public media assignments"
```

### Task 8: Typed Frontend CMS Client

**Files:**
- Modify: `rammah-next/lib/api/admin.ts`
- Modify: `rammah-next/lib/api/cms.ts`
- Create: `rammah-next/lib/api/cms-contracts.test.ts`

**Interfaces:**
- Consumes: API DTOs from Tasks 1, 4, 6, and 7.
- Produces: all typed admin/public client calls used by UI and renderers.

- [ ] **Step 1: Write failing source-level contract tests**

```ts
it("creates a CMS page through the authenticated admin API", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: page }), { status: 201 })));
  await expect(createAdminCmsPage({ slug: "new-page", title: "New page", template: "default", status: "draft", publishedAt: null })).resolves.toEqual(page);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/admin/cms/pages"), expect.objectContaining({ method: "POST" }));
});
```

- [ ] **Step 2: Run and observe failure**

Run: `npm run test:unit --workspace=rammah-next -- lib/api/cms-contracts.test.ts`

Expected: FAIL because the client functions and resolved DTOs do not exist.

- [ ] **Step 3: Implement exact DTOs and client methods**

```ts
export type CmsMedia = { id: string; kind: "image" | "video" | "animation_bundle"; mimeType: string; publicUrl: string; altText: string | null; decorative: boolean; metadata: Record<string, unknown> };
export type CmsSectionMedia = Record<string, CmsMedia | CmsMedia[]>;
export type MediaUploadIntent = { assetId: string; temporaryStorageKey: string; finalStorageKey: string; uploadUrl: string; publicUrl: string; expiresAt: string };
```

Add create/archive/duplicate/reorder page/section calls, section/global assignments, media CRUD, progress-capable direct `XMLHttpRequest` upload, section definitions, SEO, and preview token calls.

- [ ] **Step 4: Run frontend unit tests**

Run: `npm run test:unit --workspace=rammah-next -- lib/api/cms-contracts.test.ts lib/api/cms-content.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- rammah-next/lib/api/admin.ts rammah-next/lib/api/cms.ts rammah-next/lib/api/cms-contracts.test.ts
git commit -m "feat(cms): add typed media and page clients"
```

### Task 9: Media Library, Picker, and Global Media UI

**Files:**
- Create: `rammah-next/components/admin/cms/MediaLibrary.tsx`
- Create: `rammah-next/components/admin/cms/MediaPicker.tsx`
- Create: `rammah-next/components/admin/cms/GlobalMediaEditor.tsx`
- Create: `rammah-next/lib/admin-media-ui.test.ts`
- Modify: `rammah-next/components/admin/AdminCms.tsx`

**Interfaces:**
- Produces: `<MediaPicker accepts multiple value onChange />`, `<MediaLibrary />`, and `<GlobalMediaEditor />`.

- [ ] **Step 1: Write failing UI contract tests**

```ts
it("renders upload, external URL, replace, and remove actions", () => {
  const html = renderToStaticMarkup(<MediaPicker accepts={["image"]} value={[asset]} onChange={() => undefined} />);
  expect(html).toContain("Upload from device");
  expect(html).toContain("External URL");
  expect(html).toContain("Replace");
  expect(html).toContain("Remove");
});
```

- [ ] **Step 2: Run and observe missing components**

Run: `npm run test:unit --workspace=rammah-next -- lib/admin-media-ui.test.ts`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement media picker and direct upload state machine**

Use explicit states `idle → signing → uploading → finalizing → ready` plus `failed`; preserve selected file and retry action; show percentage from XHR progress; require successful browser preview for external URLs; disable pending/failed/archived choices.

```ts
export type MediaPickerProps = {
  accepts: Array<"image" | "video" | "animation_bundle">;
  multiple?: boolean;
  value: AdminMediaAsset[];
  onChange(value: AdminMediaAsset[]): void;
};
```

- [ ] **Step 4: Implement library and global slots**

Provide search/source/kind/status filters, image/video/bundle previews, usage drawer, archive confirmation, permanent-delete confirmation, and four initial global slots. Never show a UUID input.

- [ ] **Step 5: Run UI contract tests and typecheck**

Run: `npm run test:unit --workspace=rammah-next -- lib/admin-media-ui.test.ts && npm run typecheck --workspace=rammah-next`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- rammah-next/components/admin/AdminCms.tsx rammah-next/components/admin/cms rammah-next/lib/admin-media-ui.test.ts
git commit -m "feat(cms): add media library and picker"
```

### Task 10: Registry-Driven Page and Legal Editors

**Files:**
- Create: `rammah-next/components/admin/cms/CmsPagesEditor.tsx`
- Create: `rammah-next/components/admin/cms/SectionEditor.tsx`
- Create: `rammah-next/components/admin/cms/LegalPagesEditor.tsx`
- Create: `rammah-next/components/admin/cms/MarkdownEditor.tsx`
- Create: `rammah-next/lib/admin-page-editor.test.ts`
- Modify: `rammah-next/components/admin/AdminCms.tsx`

**Interfaces:**
- Consumes: section definitions and `MediaPicker`.
- Produces: create/edit/reorder/duplicate/archive/publish/schedule/preview UI without raw JSON.

- [ ] **Step 1: Write failing editor contract tests**

```ts
it("renders named hero controls without raw config or IDs", () => {
  const html = renderToStaticMarkup(<SectionEditor definition={heroDefinition} section={heroSection} onChange={() => undefined} />);
  expect(html).toContain("Desktop image");
  expect(html).toContain("Mobile image");
  expect(html).not.toContain("Section config JSON");
  expect(html).not.toContain("Media asset ID");
});
```

- [ ] **Step 2: Run and observe current raw-field failure**

Run: `npm run test:unit --workspace=rammah-next -- lib/admin-page-editor.test.ts`

Expected: FAIL because the current `AdminCms.tsx` contains raw config and media ID fields and lacks page creation.

- [ ] **Step 3: Implement focused page and section editors**

Generate controls from the API definitions; use `MediaPicker` for each named slot; validate lower-case single-segment slug and reserved slugs client-side; keep API errors authoritative and field-scoped; add create, duplicate, archive, and complete-list reorder actions; separate Details, SEO, Sections, and Preview controls.

- [ ] **Step 4: Implement Markdown legal editor**

Install `react-markdown`, `remark-gfm`, and `rehype-sanitize`; provide toolbar actions for headings/emphasis/lists/links/tables; do not enable `rehype-raw`; render side-by-side preview with the same public component.

Run: `npm install --workspace=rammah-next react-markdown remark-gfm rehype-sanitize`

- [ ] **Step 5: Run tests and typecheck**

Run: `npm run test:unit --workspace=rammah-next -- lib/admin-page-editor.test.ts && npm run typecheck --workspace=rammah-next`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- package-lock.json rammah-next/package.json rammah-next/components/admin rammah-next/lib/admin-page-editor.test.ts
git commit -m "feat(cms): complete page and legal editors"
```

### Task 11: Generic Public Pages, Legal Routes, and Preview

**Files:**
- Create: `rammah-next/components/cms/SafeMarkdown.tsx`
- Create: `rammah-next/components/cms/GenericPage.tsx`
- Create: `rammah-next/components/cms/sections/HeroSection.tsx`
- Create: `rammah-next/components/cms/sections/RichTextSection.tsx`
- Create: `rammah-next/components/cms/sections/ImageTextSection.tsx`
- Create: `rammah-next/components/cms/sections/ImageSection.tsx`
- Create: `rammah-next/components/cms/sections/VideoSection.tsx`
- Create: `rammah-next/components/cms/sections/GallerySection.tsx`
- Create: `rammah-next/components/cms/sections/CtaSection.tsx`
- Create: `rammah-next/components/cms/sections/DividerSection.tsx`
- Create: `rammah-next/app/[slug]/page.tsx`
- Create: `rammah-next/app/legal/[slug]/page.tsx`
- Create: `rammah-next/app/cms-preview/route.ts`
- Create: `rammah-next/app/preview/[slug]/page.tsx`
- Modify: `rammah-next/components/LegalDocument.tsx`
- Create: `rammah-next/lib/generic-page-rendering.test.ts`

**Interfaces:**
- Consumes: resolved `PublicPage` and `CmsMedia` contracts.
- Produces: public generic pages, arbitrary legal pages, safe Markdown, and token-scoped preview.

- [ ] **Step 1: Read required Next.js guides**

Run: `rg --files rammah-next/node_modules/next/dist/docs | rg 'dynamic-routes|cookies|metadata|image'`

Read the matching App Router guides completely before creating these files.

- [ ] **Step 2: Write failing renderer tests**

```ts
it("maps every approved section type to one renderer", () => {
  expect(Object.keys(SECTION_RENDERERS).sort()).toEqual(["cta", "divider", "gallery", "hero", "image", "image_text", "rich_text", "video"]);
});

it("does not render raw HTML from Markdown", () => {
  expect(renderSafeMarkdown("<script>alert(1)</script>")).not.toContain("<script");
});
```

- [ ] **Step 3: Run and observe missing renderer failure**

Run: `npm run test:unit --workspace=rammah-next -- lib/generic-page-rendering.test.ts`

Expected: FAIL because generic renderers do not exist.

- [ ] **Step 4: Implement public renderers and routes**

Use semantic responsive sections, native `img`/`video` for arbitrary external sources, Next Image only for configured R2/local sources, `muted` and `playsInline` whenever autoplay is true, empty `alt` for decorative images, and safe Markdown without raw HTML. Generate metadata from CMS SEO and return `notFound()` for unavailable pages.

- [ ] **Step 5: Implement one-time preview exchange**

The route handler validates the one-time token with the API, stores the page-scoped token in an HTTP-only, same-site, secure-in-production cookie, redirects to `/preview/<slug>`, sets `noindex`, and offers a toolbar action that clears the preview cookie.

- [ ] **Step 6: Run renderer tests, typecheck, and build**

Run: `npm run test:unit --workspace=rammah-next -- lib/generic-page-rendering.test.ts && npm run typecheck --workspace=rammah-next && npm run build --workspace=rammah-next`

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```powershell
git add -- rammah-next/components/cms rammah-next/app/[slug] rammah-next/app/legal rammah-next/app/cms-preview rammah-next/app/preview rammah-next/components/LegalDocument.tsx rammah-next/lib/generic-page-rendering.test.ts
git commit -m "feat(cms): render generic and preview pages"
```

### Task 12: Bind Every Existing Rendered Media Slot

**Files:**
- Modify: `rammah-next/lib/api/cms-content.ts`
- Modify: `rammah-next/lib/api/cms-content.test.ts`
- Modify: `rammah-next/components/LoadingScreen.tsx`
- Modify: `rammah-next/components/Navbar.tsx`
- Modify: `rammah-next/components/HeroSection.tsx`
- Modify: `rammah-next/components/ServicesSection.tsx`
- Modify: `rammah-next/components/about/AboutExperience.tsx`
- Modify: `rammah-next/components/corporate/CorporateExperience.tsx`
- Modify: `rammah-next/app/services/[slug]/page.tsx`
- Create: `rammah-next/lib/cms-media-inventory.test.ts`

**Interfaces:**
- Consumes: named custom-page/global media assignments.
- Produces: zero rendered content-media paths outside CMS selectors.

- [ ] **Step 1: Write failing inventory and selector tests**

```ts
it("contains no hard-coded rendered content media paths", () => {
  for (const file of renderedMediaConsumers) {
    expect(readFileSync(file, "utf8"), file).not.toMatch(/src=["']\/(?!file\.svg|next\.svg|window\.svg|vercel\.svg)/);
  }
});

it("uses CMS media and preserves the seeded fallback", () => {
  expect(getGlobalMedia(settings).loadingVideo.publicUrl).toBe("/videos/intro-loading.mp4");
  expect(getAboutMedia(page).heroImage.publicUrl).toBe("/about_hero.png");
});
```

- [ ] **Step 2: Run and observe hard-coded path failures**

Run: `npm run test:unit --workspace=rammah-next -- lib/cms-media-inventory.test.ts lib/api/cms-content.test.ts`

Expected: FAIL listing each current hard-coded content image/video.

- [ ] **Step 3: Replace hard-coded media with named props/selectors**

Thread resolved media through server pages into client components. Preserve exact current paths as selector fallbacks until seeds are present. For video `<source>` elements, posters, and canvas frame loaders, use public URLs from the appropriate named slot or bundle manifest. Do not alter animation timing, layout classes, or unrelated dirty changes in these files.

- [ ] **Step 4: Run inventory tests and existing loading tests**

Run: `npm run test:unit --workspace=rammah-next -- lib/cms-media-inventory.test.ts lib/api/cms-content.test.ts lib/loading-screen.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit only owned hunks**

Use `git diff` and interactive staging where files overlap user changes. Never stage unrelated hunks.

```powershell
git add -p -- rammah-next/components/LoadingScreen.tsx rammah-next/components/Navbar.tsx rammah-next/components/about/AboutExperience.tsx
git add -- rammah-next/lib/api/cms-content.ts rammah-next/lib/api/cms-content.test.ts rammah-next/lib/cms-media-inventory.test.ts rammah-next/components/HeroSection.tsx rammah-next/components/ServicesSection.tsx rammah-next/components/corporate/CorporateExperience.tsx rammah-next/app/services/[slug]/page.tsx
git commit -m "feat(cms): bind all displayed media"
```

### Task 13: Production Verification and Operations Documentation

**Files:**
- Modify: `deploy/README.md`
- Modify: `docs/06-engineering/Production-Runbook.md`
- Modify: `rammah-api/src/scripts/production-preflight.ts`
- Create: `rammah-api/src/scripts/production-preflight.cms.unit.test.ts`

**Interfaces:**
- Consumes: all completed features.
- Produces: deployment validation and operator instructions.

- [ ] **Step 1: Write failing preflight tests**

```ts
it("fails production preflight when R2 upload configuration is incomplete", async () => {
  const result = await runPreflight(productionEnv({ R2_BUCKET: "" }));
  expect(result.failures).toContainEqual(expect.objectContaining({ name: "R2_BUCKET" }));
});
```

- [ ] **Step 2: Run and observe failure**

Run: `npm run test:unit --workspace=rammah-api -- src/scripts/production-preflight.cms.unit.test.ts`

Expected: FAIL because CMS media configuration is not checked.

- [ ] **Step 3: Add preflight and operations documentation**

Check credentials, bucket, public base URL, preview secret, size limits, and worker configuration. Document R2 CORS `PUT` from admin origins, public `GET`/`HEAD` and range support, lifecycle cleanup for the temporary prefix, migration/seed order, scheduled worker requirement, backup implications, and permanent-delete recovery limitations.

- [ ] **Step 4: Run complete fresh verification**

Run:

```powershell
npm run test:unit
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits 0 with zero test failures, type errors, lint errors, or build errors.

- [ ] **Step 5: Run targeted rendered-media inventory**

Run:

```powershell
rg -n -e '<Image' -e '<video' -e '<source' -e 'poster=' -e 'new Image' rammah-next/app rammah-next/components
```

Expected: every displayed content-media source comes from a CMS media prop/selector; only documented interface icons and fallbacks remain literal.

- [ ] **Step 6: Commit**

```powershell
git add -- deploy/README.md docs/06-engineering/Production-Runbook.md rammah-api/src/scripts/production-preflight.ts rammah-api/src/scripts/production-preflight.cms.unit.test.ts
git commit -m "docs(cms): document R2 operations and verification"
```

## Final Acceptance Review

- [ ] Direct image/video upload reaches R2 through a presigned URL and is signature-verified.
- [ ] External HTTPS image/video creation requires a successful preview and remains visibly marked external.
- [ ] Animation bundles process safely and preserve current canvas behavior.
- [ ] Every media-bearing section exposes named controls and no raw UUID/JSON fields.
- [ ] Every currently displayed content image/video is CMS-assigned.
- [ ] General and legal pages can be created, edited, previewed, scheduled, published, visited, archived, and safely deleted where applicable.
- [ ] Used assets report usages and cannot be archived or permanently deleted.
- [ ] Draft preview is scoped, expiring, HTTP-only after exchange, and `noindex`.
- [ ] Scheduled publishing is idempotent, audited, and worker-driven.
- [ ] Existing mobile/desktop custom layouts and animations are unchanged.
- [ ] Unit tests, integration tests, typecheck, lint, builds, and production preflight pass with fresh output.
