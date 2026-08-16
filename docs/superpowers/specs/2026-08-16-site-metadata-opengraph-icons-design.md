# Site Metadata, Open Graph, and Portrait Icons — Design Specification

**Date:** 2026-08-16  
**Status:** Approved for implementation planning  
**Scope:** Public Next.js pages, CMS SEO fields, social sharing cards, browser/app icons, and private-route indexing rules

## 1. Outcome

Every public page exposes complete, absolute, page-specific metadata for search engines and social platforms. CMS editors remain in control of each page's title, description, canonical URL, indexing flag, and Open Graph image. When a page does not define a value, the site uses safe global defaults instead of missing tags or `localhost` URLs.

The site identity uses Ahmed's real portrait. A close face crop from `public/hero-final-frame.png` becomes the browser/favicon and app icon. Social cards use a wide branded composition with Ahmed's portrait, while a page-specific CMS image overrides that default.

## 2. Approved Visual Direction

1. Use `public/hero-final-frame.png` as the source for favicon and app icons because the face is centered, clear, and readable at small sizes.
2. Produce a tight square face crop with enough padding to survive circular browser and mobile masks.
3. Keep the portrait natural; do not redraw, stylize, or change facial features.
4. Use the site's existing dark/petrol visual identity behind transparent areas so the icon remains visible on light and dark browser chrome.
5. Produce a default 1200×630 Open Graph image using Ahmed's portrait, site name, and restrained brand treatment.
6. Keep text and the face inside the central safe area so WhatsApp, Facebook, LinkedIn, X, and other clients can crop without losing the subject.

Rejected alternatives:

- Reusing the uncropped full-height portrait as the favicon: the face becomes unreadable at 16–32 px.
- Using a letter mark instead of the portrait: rejected by product direction.
- Creating a separate hard-coded social card for every route: high maintenance and would duplicate CMS control.

## 3. Verified Current State

Verified against the repository on 2026-08-16:

| Area | Current behavior | Required change |
|---|---|---|
| Root metadata | Title, description, and one Open Graph image | Add metadata base, title template, full OG fields, Twitter card, robots, icons, and manifest |
| Absolute media URLs | Next production build falls back to `localhost` when resolving metadata assets | Introduce one canonical site URL and require it in production |
| CMS SEO | Pages already store title, description, canonical, noindex, and OG image | Reuse these fields through one shared metadata builder |
| Global media | CMS already exposes `defaultOgImage` with a static fallback | Preserve this as the global social-image fallback |
| Generic/legal pages | Only some routes add an OG image | Normalize through the shared builder |
| Blog/service details | Dynamic entity pages do not have complete dynamic metadata | Build metadata from the loaded entity and its media |
| Booking/private routes | Metadata and indexing behavior are inconsistent | Give entry pages useful metadata and mark transactional/token/admin routes `noindex` |
| Favicon | Existing `favicon.ico` is a single 32×32 asset and does not use the approved portrait | Replace with a portrait-derived multi-size icon set |

## 4. Metadata Architecture

Add one server-only metadata utility under the Next application, for example `lib/seo/metadata.ts`. Pages pass semantic inputs rather than manually assembling Open Graph objects.

The builder accepts:

- title;
- description;
- pathname or canonical override;
- optional Open Graph image;
- page type (`website` or `article`);
- indexing policy;
- optional article publication/modification details.

It returns a complete Next.js `Metadata` object containing:

- title using the root title template;
- description;
- canonical alternate;
- robots directives;
- Open Graph title, description, URL, site name, locale, type, and image;
- X/Twitter `summary_large_image` title, description, and image.

The root layout owns only site-wide defaults and identity. Individual routes use the shared builder for overrides.

## 5. Value Precedence

For CMS pages, resolve values in this order:

1. Page-specific CMS SEO value.
2. Page/content value such as heading, excerpt, or summary.
3. Global site default.

For social images:

1. Page-specific CMS `ogImage`.
2. Content-owned image where appropriate, such as a blog cover or service image.
3. CMS global `defaultOgImage`.
4. Checked-in branded default Open Graph image.

An unavailable CMS/API response must never remove the basic metadata. The checked-in title, description, portrait card, and icon set remain valid fallbacks.

## 6. Canonical Site URL

Add `NEXT_PUBLIC_SITE_URL` as the single canonical website origin.

Rules:

- Production startup/build validation rejects a missing, non-HTTP(S), or path-bearing value.
- Normalize to an origin without a trailing slash.
- Development may fall back to `http://localhost:3000`.
- Set Next's `metadataBase` from this value.
- Resolve canonical URLs and relative image URLs against it.
- Preserve already absolute R2/CMS image URLs.
- Never infer the public site origin from the API URL, payment return URL, proxy headers, or request host.

The production value will be set in Coolify after the domain value is confirmed.

## 7. Route Policy

| Route family | Metadata source | Indexing |
|---|---|---|
| `/`, `/about`, `/services`, `/contact` | CMS SEO with content/global fallbacks | Index |
| CMS generic pages and `/legal/[slug]` | CMS SEO and CMS OG image | Respect CMS `noindex` |
| `/blog` | Stable listing metadata and global image | Index |
| `/blog/[slug]` | Post title, excerpt, cover/OG image, article dates | Index unless content is unavailable/unpublished |
| `/services/[slug]` and fixed service pages | Service/CMS title, description, and image | Index |
| `/booking` and `/booking/[slug]` | Public booking/offering metadata | Index |
| Payment, payment return, booking status/token, and thank-you routes | Minimal contextual title and global image | `noindex, nofollow` |
| `/admin/**`, `/preview/**`, and admin login | Minimal internal title | `noindex, nofollow, noarchive` |
| Privacy/terms aliases | Canonicalize to the selected primary legal route | Index only the canonical route; aliases are noindex or redirected |
| Not-found/error states | Stable site metadata | `noindex` where Next allows route-level control |

Secret/public tokens must never appear in titles, descriptions, canonical URLs, Open Graph URLs, or image URLs.

## 8. Icon and Manifest Assets

Generate and check in:

- `app/icon.png` at 512×512 for modern browsers and manifest use;
- `app/apple-icon.png` at 180×180;
- `app/favicon.ico` containing at least 16×16, 32×32, and 48×48 portrait crops;
- a web manifest with the site name, short name, theme/background colors, and portrait icons.

The 16 px variant may use a slightly tighter crop and increased local contrast, but it must remain recognizably the same photograph. Transparent edges must not cause a black square or invisible silhouette in browsers.

## 9. Open Graph Asset Contract

The checked-in default social image must be:

- exactly 1200×630;
- PNG, JPEG, or WebP supported by the consuming platforms;
- reasonably compressed without visible face artifacts;
- accompanied by width, height, MIME type, and descriptive alt text in metadata.

CMS-uploaded OG images remain allowed. When their dimensions are known, include them. When dimensions are unknown, still emit the absolute image URL and alt text without inventing dimensions.

The default image is a fallback, not a replacement for CMS control.

## 10. CMS Compatibility

No CMS database migration is required. Existing fields remain authoritative:

- `metaTitle`;
- `metaDescription`;
- `canonicalUrl`;
- `noindex`;
- `ogImage`;
- global `defaultOgImage`.

The implementation extends the existing content adapters so they return the information needed by the shared builder. It must not add a second SEO editor or duplicate media storage. R2-backed absolute URLs are consumed directly.

## 11. Accessibility and Content Rules

- Social-image alt text describes the page or identifies Ahmed Rammah; it does not repeat keyword lists.
- Titles remain human-readable and avoid duplicate site-name suffixes.
- Descriptions are plain text with whitespace normalized and markup removed.
- Missing descriptions fall back to a stable site description.
- Arabic and English content remain valid UTF-8 and are not transliterated.
- Open Graph locale follows the page locale when known and otherwise uses the site's current default.

## 12. Failure Handling

- CMS unavailable: emit static site defaults and the checked-in social image.
- Broken page-specific image: metadata still contains the global/default image where the failure is known server-side.
- Missing content record: use Next's not-found behavior and do not publish indexable placeholder metadata.
- Invalid canonical URL from CMS: ignore it and use the route-derived canonical URL.
- Invalid or unsupported social-image URL: reject/ignore it in the adapter and use the next fallback.
- Missing production site URL: fail validation rather than shipping `localhost` metadata.

## 13. Testing and Verification

Add automated coverage for:

1. Canonical origin normalization and production validation.
2. CMS/page/global precedence for title, description, canonical, noindex, and image.
3. Relative R2/static and already absolute image URL handling.
4. Complete Open Graph and Twitter objects from the shared builder.
5. Blog and service dynamic metadata.
6. `noindex` policies for admin, preview, payment, tokenized status, and thank-you routes.
7. Token values never leaking into metadata.
8. Root fallback behavior when the CMS call fails.

Release verification requires:

- Next type check, lint, tests, and production build;
- no `metadataBase`/`localhost` warning in the production build;
- inspection of rendered `<head>` for representative public, CMS, blog, service, booking, and private routes;
- image-dimension and file-format checks for every generated icon/social asset;
- browser verification of the tab icon at normal and dark-theme chrome;
- social-card validation against at least Facebook Sharing Debugger and LinkedIn Post Inspector after deployment, with WhatsApp/X link preview smoke checks where available.

## 14. Acceptance Criteria

1. The tab and saved-app icon show a clear, tightly cropped photograph of Ahmed, not a letter mark.
2. Every indexable public route emits an absolute canonical URL and complete Open Graph/Twitter metadata.
3. CMS page title, description, canonical, noindex, and OG image override global defaults.
4. A missing page OG image falls back to global CMS media, then to the checked-in branded portrait card.
5. Blog posts, services, and public booking pages expose entity-specific metadata.
6. Admin, preview, payment, status/token, and thank-you routes are never indexable.
7. No secret token appears in metadata.
8. Production metadata contains no `localhost` URLs.
9. Existing CMS/R2 media behavior and public page rendering remain unchanged.
10. All specified automated and manual checks pass.

## 15. Not in Scope

- changing page copy or the site's visual design outside metadata assets;
- redesigning the CMS SEO editor;
- changing R2 upload/storage behavior;
- adding automatic per-request AI-generated social cards;
- changing domain/DNS configuration;
- adding analytics, structured data beyond existing behavior, or a multilingual routing system;
- making transactional or admin pages searchable.

## 16. Implementation Slices

1. Canonical URL configuration and shared metadata builder.
2. Root defaults, portrait icon set, manifest, and branded fallback social card.
3. CMS/generic/legal route integration.
4. Blog, service, and booking metadata integration.
5. Private/transactional route noindex policy.
6. Tests, production build, rendered-head audit, and post-deploy social preview checks.

The slices share one metadata builder and one asset set; they must not introduce route-specific copies of the fallback logic.
