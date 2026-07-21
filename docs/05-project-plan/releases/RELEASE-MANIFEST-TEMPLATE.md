# Release manifest template — not a release

Copy this file to `vX.Y.Z.md` for a real release. All `REQUIRED` values below
are deliberately invalid placeholders and must be replaced with evidence. The
rollback sentinel is the one explicit, truthful initial-release value.

## Identity

| Field | Required value |
| --- | --- |
| Version | `REQUIRED_SEMVER_X.Y.Z` |
| Status | `REQUIRED_RELEASED_STATUS` (must be `Released`) |
| Release UTC | `REQUIRED_UTC_TIMESTAMP` |
| Source SHA | `REQUIRED_40_LOWERCASE_HEX_SOURCE_SHA` |
| Changelog | `REQUIRED_RELATIVE_LINK_TO_EXACT_VERSIONED_CHANGELOG_HEADING` |

The source SHA must match `^[0-9a-f]{40}$` and identifies the sole source
checkout for web, API, and worker.

In the same reviewed release change, move relevant root `Unreleased` notes to
`## [X.Y.Z] - YYYY-MM-DD` and retain a fresh `Unreleased` section. The
Changelog value must be a valid relative Markdown link from this manifest to
that exact versioned heading, such as
`[X.Y.Z](../../../CHANGELOG.md#x.y.z---yyyy-mm-dd)`; it must never link to
`Unreleased`.

## Immutable images

| Component | Required immutable reference |
| --- | --- |
| Web | `REQUIRED_REPOSITORY@sha256:REQUIRED_64_LOWERCASE_HEX_WEB_DIGEST` |
| API | `REQUIRED_REPOSITORY@sha256:REQUIRED_64_LOWERCASE_HEX_API_DIGEST` |
| Worker | `REQUIRED_REPOSITORY@sha256:REQUIRED_64_LOWERCASE_HEX_WORKER_DIGEST` |

Each digest must match `sha256:` followed by 64 lowercase hexadecimal
characters. Mutable tags are not release evidence.

## Database, configuration, and compatibility

| Field | Required value |
| --- | --- |
| Migration head | `REQUIRED_MIGRATION_HEAD` |
| Migration-set evidence | `REQUIRED_CHECKSUM_AND_GENERATION_EVIDENCE` |
| Configuration schema/version | `REQUIRED_NON_SECRET_CONFIGURATION_SCHEMA_OR_VERSION` |
| Compatibility notes | `REQUIRED_WEB_API_WORKER_AND_MIGRATION_COMPATIBILITY_NOTES` |
| Provider notes | `REQUIRED_PROVIDER_COMPATIBILITY_NOTES` |
| Locale notes | `REQUIRED_LOCALE_COMPATIBILITY_NOTES` |

Configuration evidence must name only a non-secret schema or version; never
put credentials or secret values in a manifest.

## Backup and rollback

| Field | Required value |
| --- | --- |
| Pre-deploy backup | `REQUIRED_BACKUP_REFERENCE_AND_VERIFICATION_EVIDENCE` |
| Prior web image | `REQUIRED_REPOSITORY@sha256:REQUIRED_64_LOWERCASE_HEX_PRIOR_WEB_DIGEST` or initial sentinel |
| Prior API image | `REQUIRED_REPOSITORY@sha256:REQUIRED_64_LOWERCASE_HEX_PRIOR_API_DIGEST` or initial sentinel |
| Prior worker image | `REQUIRED_REPOSITORY@sha256:REQUIRED_64_LOWERCASE_HEX_PRIOR_WORKER_DIGEST` or initial sentinel |

Use exactly one required rollback mode:

1. **Initial production release:** every prior-image field is exactly
   `None — initial production release; no prior production image`.
2. **Subsequent release:** every prior-image field is an immutable
   `repository@sha256:` reference with a 64-character lowercase hexadecimal
   digest.

Mixed sentinel/digest rollback sets are invalid. Do not invent a prior digest
for the initial production release.

Image rollback is not database rollback. After real provider or customer
events, do not automatically restore a database; use an approved recovery
decision based on compatibility and backup evidence.

## Verification and approval

| Field | Required value |
| --- | --- |
| Deployment and smoke verification | `REQUIRED_VERIFICATION_EVIDENCE` |
| Approval | `REQUIRED_RELEASE_OWNER_APPROVAL_EVIDENCE` |
| Amendments | `NONE_OR_APPEND_ONLY_DATED_AMENDMENT` |

## Reconstruction walkthrough

1. Check out the recorded 40-character source SHA.
2. Deploy or inspect the recorded web, API, and worker `repository@sha256:`
   image references, never a mutable tag.
3. Use the migration head, migration-set evidence, and non-secret
   configuration schema/version to verify the compatible runtime contract.

These fields identify one source checkout and three immutable images without
relying on mutable tags.
