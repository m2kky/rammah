# CMS SEO, Blog Administration, and Dependency Security Design

Date: 2026-08-16
Status: Approved

## Goal

Finish the remaining CMS controls and remove the currently reported production dependency vulnerabilities without changing the public content model or requiring a database migration.

## Scope

### Shared SEO editor

Create one reusable admin SEO editor for CMS resources. It must support:

- Meta title.
- Meta description.
- Canonical URL.
- One Open Graph image selected from the existing image media library.
- `noindex` control.
- Clear saved, loading, and error feedback.

Use the existing SEO metadata API and media library. The editor is shown only after its owner resource has an ID. Removing the selected image saves `ogImageAssetId: null`. An empty canonical value saves `canonicalUrl: null`.

Integrate it into:

- CMS pages with resource type `page`.
- Legal pages with resource type `legal_page`.
- Blog posts with resource type `blog_post`.

### Blog administration

Add a `Blog` view to the existing Website CMS navigation. The view manages the existing blog category and blog post resources; it does not introduce a new public blog architecture.

Category controls:

- List active categories.
- Create a category with name, slug, and status.
- Edit a category.
- Archive a category after confirmation.
- Validate a lowercase, single-segment slug before submission.

Post controls:

- List posts and select one for editing.
- Create, edit, and archive a post.
- Edit title, slug, excerpt, Markdown body, category, featured image, status, and publication time.
- Support draft, published, scheduled, and archived states already accepted by the API.
- Require a title, a valid slug, and non-empty body.
- Require a publication time for scheduled posts.
- Select the featured image from the existing media library, including upload and external image URL flows already supported by `MediaPicker`.
- Show publication validation errors returned by the API.
- Show the shared SEO editor after the post has been created.

The API must enforce the same lowercase, single-segment slug rule for blog categories and posts. It must also reject a scheduled blog post without `publishedAt`; these rules cannot rely only on browser validation.

The public blog responses must resolve `featuredMediaAssetId` into a ready, non-archived image object. The existing public blog list and detail views must render that image when present and retain their current layout when it is absent. This is functional media wiring, not a public blog redesign.

The implementation will add typed admin API client functions for the existing category and post endpoints. It will update the existing server schemas and public response shape, but it will not add a database migration or a new route family.

## Country detection dependency security

Remove `geoip-country` and its vulnerable `ip-address` dependency from the API runtime.

Production country detection will use the configured, trusted Cloudflare country header. The server must only accept it when the request passes the existing trusted-proxy checks. Without a valid trusted provider header, country detection returns unavailable; pricing then follows the existing unsupported-country behavior and does not accept manual customer input.

Tests must explicitly cover:

- A valid trusted Cloudflare header is accepted.
- An untrusted/spoofed header is rejected.
- A request without a usable provider header returns no detected country.
- Country input cannot be supplied by the customer as a pricing override.

This deliberately removes local IP-database inference rather than downgrading to an old GeoIP package or forcing an incompatible transitive override.

## Nanoid dependency security

Update the dependency chain that supplies `nanoid`, or apply the narrowest compatible package resolution, so the installed production tree contains `nanoid >= 3.3.18`. Do not use `npm audit fix --force` and do not introduce unrelated major upgrades.

## Error handling and UX

- Every editor keeps the current user input when a save fails.
- API validation messages are displayed in the relevant editor.
- Buttons are disabled while their operation is in progress.
- Destructive archive actions require confirmation.
- An SEO/media load failure must not make the primary page, legal page, or blog post content disappear.

## Testing and acceptance

Implementation follows red-green-refactor. New tests must fail for the missing behavior before production code is written.

Acceptance requires:

- Component tests covering SEO editing, OG image selection/removal, blog post create/edit validation, category archive confirmation, and public featured-image rendering.
- API client or contract tests covering blog and SEO payloads.
- API tests covering blog slug validation, scheduled publication validation, and featured-image resolution.
- Country detection unit tests updated to prove header-only behavior.
- Existing CMS, pricing, and metadata tests remain green.
- `npm audit --omit=dev` reports zero known vulnerabilities.
- Repository lint, typecheck, unit tests, relevant component/integration tests, and production build all exit successfully.

## Out of scope

- Public blog redesign beyond rendering the configured featured image.
- Rich-text or block editor; posts continue to use Markdown.
- Comments, authors, tags, related posts, or analytics.
- Database migrations.
- Manual country selection or a new GeoIP provider.
- Arabic localization, roles and permissions, coupons, or taxes.
