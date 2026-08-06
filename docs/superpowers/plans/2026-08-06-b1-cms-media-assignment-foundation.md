# B1 CMS Media Assignment Foundation

## Goal

Establish one authoritative CMS contract for every section and global media slot, plus a queryable relational assignment model that preserves the legacy `page_sections.media_asset_id` field during rollout.

## Scope

1. Add the API-owned section and global-media definition registries.
2. Add a Next renderer registry and a contract test that prevents registry drift.
3. Extend media assets with source, kind, processing state, dimensions, duration, and metadata.
4. Add section media assignments, versioned global assignment sets, and global media assignments.
5. Validate media kind and single/multiple slot cardinality in the assignment service.
6. Add media usage lookup across sections and global assignment sets.
7. Generate migration `0009`, backfill the legacy section media foreign key into a named slot, and keep the compatibility column.
8. Verify fresh migration, upgrade migration, foreign keys, usage lookup, registry parity, and cardinality.

## Contract Decisions

- API section keys are stable and snake_case: `hero`, `rich_text`, `image_with_text`, `standalone_image`, `video`, `gallery`, `cta`, and `divider_spacer`.
- Media slot keys are camelCase because they are public CMS field identifiers.
- Unknown legacy section types backfill to the compatibility slot `primaryMedia`.
- `galleryImages` is multi-value; all other initial slots are single-value.
- Loading media is grouped under `loadingMatchCut`; its `video`, `poster`, and `matchedHeroFrame` slots are published as one assignment-set version.
- A media asset source is `r2` or `external`; its kind is `image`, `video`, or `animation_bundle`; its processing state is `pending`, `ready`, or `failed`.
- Existing assets with an HTTPS public URL migrate to `external`; other assets migrate to `r2` because they already have a storage key.
- B1 exposes safe read-only definition endpoints. Upload, R2 finalization, media picker UI, publication commands, and destructive deletion remain B2-B4 work.

## TDD Sequence

1. Write failing registry parity and definition-shape tests.
2. Implement the API and Next registries and the read-only admin definition endpoints.
3. Write failing assignment validation and usage lookup tests.
4. Implement the schema and assignment service.
5. Generate and augment the migration with compatibility backfill.
6. Add fresh/upgrade migration tests and run the complete API/Next verification gates.

## Verification Gate

- API unit, integration, typecheck, build, and OpenAPI checks pass.
- Next unit, typecheck, lint, and production build pass.
- Migration preflight reports `0009` as the next journaled migration and a guarded PostgreSQL database migrates from both fresh and `0008` states.
- Worktree diff is reviewed and committed as the B1 phase only.
