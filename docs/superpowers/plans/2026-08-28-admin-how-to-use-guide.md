# Admin “How to use” Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a searchable, deeply detailed Arabic operating manual for every current admin workflow at `/admin/how-to-use`.

**Architecture:** Keep all guide copy in one static typed content module and render it through one client route using native search filtering, anchors, and `<details>`. Add one navigation entry to the existing admin shell; do not add APIs, persistence, dependencies, or a documentation framework.

**Tech Stack:** Next.js 16.3.0, React 19.2.4, TypeScript, Tailwind CSS 4, Vitest, Testing Library.

## Global Constraints

- The guide is fixed application content and cannot be edited through the CMS.
- Arabic copy is RTL while exact English dashboard labels remain recognizable.
- Every enabled admin area and all 26 approved playbooks must be covered.
- Search must match Arabic and English aliases locally with no API call.
- Use native `<details>`, anchors, and existing dependencies only.
- Disabled `Settings` must not be described as available.
- Follow the current code when it conflicts with an older assumption or document.

---

## File structure

- Create `rammah-next/app/admin/(protected)/how-to-use/how-to-use-content.ts`: types, glossary, decision guide, 26 playbooks, page references, troubleshooting entries, and launch checklists.
- Create `rammah-next/app/admin/(protected)/how-to-use/page.tsx`: RTL renderer, local search, table of contents, native expandable cards, direct links, and no-results state.
- Create `rammah-next/components/admin/AdminHowToUse.test.tsx`: interaction and coverage tests against real page/content.
- Modify `rammah-next/components/admin/AdminShell.tsx`: add the enabled `How to use` link after `Overview`.

### Task 1: Static guide contract and content coverage

**Files:**
- Create: `rammah-next/app/admin/(protected)/how-to-use/how-to-use-content.ts`
- Test: `rammah-next/components/admin/AdminHowToUse.test.tsx`

**Interfaces:**
- Produces `GuideEntry`, `GuideSection`, `guideSections`, `guideNavigation`, and `searchGuideSections(query)`.
- `GuideEntry` contains `id`, `title`, `summary`, `aliases`, optional `href`, and `blocks`.
- `GuideSection` contains `id`, `title`, `description`, and `entries`.

- [ ] **Step 1: Write the failing content coverage test**

```tsx
import { describe, expect, it } from "vitest";
import { guideSections, searchGuideSections } from "@/app/admin/(protected)/how-to-use/how-to-use-content";

describe("admin how-to content", () => {
  it("covers every approved workflow and enabled admin destination", () => {
    const entries = guideSections.flatMap((section) => section.entries);
    const ids = new Set(entries.map((entry) => entry.id));
    expect([
      "create-appointment-offering", "add-fixed-session", "create-one-off-program",
      "create-course-program", "split-weekday-availability", "date-overrides",
      "minimum-advance-days", "attendance-and-locations", "capacity",
      "booking-modes", "pricing", "booking-operations", "payment-operations",
      "quote-operations", "booking-form-fields", "email-operations", "create-cms-page",
      "edit-section-media", "media-library", "legal-pages", "blog-and-seo",
      "navigation", "site-settings", "calendar-meet", "preview-and-publish",
      "safe-rollback",
    ].every((id) => ids.has(id))).toBe(true);
    expect(["offerings", "availability", "locations", "programs", "form-fields",
      "sessions", "bookings", "payments", "quotes", "emails", "cms", "integrations"
    ].every((term) => entries.some((entry) => entry.aliases.includes(term)))).toBe(true);
  });

  it("finds entries using Arabic and English aliases", () => {
    expect(searchGuideSections("سعة").flatMap((section) => section.entries).map((entry) => entry.id)).toContain("capacity");
    expect(searchGuideSections("Early bird").flatMap((section) => section.entries).map((entry) => entry.id)).toContain("pricing");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm --workspace rammah-next run test:components -- components/admin/AdminHowToUse.test.tsx`  
Expected: FAIL because `how-to-use-content` does not exist.

- [ ] **Step 3: Add the minimal typed content module**

Define these exact shapes:

```ts
export type GuideBlock = {
  heading: string;
  items: string[];
  ordered?: boolean;
  tone?: "default" | "warning" | "success";
};

export type GuideEntry = {
  id: string;
  title: string;
  summary: string;
  aliases: string[];
  href?: string;
  blocks: GuideBlock[];
};

export type GuideSection = {
  id: string;
  title: string;
  description: string;
  entries: GuideEntry[];
};
```

Populate the five exact top-level sections:

1. `understand-system`: glossary, decision guide, statuses, capacity states, and dependency order.
2. `playbooks`: the 26 workflow IDs asserted by the test. Every workflow includes `متى تستخدمه؟`, `قبل أن تبدأ`, `الخطوات`, `ما الذي يتأثر؟`, `أخطاء شائعة`, and `التعديل أو التراجع` blocks.
3. `page-reference`: Overview, Offerings/Pricing, Availability/Overrides/Policy, Locations, Programs, Form Fields, Sessions, Bookings, Payments, Quotes, Emails, all current CMS views, and Integrations.
4. `troubleshooting`: the 14 ordered diagnostic paths from the approved design.
5. `checklists`: appointment, session/event, program/course, CMS publication, and paid-booking launch checks.

Use exact current route links: `/admin`, `/admin/offerings`, `/admin/availability`, `/admin/locations`, `/admin/programs`, `/admin/form-fields`, `/admin/sessions`, `/admin/bookings`, `/admin/payments`, `/admin/quotes`, `/admin/emails`, `/admin/cms`, and `/admin/integrations`.

Add a single filter that searches every human-readable field:

```ts
const normalize = (value: string) => value.trim().toLocaleLowerCase("ar");

const searchableText = (entry: GuideEntry) => normalize([
  entry.title,
  entry.summary,
  ...entry.aliases,
  ...entry.blocks.flatMap((block) => [block.heading, ...block.items]),
].join(" "));

export const searchGuideSections = (query: string) => {
  const needle = normalize(query);
  if (!needle) return guideSections;
  return guideSections
    .map((section) => ({ ...section, entries: section.entries.filter((entry) => searchableText(entry).includes(needle)) }))
    .filter((section) => section.entries.length > 0);
};
```

- [ ] **Step 4: Run the focused content tests and verify GREEN**

Run: `npm --workspace rammah-next run test:components -- components/admin/AdminHowToUse.test.tsx`  
Expected: PASS for coverage and Arabic/English search.

- [ ] **Step 5: Commit the content contract**

```bash
git add "rammah-next/app/admin/(protected)/how-to-use/how-to-use-content.ts" rammah-next/components/admin/AdminHowToUse.test.tsx
git commit -m "feat(admin): add Arabic operating guide content"
```

### Task 2: Searchable RTL guide page

**Files:**
- Create: `rammah-next/app/admin/(protected)/how-to-use/page.tsx`
- Modify: `rammah-next/components/admin/AdminHowToUse.test.tsx`

**Interfaces:**
- Consumes `guideSections`, `guideNavigation`, and `searchGuideSections(query)`.
- Produces the protected `/admin/how-to-use` UI.

- [ ] **Step 1: Add a failing page interaction test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HowToUsePage from "@/app/admin/(protected)/how-to-use/page";

it("filters the Arabic guide and resets an empty result", async () => {
  const user = userEvent.setup();
  render(<HowToUsePage />);
  expect(screen.getByRole("heading", { name: "كيف تستخدم الداشبورد؟" })).toBeInTheDocument();
  await user.type(screen.getByRole("searchbox", { name: "ابحث في الدليل" }), "Early bird");
  expect(screen.getByText("الأسعار وPrice groups وEarly bird")).toBeInTheDocument();
  await user.clear(screen.getByRole("searchbox", { name: "ابحث في الدليل" }));
  await user.type(screen.getByRole("searchbox", { name: "ابحث في الدليل" }), "لا توجد نتيجة بهذا الاسم");
  expect(screen.getByRole("status")).toHaveTextContent("لم نجد شرحًا مطابقًا");
  await user.click(screen.getByRole("button", { name: "مسح البحث" }));
  expect(screen.getByText("إضافة Session ثابتة")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm --workspace rammah-next run test:components -- components/admin/AdminHowToUse.test.tsx`  
Expected: FAIL because the page component does not exist.

- [ ] **Step 3: Implement the minimal page**

Create a client component with:

- `useState("")` for the query and `useMemo` for `searchGuideSections(query)`.
- `<main dir="rtl">` with the heading `كيف تستخدم الداشبورد؟`.
- Search input with `type="search"` and `aria-label="ابحث في الدليل"`.
- Desktop sticky anchors generated from the five section IDs.
- A simple mobile horizontal anchor list using the same data.
- `<details>` for every entry and semantic `<ol>`/`<ul>` according to `block.ordered`.
- `<bdi dir="ltr">` or `dir="ltr"` spans for English labels where needed.
- Next.js `Link` for `entry.href` with the label `افتح الصفحة`.
- A `role="status"` no-results message and `مسح البحث` button.
- Existing admin palette/classes only; no animation or dependency.

- [ ] **Step 4: Run the focused page tests and verify GREEN**

Run: `npm --workspace rammah-next run test:components -- components/admin/AdminHowToUse.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit the page**

```bash
git add "rammah-next/app/admin/(protected)/how-to-use/page.tsx" rammah-next/components/admin/AdminHowToUse.test.tsx
git commit -m "feat(admin): render searchable how-to guide"
```

### Task 3: Navigation integration and full verification

**Files:**
- Modify: `rammah-next/components/admin/AdminShell.tsx`
- Modify: `rammah-next/components/admin/AdminHowToUse.test.tsx`

**Interfaces:**
- Makes `/admin/how-to-use` reachable from the global admin navigation.

- [ ] **Step 1: Add a failing navigation assertion**

Extract and export the existing navigation array as `adminNavItems`, then assert:

```ts
expect(adminNavItems.slice(0, 2)).toEqual([
  { label: "Overview", href: "/admin" },
  { label: "How to use", href: "/admin/how-to-use" },
]);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm --workspace rammah-next run test:components -- components/admin/AdminHowToUse.test.tsx`  
Expected: FAIL because `adminNavItems` is not exported and the link is missing.

- [ ] **Step 3: Add the navigation entry**

Rename `navItems` to `adminNavItems`, export it, and insert:

```ts
{ label: "How to use", href: "/admin/how-to-use" },
```

immediately after `Overview`. Keep active-route matching unchanged.

- [ ] **Step 4: Run all verification**

Run:

```bash
npm --workspace rammah-next run test:components
npm --workspace rammah-next run typecheck
npm --workspace rammah-next run lint -- "app/admin/(protected)/how-to-use" components/admin/AdminShell.tsx
npm --workspace rammah-next run build
```

Expected: all commands exit `0`; component suite reports no failures; production build includes `/admin/how-to-use`.

- [ ] **Step 5: Manually verify the critical flow**

Check desktop and narrow widths, RTL/English label direction, keyboard expansion, Arabic search, English search, no-results reset, section anchors, and direct admin links.

- [ ] **Step 6: Commit the integration**

```bash
git add rammah-next/components/admin/AdminShell.tsx rammah-next/components/admin/AdminHowToUse.test.tsx
git commit -m "feat(admin): link how-to guide in navigation"
```
