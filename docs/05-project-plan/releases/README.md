# Release manifests

## Current production

**None.** No production deployment has been verified and no immutable images
have been recorded. This remains `None` until a real released manifest is
linked here.

This file is the only authoritative production pointer. It may link to exactly
one released `vX.Y.Z.md` manifest. The template is not a release.

## Create and publish a manifest

1. Copy [RELEASE-MANIFEST-TEMPLATE.md](RELEASE-MANIFEST-TEMPLATE.md) to
   `vX.Y.Z.md` and replace every `REQUIRED` placeholder with release evidence.
2. Review that its source SHA is 40 lowercase hexadecimal characters and that
   each web, API, and worker image is an immutable `repository@sha256:`
   reference with a 64-character lowercase hexadecimal digest.
3. Record all three prior-image fields in exactly one rollback mode: for a
   subsequent release, all three are immutable digests; for the initial
   production release, all three are exactly `None — initial production
   release; no prior production image`. A mixed sentinel/digest set is
   invalid. Before deployment, also record the backup.
4. In the same reviewed change, move relevant `Unreleased` notes into a new
   root `CHANGELOG.md` heading `## [X.Y.Z] - YYYY-MM-DD`, leave a fresh
   `Unreleased` section, and set the manifest Changelog field to a relative
   Markdown link from `vX.Y.Z.md` to that exact heading (for example,
   `../../../CHANGELOG.md#x.y.z---yyyy-mm-dd`).
5. After all verification and approvals are recorded, set the manifest status
   to `Released`. In the same reviewed change, replace `None` above with one
   link to that released manifest. Do not add a second current-manifest link.

A released manifest is immutable. Correct it only with an append-only dated
amendment in the same manifest; do not alter recorded release facts. A later
release repeats this process and atomically replaces the single link above.

## Rollback boundary

Image rollback is not database rollback. After real provider or customer
events, never automatically restore a database; assess forward recovery,
migration compatibility, and the recorded backup before any approved recovery
action.
