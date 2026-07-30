# Loading Screen Mobile Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the synchronized loader and hero portrait to `86dvh` on mobile while preserving the existing `96dvh` desktop geometry.

**Architecture:** Change the single shared Tailwind geometry string in `LoadingScreen` and `HeroSection`. Keep both elements centered and bottom-aligned so their rendered rectangles remain identical across the transition.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Vitest 4, Playwright CLI.

## Global Constraints

- Mobile geometry is exactly `h-[86dvh]`.
- Desktop geometry remains exactly `md:h-[96dvh]`.
- No new dependency, abstraction, asset, animation, or copy change.
- Verify at `390×844` and `1440×900`.

---

### Task 1: Balance the Synchronized Mobile Portrait

**Files:**
- Modify: `rammah-next/lib/loading-screen.test.ts`
- Modify: `rammah-next/components/LoadingScreen.tsx`
- Modify: `rammah-next/components/HeroSection.tsx`

**Interfaces:**
- Consumes: the existing loader video and `/hero.png`.
- Produces: the identical class string `h-[86dvh] w-auto max-w-none object-contain object-bottom md:h-[96dvh]` on both media elements.

- [ ] **Step 1: Write the failing geometry assertion**

```ts
const synchronizedGeometry =
  'className="h-[86dvh] w-auto max-w-none object-contain object-bottom md:h-[96dvh]"';

expect(componentSource).toContain(synchronizedGeometry);
expect(heroSource).toContain(synchronizedGeometry);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm run test:unit -- --run lib/loading-screen.test.ts
```

Expected: FAIL because both components still use `h-[100dvh]`.

- [ ] **Step 3: Apply the minimal synchronized change**

In both components, replace:

```tsx
className="h-[100dvh] w-auto max-w-none object-contain object-bottom md:h-[96dvh]"
```

with:

```tsx
className="h-[86dvh] w-auto max-w-none object-contain object-bottom md:h-[96dvh]"
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm run test:unit -- --run lib/loading-screen.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 5: Verify the project and responsive layout**

Run:

```powershell
npm run test:unit
npm run typecheck
npm run lint
npm run build
```

Use Playwright at `390×844` and `1440×900`. Confirm:

- mobile loader and hero rectangles match and the chair fits within the viewport;
- desktop rectangles remain at `96dvh`;
- loading progress advances and the loader exits.

- [ ] **Step 6: Commit**

```powershell
git add -- rammah-next/lib/loading-screen.test.ts rammah-next/components/LoadingScreen.tsx rammah-next/components/HeroSection.tsx
git commit -m "fix: balance intro portrait on mobile"
```
