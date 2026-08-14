# B1 CMS Media Assignment Foundation — Evidence

## Delivered

- API-owned definitions for eight reusable CMS sections and all known global site media.
- Next renderer registry parity contract for the eight stable section keys.
- Responsive menu-video slots discovered from the current renderer inventory.
- Media source, media kind, processing state, dimensions, duration, metadata, and display-name columns.
- Queryable section and global media assignment tables with foreign keys, deterministic ordering, and slot cardinality validation.
- Version identity and one-published-version database invariant for atomic global media groups such as the loading match-cut.
- Legacy `page_sections.media_asset_id` backfill into a named slot while preserving the compatibility column.
- Read-only authenticated admin endpoints for section and global media definitions.
- Media usage lookup across page sections and global assignment versions.

## Migration Evidence

- Journal migration: `0009_naive_thunderbird`.
- Migration preflight: `current=0009_naive_thunderbird`, `nextPrefix=0010`.
- Guarded PostgreSQL test database reset and migrated successfully on `127.0.0.1:55433`.
- Fresh migration test confirms all three assignment tables exist.
- Upgrade test applies `0000` through `0008`, inserts legacy CMS media, applies `0009`, and confirms:
  - media metadata backfill;
  - source and media-kind inference;
  - named slot backfill;
  - preservation of `page_sections.media_asset_id`;
  - restrictive media FK and cascading section cleanup.

## Verification Evidence

- API unit: 34 files, 119 tests passed.
- API integration: 21 files, 166 tests passed.
- API booking regression: 1 file, 7 tests passed.
- API typecheck passed.
- API production build passed.
- OpenAPI contract: 2 tests passed.
- Next unit: 6 files, 18 tests passed.
- Next typecheck passed on Next 16.2.1.
- Next lint passed.
- Next production build passed; 32 routes generated.
- Focused CMS registry, assignment, fresh-migration, and upgrade-migration suites passed.

## Scope Boundary

This phase freezes the registry and relational assignment foundation. R2 upload/finalization, media-library UI and picker, page/legal editors, publication completeness checks, and binding the current renderers to assignments remain in B2-B4.
