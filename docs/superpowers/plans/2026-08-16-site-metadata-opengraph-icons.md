# Site Metadata, Open Graph, and Portrait Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every public page complete CMS-aware search/social metadata and replace the browser/app identity with Ahmed's portrait.

**Architecture:** A pure `lib/seo/metadata.ts` module owns URL validation, normalization, metadata precedence, Open Graph, Twitter, robots, and private-page helpers. Existing page loaders continue fetching their own content and pass semantic values into that builder; root layout supplies global settings/media fallbacks. Checked-in portrait-derived assets provide deterministic icons and a social-card fallback when CMS/R2 data is unavailable.

**Tech Stack:** Next.js 16.3 App Router metadata API, React 19, TypeScript 5, Vitest 4, Sharp 0.35, Node 24, CMS/R2 media contracts

## Global Constraints

- `public/hero-final-frame.png` is the approved icon source; facial features must not be redrawn or stylized.
- Open Graph fallback is exactly 1200×630 and includes Ahmed's portrait.
- Page CMS SEO overrides content fallbacks, then global CMS media, then checked-in defaults.
- Production metadata must never resolve to `localhost`.
- `NEXT_PUBLIC_SITE_URL` is the only canonical public origin and must be a pathless HTTP(S) origin.
- Admin, preview, payment, booking status/token, and thank-you routes are `noindex`; tokens never appear in metadata.
- Existing CMS fields and R2 URLs are reused; no database migration or second SEO editor is added.
- Work inline in the current session; do not dispatch subagents.

---

## File Structure

### Create

- `rammah-next/lib/seo/metadata.ts` — pure canonical URL and full metadata builder.
- `rammah-next/lib/seo/metadata.test.ts` — URL, precedence, robots, OG, and Twitter unit tests.
- `rammah-next/scripts/generate-seo-assets.mjs` — deterministic portrait crop, wide card, PNG sizes, and ICO packaging.
- `rammah-next/app/icon.png` — 512×512 portrait icon.
- `rammah-next/app/apple-icon.png` — 180×180 portrait icon.
- `rammah-next/app/opengraph-image.png` — 1200×630 branded portrait fallback.
- `rammah-next/app/manifest.ts` — installable-site identity and icon declarations.
- `rammah-next/app/admin/layout.tsx` — one metadata boundary covering login and protected admin routes.
- `rammah-next/app/booking/payment/layout.tsx` — private metadata boundary for payment and return routes.
- `rammah-next/app/booking/status/layout.tsx` — private metadata boundary for status and token routes.

### Replace

- `rammah-next/app/favicon.ico` — multi-entry 16×16, 32×32, and 48×48 portrait ICO.

### Modify

- `rammah-next/.env.example` — document `NEXT_PUBLIC_SITE_URL`.
- `rammah-next/Dockerfile` — pass the canonical site origin during build.
- `deploy/docker-compose.production.yml` — require the site origin build argument.
- `rammah-next/package.json` and root `package-lock.json` — declare Sharp and the asset-generation script.
- `rammah-next/app/layout.tsx` — site-wide metadata base, title template, defaults, icons, and manifest.
- `rammah-next/lib/api/cms.ts` — expose blog `updatedAt` and SEO `ogImage` already returned by the API.
- `rammah-next/lib/api/cms-content.ts` — route CMS pages through the shared builder.
- `rammah-next/lib/api/cms-content.test.ts` — update the metadata contract assertions.
- `rammah-next/app/[slug]/page.tsx`, `rammah-next/app/legal/[slug]/page.tsx` — remove duplicated partial OG logic.
- `rammah-next/app/blog/page.tsx`, `rammah-next/app/blog/[slug]/page.tsx` — CMS listing and article metadata.
- `rammah-next/app/services/[slug]/page.tsx` — offering-specific metadata.
- `rammah-next/app/booking/page.tsx`, `rammah-next/app/booking/[slug]/page.tsx` — public booking metadata.
- `rammah-next/app/preview/[slug]/page.tsx`, `rammah-next/app/thank-you/page.tsx` — strict private metadata.
- `rammah-next/app/privacy/page.tsx`, `rammah-next/app/terms/page.tsx` — complete canonical legal metadata.

---

### Task 1: Canonical URL and Shared Metadata Builder

**Files:**
- Create: `rammah-next/lib/seo/metadata.ts`
- Create: `rammah-next/lib/seo/metadata.test.ts`
- Modify: `rammah-next/.env.example`
- Modify: `rammah-next/Dockerfile`
- Modify: `deploy/docker-compose.production.yml`

**Interfaces:**
- Produces: `siteUrl(): URL`, `absoluteUrl(value: string): string | null`, `buildMetadata(input: MetadataInput): Metadata`, `privateMetadata(title: string): Metadata`.
- Consumes: Next.js `Metadata`; no API/network access.

- [ ] **Step 1: Write failing URL and metadata tests**

Create tests that set/reset `NEXT_PUBLIC_SITE_URL` and assert:

```ts
expect(siteUrl().href).toBe("https://ahmedrammah.com/");
expect(absoluteUrl("/opengraph-image.png")).toBe("https://ahmedrammah.com/opengraph-image.png");
expect(absoluteUrl("https://r2.example.com/page.png")).toBe("https://r2.example.com/page.png");
expect(buildMetadata({
  title: "About",
  description: "About Ahmed",
  pathname: "/about",
  image: { publicUrl: "/opengraph-image.png", altText: "Ahmed Rammah", width: 1200, height: 630, mimeType: "image/png" },
})).toMatchObject({
  title: "About",
  alternates: { canonical: "https://ahmedrammah.com/about" },
  openGraph: { title: "About", url: "https://ahmedrammah.com/about", siteName: "Ahmed Rammah", type: "website" },
  twitter: { card: "summary_large_image", title: "About" },
});
expect(privateMetadata("Payment")).toMatchObject({
  robots: { index: false, follow: false, noarchive: true },
});
```

- [ ] **Step 2: Run tests and confirm the missing-module failure**

Run: `npm run test:unit --workspace=rammah-next -- lib/seo/metadata.test.ts`  
Expected: FAIL because `lib/seo/metadata.ts` does not exist.

- [ ] **Step 3: Implement the pure builder**

Implement these exact public types and rules:

```ts
export type SeoImage = {
  publicUrl: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
};

export type MetadataInput = {
  title: string;
  description: string;
  pathname: string;
  canonicalUrl?: string | null;
  image?: SeoImage | null;
  noindex?: boolean;
  type?: "website" | "article";
  publishedTime?: string | null;
  modifiedTime?: string | null;
};
```

`siteUrl()` trims the environment value, requires `http:`/`https:`, rejects credentials/query/hash and non-root path, returns `http://localhost:3000` only outside production, and throws `Invalid NEXT_PUBLIC_SITE_URL` otherwise. `absoluteUrl()` accepts same-origin relative paths and external HTTP(S) URLs, rejecting other protocols. `buildMetadata()` normalizes plain text, derives a safe route canonical when a CMS canonical is invalid, emits complete OG/Twitter objects, adds image dimensions only when both are positive, and maps `noindex` to `{ index: false, follow: false }`. `privateMetadata()` adds `noarchive: true` and never accepts a route/token.

- [ ] **Step 4: Wire build-time environment configuration**

Add:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Add `ARG`/`ENV NEXT_PUBLIC_SITE_URL` beside the API URL in the Dockerfile, and add this required build arg:

```yaml
NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL:?Set NEXT_PUBLIC_SITE_URL in Coolify}
```

- [ ] **Step 5: Run focused tests, typecheck, and commit**

Run:

```bash
npm run test:unit --workspace=rammah-next -- lib/seo/metadata.test.ts
npm run typecheck --workspace=rammah-next
```

Expected: PASS. Commit: `feat(seo): add canonical metadata builder`.

### Task 2: Portrait Icon and Social Assets

**Files:**
- Create: `rammah-next/scripts/generate-seo-assets.mjs`
- Create: `rammah-next/app/icon.png`
- Create: `rammah-next/app/apple-icon.png`
- Create: `rammah-next/app/opengraph-image.png`
- Create: `rammah-next/app/manifest.ts`
- Replace: `rammah-next/app/favicon.ico`
- Modify: `rammah-next/package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `rammah-next/public/hero-final-frame.png`.
- Produces: static assets referenced automatically by Next metadata routes plus `/opengraph-image.png`.

- [ ] **Step 1: Add asset verification before generation**

The script must exit non-zero unless the source is 1080×1920 and must verify generated metadata:

```js
assert.deepEqual(await sharp(iconPath).metadata().then(({ width, height }) => ({ width, height })), { width: 512, height: 512 });
assert.deepEqual(await sharp(applePath).metadata().then(({ width, height }) => ({ width, height })), { width: 180, height: 180 });
assert.deepEqual(await sharp(ogPath).metadata().then(({ width, height }) => ({ width, height })), { width: 1200, height: 630 });
assert.equal((await readFile(faviconPath)).subarray(0, 4).toString("hex"), "00000100");
```

- [ ] **Step 2: Create the deterministic asset generator**

Use Sharp with explicit composition:

- square master: `#0F3B46` background, extracted/contained portrait centered so the full head and glasses remain inside circular safe area;
- icon outputs: 512 and 180 PNG;
- favicon outputs: render 16/32/48 PNG buffers and pack them into ICO header/directory entries without a new ICO dependency;
- social card: 1200×630 petrol background, portrait on the right, `AHMED RAMMAH` and `Engineer · Systematizer · Trainer · Coach` on the left, with no text within 60 px of an edge.

Expose `npm run assets:seo --workspace=rammah-next` and declare `sharp` as a direct dev dependency matching the lockfile's installed `0.35.3`.

- [ ] **Step 3: Generate and visually inspect assets**

Run:

```bash
npm run assets:seo --workspace=rammah-next
```

Expected: script prints all four paths and their validated dimensions. Inspect `icon.png`, `apple-icon.png`, and `opengraph-image.png`; the face must be recognizable at 32 px and unchanged from the source.

- [ ] **Step 4: Add the web manifest**

Return a `MetadataRoute.Manifest` containing:

```ts
{
  name: "Ahmed Rammah",
  short_name: "Rammah",
  start_url: "/",
  display: "standalone",
  background_color: "#02040A",
  theme_color: "#0F3B46",
  icons: [
    { src: "/icon.png", sizes: "512x512", type: "image/png" },
    { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
  ],
}
```

- [ ] **Step 5: Verify and commit**

Run `npm run assets:seo --workspace=rammah-next` twice and assert `git diff` is unchanged after the second run. Commit: `feat(seo): add portrait identity assets`.

### Task 3: Root and CMS Page Metadata

**Files:**
- Modify: `rammah-next/app/layout.tsx`
- Modify: `rammah-next/lib/api/cms-content.ts`
- Modify: `rammah-next/lib/api/cms-content.test.ts`
- Modify: `rammah-next/app/[slug]/page.tsx`
- Modify: `rammah-next/app/legal/[slug]/page.tsx`
- Modify: `rammah-next/app/privacy/page.tsx`
- Modify: `rammah-next/app/terms/page.tsx`

**Interfaces:**
- Consumes: `buildMetadata()`, `siteUrl()`, CMS `seo.ogImage`, global `defaultOgImage`.
- Produces: `getPageMetadata(page, fallbackTitle, fallbackDescription, pathname, fallbackImage?)`.

- [ ] **Step 1: Expand CMS metadata tests**

Assert that page OG media overrides the passed fallback; an invalid CMS canonical falls back to the route; `noindex` survives; and the result includes canonical, Open Graph, and Twitter fields.

- [ ] **Step 2: Update `getPageMetadata` and root defaults**

Change the helper signature to:

```ts
export const getPageMetadata = (
  page: PublicPage | null,
  fallbackTitle: string,
  fallbackDescription: string,
  pathname: string,
  fallbackImage?: CmsMedia | null,
): Metadata => buildMetadata({
  title: page?.seo?.metaTitle || page?.title || fallbackTitle,
  description: page?.seo?.metaDescription || fallbackDescription,
  pathname,
  canonicalUrl: page?.seo?.canonicalUrl,
  noindex: page?.seo?.noindex,
  image: page?.seo?.ogImage || fallbackImage || DEFAULT_OG_IMAGE,
});
```

Root `generateMetadata()` fetches settings and global media together, sets `metadataBase`, title `{ default, template: "%s | Ahmed Rammah" }`, application name, description, creator/publisher, manifest, icons, canonical `/`, complete OG, and Twitter using `buildMetadata()`.

- [ ] **Step 3: Update all CMS page callers**

Pass explicit paths to home/about/services/contact/corporate/generic pages. Remove manual `openGraph` blocks from `[slug]` and legal routes. Legal metadata calls `buildMetadata()` with legal SEO fields and `/legal/${slug}`. Privacy and terms use `/privacy` and `/terms` canonicals.

- [ ] **Step 4: Run CMS tests and build checks**

Run:

```bash
npm run test:unit --workspace=rammah-next -- lib/api/cms-content.test.ts lib/seo/metadata.test.ts
npm run typecheck --workspace=rammah-next
npm run lint --workspace=rammah-next
```

Expected: PASS. Commit: `feat(seo): apply metadata to cms pages`.

### Task 4: Blog, Service, and Public Booking Metadata

**Files:**
- Modify: `rammah-next/lib/api/cms.ts`
- Modify: `rammah-next/app/blog/page.tsx`
- Modify: `rammah-next/app/blog/[slug]/page.tsx`
- Modify: `rammah-next/app/services/[slug]/page.tsx`
- Modify: `rammah-next/app/booking/page.tsx`
- Modify: `rammah-next/app/booking/[slug]/page.tsx`
- Test: `rammah-next/lib/seo/metadata.test.ts`

**Interfaces:**
- Consumes: `buildMetadata()` and the existing content/offering fetchers.
- Produces: complete dynamic metadata without changing page rendering.

- [ ] **Step 1: Correct the public blog contract**

Add top-level `updatedAt: string` to `PublicBlogPost` and add `ogImage: CmsMedia | null` inside its existing `seo` object, because the API already returns both through post serialization and `findSeo()`.

- [ ] **Step 2: Add blog metadata**

The listing uses CMS `blog` SEO with `/blog`. The detail page fetches the decoded slug and returns article metadata:

```ts
return buildMetadata({
  title: post.seo?.metaTitle || post.title,
  description: post.seo?.metaDescription || post.excerpt || "Insights from Ahmed Rammah.",
  pathname: `/blog/${post.slug}`,
  canonicalUrl: post.seo?.canonicalUrl,
  image: post.seo?.ogImage,
  noindex: post.seo?.noindex,
  type: "article",
  publishedTime: post.publishedAt,
  modifiedTime: post.updatedAt,
});
```

Missing posts return private/not-found metadata and the page continues calling `notFound()`.

- [ ] **Step 3: Add service and booking metadata**

Service detail and booking detail both reuse `getOffering(slug)`/`fetchPublicOffering(slug)` and build metadata from `title`, `description || subtitle`, and their own canonical path. `/booking` uses stable public copy. No payment/status metadata is added here.

- [ ] **Step 4: Run checks and commit**

Run unit tests, typecheck, and lint. Expected: PASS. Commit: `feat(seo): add entity and booking metadata`.

### Task 5: Private and Transactional Route Indexing

**Files:**
- Create: `rammah-next/app/admin/layout.tsx`
- Create: `rammah-next/app/booking/payment/layout.tsx`
- Create: `rammah-next/app/booking/status/layout.tsx`
- Modify: `rammah-next/app/preview/[slug]/page.tsx`
- Modify: `rammah-next/app/thank-you/page.tsx`

**Interfaces:**
- Consumes: `privateMetadata(title)`.
- Produces: inherited `noindex, nofollow, noarchive` metadata for every sensitive subtree.

- [ ] **Step 1: Add subtree layouts**

Each new layout exports metadata and returns children unchanged:

```tsx
export const metadata = privateMetadata("Booking payment");
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
```

Use titles `Administration`, `Booking payment`, and `Booking status`. The helper receives no pathname or token, preventing accidental disclosure.

- [ ] **Step 2: Strengthen existing private pages**

Replace preview and thank-you metadata with `privateMetadata("CMS preview")` and `privateMetadata("Thank you")`. Do not read `searchParams`, cookies, or route params during metadata generation.

- [ ] **Step 3: Verify route coverage and commit**

Run:

```bash
rg -n "publicToken|booking=" rammah-next/app --glob "*layout.tsx" --glob "*page.tsx"
npm run typecheck --workspace=rammah-next
npm run lint --workspace=rammah-next
```

Inspect every metadata export found by `rg -n "metadata|generateMetadata" rammah-next/app`. Commit: `feat(seo): block indexing of private routes`.

### Task 6: Production Verification and Documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-08-16-site-metadata-opengraph-icons.md` only to mark completed checkboxes during execution.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a production-build and rendered-head evidence set ready for deployment.

- [ ] **Step 1: Run the complete local gate**

Set a production-like origin and run:

```bash
$env:NEXT_PUBLIC_SITE_URL="https://example.com"
npm run test:unit --workspace=rammah-next
npm run test:components --workspace=rammah-next
npm run test:regression:booking --workspace=rammah-next
npm run typecheck --workspace=rammah-next
npm run lint --workspace=rammah-next
npm run build --workspace=rammah-next
```

Expected: every command exits 0 and the build prints no metadata-base/localhost warning.

- [ ] **Step 2: Inspect build output and assets**

Search `.next` for `localhost:3000` while the production-like URL is set; expected: no metadata occurrences. Re-run `assets:seo` and verify icon/OG dimensions and ICO signature.

- [ ] **Step 3: Run representative rendered-head smoke checks**

Start the production server and inspect `/`, `/about`, `/blog`, one blog post, one service, `/booking`, `/booking/<slug>`, `/admin/login`, `/booking/payment/redacted`, `/booking/status/redacted`, and `/thank-you`. Public pages must have canonical + OG + Twitter; private pages must have robots `noindex, nofollow, noarchive`; `redacted` must not appear in metadata fields.

- [ ] **Step 4: Final diff review and commit**

Run `git diff --check`, inspect `git status --short`, and confirm only planned files changed. Commit any verification-only corrections as `fix(seo): complete metadata verification`.

- [ ] **Step 5: Deployment configuration handoff**

Before deployment, set `NEXT_PUBLIC_SITE_URL` in Coolify to the exact Cloudflare-connected public origin, rebuild, then validate the live home/article/service URLs with Facebook Sharing Debugger and LinkedIn Post Inspector plus WhatsApp/X preview smoke checks.
