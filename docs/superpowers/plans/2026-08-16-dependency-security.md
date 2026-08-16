# Dependency Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all currently reported production dependency vulnerabilities while preserving automatic Cloudflare country detection.

**Architecture:** Delete the bundled GeoIP fallback and accept country only from the configured provider header after existing trusted-proxy verification. Update the narrow PostCSS dependency chain or root resolution so production installs `nanoid >= 3.3.18` without forced major upgrades.

**Tech Stack:** Node.js 24, npm workspaces, Express, Vitest, Cloudflare headers.

## Global Constraints

- Automatic country detection remains server-side and has no customer override.
- Only a trusted configured provider header can provide a country.
- `npm audit fix --force` is forbidden.
- The production dependency tree must have zero known vulnerabilities.
- Do not introduce a replacement GeoIP database dependency.

---

### Task 1: Make country detection trusted-header only

**Files:**
- Modify: `rammah-api/src/modules/pricing/request-country.unit.test.ts`
- Modify: `rammah-api/src/shared/geo/request-country.ts`
- Modify: `rammah-api/package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `detectCountryFromRequest(req, options?)` returning source `"header" | null`.

- [ ] **Step 1: Rewrite tests for the desired behavior**

Assert a trusted Cloudflare header returns `{ countryCode: "EG", source: "header" }`, while an untrusted header, provider `none`, an invalid provider code, and an absent header all return `{ countryCode: null, source: null }`.

- [ ] **Step 2: Run unit test to verify RED**

Run: `npm run test:unit --workspace=rammah-api -- src/modules/pricing/request-country.unit.test.ts`

Expected: FAIL because the current function falls back to GeoIP.

- [ ] **Step 3: Remove GeoIP behavior and dependency**

Remove `createRequire`, `geoip-country`, IP lookup injection, and the `geoip` source variant. Preserve `normalizeIpAddress` only for immediate trusted-proxy checking.

```ts
export type RequestCountryDetection = {
  countryCode: string | null;
  source: "header" | null;
};
```

Run: `npm uninstall geoip-country --workspace=rammah-api`

- [ ] **Step 4: Run unit and pricing tests to verify GREEN**

Run: `npm run test:unit --workspace=rammah-api -- src/modules/pricing/request-country.unit.test.ts`

Run: `npm run test:unit --workspace=rammah-api`

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add rammah-api/src/shared/geo/request-country.ts rammah-api/src/modules/pricing/request-country.unit.test.ts rammah-api/package.json package-lock.json
git commit -m "fix(security): trust provider headers for country detection"
```

### Task 2: Upgrade the vulnerable nanoid resolution

**Files:**
- Modify: `package.json` only if a root override is required.
- Modify: `package-lock.json`

**Interfaces:**
- Produces: installed production `nanoid` version `>=3.3.18`.

- [ ] **Step 1: Record the failing security check**

Run: `npm audit --omit=dev`

Expected: non-zero with `nanoid <3.3.18` reported.

- [ ] **Step 2: Apply the narrow compatible update**

First run `npm update nanoid --workspaces`. If the transitive range remains pinned below `3.3.18`, add this root override and reinstall:

```json
{
  "overrides": {
    "eslint-plugin-react-hooks": "7.0.1",
    "nanoid": "^3.3.18"
  }
}
```

Run: `npm install`

- [ ] **Step 3: Verify the installed resolution**

Run: `npm ls nanoid --all`

Expected: every installed 3.x nanoid is `3.3.18` or newer.

- [ ] **Step 4: Verify the production audit**

Run: `npm audit --omit=dev`

Expected: `found 0 vulnerabilities` and exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "fix(security): update vulnerable nanoid resolution"
```

### Task 3: Full security regression verification

**Files:**
- Modify only files required by failures directly caused by Tasks 1-2.

- [ ] **Step 1: Verify no vulnerable packages remain**

Run: `npm ls geoip-country ip-address nanoid --all`

Expected: `geoip-country` and `ip-address` are absent; `nanoid` satisfies the security floor.

- [ ] **Step 2: Run repository checks**

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm run test:unit`

Expected: all exit 0.

- [ ] **Step 3: Run the production audit again**

Run: `npm audit --omit=dev`

Expected: zero vulnerabilities and exit 0.
