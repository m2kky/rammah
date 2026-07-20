# Repository Consolidation Report

Executed: 2026-07-20 (Africa/Cairo)

## Outcome

Frontend source and its nine-commit history now live under `rammah-next/` in the root repository on branch `codex/production-readiness`. The history was rewritten with `git filter-repo --to-subdirectory-filter rammah-next` and merged without squashing. The pre-existing Methodology redesign was then applied and committed separately. Runtime log worktree changes were not imported.

The consolidation commits are:

- `6d53be7`: merge the rewritten frontend history into the root history.
- `449fb9b`: preserve the user-owned Methodology redesign as a one-file overlay.

The imported tree contains 625 frontend files, alongside 112 API files and the tracked project documentation. One root `git status` now owns all three workspaces in the isolated execution worktree.

## Recovery evidence

Original frontend repository:

- Path: `D:\projects\rammah\rammah-next`.
- Original HEAD: `7ffd30eeda964ca35ea1cd8603f6b19a209a257e`.
- Preservation tag: `pre-monorepo-2026-07-20`, pointing to that exact SHA in the source repository and bundle.
- Original commit count: 9.

Offline bundle:

- Path: `D:\projects\rammah-recovery\rammah-next-pre-monorepo-2026-07-20.bundle`.
- Size: 234,358,837 bytes.
- SHA-256: `e8475eaa0ac37e5307d9899ec167f47b03a805c8e136c373298689e53e3401bd`.
- `git bundle verify`: complete history, SHA-1 object format, original branch, remote branch, tag, and HEAD all resolve to `7ffd30e...`.
- Verification clone: created from the bundle in the ignored execution evidence directory; `git fsck --full` passes and its HEAD/tag both resolve to `7ffd30e...`.

The original nested repository remains intact as a recovery checkout outside the isolated execution worktree. It was changed only by adding the preservation tag; its three original worktree modifications remain present. The consolidated worktree itself contains no nested `.git` directory. The recovery checkout should be retired only after this branch is integrated into the final canonical repository.

## History rewrite map

`git-filter-repo` 2.47.0 produced this complete original-to-rewritten commit map:

| Original | Rewritten |
|---|---|
| `03b37defdf62226ab923113b8cd84272fd2f2429` | `dff6c20585f8342399061bf3d76d5c5063a471d6` |
| `0f2b3d5641803ff20cdd57049be5db4f0123624a` | `f11f6df23f23de89d3be1b45e901a77c13ed666c` |
| `239c06f71b040c894909be90b1e670abb079c455` | `c67e84295ce65a96fc3424814f1a28eedc0d78fd` |
| `5b40a7e189e8f00fa83b1f835d452ed3e1e6abc4` | `2d717c102d4f5eb022ea1462ceca344e7db0d86b` |
| `7ffd30eeda964ca35ea1cd8603f6b19a209a257e` | `d350b567895aab1cfb66a8661b10dadf502c8f48` |
| `8e2f2b9737ac7a455091f9fc2b45dc5622e252ff` | `3c470c050b28e8202d17cce5b33a07be11a0003e` |
| `e5271344f8e3e897f8b6e28da066ded22052ffd7` | `52456a08a55d8cd9f273b9900ddaed786d36e56a` |
| `eb8510e57ba8faaf3e036d729a35a53dbc2694aa` | `d2204fe82cc7c7b7e4e78f3398f2433cb0817505` |
| `f06fc7d77097e3d227e0471a6b715d03cca15980` | `ccb7f9cc553d104a67115344cf9392ee8a051d42` |

The rewritten head is `d350b567895aab1cfb66a8661b10dadf502c8f48`. It is an ancestor of the current root branch, and its rewritten history contains the same nine commits. The temporary local import remote was removed after the reachability check, so the branch has no dependency on the ignored temporary clone.

## Content verification

Before the Methodology overlay:

- Exactly 625 staged paths were imported and every path was under `rammah-next/`.
- No unmerged entries existed.
- Imported `MethodologySection.tsx` blob matched the original committed blob `71d6c761e08b35d653d6aa324e3f978847567f9e`.
- Imported committed log blobs matched the source HEAD blobs (`130f21c...` and `d6b65b6...`), proving that the dirty runtime-log worktree changes were excluded.

Normalized content manifests match the REPO-01 baseline exactly:

| Scope | Count | SHA-256 |
|---|---:|---|
| `rammah-next/public/**` with the import prefix removed | 505 | `720d762dd118f937baf5ab1381025c1e509c360dc205a27c6eed550a68762964` |
| All tracked frontend media with the import prefix removed | 513 | `3e8877e33259fac6899c71fbc22d75c096fad1a3d2f6d74fc6512ffbba2d414a` |

The Methodology overlay:

- changed only `rammah-next/components/MethodologySection.tsx`;
- contains 33 insertions and 66 deletions;
- produces blob `a67a7c8171ba21775d672b32b6ee68c0db6a4289`, exactly matching the preserved source worktree blob;
- passes `git diff --check` for the overlay commit.

`git log --follow -- rammah-next/components/MethodologySection.tsx` crosses the import boundary and reaches rewritten frontend commits `ccb7f9c...` and `52456a0...`, in addition to the overlay commit.

## Integrity notes

The imported historical snapshot contains pre-existing whitespace warnings and tracked runtime/browser artifacts. They were not normalized during history preservation because doing so would mix cleanup with the import and invalidate the content manifest. REPO-04 removes those artifacts from the current tree in a distinct, reviewable change.

Root `git fsck --no-reflogs` reports the 533 pre-existing dangling objects recorded in the baseline plus dangling commit `4911cba...`, which was made unreachable when the baseline documentation commit was amended to remove trailing whitespace. It reports no missing or corrupt reachable objects. The offline bundle and its verification clone are the authoritative recovery path for the original frontend object IDs.

## Acceptance

REPO-02 recovery and ancestry checks pass in the isolated worktree:

1. Original SHA and tag resolve in a checksummed, verified offline bundle.
2. All nine rewritten commits are reachable from the root branch.
3. Frontend file history follows across the import.
4. Public/media manifests match the baseline.
5. User-owned work matches the preserved blob in a separate commit.
6. Dirty runtime logs were not attributed as source work.
7. The consolidated target has one Git ownership boundary and no nested `.git`.
