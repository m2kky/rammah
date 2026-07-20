# Production Readiness Baseline Snapshot

Captured: 2026-07-20 (Africa/Cairo)
Purpose: immutable pre-consolidation evidence for REPO-01. This snapshot records the ownership boundaries and recoverability checks that must survive repository cleanup and history consolidation.

## Repository boundaries

| Checkout | Branch | HEAD | Remote | Baseline status |
|---|---|---|---|---|
| Root source checkout, `D:\projects\rammah` | `master` | `a09d6e6477a62630605f2dd9bf28a2201ed1e689` | none | 0 tracked changes; 61 untracked entries |
| Isolated execution worktree, `D:\projects\rammah\.worktrees\production-readiness` | `codex/production-readiness` | `f572add770ed3ae1750e424be631d62c172f10a4` at capture start | none | one intentional `.gitignore` edit, committed separately as `c5cd957` before this snapshot |
| Nested frontend source, `D:\projects\rammah\rammah-next` | `master` | `7ffd30eeda964ca35ea1cd8603f6b19a209a257e` | `origin=https://github.com/m2kky/rammah.git`; tracks `origin/master` | 3 tracked modifications |

The root and frontend are independent Git repositories at this baseline. The root has no canonical remote or upstream. No tag points at either recorded HEAD.

## User-owned frontend changes

Only this source change is eligible for preservation as authored work:

- `components/MethodologySection.tsx`: 33 insertions, 66 deletions.
- HEAD blob: `71d6c761e08b35d653d6aa324e3f978847567f9e`.
- Worktree blob: `a67a7c8171ba21775d672b32b6ee68c0db6a4289`.
- `git diff --check -- components/MethodologySection.tsx`: passes, with only the existing Windows line-ending warning.
- A binary-safe patch is preserved in the ignored execution evidence directory at `.superpowers/artifacts/methodology-section.patch` before any import or cleanup.
- Preserved patch SHA-256: `25f7b3f13074a6f7ee5b020ca7b9865d70b7111a137af53baa1fc1f9cfec57d9`; reverse-apply validation against the live modified frontend passes.

The other two frontend modifications are tracked runtime output and must not be attributed as authored source:

- `dev-server.err.log`
- `dev-server.out.log`

At capture time the complete frontend diff was 51 insertions and 2,064 deletions across the component and those two logs. No reset, checkout, normalization, or cleanup has been performed in the source checkout.

## Content integrity

The frontend content manifest is computed from sorted `git ls-files -s` output, so it identifies tracked paths and Git blob IDs without depending on filesystem timestamps.

| Scope | Tracked files | SHA-256 of sorted index manifest |
|---|---:|---|
| Root `public/**` | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Root tracked image, font, icon, and video extensions | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `public/**` | 505 | `720d762dd118f937baf5ab1381025c1e509c360dc205a27c6eed550a68762964` |
| All tracked image, font, icon, and video extensions | 513 | `3e8877e33259fac6899c71fbc22d75c096fad1a3d2f6d74fc6512ffbba2d414a` |

Lockfile evidence:

- API `package-lock.json`: `eaf4178541d7de8ec41e54ce39625b37dc522eab194726fe02a6b810189d03a9`.
- Frontend `package-lock.json`: `b4950b77b2e701a0da2b0db63da12079368eff55b4e3c9327e419dde80b3deb9`.

## Object database checks

`git fsck --no-reflogs` completed for both repositories:

- Root: 533 dangling objects (532 trees and 1 blob); no missing or corrupt objects were reported.
- Frontend: one dangling commit, `f0df4d68cfec686696dcb90eff2e16d1aba0e9e7`; no missing or corrupt objects were reported.

Dangling objects are retained as recovery evidence until consolidation is verified. They are not treated as reachable product history.

## Root untracked inventory

The 61 root entries are intentionally left untouched. They include:

- generated/browser output: `.playwright-cli/`, `tmp_ref/`, `exported code`, and eight `*-dev/test-*.log` files;
- standalone prototype files and assets: `index.html`, `about.html`, `css/`, `js/`, `data/`, `services`, three image files, and the untracked root `package-lock.json`;
- the independent `rammah-next/` repository;
- architecture, UX, engineering, project-plan, product-requirement, meeting, PDF, and integration documentation under `docs/` and the root.

This inventory is evidence only. REPO-04 must classify every generated/runtime path before any untracking or deletion. Documentation and source-like entries must never be swept up by a broad cleanup command.

## Toolchain and executable baseline

- Git: `2.55.0.windows.3`.
- Node.js: `24.14.0`.
- npm: `11.9.0`.
- Docker: `29.2.1`; Docker Compose: `5.0.2`.
- `git filter-repo`: not installed globally at capture time.

API baseline:

- npm lockfile v3; clean tracked worktree; no `node_modules` in the isolated worktree.
- Existing gates: `typecheck`, `build`, `smoke`, `business-smoke`, and `preflight:prod`.
- Missing gates: `lint`, `test`, unit coverage, and integration-test scripts.
- Local runtime requires PostgreSQL plus `DATABASE_URL` and an `ADMIN_SESSION_SECRET` of at least 12 characters.

Frontend baseline:

- npm lockfile v3; Next.js 16.2.1 requires Node.js 20.9 or newer.
- Existing gates: `lint` and `build`; TypeScript can run with `npx tsc --noEmit`.
- Missing gates: a named `typecheck` script, tests, and coverage.
- Public API configuration uses `NEXT_PUBLIC_API_BASE_URL`.

The root has no workspace manifest, pinned runtime file, CI workflow, `README.md`, or `CODEOWNERS` at this point. Those are later Phase 0 deliverables, not baseline assumptions.

## Recovery acceptance criteria

Before the independent frontend repository can be retired, REPO-02 must prove all of the following:

1. A tag and an offline Git bundle identify and recover the exact frontend HEAD above.
2. The bundle passes clone and `git fsck` verification.
3. The imported root history contains the frontend ancestry under `rammah-next/` without squashing.
4. `git log --follow` reaches the pre-import component history.
5. The two manifest hashes above match after import.
6. The Methodology worktree blob matches `a67a7c8...` after its separate overlay commit.
7. Neither development log diff is imported as authored source.

Until all seven checks pass, the original nested `.git` directory remains the source of truth and must not be removed.
