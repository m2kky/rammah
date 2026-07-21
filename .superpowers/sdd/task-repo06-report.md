# REPO-06 Implementer Report

## Status

DONE

## Scope and commit

This documentation-only change creates the local single-SHA release contract.
The one focused commit is `REPO-06 add single-SHA release manifest contract`;
its exact SHA is recorded by `git rev-parse HEAD` immediately after commit.
No remote, release, registry, deployment, or image digest was created.

## RED / inventory evidence

Before implementation, the following command reported every required release
artifact as absent:

```powershell
$red = @('CHANGELOG.md','docs\05-project-plan\releases',
  'docs\05-project-plan\releases\README.md',
  'docs\05-project-plan\releases\vX.Y.Z.md')
foreach ($item in $red) { '{0}: {1}' -f $item, (Test-Path -LiteralPath $item) }
```

Output: each path was `False`. A search for `^Current production:` also found
no production pointer.

## Implementation

- Added root `CHANGELOG.md` with only a compact Keep-a-Changelog-style
  `Unreleased` section and no comparison URLs.
- Added `docs/05-project-plan/releases/README.md` as the sole authoritative
  production pointer. It says `None` because production has not been verified,
  and defines a reviewed atomic replacement that permits one linked released
  manifest only.
- Added `RELEASE-MANIFEST-TEMPLATE.md`, explicitly not a release, with invalid
  placeholders and all required source, image, migration, configuration,
  compatibility, backup, rollback, changelog, verification, and approval
  fields. Real manifests are `vX.Y.Z.md`, immutable after release, with only
  append-only amendments.
- Linked the process from the root README without changing its command table.
- Documented in both process and template that image rollback is not database
  rollback and that a database must not be automatically restored after real
  provider or customer events.

## GREEN / verification evidence

| Check | Command / result |
| --- | --- |
| Local Markdown links | An inline PowerShell resolver checked every non-HTTP Markdown target in `README.md`, `CHANGELOG.md`, and the two release documents; `Local Markdown links: PASS`. |
| Placeholder distinction | The same check proved `REQUIRED_40_LOWERCASE_HEX_SOURCE_SHA` fails `^[0-9a-f]{40}$`, and `REQUIRED_REPOSITORY@sha256:REQUIRED_64_LOWERCASE_HEX_WEB_DIGEST` fails `^.+@sha256:[0-9a-f]{64}$`; it also confirmed the template documents both valid formats. |
| Reconstruction walkthrough | `RELEASE-MANIFEST-TEMPLATE.md` requires checkout of its one 40-character source SHA and inspection/deployment of three recorded `repository@sha256:` references, followed by migration/configuration compatibility evidence. Mutable tags are explicitly excluded. |
| Sole production pointer | `rg -n '^## Current production$|^\*\*None\.\*\*' README.md CHANGELOG.md docs/05-project-plan/releases -g '*.md'` returned only `releases/README.md` lines 3 and 5. Count checks found one heading and one value. |
| No fabricated release | `Get-ChildItem docs/05-project-plan/releases -File -Filter 'v*.md'` found zero files. The template's placeholders fail the required SHA/digest patterns and its status is `REQUIRED_RELEASED_STATUS`, not an actual released status. |
| Whitespace | `git diff --check` exited 0. |
| Scope | `git diff --name-only` plus untracked-file inventory showed only `README.md`, `CHANGELOG.md`, the release documentation, and this report: documentation only. |

## Self-review and concerns

The contract deliberately leaves production as `None`; no fake source SHA,
digest, release version, configuration version, migration deployment, registry,
or external publication is presented. It adds no CLI, validator dependency,
workflow, remote change, or automation; OPS-10 remains responsible for
automation. No concerns beyond the intentional pre-production state.

## Review remediation

### RED

Review found two documentation gaps: the three required prior-image fields had
no truthful initial-release value, and the changelog process did not require a
versioned root section or a manifest link to that exact section.

### Fix

- The process and template now define exactly two complete rollback modes. A
  subsequent release records three immutable prior digests; an initial
  production release records the exact sentinel `None — initial production
  release; no prior production image` in all three prior-image fields. Mixed
  sets are invalid.
- The process now requires the same reviewed change to move notes into
  `## [X.Y.Z] - YYYY-MM-DD`, retain a fresh `Unreleased` section, and set a
  relative manifest link to that exact root heading. `CHANGELOG.md` explicitly
  forbids linking a release to `Unreleased`.

### GREEN

Static PowerShell checks modelled all three rollback sets: the exact sentinel
in every field passes only the initial mode; three `repository@sha256:` values
with 64 lowercase hexadecimal digests pass only the subsequent mode; and a
sentinel/digest mix fails. The checks also assert the template/process contain
the exact sentinel, mixed-set rejection, versioned changelog heading, fresh
`Unreleased` requirement, and `../../../CHANGELOG.md#` relative-link prefix.
Fresh local-link, placeholder, sole-pointer, and `git diff --check` checks
passed after this fix.
