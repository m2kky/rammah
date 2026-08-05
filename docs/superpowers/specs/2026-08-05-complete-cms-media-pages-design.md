# Complete CMS Media and Pages Design

## Goal

Finish the existing CMS so an administrator can manage every image and video displayed by the public site, create and publish standard pages from reusable sections, and create and publish legal pages without editing code.

The approved media workflow supports both direct uploads to Cloudflare R2 and externally hosted HTTPS URLs.

Operational booking controls are specified separately in `docs/superpowers/specs/2026-08-05-global-booking-advance-days-design.md`. The Availability dashboard owns the global booking timezone and minimum advance calendar days; the CMS Site Settings screen does not duplicate those controls.

## Current-State Findings

The repository already contains database tables and admin APIs for pages, page sections, legal pages, media asset records, navigation, and SEO metadata. The public site also reads some text content from those APIs.

The remaining gaps are:

- The admin UI can edit existing pages and sections but cannot create, archive, or arrange them.
- The admin UI can edit legal pages, but the experience is incomplete and arbitrary legal pages do not have a public route.
- A media asset record stores metadata only; there is no actual upload flow, R2 integration, or media library in the dashboard.
- Page sections expose a raw `mediaAssetId` and raw JSON config instead of named, usable fields.
- Public page responses return media IDs without resolving them to renderable media data.
- Most displayed images and videos are hard-coded in React components.
- There is no public renderer for a newly created CMS page.

## Approved Product Direction

Use the existing CMS as the source of truth and add a unified media library. Do not introduce a separate headless CMS.

Administrators will be able to:

1. Upload images and videos directly to R2.
2. Register an external HTTPS image or video URL.
3. Search, filter, preview, reuse, replace, and archive media.
4. See where an asset is used before attempting to archive it.
5. Edit named image and video fields inside every section that displays media.
6. Create pages from a fixed catalog of reusable section types.
7. Create and publish arbitrary legal pages.
8. Manage global media such as the loading video, its poster, the menu video, and the default social-sharing image.
9. Preview draft pages through an authenticated, short-lived preview link before publication.
10. Permanently delete unused archived media, including its R2 objects, through an explicit destructive action.

## Scope

### Media Library

The dashboard gets a first-class **Media Library** view with two creation paths:

- **Upload:** select a local image or video, upload it directly to R2, then save its metadata in the API.
- **External URL:** enter an HTTPS URL and declare whether it is an image or video.

Each media item exposes:

- File/display name
- Source type: `r2` or `external`
- MIME type and media kind
- Public URL
- File size when known
- Alternative text for images
- Status
- Processing state: `pending`, `ready`, or `failed`
- Created and updated timestamps
- Usage locations

The library supports grid and list-friendly metadata, image/video previews, search, kind/source/status filters, and safe archival. An asset with active usages cannot be archived until those usages are removed or replaced. The API returns the usage locations in the validation error so the dashboard can link the administrator to them.

Archival hides an unused asset from pickers but retains its record and object. Permanent deletion is a separate, confirmed action available only for an unused archived asset. Deleting an R2 asset removes all of its R2 objects before deleting the database record; deleting an external asset removes only its database record. Every destructive action is written to the existing audit log.

Replacing a file never overwrites an existing R2 key. It creates a new immutable asset and reassigns the selected slot, which avoids stale CDN caches and preserves the old asset for other usages.

### R2 Upload Flow

R2 credentials remain server-side. The browser never receives permanent credentials.

1. The dashboard requests a short-lived presigned upload URL from the API with file name, MIME type, and byte size.
2. The API validates the requested type and size, creates a collision-resistant R2 object key, and returns the presigned URL, object key, and eventual public URL.
3. The browser uploads directly to R2 and shows progress.
4. The dashboard asks the API to finalize the asset.
5. The API performs an R2 `HEAD` check, confirms that the uploaded object exists and matches the declared byte size, then reads the minimum required byte ranges to identify the actual file signature. The detected type must match an allowed image or video type before the media asset becomes ready.

If upload or finalization fails, the dashboard preserves the form state and offers retry. A periodic cleanup job is not part of this delivery; abandoned unfinalized objects use a dedicated temporary prefix so an R2 lifecycle rule can expire them.

The R2 bucket CORS policy must allow presigned `PUT` requests from the configured admin origin. API verification uses server-to-server `HEAD` and byte-range requests and does not depend on browser CORS. The public/CDN endpoint must support `GET`, `HEAD`, byte-range video requests, and the required response headers. Uploaded objects use immutable, collision-resistant keys and long-lived cache headers.

External URLs must use HTTPS. The application renders them directly and does not proxy or fetch arbitrary external content through the API. Because arbitrary remote URLs cannot be trusted or guaranteed to remain available, the dashboard requires a successful browser preview before saving and displays a persistent external-source badge. Public rendering uses native `img` and `video` elements for arbitrary external assets. R2 images may use `next/image` only when the build-time R2 public origin is configured through a strict `images.remotePatterns` entry; arbitrary administrator-provided hosts never enter that allowlist. The site security policy permits HTTPS image and media sources while retaining the existing script and frame restrictions.

### Media Assignments

Media is assigned through named slots rather than raw IDs or arbitrary JSON. Examples include:

- `desktopImage`
- `mobileImage`
- `video`
- `poster`
- `backgroundImage`
- `galleryImages`

Each assignment records the owning section or global setting, slot key, media asset, order for multi-value slots, optional usage-specific alternative text, and whether an image is decorative. Usage-specific alternative text takes precedence over the asset library default. Decorative images render with an empty alternative text value and are ignored by assistive technology; all other content images require meaningful alternative text.

The database will add dedicated section-media and global-media assignment tables with foreign keys. This preserves referential integrity and makes usage lookup and safe archival straightforward. The existing single `page_sections.media_asset_id` value will be migrated into the appropriate default slot where present and removed from the public contract after migration.

### Section Catalog

New general-purpose pages use a fixed catalog:

1. **Hero** — title, body, CTA fields, desktop/mobile image or video, and poster.
2. **Rich Text** — heading and formatted body without media.
3. **Image with Text** — image, alternative text, copy, alignment, and CTA.
4. **Standalone Image** — responsive image, alternative text, caption, and width treatment.
5. **Video** — video, poster, caption, autoplay, loop, muted, and controls options.
6. **Gallery** — ordered images with alternative text and captions.
7. **CTA** — heading, body, button fields, and optional background image.
8. **Divider/Spacer** — controlled visual separation without media.

The API owns the authoritative section-definition registry and exposes its safe form contract to the admin frontend. The public frontend maintains the component mapping for those stable section types, with contract tests that fail if the API definitions and renderer diverge. The registry describes the editable text, Markdown, choice, boolean, link, and media fields for each type. Administrators never edit raw JSON or media UUIDs.

### Existing Custom Pages

The existing homepage, About, Services, Corporate Training, and service-detail experiences retain their current custom layouts and animation behavior. Their displayed assets move from hard-coded paths to named CMS media slots.

The first inventory includes:

- Homepage hero portrait
- Loading video and loading poster
- Menu video
- About hero image, desktop/mobile fast-cut videos, and supporting image
- Corporate Training portrait and parallax image
- Service-detail portrait
- Homepage services animation assets
- Default Open Graph image

During implementation, a repository-wide scan of rendered `Image`, `video`, `source`, CSS background URLs, posters, and canvas image sources will extend this list. Acceptance requires that every media reference actually displayed by the site resolves through a CMS assignment. Code-owned icons, SVG interface marks, favicons, and non-rendered development/review assets remain code assets.

Frame sequences used by animated canvases are represented as one `animation_bundle` media kind with a manifest, poster, dimensions, frame count, file extension, and URL pattern. The administrator replaces the bundle as a unit instead of editing hundreds of individual frames.

An animation bundle is uploaded as a ZIP to the temporary R2 prefix. Finalization queues an existing-worker-compatible processing job that validates safe relative paths, rejects executable or traversal entries, expands the frames into an immutable R2 prefix, validates consistent dimensions and numbering, writes the manifest, and marks the asset `ready`. Failed bundles retain a visible error and cannot be assigned or published. The original ZIP is removed after successful processing. Existing frame sequences are registered during migration as ready bundles without changing the current animation behavior.

### Global Media

The CMS gets a **Global Media** view for assets that are not owned by one page section. Initial slots are:

- Loading video
- Loading video poster
- Menu video
- Default Open Graph image

Additional global slots discovered by the implementation inventory will be added to the shared definition registry. Each field provides preview, choose-from-library, upload-new, add-external-URL, replace, and remove actions.

### Page Management

The **Pages** view supports:

- Create a page
- Edit title, slug, template, publication status, and publication date
- Edit SEO title, description, canonical URL, indexability, and Open Graph image
- Add a section from the approved catalog
- Edit named section fields
- Reorder sections
- Duplicate a section
- Archive a section
- Preview the media selected for every slot
- Open an authenticated full-page draft preview
- Publish or archive the page

New general-purpose pages render at `/<slug>` through a generic Next.js route. Existing static routes take precedence. Slugs are lowercase, single-segment URL slugs for this delivery. A single server-owned reserved-slug set covers all static and system routes, including `admin`, `api`, `booking`, `blog`, `services`, `about`, `contact`, `legal`, `privacy`, `privacy-policy`, `terms`, `terms-and-conditions`, `thank-you`, `cms-preview`, and their aliases. API validation is authoritative and contract tests keep the dashboard validation aligned.

The public route renders only published pages and published sections, ordered by `sortOrder`. Draft and archived pages return the normal not-found experience.

Section reordering uses one purpose-built endpoint that accepts the complete ordered section ID list. The API verifies ownership and completeness, then updates all sort positions in one database transaction so partial or duplicate ordering cannot be exposed.

Draft preview uses Next.js 16 Draft Mode plus a short-lived, signed, page-scoped token issued only to an authenticated administrator. A one-time Route Handler validates the token with the API, resolves the canonical page slug server-side, enables Draft Mode, stores the scoped token in a separate HTTP-only, same-site cookie, and redirects to the normal clean `/<slug>` route. It never redirects to an untrusted query-string path. The normal page renderer checks `await draftMode()` and the scoped token before bypassing publication filters, so preview and production cannot drift into separate renderers. Draft responses are `noindex`, never expose unrelated drafts, and use an explicit disable Route Handler that clears both Draft Mode and the scoped token cookie.

The frontend targets Next.js 16.2.1. App Router request APIs are treated as asynchronous: dynamic-route `params`, `searchParams`, `cookies()`, and `draftMode()` are always awaited. Generic and legal routes use generated `PageProps` helpers, and `generateMetadata` shares a React `cache`-memoized page loader with the page component to avoid duplicate CMS reads during one render.

`scheduled` has operational meaning: a page or legal page must have a future `publishedAt`, and a CMS publication handler registered with the existing worker publishes due records, re-runs publication validation, writes an audit event, and is idempotent. If validation fails at publish time, the item remains scheduled with an actionable dashboard error. Public routes never treat `scheduled` content as published directly.

### Legal Pages

The **Legal Pages** view supports create, edit, search, publish/schedule, and archive operations with title, slug, version, body, SEO fields, and publication date.

Arbitrary legal pages render at `/legal/<slug>`. Existing `/privacy`, `/privacy-policy`, `/terms`, and `/terms-and-conditions` routes remain as stable aliases for their current legal slugs.

Legal bodies and Rich Text sections use Markdown with a formatting toolbar and side-by-side preview. Raw HTML is disabled. The renderer supports an explicit safe subset—headings, paragraphs, emphasis, lists, blockquotes, links, and tables—and sanitizes generated output before rendering.

### Navigation

After creating a page or legal page, the administrator can add its URL to the existing navigation editor. Header and footer navigation items retain explicit ordering and publication status. Page creation does not silently change navigation.

## Dashboard Information Architecture

The CMS navigation is organized as:

1. Pages
2. Media Library
3. Global Media
4. Navigation
5. Legal Pages
6. Site Settings

Booking timezone and minimum advance days live together in the separate Booking Policy card on the Availability page. Site Settings remains responsible for site identity, locale, contact details, social links, and other non-booking CMS configuration.

The page editor separates page details, SEO, and sections. Media fields are labeled by purpose and always show the current preview. A media picker modal provides library selection plus upload and external-URL tabs without navigating away from the editor.

Upload and bundle-processing progress persists while the editor remains open. Media items that are pending, failed, archived, or missing cannot be selected for a publishable slot.

## API and Data Contracts

The existing page, section, legal, navigation, media, and SEO endpoints remain the base. The frontend adds the currently missing create/archive calls for pages and sections and media/SEO client functions.

New API capabilities include:

- Create a presigned R2 upload intent
- Finalize and verify an R2 upload
- Process and report animation-bundle status
- List media with source/kind/status/search filters
- Return media usage locations
- Create/update/archive/permanently-delete media records
- Read and update named section media assignments
- Read and update named global media assignments
- Return the authoritative admin section-definition contract
- Reorder page sections transactionally
- Issue and validate short-lived draft-preview tokens
- Publish scheduled CMS records through an idempotent worker handler
- Return resolved media objects in public page and settings responses

Public media objects contain only safe display fields: ID, kind, MIME type, public URL, alternative text, dimensions/duration when known, and poster data where applicable. Storage credentials and internal upload details are never exposed.

## Validation and Error Handling

- Only configured image and video MIME types are accepted.
- Upload size limits are configurable separately for images and videos.
- File extensions and submitted MIME headers are not trusted; R2 finalization verifies file signatures from object bytes.
- Presigned URLs expire quickly and are scoped to one generated object key.
- External media URLs must be valid HTTPS URLs.
- Section payloads are validated against the selected section definition.
- Required media slots must be assigned before a section or page can be published.
- A non-decorative image assignment requires usable alternative text, either from the usage or asset default.
- Video sections that require a poster cannot publish without one.
- Autoplay video always renders muted and `playsInline`; contradictory dashboard options are rejected.
- Only `ready`, active media can be assigned to published content.
- Duplicate page or legal slugs return a field-level conflict error.
- Reserved slugs return a field-level validation error.
- Archiving a used asset returns a conflict response containing its usages.
- Permanent deletion requires an unused archived asset and explicit confirmation.
- ZIP processing rejects absolute paths, traversal entries, executable content, unexpected file types, inconsistent dimensions, and configured expanded-size or frame-count limits.
- Scheduled publication revalidates the complete item and records a visible failure instead of publishing invalid content.
- Public rendering handles a missing optional asset without breaking the page and logs an observable server-side warning.

## Configuration

The API environment adds:

- R2 account endpoint
- R2 bucket name
- R2 access key ID
- R2 secret access key
- R2 public asset base URL
- Presigned upload expiry
- Maximum image bytes
- Maximum video bytes
- Allowed image MIME types
- Allowed video MIME types
- Maximum animation-bundle ZIP bytes, expanded bytes, and frame count
- R2 temporary-object prefix and lifecycle retention
- Admin origin allowed by the R2 CORS policy
- Public media/CDN cache and byte-range requirements
- Draft-preview signing secret and expiry

Example environment files and deployment documentation will describe these values without committing secrets.

## Migration and Compatibility

1. Add media source, processing-state, processing-error metadata, and assignment tables.
2. Preserve existing media rows and migrate current section media IDs into assignments.
3. Register the existing frame sequences as ready animation bundles and seed global and custom-page slot definitions with the currently displayed static asset URLs so the site remains visually unchanged immediately after deployment.
4. Update public contracts and components to resolve assignments.
5. Add the generic page and legal routes.
6. Remove rendered hard-coded media paths only after the equivalent assignment has a fallback seed.

Fallback values may remain in seed/config code for first deployment and disaster recovery, but an active site with seeded CMS data must not depend on hard-coded public media paths.

## Testing Strategy

Follow test-driven development for each behavior.

API unit and integration tests cover:

- Upload-intent validation
- R2 finalization signature, size, and object verification
- Animation-bundle path, content, dimension, limit, processing, retry, and cleanup behavior
- External URL creation
- Media filtering and serialization
- Usage lookup, safe archival conflicts, and permanent R2 deletion
- Page and section creation, transactional ordering, publication validation, and archival
- Reserved and duplicate slug validation
- Legal-page creation and public retrieval
- Scheduled publication success, validation failure, audit, and idempotency
- Draft-preview authorization, page scoping, expiry, and `noindex` behavior
- Next.js Draft Mode enable/disable behavior, secure canonical redirects, and async request APIs
- Strict R2 `images.remotePatterns` configuration while arbitrary external media stays on native elements
- Resolved section and global media contracts

Frontend unit tests cover:

- Section definitions and field rendering contracts
- Public section-to-component mapping
- Existing custom page media fallback and override behavior
- Generic page rendering data mapping
- Legal route aliases
- Markdown safe-subset rendering and raw-HTML rejection
- Decorative and required alternative-text behavior
- R2 optimized rendering and external native-media rendering

Browser verification covers:

- Upload an image and a video to R2
- Register external image and video URLs
- Select, replace, and remove media from a section
- Upload, process, and replace an animation bundle
- Create, arrange, publish, and visit a new page
- Preview that page while it is still a draft
- Create, publish, and visit a legal page
- Schedule a page and confirm it is not public before the worker publishes it
- Edit every global media slot
- Confirm used media cannot be archived
- Permanently delete an unused archived R2 asset and confirm its objects are gone
- Confirm existing animated pages preserve their layouts at mobile and desktop breakpoints

The final verification runs API and frontend unit/integration tests, type checking, linting, production builds, and a rendered-media inventory scan.

## Non-Goals

- A free-form drag-and-drop page builder
- Arbitrary custom HTML or JavaScript blocks
- Image editing, cropping, or video transcoding in the dashboard
- Automatic copying/proxying of externally hosted media into R2
- Nested general-page slugs
- Media approval workflows or multi-user editorial roles

## Acceptance Criteria

- An administrator can upload images and videos directly to R2.
- An administrator can upload and process a frame-sequence animation bundle as one asset.
- An administrator can register and use external HTTPS media.
- Every displayed content image/video and every approved global media asset can be changed from the dashboard.
- Every media-bearing section exposes named fields with preview, choose, upload, external URL, replace, and remove actions.
- No administrator must enter raw JSON or a media UUID.
- A used media asset cannot be archived and its usage locations are shown.
- An unused archived asset can be permanently deleted, removing its R2 objects when applicable.
- An administrator can create, reorder, publish, visit, and archive a general page built from the approved section catalog.
- An administrator can securely preview a draft page before publication.
- Scheduled content is published by the worker at its configured time or remains scheduled with a visible validation error.
- An administrator can create, publish, visit, and archive an arbitrary legal page.
- Existing privacy and terms URLs continue to work.
- Existing custom page visuals and animations remain intact while their media becomes CMS-managed.
- Non-decorative images require alternative text; decorative images render with an empty alternative text value.
- Draft and archived content is not publicly rendered.
- API/frontend tests, type checking, linting, production builds, and the browser verification flow pass.
