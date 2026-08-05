# Complete CMS Media and Pages Design

## Goal

Finish the existing CMS so an administrator can manage every image and video displayed by the public site, create and publish standard pages from reusable sections, and create and publish legal pages without editing code.

The approved media workflow supports both direct uploads to Cloudflare R2 and externally hosted HTTPS URLs.

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
- Optional poster relationship for videos where a component requires one
- Status
- Created and updated timestamps
- Usage locations

The library supports grid and list-friendly metadata, image/video previews, search, kind/source/status filters, and safe archival. An asset with active usages cannot be archived until those usages are removed or replaced. The API returns the usage locations in the validation error so the dashboard can link the administrator to them.

### R2 Upload Flow

R2 credentials remain server-side. The browser never receives permanent credentials.

1. The dashboard requests a short-lived presigned upload URL from the API with file name, MIME type, and byte size.
2. The API validates the requested type and size, creates a collision-resistant R2 object key, and returns the presigned URL, object key, and eventual public URL.
3. The browser uploads directly to R2 and shows progress.
4. The dashboard asks the API to finalize the asset.
5. The API performs an R2 `HEAD` check, confirms that the uploaded object exists and matches the declared metadata, then creates the media asset row.

If upload or finalization fails, the dashboard preserves the form state and offers retry. A periodic cleanup job is not part of this delivery; abandoned unfinalized objects use a dedicated temporary prefix so an R2 lifecycle rule can expire them.

External URLs must use HTTPS. The application renders them directly and does not proxy or fetch arbitrary external content through the API.

### Media Assignments

Media is assigned through named slots rather than raw IDs or arbitrary JSON. Examples include:

- `desktopImage`
- `mobileImage`
- `video`
- `poster`
- `backgroundImage`
- `galleryImages`

Each assignment records the owning section or global setting, slot key, media asset, order for multi-value slots, and optional usage-specific alternative text. Usage-specific alternative text takes precedence over the asset library default.

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

A shared section-definition registry describes the editable text, choice, boolean, link, and media fields for each type. The dashboard uses the registry to build clear forms, and the public renderer uses the same stable section types. Administrators never edit raw JSON or media UUIDs.

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

Frame sequences used by animated canvases are represented as one named sequence bundle with a manifest, poster, dimensions, frame count, and URL pattern. The administrator replaces the bundle as a unit instead of editing hundreds of individual frames.

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
- Publish or archive the page

New general-purpose pages render at `/<slug>` through a generic Next.js route. Existing static routes take precedence. Slugs are lowercase, single-segment URL slugs for this delivery. Reserved application slugs such as `admin`, `api`, `booking`, `blog`, `services`, `about`, `contact`, `privacy`, `terms`, and their aliases cannot be assigned to a general page.

The public route renders only published pages and published sections, ordered by `sortOrder`. Draft and archived pages return the normal not-found experience.

### Legal Pages

The **Legal Pages** view supports create, edit, search, publish/schedule, and archive operations with title, slug, version, body, SEO fields, and publication date.

Arbitrary legal pages render at `/legal/<slug>`. Existing `/privacy`, `/privacy-policy`, `/terms`, and `/terms-and-conditions` routes remain as stable aliases for their current legal slugs.

Legal body content uses the same safe rich-text format selected for Rich Text sections. Rendering sanitizes supported markup and does not allow arbitrary scripts or embedded HTML.

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

The page editor separates page details, SEO, and sections. Media fields are labeled by purpose and always show the current preview. A media picker modal provides library selection plus upload and external-URL tabs without navigating away from the editor.

## API and Data Contracts

The existing page, section, legal, navigation, media, and SEO endpoints remain the base. The frontend adds the currently missing create/archive calls for pages and sections and media/SEO client functions.

New API capabilities include:

- Create a presigned R2 upload intent
- Finalize and verify an R2 upload
- List media with source/kind/status/search filters
- Return media usage locations
- Create/update/archive media records
- Read and update named section media assignments
- Read and update named global media assignments
- Return resolved media objects in public page and settings responses

Public media objects contain only safe display fields: ID, kind, MIME type, public URL, alternative text, dimensions/duration when known, and poster data where applicable. Storage credentials and internal upload details are never exposed.

## Validation and Error Handling

- Only configured image and video MIME types are accepted.
- Upload size limits are configurable separately for images and videos.
- File extensions are not trusted as MIME validation.
- Presigned URLs expire quickly and are scoped to one generated object key.
- External media URLs must be valid HTTPS URLs.
- Section payloads are validated against the selected section definition.
- Required media slots must be assigned before a section or page can be published.
- An image assignment requires usable alternative text, either from the usage or asset default.
- Video sections that require a poster cannot publish without one.
- Duplicate page or legal slugs return a field-level conflict error.
- Reserved slugs return a field-level validation error.
- Archiving a used asset returns a conflict response containing its usages.
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

Example environment files and deployment documentation will describe these values without committing secrets.

## Migration and Compatibility

1. Add the media source metadata and assignment tables.
2. Preserve existing media rows and migrate current section media IDs into assignments.
3. Seed global and custom-page slot definitions with the currently displayed static asset URLs so the site remains visually unchanged immediately after deployment.
4. Update public contracts and components to resolve assignments.
5. Add the generic page and legal routes.
6. Remove rendered hard-coded media paths only after the equivalent assignment has a fallback seed.

Fallback values may remain in seed/config code for first deployment and disaster recovery, but an active site with seeded CMS data must not depend on hard-coded public media paths.

## Testing Strategy

Follow test-driven development for each behavior.

API unit and integration tests cover:

- Upload-intent validation
- R2 finalization verification
- External URL creation
- Media filtering and serialization
- Usage lookup and safe archival conflicts
- Page and section creation, ordering, publication validation, and archival
- Reserved and duplicate slug validation
- Legal-page creation and public retrieval
- Resolved section and global media contracts

Frontend unit tests cover:

- Section definitions and field rendering contracts
- Public section-to-component mapping
- Existing custom page media fallback and override behavior
- Generic page rendering data mapping
- Legal route aliases

Browser verification covers:

- Upload an image and a video to R2
- Register external image and video URLs
- Select, replace, and remove media from a section
- Create, arrange, publish, and visit a new page
- Create, publish, and visit a legal page
- Edit every global media slot
- Confirm used media cannot be archived
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
- An administrator can register and use external HTTPS media.
- Every displayed content image/video and every approved global media asset can be changed from the dashboard.
- Every media-bearing section exposes named fields with preview, choose, upload, external URL, replace, and remove actions.
- No administrator must enter raw JSON or a media UUID.
- A used media asset cannot be archived and its usage locations are shown.
- An administrator can create, reorder, publish, visit, and archive a general page built from the approved section catalog.
- An administrator can create, publish, visit, and archive an arbitrary legal page.
- Existing privacy and terms URLs continue to work.
- Existing custom page visuals and animations remain intact while their media becomes CMS-managed.
- Draft and archived content is not publicly rendered.
- API/frontend tests, type checking, linting, production builds, and the browser verification flow pass.
