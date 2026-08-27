# aCRL Official Recognition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a short, premium, fully CMS-managed aCRL official-recognition section to `/about`, with a local portrait and a safe deep link to Ahmed's official aCRL Academy listing.

**Architecture:** A `recognition` CMS section type owns its copy, external link, and single `portrait` media slot. One reusable React renderer normalizes incomplete CMS data through `getRecognitionContent`, renders both the custom About experience and generic CMS pages, and uses a local WebP fallback. An idempotent data-only Drizzle migration updates existing production content and media assignments, while the TypeScript seed mirrors the same state for fresh databases.

**Tech Stack:** Node.js 24.14.0, npm 11.9.0, TypeScript 5, Express 4, Drizzle ORM 0.45/PostgreSQL, Vitest 4, Next.js 16.3.0 App Router, React 19.2.4, GSAP 3.14, CSS Modules, Testing Library.

## Global Constraints

- Work only in `D:\projects\rammah\.worktrees\f0-contract-guard` on branch `codex/acrl-official-recognition`; preserve unrelated user changes.
- Execute inline with the primary agent; do not dispatch subagents unless the user explicitly changes that preference.
- Keep the approved factual copy verbatim; do not add accreditation, exclusivity, endorsement, or partnership claims beyond the official aCRL listing.
- Approved page URL: `https://acrl-academy.eu/acrl-academy-eddi-schulze-2/`.
- Approved CTA URL: `https://acrl-academy.eu/acrl-academy-eddi-schulze-2/#:~:text=Ahmed%20Sherif%20Rammah`.
- Official portrait source: `https://acrl-academy.eu/wp-content/uploads/2025/11/achmed4.png`; runtime rendering must use the local optimized copy, never this remote image.
- External CMS URLs must resolve to `http:` or `https:`; every other value falls back to the approved CTA URL.
- The CTA opens a new tab with `target="_blank"` and `rel="noopener noreferrer"`.
- The section is compact, responsive, keyboard accessible, and uses no pinning, scrubbing, parallax, or continuous portrait animation.
- Respect `prefers-reduced-motion`; without JavaScript or animation, all section content remains visible.
- Do not retrofit the pre-existing legacy About section types into the generic registry in this feature.
- Before changing Next.js code, install workspace dependencies if absent, resolve the installed Next package from the `rammah-next` workspace, and read its bundled App Router guides for linking/navigation, server/client components, CSS, and images.
- Use RED → GREEN → refactor for every behavior and finish each task with its focused tests and a dedicated commit.

---

### Task 1: Recognition Content Contract and Safe URL Resolver

**Files:**
- Modify: `rammah-next/lib/api/cms-content.ts`
- Modify: `rammah-next/lib/api/cms-content.test.ts`

**Interfaces:**
- Consumes: existing `PublicPageSection`, `CmsMedia`, and `fallbackMedia` contracts.
- Produces: `ACRL_PROFILE_URL`, `RecognitionContent`, and `getRecognitionContent(section: PublicPageSection | null): RecognitionContent`.

- [ ] **Step 1: Read the bundled Next.js rules required by the repository**

Run:

```powershell
$nextPackage = node -p "require.resolve('next/package.json',{paths:['./rammah-next']})" 2>$null
if ($LASTEXITCODE -ne 0) {
  npm install
  $nextPackage = node -p "require.resolve('next/package.json',{paths:['./rammah-next']})"
}
$nextDocs = Join-Path (Split-Path $nextPackage) 'dist/docs/01-app/01-getting-started'
Get-Content -Raw (Join-Path $nextDocs '04-linking-and-navigating.md')
Get-Content -Raw (Join-Path $nextDocs '05-server-and-client-components.md')
Get-Content -Raw (Join-Path $nextDocs '11-css.md')
Get-Content -Raw (Join-Path $nextDocs '12-images.md')
```

Expected: all four guides are readable from the installed Next `16.3.0` package.

- [ ] **Step 2: Write failing normalization and URL-safety tests**

Add `getRecognitionContent` to the import list in `cms-content.test.ts`, then add:

```ts
it("maps recognition copy, portrait, and a safe external CTA", () => {
  const fallbackPortrait = getRecognitionContent(null).portrait;
  const cmsPortrait = {
    ...fallbackPortrait,
    id: "recognition-portrait",
    publicUrl: "https://media.example.test/recognition.webp",
  };

  const content = getRecognitionContent(section("recognition", {
    title: "(04) Verified",
    body: "Official listing copy",
    config: {
      name: "Ahmed from CMS",
      roles: "Supervisor · Master Trainer",
      sourceLabel: "Official source",
      profileBadge: "Verified profile",
      cta: { label: "Open listing", url: "https://example.test/ahmed" },
    },
    media: { portrait: cmsPortrait },
  }));

  expect(content).toEqual({
    sectionLabel: "(04) Verified",
    name: "Ahmed from CMS",
    statement: "Official listing copy",
    roles: "Supervisor · Master Trainer",
    sourceLabel: "Official source",
    profileBadge: "Verified profile",
    ctaLabel: "Open listing",
    ctaUrl: "https://example.test/ahmed",
    portrait: cmsPortrait,
  });
});

it.each(["javascript:alert(1)", "data:text/html,broken", "/relative-link", "   "])(
  "falls back from unsupported recognition URL %s",
  (url) => {
    const content = getRecognitionContent(section("recognition", {
      config: { cta: { label: "Official profile", url } },
    }));

    expect(content.ctaUrl).toBe(
      "https://acrl-academy.eu/acrl-academy-eddi-schulze-2/#:~:text=Ahmed%20Sherif%20Rammah",
    );
  },
);

it("uses approved field-level fallbacks for an incomplete recognition section", () => {
  const content = getRecognitionContent(section("recognition", {
    title: null,
    body: " ",
    config: { name: "", roles: null, cta: {} },
  }));

  expect(content.sectionLabel).toBe("(04) Official recognition");
  expect(content.name).toBe("Ahmed Sherif Rammah");
  expect(content.statement).toContain("aCRL® Cooperation & Project Partners");
  expect(content.portrait.publicUrl).toBe("/acrl-ahmed-rammah.webp");
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```powershell
npm --prefix rammah-next exec vitest run lib/api/cms-content.test.ts
```

Expected: FAIL because `getRecognitionContent` is not exported.

- [ ] **Step 4: Implement the normalized recognition content model**

Add to `cms-content.ts` after the section/config helpers:

```ts
export const ACRL_PROFILE_URL =
  "https://acrl-academy.eu/acrl-academy-eddi-schulze-2/#:~:text=Ahmed%20Sherif%20Rammah";

const recognitionFallbackPortrait = fallbackMedia(
  "acrl-recognition-portrait",
  "image",
  "image/webp",
  "/acrl-ahmed-rammah.webp",
  "Ahmed Sherif Rammah on the official aCRL Academy website",
  {
    sourceUrl: "https://acrl-academy.eu/wp-content/uploads/2025/11/achmed4.png",
    officialPage: "https://acrl-academy.eu/acrl-academy-eddi-schulze-2/",
  },
  300,
  300,
);

const nonEmptyString = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const safeExternalUrl = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : fallback;
  } catch {
    return fallback;
  }
};

export type RecognitionContent = {
  sectionLabel: string;
  name: string;
  statement: string;
  roles: string;
  sourceLabel: string;
  profileBadge: string;
  ctaLabel: string;
  ctaUrl: string;
  portrait: CmsMedia;
};

export const getRecognitionContent = (
  section: PublicPageSection | null,
): RecognitionContent => {
  const cta = typeof section?.config.cta === "object" && section.config.cta
    ? section.config.cta as { label?: unknown; url?: unknown }
    : {};
  const portraitValue = section?.media.portrait;
  const portrait = Array.isArray(portraitValue) ? portraitValue[0] : portraitValue;

  return {
    sectionLabel: nonEmptyString(section?.title, "(04) Official recognition"),
    name: nonEmptyString(section?.config.name, "Ahmed Sherif Rammah"),
    statement: nonEmptyString(
      section?.body,
      "Officially listed among aCRL® Cooperation & Project Partners — Middle East.",
    ),
    roles: nonEmptyString(
      section?.config.roles,
      "Supervisor aCRL® Middle East · Master Trainer aCRL®",
    ),
    sourceLabel: nonEmptyString(section?.config.sourceLabel, "acrl-academy.eu"),
    profileBadge: nonEmptyString(section?.config.profileBadge, "Official profile"),
    ctaLabel: nonEmptyString(cta.label, "View Ahmed on aCRL® Academy"),
    ctaUrl: safeExternalUrl(cta.url, ACRL_PROFILE_URL),
    portrait: portrait ?? recognitionFallbackPortrait,
  };
};
```

- [ ] **Step 5: Run GREEN checks and commit**

Run:

```powershell
npm --prefix rammah-next exec vitest run lib/api/cms-content.test.ts
npm --prefix rammah-next run typecheck
git add rammah-next/lib/api/cms-content.ts rammah-next/lib/api/cms-content.test.ts
git commit -m "feat(cms): normalize aCRL recognition content"
```

Expected: focused tests and typecheck PASS; commit contains only the content contract.

---

### Task 2: CMS Definition, Generic Renderer, and Premium UI

**Files:**
- Modify: `rammah-api/src/modules/cms/cms-definitions.ts`
- Modify: `rammah-api/src/modules/cms/cms-definitions.unit.test.ts`
- Modify: `rammah-next/lib/cms/section-renderer-registry.json`
- Modify: `rammah-next/components/cms/sectionRenderers.ts`
- Create: `rammah-next/components/about/RecognitionSection.tsx`
- Create: `rammah-next/components/about/RecognitionSection.module.css`
- Create: `rammah-next/components/about/RecognitionSection.test.tsx`

**Interfaces:**
- Consumes: Task 1 `getRecognitionContent(section)`.
- Produces: `recognition` definition with `portrait` single-image slot and `RecognitionSection({ section })` reusable renderer.

- [ ] **Step 1: Write failing registry and renderer tests**

In `cms-definitions.unit.test.ts`, insert `"recognition"` before `"cta"` in the exact section-key expectation and add:

```ts
expect(resolveSectionMediaSlot("recognition", "portrait")).toMatchObject({
  accepts: ["image"],
  cardinality: "single",
  required: false,
});
```

Create `RecognitionSection.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PublicPageSection } from "@/lib/api/cms";
import { RecognitionSection } from "./RecognitionSection";

const section: PublicPageSection = {
  id: "recognition-id",
  sectionType: "recognition",
  title: "(04) Official recognition",
  body: "Officially listed by aCRL.",
  config: {
    name: "Ahmed Sherif Rammah",
    roles: "Supervisor · Master Trainer",
    sourceLabel: "acrl-academy.eu",
    profileBadge: "Official profile",
    cta: { label: "View official profile", url: "https://example.test/ahmed" },
  },
  media: {},
  sortOrder: 60,
};

describe("RecognitionSection", () => {
  it("renders factual copy and a safe new-tab CTA", () => {
    render(<RecognitionSection section={section} />);

    expect(screen.getByRole("heading", { name: "Ahmed Sherif Rammah" })).toBeVisible();
    expect(screen.getByRole("link", { name: /View official profile/ })).toHaveAttribute(
      "href",
      "https://example.test/ahmed",
    );
    expect(screen.getByRole("link", { name: /View official profile/ })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByRole("link", { name: /View official profile/ })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("keeps the text and CTA usable when the portrait fails", () => {
    render(<RecognitionSection section={section} />);
    fireEvent.error(screen.getByRole("img"));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ahmed Sherif Rammah" })).toBeVisible();
    expect(screen.getByRole("link", { name: /View official profile/ })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm --prefix rammah-api exec vitest run --config vitest.config.ts src/modules/cms/cms-definitions.unit.test.ts
npm --prefix rammah-next exec vitest run --config vitest.components.config.ts components/about/RecognitionSection.test.tsx
```

Expected: API test misses `recognition`; component test cannot import `RecognitionSection`.

- [ ] **Step 3: Add the CMS definition and renderer registry entry**

Add this definition before `cta` in `cms-definitions.ts`:

```ts
{
  key: "recognition",
  label: "Official Recognition",
  description: "Verified external profile with portrait, roles, source, and action.",
  fields: [
    { key: "title", label: "Section label", type: "text", required: true },
    { key: "name", label: "Name", type: "text", required: true },
    { key: "body", label: "Official statement", type: "text", required: true },
    { key: "roles", label: "Roles", type: "text", required: true },
    { key: "sourceLabel", label: "Source label", type: "text", required: true },
    { key: "profileBadge", label: "Portrait badge", type: "text" },
    { key: "cta", label: "Official profile action", type: "link", required: true },
    singleImage("portrait", "Portrait"),
  ],
},
```

Add `"recognition": "RecognitionSection"` before `cta` in `section-renderer-registry.json`. Import `RecognitionSection` from `../about/RecognitionSection` in `sectionRenderers.ts` and add `recognition: RecognitionSection` to `SECTION_RENDERERS`.

- [ ] **Step 4: Implement the approved reusable renderer**

Create `RecognitionSection.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { PublicPageSection } from "@/lib/api/cms";
import { getRecognitionContent } from "@/lib/api/cms-content";
import styles from "./RecognitionSection.module.css";

export function RecognitionSection({ section }: { section: PublicPageSection | null }) {
  const content = getRecognitionContent(section);
  const [imageFailed, setImageFailed] = useState(false);
  const headingId = `acrl-recognition-${section?.id ?? "fallback"}`;

  return (
    <section className={styles.section} data-recognition aria-labelledby={headingId}>
      <div className={`${styles.inner} ${imageFailed ? styles.withoutPortrait : ""}`}>
        {!imageFailed ? (
          <div className={styles.visual} data-recognition-reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.portrait.publicUrl}
              alt={content.portrait.decorative ? "" : content.portrait.altText ?? ""}
              width={content.portrait.width ?? 300}
              height={content.portrait.height ?? 300}
              className={styles.portrait}
              onError={() => setImageFailed(true)}
            />
            <span className={styles.badge}>{content.profileBadge}</span>
          </div>
        ) : null}

        <div className={styles.content}>
          <div className={styles.topline} data-recognition-reveal>
            <span>{content.sectionLabel}</span>
            <span>{content.sourceLabel}</span>
          </div>
          <h2 id={headingId} data-recognition-reveal>{content.name}</h2>
          <p className={styles.statement} data-recognition-reveal>{content.statement}</p>
          <p className={styles.roles} data-recognition-reveal>{content.roles}</p>
          <a
            href={content.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cta}
            data-recognition-reveal
          >
            <span>{content.ctaLabel}</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
```

Create `RecognitionSection.module.css`:

```css
.section {
  background: #0f3b46;
  color: #f1f4ee;
}

.inner {
  display: grid;
  grid-template-columns: minmax(15rem, 0.72fr) minmax(0, 1.28fr);
  align-items: center;
  gap: clamp(2.5rem, 7vw, 8rem);
  width: min(100%, 1600px);
  margin: 0 auto;
  padding: clamp(4rem, 7vw, 7rem) 5vw;
}

.withoutPortrait {
  grid-template-columns: minmax(0, 1fr);
}

.visual {
  position: relative;
  width: min(100%, 25rem);
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid rgba(241, 244, 238, 0.2);
  background: #08171a;
}

.portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1) contrast(1.04);
}

.badge {
  position: absolute;
  left: 1rem;
  bottom: 1rem;
  padding: 0.55rem 0.8rem;
  background: #f1f4ee;
  color: #0f3b46;
  font: 600 0.68rem/1 var(--font-inter), sans-serif;
  text-transform: uppercase;
}

.content {
  min-width: 0;
}

.topline {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(241, 244, 238, 0.22);
  color: rgba(241, 244, 238, 0.65);
  font: 600 0.7rem/1.4 var(--font-inter), sans-serif;
  text-transform: uppercase;
}

.content h2 {
  margin-top: clamp(2rem, 4vw, 3.5rem);
  font-size: clamp(3rem, 6.3vw, 7rem);
  font-weight: 650;
  line-height: 0.9;
  letter-spacing: -0.035em;
}

.statement {
  max-width: 48rem;
  margin-top: 2rem;
  font-size: clamp(1.15rem, 1.8vw, 1.65rem);
  line-height: 1.45;
}

.roles {
  margin-top: 1rem;
  color: rgba(241, 244, 238, 0.66);
  font: 500 0.92rem/1.6 var(--font-inter), sans-serif;
}

.cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  width: min(100%, 30rem);
  min-height: 3.5rem;
  margin: 2.5rem 0 0 auto;
  padding: 0 1.25rem;
  border: 1px solid #f1f4ee;
  background: #f1f4ee;
  color: #0f3b46;
  font: 650 0.78rem/1 var(--font-inter), sans-serif;
  transition: transform 180ms ease, background-color 180ms ease, color 180ms ease;
}

.cta:hover {
  transform: translateY(-2px);
  background: transparent;
  color: #f1f4ee;
}

.cta:focus-visible {
  outline: 3px solid #7df2c7;
  outline-offset: 4px;
}

@media (max-width: 899px) {
  .inner {
    grid-template-columns: minmax(9rem, 0.72fr) minmax(0, 1.28fr);
    gap: 1.5rem;
    padding: 4.5rem 1.25rem;
  }

  .withoutPortrait {
    grid-template-columns: minmax(0, 1fr);
  }

  .content h2 {
    font-size: clamp(2.6rem, 9vw, 4.5rem);
  }

  .topline {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.5rem;
  }
}

@media (max-width: 639px) {
  .inner {
    grid-template-columns: minmax(0, 1fr);
  }

  .visual {
    width: min(64vw, 14rem);
  }

  .cta {
    width: 100%;
    min-height: 3rem;
    margin-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cta {
    transition: none;
  }
}
```

- [ ] **Step 5: Run GREEN checks and commit**

Run:

```powershell
npm --prefix rammah-api exec vitest run --config vitest.config.ts src/modules/cms/cms-definitions.unit.test.ts
npm --prefix rammah-next exec vitest run --config vitest.components.config.ts components/about/RecognitionSection.test.tsx
npm --prefix rammah-api run typecheck
npm --prefix rammah-next run typecheck
git add rammah-api/src/modules/cms/cms-definitions.ts rammah-api/src/modules/cms/cms-definitions.unit.test.ts rammah-next/lib/cms/section-renderer-registry.json rammah-next/components/cms/sectionRenderers.ts rammah-next/components/about/RecognitionSection.tsx rammah-next/components/about/RecognitionSection.module.css rammah-next/components/about/RecognitionSection.test.tsx
git commit -m "feat(cms): add aCRL recognition renderer"
```

Expected: API registry parity, component tests, and both typechecks PASS.

---

### Task 3: About Page Placement, Numbering, and Restrained Reveal

**Files:**
- Modify: `rammah-next/components/about/AboutExperience.tsx`
- Create: `rammah-next/lib/about-recognition-behavior.test.ts`
- Modify: `rammah-next/lib/cms-media-inventory.test.ts`

**Interfaces:**
- Consumes: Task 2 `RecognitionSection` and registered `recognition` section type.
- Produces: exact story → recognition → reach order and new `(05)`/`(06)` fallbacks.

- [ ] **Step 1: Write failing source-contract tests**

Create `about-recognition-behavior.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "components", "about", "AboutExperience.tsx"),
  "utf8",
);

describe("About recognition placement", () => {
  it("renders recognition between story and reach with the updated numbering", () => {
    expect(source).toContain('findPublicSection(page, "recognition")');
    const storyIndex = source.indexOf(`className={styles.story}`);
    const recognitionIndex = source.indexOf("<RecognitionSection");
    const reachIndex = source.indexOf(`className={styles.world}`);

    expect(storyIndex).toBeGreaterThan(-1);
    expect(recognitionIndex).toBeGreaterThan(storyIndex);
    expect(reachIndex).toBeGreaterThan(recognitionIndex);
    expect(source).toContain('"(05) The reach"');
    expect(source).toContain('"(06) Start the work"');
  });

  it("uses one non-scrubbed recognition reveal and no recognition pinning", () => {
    const start = source.indexOf('gsap.from("[data-recognition-reveal]"');
    const end = source.indexOf("const globeTimeline", start);
    const recognitionAnimation = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(recognitionAnimation).toContain('trigger: "[data-recognition]"');
    expect(recognitionAnimation).toContain("once: true");
    expect(recognitionAnimation).not.toContain("scrub:");
    expect(recognitionAnimation).not.toContain("pin:");
  });
});
```

Add `"components/about/RecognitionSection.tsx"` to `consumers` in `cms-media-inventory.test.ts` and extend `knownRenderedPaths` with `acrl-ahmed-rammah\.webp`. This keeps the hard-coded fallback centralized in `cms-content.ts` rather than the renderer.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm --prefix rammah-next exec vitest run lib/about-recognition-behavior.test.ts lib/cms-media-inventory.test.ts
```

Expected: placement and numbering assertions FAIL because the section is not yet mounted.

- [ ] **Step 3: Mount the recognition section in the exact approved position**

In `AboutExperience.tsx`:

```tsx
import { RecognitionSection } from "./RecognitionSection";
```

Add beside the other section lookups:

```ts
const recognitionSec = findPublicSection(page, "recognition");
```

Change the fallbacks:

```ts
const reachTitle = reachSec?.title || "(05) The reach";
const ctaTitle = ctaSec?.title || "(06) Start the work";
```

Insert immediately after the closing story `</section>` and before the world section:

```tsx
<RecognitionSection section={recognitionSec} />
```

- [ ] **Step 4: Add the restrained one-time reveal**

Inside the existing `if (!reduceMotion)` GSAP branch, after the story animation and before the world timeline, add:

```ts
gsap.from("[data-recognition-reveal]", {
  autoAlpha: 0,
  y: 24,
  stagger: 0.08,
  duration: 0.72,
  ease: "power3.out",
  scrollTrigger: {
    trigger: "[data-recognition]",
    start: "top 82%",
    once: true,
  },
});
```

- [ ] **Step 5: Run GREEN checks and commit**

Run:

```powershell
npm --prefix rammah-next exec vitest run lib/about-recognition-behavior.test.ts lib/cms-media-inventory.test.ts lib/about-globe-behavior.test.ts
npm --prefix rammah-next run typecheck
git add rammah-next/components/about/AboutExperience.tsx rammah-next/lib/about-recognition-behavior.test.ts rammah-next/lib/cms-media-inventory.test.ts
git commit -m "feat(about): place official aCRL recognition"
```

Expected: placement, media inventory, globe regression, and typecheck PASS.

---

### Task 4: Local Portrait, Fresh Seed, and Idempotent Production Migration

**Files:**
- Create: `rammah-next/public/acrl-ahmed-rammah.webp`
- Modify: `rammah-api/src/db/seed.ts`
- Create: generated `rammah-api/drizzle/0014_acrl_recognition.sql`
- Create: generated `rammah-api/drizzle/meta/0014_snapshot.json`
- Modify: generated `rammah-api/drizzle/meta/_journal.json`
- Modify: `rammah-api/drizzle/migration-lock.json`
- Create: `rammah-api/src/test/acrl-recognition-migration.integration.test.ts`

**Interfaces:**
- Consumes: `recognition.portrait` slot and local path `/acrl-ahmed-rammah.webp` from Tasks 1–2.
- Produces: one production recognition section, one managed portrait asset, one portrait assignment, reach sort `70`, CTA sort `80`, and matching fresh-seed state.

- [ ] **Step 1: Create and verify the optimized local portrait**

Run this deterministic Sharp conversion from the official 300×300 PNG:

```powershell
Push-Location 'rammah-next'
node --input-type=module -e "import sharp from 'sharp'; const source='https://acrl-academy.eu/wp-content/uploads/2025/11/achmed4.png'; const response=await fetch(source); if(!response.ok) throw new Error('Portrait download failed: '+response.status); const input=Buffer.from(await response.arrayBuffer()); await sharp(input).resize(300,300,{fit:'cover'}).webp({quality:86,smartSubsample:true}).toFile('public/acrl-ahmed-rammah.webp');"
node --input-type=module -e "import sharp from 'sharp'; const metadata=await sharp('public/acrl-ahmed-rammah.webp').metadata(); if(metadata.format!=='webp'||metadata.width!==300||metadata.height!==300) throw new Error(JSON.stringify(metadata)); console.log(metadata.format, metadata.width, metadata.height);"
Pop-Location
```

Expected: `webp 300 300`; the public asset is substantially smaller than the source PNG and contains no runtime dependency on the aCRL host.

- [ ] **Step 2: Write the failing migration integration test**

Create `acrl-recognition-migration.integration.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  mediaAssets,
  pageSections,
  pages,
  sectionMediaAssignments,
} from "../db/schema/index.js";
import { getTestDatabase } from "./db.js";

const migrationSql = readFileSync(
  new URL("../../drizzle/0014_acrl_recognition.sql", import.meta.url),
  "utf8",
).replaceAll("--> statement-breakpoint", "");

describe.sequential("aCRL recognition migration", () => {
  it("is idempotent, preserves custom titles, and assigns the local portrait", async () => {
    const { db, pool } = getTestDatabase();
    const [about] = await db.insert(pages).values({
      slug: "about",
      title: "About Ahmed Rammah",
      template: "about",
      status: "published",
    }).returning();
    const [otherPage] = await db.insert(pages).values({
      slug: "migration-unrelated",
      title: "Unrelated page",
      template: "default",
      status: "published",
    }).returning();

    const insertedSections = await db.insert(pageSections).values([
      {
        pageId: about!.id,
        sectionType: "reach",
        title: "(04) The reach",
        sortOrder: 60,
        status: "published",
      },
      {
        pageId: about!.id,
        sectionType: "cta",
        title: "A custom CTA title",
        sortOrder: 70,
        status: "published",
      },
      {
        pageId: about!.id,
        sectionType: "reach",
        title: "Archived reach",
        sortOrder: 600,
        status: "archived",
      },
      {
        pageId: otherPage!.id,
        sectionType: "reach",
        title: "Unrelated reach",
        sortOrder: 60,
        status: "published",
      },
    ]).returning();
    const archivedReach = insertedSections.find(({ title }) => title === "Archived reach")!;
    const unrelatedReach = insertedSections.find(({ title }) => title === "Unrelated reach")!;

    await pool.query(migrationSql);
    await pool.query(migrationSql);

    const sections = await db.select().from(pageSections)
      .where(eq(pageSections.pageId, about!.id));
    const recognition = sections.filter(({ sectionType }) => sectionType === "recognition");
    expect(recognition).toHaveLength(1);
    expect(recognition[0]).toMatchObject({
      title: "(04) Official recognition",
      sortOrder: 60,
      status: "published",
    });
    expect(sections.find(({ sectionType, status }) =>
      sectionType === "reach" && status !== "archived"
    )).toMatchObject({
      title: "(05) The reach",
      sortOrder: 70,
    });
    expect(sections.find(({ sectionType }) => sectionType === "cta")).toMatchObject({
      title: "A custom CTA title",
      sortOrder: 80,
    });

    const portraits = await db.select().from(mediaAssets).where(
      and(
        eq(mediaAssets.sourceType, "external"),
        eq(mediaAssets.publicUrl, "/acrl-ahmed-rammah.webp"),
      ),
    );
    expect(portraits).toHaveLength(1);

    const assignments = await db.select().from(sectionMediaAssignments).where(
      and(
        eq(sectionMediaAssignments.pageSectionId, recognition[0]!.id),
        eq(sectionMediaAssignments.slotKey, "portrait"),
      ),
    );
    expect(assignments).toHaveLength(1);
    expect(assignments[0]!.mediaAssetId).toBe(portraits[0]!.id);

    const [archivedAfter] = await db.select().from(pageSections)
      .where(eq(pageSections.id, archivedReach.id));
    const [unrelatedAfter] = await db.select().from(pageSections)
      .where(eq(pageSections.id, unrelatedReach.id));
    expect(archivedAfter).toMatchObject({ title: "Archived reach", sortOrder: 600 });
    expect(unrelatedAfter).toMatchObject({ title: "Unrelated reach", sortOrder: 60 });
  });
});
```

- [ ] **Step 3: Generate an empty data migration and verify RED**

Run:

```powershell
npm --prefix rammah-api run db:migrations:preflight
npm --prefix rammah-api run db:generate -- --custom --name=acrl_recognition
npm --prefix rammah-api run test:db:wait
npm --prefix rammah-api exec vitest run --config vitest.integration.config.ts src/test/acrl-recognition-migration.integration.test.ts
```

Expected: preflight reports current `0013`/next `0014`; Drizzle creates exactly one `0014_acrl_recognition` journal entry and snapshot; integration test FAILS because the empty migration does not insert recognition data.

- [ ] **Step 4: Implement the exact idempotent migration SQL**

Replace the generated empty SQL body with:

```sql
DO $$
DECLARE
  about_page_id uuid;
  recognition_section_id uuid;
  portrait_asset_id uuid;
BEGIN
  SELECT id INTO about_page_id
  FROM pages
  WHERE slug = 'about' AND status = 'published'
  LIMIT 1;

  IF about_page_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO recognition_section_id
  FROM page_sections
  WHERE page_id = about_page_id
    AND section_type = 'recognition'
    AND status <> 'archived'
  ORDER BY sort_order, id
  LIMIT 1;

  IF recognition_section_id IS NULL THEN
    INSERT INTO page_sections (
      page_id,
      section_type,
      title,
      body,
      config,
      sort_order,
      status
    ) VALUES (
      about_page_id,
      'recognition',
      '(04) Official recognition',
      'Officially listed among aCRL® Cooperation & Project Partners — Middle East.',
      jsonb_build_object(
        'name', 'Ahmed Sherif Rammah',
        'roles', 'Supervisor aCRL® Middle East · Master Trainer aCRL®',
        'sourceLabel', 'acrl-academy.eu',
        'profileBadge', 'Official profile',
        'cta', jsonb_build_object(
          'label', 'View Ahmed on aCRL® Academy',
          'url', 'https://acrl-academy.eu/acrl-academy-eddi-schulze-2/#:~:text=Ahmed%20Sherif%20Rammah'
        )
      ),
      60,
      'published'
    )
    RETURNING id INTO recognition_section_id;
  END IF;

  UPDATE page_sections
  SET
    title = CASE
      WHEN title IS NULL OR title = '(04) The reach' THEN '(05) The reach'
      ELSE title
    END,
    sort_order = 70,
    updated_at = now()
  WHERE page_id = about_page_id
    AND section_type = 'reach'
    AND status <> 'archived';

  UPDATE page_sections
  SET
    title = CASE
      WHEN title IS NULL OR title = '(05) Start the work' THEN '(06) Start the work'
      ELSE title
    END,
    sort_order = 80,
    updated_at = now()
  WHERE page_id = about_page_id
    AND section_type = 'cta'
    AND status <> 'archived';

  SELECT id INTO portrait_asset_id
  FROM media_assets
  WHERE source_type = 'external'
    AND public_url = '/acrl-ahmed-rammah.webp'
  ORDER BY id
  LIMIT 1;

  IF portrait_asset_id IS NULL THEN
    INSERT INTO media_assets (
      display_name,
      file_name,
      mime_type,
      source_type,
      media_kind,
      public_url,
      alt_text,
      size_bytes,
      width,
      height,
      metadata,
      processing_state,
      status
    ) VALUES (
      'Ahmed Rammah — official aCRL profile',
      'acrl-ahmed-rammah.webp',
      'image/webp',
      'external',
      'image',
      '/acrl-ahmed-rammah.webp',
      'Ahmed Sherif Rammah on the official aCRL Academy website',
      0,
      300,
      300,
      jsonb_build_object(
        'sourceUrl', 'https://acrl-academy.eu/wp-content/uploads/2025/11/achmed4.png',
        'officialPage', 'https://acrl-academy.eu/acrl-academy-eddi-schulze-2/'
      ),
      'ready',
      'published'
    )
    RETURNING id INTO portrait_asset_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM section_media_assignments
    WHERE page_section_id = recognition_section_id
      AND slot_key = 'portrait'
  ) THEN
    INSERT INTO section_media_assignments (
      page_section_id,
      slot_key,
      media_asset_id,
      sort_order,
      decorative
    ) VALUES (
      recognition_section_id,
      'portrait',
      portrait_asset_id,
      0,
      false
    );
  END IF;
END $$;
```

- [ ] **Step 5: Mirror the migration state in the TypeScript seed**

In `seed.ts`:

1. Import `sectionMediaAssignments`.
2. Add this `mediaSeeds` item:

```ts
{
  key: "acrlRecognitionPortrait",
  displayName: "Ahmed Rammah — official aCRL profile",
  fileName: "acrl-ahmed-rammah.webp",
  publicUrl: "/acrl-ahmed-rammah.webp",
  mimeType: "image/webp",
  mediaKind: "image",
  altText: "Ahmed Sherif Rammah on the official aCRL Academy website",
  metadata: {
    sourceUrl: "https://acrl-academy.eu/wp-content/uploads/2025/11/achmed4.png",
    officialPage: "https://acrl-academy.eu/acrl-academy-eddi-schulze-2/",
  },
},
```

3. Add the recognition section after story, change reach/CTA values, and preserve exact sort orders:

```ts
{ sectionType: "recognition", title: "(04) Official recognition", body: "Officially listed among aCRL® Cooperation & Project Partners — Middle East.", config: { name: "Ahmed Sherif Rammah", roles: "Supervisor aCRL® Middle East · Master Trainer aCRL®", sourceLabel: "acrl-academy.eu", profileBadge: "Official profile", cta: { label: "View Ahmed on aCRL® Academy", url: "https://acrl-academy.eu/acrl-academy-eddi-schulze-2/#:~:text=Ahmed%20Sherif%20Rammah" } }, sortOrder: 60 },
{ sectionType: "reach", title: "(05) The reach", body: "One language for human patterns. Across borders.", config: { pioneerText: "Bringing the aCRL methodology to the Arab World for the first time. The absolute pioneer and sole Master Trainer in the region.", stats: [["10+", "years in engineering and systems thinking"], ["1,500+", "behavioral profiles analyzed"], ["22+", "countries reached through training"]] }, sortOrder: 70 },
{ sectionType: "cta", title: "(06) Start the work", body: "Your patterns already tell a story. Let's read it properly.", config: {}, sortOrder: 80 },
```

4. End `seedManagedMedia` by returning the map, capture it, then assign the portrait without replacing an existing slot:

```ts
  return assetIds;
};

const assetIds = await seedManagedMedia();
```

Use the captured map for the section assignment:

```ts
const [recognitionSection] = await db
  .select({ id: pageSections.id })
  .from(pageSections)
  .innerJoin(pages, eq(pages.id, pageSections.pageId))
  .where(and(
    eq(pages.slug, "about"),
    eq(pageSections.sectionType, "recognition"),
  ))
  .limit(1);
const recognitionPortraitId = assetIds.get("acrlRecognitionPortrait");

if (!recognitionSection || !recognitionPortraitId) {
  throw new Error("Missing seeded aCRL recognition section or portrait");
}

await db.insert(sectionMediaAssignments).values({
  pageSectionId: recognitionSection.id,
  slotKey: "portrait",
  mediaAssetId: recognitionPortraitId,
  sortOrder: 0,
  decorative: false,
}).onConflictDoNothing();
```

- [ ] **Step 6: Lock migration metadata, run GREEN checks twice, and commit**

Append the generated migration hashes mechanically after reviewing the SQL and snapshot:

```powershell
node --input-type=module -e "import {createHash} from 'node:crypto'; import {readFileSync,writeFileSync} from 'node:fs'; const journalPath='rammah-api/drizzle/meta/_journal.json'; const lockPath='rammah-api/drizzle/migration-lock.json'; const journal=JSON.parse(readFileSync(journalPath,'utf8')); const entry=journal.entries.at(-1); if(entry.tag!=='0014_acrl_recognition') throw new Error('Unexpected migration '+entry.tag); const digest=(path)=>createHash('sha256').update(readFileSync(path,'utf8')).digest('hex'); const lock=JSON.parse(readFileSync(lockPath,'utf8')); if(!lock.lockedMigrations.some((item)=>item.tag===entry.tag)){ lock.lockedMigrations.push({tag:entry.tag,sqlSha256:digest('rammah-api/drizzle/'+entry.tag+'.sql'),snapshotSha256:digest('rammah-api/drizzle/meta/0014_snapshot.json')}); writeFileSync(lockPath,JSON.stringify(lock,null,2)+'\n'); }"
npm --prefix rammah-api run db:migrations:preflight
npm --prefix rammah-api exec vitest run --config vitest.integration.config.ts src/test/acrl-recognition-migration.integration.test.ts
npm --prefix rammah-api exec vitest run --config vitest.integration.config.ts src/test/acrl-recognition-migration.integration.test.ts
npm --prefix rammah-api run typecheck
git add rammah-next/public/acrl-ahmed-rammah.webp rammah-api/src/db/seed.ts rammah-api/drizzle/0014_acrl_recognition.sql rammah-api/drizzle/meta/0014_snapshot.json rammah-api/drizzle/meta/_journal.json rammah-api/drizzle/migration-lock.json rammah-api/src/test/acrl-recognition-migration.integration.test.ts
git commit -m "feat(cms): migrate official aCRL recognition"
```

Expected: migration preflight reports current `0014`/next `0015`; both integration runs PASS; only one recognition section, portrait asset, and portrait assignment exist.

---

### Task 5: Full Verification and Live UX Evidence

**Files:**
- Verify only; modify implementation files only if a failing check identifies a defect within this feature.

**Interfaces:**
- Consumes: Tasks 1–4 complete feature.
- Produces: test, build, responsive, accessibility, interaction, and external-link evidence ready for merge/push review.

- [ ] **Step 1: Run all focused and repository-level automated checks**

Run:

```powershell
npm --prefix rammah-api run db:migrations:preflight
npm --prefix rammah-api run test:unit
npm --prefix rammah-api run test:integration
npm --prefix rammah-api run typecheck
npm --prefix rammah-api run build
npm --prefix rammah-next run test:unit
npm --prefix rammah-next run test:components
npm --prefix rammah-next run typecheck
npm --prefix rammah-next run lint
npm --prefix rammah-next run build
```

Expected: every command exits `0`; migration history remains locked and Next `16.3.0` production build succeeds.

- [ ] **Step 2: Start the fallback About page and inspect desktop/mobile layouts**

Run:

```powershell
npm --prefix rammah-next run dev -- --hostname 127.0.0.1 --port 3100
```

Using the browser at `http://127.0.0.1:3100/about`, verify at `1440×900`, `768×1024`, and `390×844`:

- recognition appears exactly after `Systems meet people` and before `The reach`;
- the band is compact dark teal, the portrait is grayscale, and the ivory CTA is prominent;
- labels, name, statement, roles, and CTA do not clip or overlap;
- mobile CTA is full width and at least `48px` high;
- keyboard Tab reaches the CTA and shows the mint focus ring;
- scrolling up and down creates no blank section, pinning, snapping, or stuck opacity;
- the existing globe remains non-interactive and fixed-scale.

- [ ] **Step 3: Verify CMS and external-link behavior**

On a migrated local database, open the admin page editor and confirm `Official Recognition` exposes Section label, Name, Official statement, Roles, Source label, Portrait badge, Official profile action, and Portrait. Replace the portrait once, save, refresh `/about`, then restore the seeded portrait.

Open the CTA and verify:

```text
https://acrl-academy.eu/acrl-academy-eddi-schulze-2/#:~:text=Ahmed%20Sherif%20Rammah
```

Expected: Chromium scrolls to and highlights `Ahmed Sherif Rammah`; unsupported text-fragment browsers still open the official page normally.

- [ ] **Step 4: Review the final diff and hand off without pushing**

Run:

```powershell
git diff master...HEAD --check
git status --short
git log --oneline --decorate master..HEAD
```

Expected: no whitespace errors, no unintended files, clean worktree, and one focused commit per completed task. Present the results to the user and wait for explicit merge/push authorization.
