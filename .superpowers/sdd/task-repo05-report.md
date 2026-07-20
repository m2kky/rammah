# REPO-05 Implementer Report

## Scope

REPO-05 normalizes the repository on npm native workspaces. The focused commit
adds the root contract for exactly `rammah-api` and `rammah-next`, pins the
verified Node/npm runtime, documents the commands, and retains all existing
package-level scripts.

## RED / inventory evidence

Before the implementation commit, `git show HEAD^:package.json` and
`git show HEAD^:package-lock.json` both failed because neither root file
existed. Both workspace lockfiles were tracked. There was therefore no root
workspace install contract or single-lockfile policy.

## Implementation

- Added root `package.json`, `package-lock.json`, and `.nvmrc` for Node
  `24.14.0` and npm `11.9.0`.
- Root scripts delegate through npm workspaces for lint, typecheck, future
  test hooks, build, E2E, smoke, preflight, Docker PostgreSQL Compose, and
  clean. No task-runner dependency or fake test was added.
- Kept package-level scripts and added only native Node `fs.rmSync` clean
  scripts for generated output.
- Replaced independent-workspace install instructions with root-install
  guidance. The root README explicitly states that unit, integration,
  coverage, and E2E suites do not exist yet and limits Docker claims to local
  PostgreSQL Compose.
- Regenerated the root lockfile, rather than hand-editing metadata, in a fresh
  clone of `602f8d1` with no `node_modules`: after `git rm -- package-lock.json`,
  npm `11.9.0` ran `npm install --package-lock-only --ignore-scripts
  --include=optional --no-audit --no-fund` with
  `omit-lockfile-registry-resolved=false`.
- Structural audit found `resolved` and `integrity` on every independently
  resolved registry package. The only metadata-free descendants are the six
  npm-marked `inBundle` records inside `@tailwindcss/oxide-wasm32-wasi`, which
  do not have independent tarballs. npm hoisted all eight Next 16.2.1
  `@next/swc-*` optional packages to `node_modules`; each has version,
  resolved, integrity, CPU, OS, engines, and optional metadata.
- The fresh resolution selected `eslint-plugin-react-hooks` 7.1.1 and exposed
  24 existing `react-hooks/set-state-in-effect` errors. A root npm override
  pins its previously working 7.0.1 release; it is a lock-compatible registry
  resolution, not a lint suppression or source change.
- Changed Turbopack's root from the workspace working directory to the
  repository parent using `path.resolve(__dirname, "..")`. The root lock
  hoists `next` there, and Turbopack intentionally cannot resolve files
  outside its configured root.
  Removed `rammah-api/package-lock.json` and `rammah-next/package-lock.json`.

## Verification

Verified with Node `v24.14.0` and npm `11.9.0` in a fresh disposable clone of
the amended commit. The root-only install used the generated lock; the exact
amended Turbopack configuration was then checked out before the final lint,
typecheck, and build gates.

| Check | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Passed: `added 530 packages in 3m`; only the root lockfile was present. npm emitted four dependency deprecation warnings (`@esbuild-kit/esm-loader`, `@esbuild-kit/core-utils`, `node-domexception`, and `glob`). |
| `npm ls --depth=0` | Exited 0 and listed both workspaces linked from the root. npm also labels its generated `@emnapi/runtime@1.11.2` optional record extraneous. |
| `npm run lint` | Passed. |
| `npm run typecheck` | Passed for API and frontend. |
| `npm run build` | Passed: API compiled and Next built all 31 pages. No incorrect-lockfile warning or lockfile-patch error appeared. |
| Documented root commands | Programmatic check confirmed all 13 documented root scripts exist. |
| Delegation failure propagation | `npm run lint -- -- --definitely-invalid-eslint-option` failed with npm exit code 1 after the frontend ESLint child exited 2. No tracked source changed. |
| `npm run clean` | Removed API `dist` and frontend `.next`; `rammah-next/public` remained present. The clean scripts also target only API `coverage` and frontend `coverage`/`dist`/`out`/`output`/`.playwright-cli`. |
| `git diff --check` | Passed. |

The Docker, smoke, and preflight commands were verified as present rather than
run because they require the local PostgreSQL service or a running API.

## Regression investigation

- RED: with the first fresh lock, two unchanged root lint runs each reported
  24 errors in 16 frontend files, all from `react-hooks/set-state-in-effect`.
  The old nested lock used `eslint-plugin-react-hooks` 7.0.1; fresh resolution
  used 7.1.1. Other relevant changes were ESLint/@eslint 9.39.4 to 9.39.5,
  `@eslint/eslintrc` 3.3.5 to 3.3.6, `eslint-import-resolver-node` 0.3.9 to
  0.3.10, and `eslint-module-utils` 2.12.1 to 2.14.0; `eslint-config-next`
  stayed 16.2.1.
- GREEN: changing only the disposable clone's `eslint-plugin-react-hooks` to
  7.0.1 made the unchanged root lint command pass. The root override makes
  npm generate that same resolution reproducibly.
- RED: with hoisted `next`, the old `turbopack.root: process.cwd()` excluded
  the parent `node_modules`, so root build failed to resolve
  `next/package.json` from `rammah-next/app`.
- GREEN: changing only Turbopack root to the repository parent made the root
  build pass and generate all 31 pages. This follows Next's documented root
  directory behavior for dependencies outside the project directory.

## Self-review

The diff remains limited to the workspace contract, lockfile normalization,
runtime pins, scripts, and their documentation. No manifest dependency, new
task runner, production container claim, remote, or generated artifact was
added. The disposable clone had no tracked-source changes after checks; the
main worktree is clean after this report is committed.
