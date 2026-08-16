# CMS SEO and Blog Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete SEO controls across CMS resources and add a usable blog manager with featured-image delivery to the public blog.

**Architecture:** Reuse the existing SEO metadata, blog, and media APIs. Add a focused shared `SeoEditor`, a focused `BlogEditor`, typed client functions, narrow server validation, and a resolved public `featuredMedia` contract. No database migration is required.

**Tech Stack:** Next.js 16, React 19, TypeScript, Express, Zod, Drizzle ORM, Vitest, Testing Library.

## Global Constraints

- Keep the existing ready-made CMS section architecture and media library.
- Use resource types `page`, `legal_page`, and `blog_post` exactly.
- Blog content remains Markdown.
- Scheduled blog posts require `publishedAt`.
- Blog category and post slugs use `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- Do not add a database migration or a new route family.

---

### Task 1: Harden blog API contracts and resolve featured media

**Files:**
- Modify: `rammah-api/src/modules/cms/admin-cms.routes.ts`
- Modify: `rammah-api/src/modules/cms/public-cms.routes.ts`
- Modify: `rammah-api/src/modules/cms/public-cms.integration.test.ts`

**Interfaces:**
- Consumes: existing `cmsSlugSchema`, `mediaAssets`, and `cmsMedia()`.
- Produces: public blog responses with `featuredMedia: CmsMedia | null` and validated admin payloads.

- [ ] **Step 1: Write failing API tests**

Extend the public CMS integration test with a published blog post linked to a ready image and assert:

```ts
expect(postBody.data.featuredMedia).toMatchObject({
  kind: "image",
  publicUrl: "https://media.example.test/blog.webp",
});
expect(JSON.stringify(postBody)).not.toContain("storageKey");
```

Add route-schema coverage showing invalid slugs and scheduled posts without `publishedAt` return `422`.

- [ ] **Step 2: Run tests to verify RED**

Run: `npm run test:integration --workspace=rammah-api -- src/modules/cms/public-cms.integration.test.ts`

Expected: FAIL because `featuredMedia` is absent and blog schemas accept invalid scheduling input.

- [ ] **Step 3: Implement minimal API changes**

Use `cmsSlugSchema` for both blog slugs. Add `assertBlogPublicationSchedule` and call it before create inserts and after merging an existing post with a PATCH payload:

```ts
const assertBlogPublicationSchedule = (value: {
  status: z.infer<typeof contentStatusSchema>;
  publishedAt?: string | Date | null;
}) => {
  if (value.status === "scheduled" && !value.publishedAt) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Choose a publication time for a scheduled post.",
      statusCode: httpStatus.unprocessableEntity,
      details: [{ field: "publishedAt", message: "Choose a publication time." }],
    });
  }
};
```

Resolve featured images in one batched query using `inArray`, restricted to image assets that are ready and non-archived. Attach the mapped result to list and detail responses as `featuredMedia`.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm run test:integration --workspace=rammah-api -- src/modules/cms/public-cms.integration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rammah-api/src/modules/cms/admin-cms.routes.ts rammah-api/src/modules/cms/public-cms.routes.ts rammah-api/src/modules/cms/public-cms.integration.test.ts
git commit -m "feat(cms): validate blog publishing and resolve featured media"
```

### Task 2: Add typed blog admin clients

**Files:**
- Modify: `rammah-next/lib/api/admin.ts`
- Modify: `rammah-next/lib/api/cms.ts`
- Modify: `rammah-next/lib/api/cms-contracts.test.ts`

**Interfaces:**
- Produces: `AdminBlogCategory`, `AdminBlogCategoryPayload`, `AdminBlogPost`, `AdminBlogPostPayload`, CRUD client functions, and `PublicBlogPost.featuredMedia`.

- [ ] **Step 1: Write failing client contract tests**

Add calls such as:

```ts
await createAdminBlogPost({
  categoryId: null,
  title: "A post",
  slug: "a-post",
  excerpt: null,
  body: "Body",
  featuredMediaAssetId: null,
  status: "draft",
  publishedAt: null,
});
expect(fetchMock).toHaveBeenCalledWith(
  expect.stringContaining("/admin/cms/blog/posts"),
  expect.objectContaining({ method: "POST", credentials: "include" }),
);
```

Also assert `fetchPublicBlogPosts()` preserves the resolved `featuredMedia` object.

- [ ] **Step 2: Run client test to verify RED**

Run: `npm run test:unit --workspace=rammah-next -- lib/api/cms-contracts.test.ts`

Expected: FAIL because blog admin types/functions and `featuredMedia` are missing.

- [ ] **Step 3: Implement typed clients**

Add list/create/update/archive clients for `/admin/cms/blog/categories` and `/admin/cms/blog/posts`. Use `AdminContentStatus`, ISO strings, nullable category/media IDs, and partial payloads for PATCH.

- [ ] **Step 4: Run client test to verify GREEN**

Run: `npm run test:unit --workspace=rammah-next -- lib/api/cms-contracts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rammah-next/lib/api/admin.ts rammah-next/lib/api/cms.ts rammah-next/lib/api/cms-contracts.test.ts
git commit -m "feat(cms): add typed blog administration clients"
```

### Task 3: Build and integrate the shared SEO editor

**Files:**
- Create: `rammah-next/components/admin/cms/SeoEditor.tsx`
- Create: `rammah-next/components/admin/cms/SeoEditor.test.tsx`
- Modify: `rammah-next/components/admin/cms/CmsPagesEditor.tsx`
- Modify: `rammah-next/components/admin/cms/LegalPagesEditor.tsx`

**Interfaces:**
- Consumes: `fetchAdminSeoMetadata`, `saveAdminSeoMetadata`, `fetchAdminMediaAssets`, and `MediaPicker`.
- Produces: `SeoEditor({ resourceType, resourceId })`.

- [ ] **Step 1: Write failing component tests**

Cover loading metadata, entering a canonical URL, selecting/removing an image, toggling noindex, and saving this exact payload:

```ts
expect(apiMocks.saveAdminSeoMetadata).toHaveBeenCalledWith({
  resourceType: "page",
  resourceId: PAGE_ID,
  metaTitle: "Title",
  metaDescription: "Description",
  canonicalUrl: "https://example.com/custom",
  ogImageAssetId: IMAGE_ID,
  noindex: true,
});
```

- [ ] **Step 2: Run component test to verify RED**

Run: `npm run test:components --workspace=rammah-next -- components/admin/cms/SeoEditor.test.tsx`

Expected: FAIL because `SeoEditor` does not exist.

- [ ] **Step 3: Implement `SeoEditor`**

The component loads SEO metadata and image assets independently, initializes null-safe fields, keeps form state on errors, uses `<MediaPicker accepts={["image"]} />`, and shows `SEO saved.` only after a successful save.

- [ ] **Step 4: Integrate pages and legal pages**

Replace page-local SEO state and methods with:

```tsx
{selectedPage ? <SeoEditor resourceType="page" resourceId={selectedPage.id} /> : null}
```

Add below the legal content editor:

```tsx
{selected ? <SeoEditor resourceType="legal_page" resourceId={selected.id} /> : null}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm run test:components --workspace=rammah-next -- components/admin/cms/SeoEditor.test.tsx`

Run: `npm run typecheck --workspace=rammah-next`

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add rammah-next/components/admin/cms/SeoEditor.tsx rammah-next/components/admin/cms/SeoEditor.test.tsx rammah-next/components/admin/cms/CmsPagesEditor.tsx rammah-next/components/admin/cms/LegalPagesEditor.tsx
git commit -m "feat(cms): add shared seo controls"
```

### Task 4: Add blog management to the CMS

**Files:**
- Create: `rammah-next/components/admin/cms/BlogEditor.tsx`
- Create: `rammah-next/components/admin/cms/BlogEditor.test.tsx`
- Modify: `rammah-next/components/admin/AdminCms.tsx`

**Interfaces:**
- Consumes: Task 2 blog clients, `MarkdownEditor`, `MediaPicker`, and Task 3 `SeoEditor`.
- Produces: a `Blog` CMS view with category and post management.

- [ ] **Step 1: Write failing blog component tests**

Test:

```ts
expect(screen.getByRole("button", { name: "Create post" })).toBeDisabled();
```

until valid title, slug, and body are present; scheduled posts additionally need a publication time. Verify featured image ID is sent, save failures retain input, and category archive calls `archiveAdminBlogCategory` only after confirmation.

- [ ] **Step 2: Run component test to verify RED**

Run: `npm run test:components --workspace=rammah-next -- components/admin/cms/BlogEditor.test.tsx`

Expected: FAIL because `BlogEditor` does not exist.

- [ ] **Step 3: Implement `BlogEditor`**

Use two clearly labelled panels/tabs: `Posts` and `Categories`. Keep separate busy/error states, filter archived rows from the active lists, and retain the selected form on API failures. Use the existing date conversion pattern from `CmsPagesEditor`.

- [ ] **Step 4: Register the Blog CMS view**

Extend the union and view map:

```ts
type CmsView = "pages" | "media" | "global" | "legal" | "blog" | "navigation" | "settings";
```

Render `<BlogEditor />` for the `blog` view.

- [ ] **Step 5: Run component tests and typecheck**

Run: `npm run test:components --workspace=rammah-next -- components/admin/cms/BlogEditor.test.tsx components/admin/cms/SeoEditor.test.tsx`

Run: `npm run typecheck --workspace=rammah-next`

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add rammah-next/components/admin/AdminCms.tsx rammah-next/components/admin/cms/BlogEditor.tsx rammah-next/components/admin/cms/BlogEditor.test.tsx
git commit -m "feat(cms): add blog management"
```

### Task 5: Render configured blog images publicly

**Files:**
- Modify: `rammah-next/app/blog/page.tsx`
- Modify: `rammah-next/app/blog/[slug]/page.tsx`
- Create: `rammah-next/components/blog/BlogFeaturedImage.tsx`
- Create: `rammah-next/components/blog/BlogFeaturedImage.test.tsx`

**Interfaces:**
- Consumes: `PublicBlogPost.featuredMedia` from Task 2.
- Produces: a reusable optional featured image with safe alt text and dimensions.

- [ ] **Step 1: Write failing rendering tests**

```tsx
render(<BlogFeaturedImage media={image} priority={false} />);
expect(screen.getByRole("img", { name: "Article cover" })).toHaveAttribute(
  "src",
  "https://media.example.test/blog.webp",
);
```

Also assert `media={null}` renders nothing.

- [ ] **Step 2: Run test to verify RED**

Run: `npm run test:components --workspace=rammah-next -- components/blog/BlogFeaturedImage.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement and integrate the image**

Use a plain responsive `<img>` because media can come from arbitrary verified external HTTPS origins that are not known at build time. Render the image in each list card and between the detail header and Markdown body only when configured.

- [ ] **Step 4: Run tests and build-facing checks**

Run: `npm run test:components --workspace=rammah-next -- components/blog/BlogFeaturedImage.test.tsx`

Run: `npm run typecheck --workspace=rammah-next`

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add rammah-next/app/blog/page.tsx rammah-next/app/blog/[slug]/page.tsx rammah-next/components/blog/BlogFeaturedImage.tsx rammah-next/components/blog/BlogFeaturedImage.test.tsx
git commit -m "feat(blog): render cms featured images"
```

### Task 6: CMS regression verification

**Files:**
- Modify only files required by failures directly caused by Tasks 1-5.

- [ ] **Step 1: Run CMS/API test suites**

Run: `npm run test:unit --workspace=rammah-next`

Run: `npm run test:components --workspace=rammah-next`

Run: `npm run test:unit --workspace=rammah-api`

Run: `npm run test:integration --workspace=rammah-api`

Expected: all exit 0.

- [ ] **Step 2: Run static checks**

Run: `npm run lint`

Run: `npm run typecheck`

Expected: both exit 0.
