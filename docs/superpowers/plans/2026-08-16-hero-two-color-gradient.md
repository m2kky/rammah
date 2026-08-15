# Hero Two-Color Gradient Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hero's gray radial halo with the approved vertical gradient using only `#0F3B46` and `#FFFFFF`.

**Architecture:** Keep the existing teal base layer and replace the separate lower white block plus radial ellipse with one full-hero linear-gradient layer. Fade that layer in using opacity only, leaving portrait geometry, content, and responsive layout unchanged.

**Tech Stack:** Next.js 16.3, React, TypeScript, Tailwind CSS, Vitest

## Global Constraints

- Use only `#0F3B46` and `#FFFFFF` in the gradient.
- Use exact stops: teal through `28%`, transition to white at `48%`, white through `100%`.
- Remove the radial ellipse, rounded ellipse geometry, transparent white stops, blur, shadow, and added gray colors.
- Animate only opacity on the gradient layer.
- Preserve all portrait, typography, content, and responsive layout behavior.

---

### Task 1: Replace the Hero Background Treatment

**Files:**
- Modify: `rammah-next/components/HeroSection.tsx`
- Test: `rammah-next/lib/loading-screen.test.ts`

**Interfaces:**
- Consumes: `entryReady: boolean` in `HeroSectionProps`.
- Produces: One visual gradient layer whose opacity follows `entryReady`.

- [ ] **Step 1: Write the failing regression test**

Replace the existing hero glow assertion in `rammah-next/lib/loading-screen.test.ts` with:

```ts
it("renders the approved vertical two-color hero gradient", () => {
  expect(heroSource).toContain(
    "linear-gradient(to bottom, #0F3B46 0%, #0F3B46 28%, #FFFFFF 48%, #FFFFFF 100%)",
  );
  expect(heroSource).not.toContain("radial-gradient");
  expect(heroSource).not.toContain("rounded-[50%]");
  expect(heroSource).not.toContain("blur-[30px] md:blur-[60px]");
});
```

- [ ] **Step 2: Run the targeted test and confirm RED**

Run:

```bash
cd rammah-next
npm exec vitest -- run lib/loading-screen.test.ts --reporter=dot
```

Expected: FAIL because `HeroSection.tsx` still contains `radial-gradient` and does not contain the approved linear gradient.

- [ ] **Step 3: Implement the single gradient layer**

In `rammah-next/components/HeroSection.tsx`, delete both the lower white block and radial ellipse, then add:

```tsx
<div
  className={`absolute inset-0 transition-opacity duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
    entryReady ? "opacity-100" : "opacity-0"
  }`}
  style={{
    background:
      "linear-gradient(to bottom, #0F3B46 0%, #0F3B46 28%, #FFFFFF 48%, #FFFFFF 100%)",
  }}
/>
```

- [ ] **Step 4: Run the targeted test and confirm GREEN**

Run:

```bash
cd rammah-next
npm exec vitest -- run lib/loading-screen.test.ts --reporter=dot
```

Expected: `1 passed` test file with all tests green.

- [ ] **Step 5: Verify the complete frontend**

Run:

```bash
cd rammah-next
npm run test:unit
npm run typecheck
npm run lint -- components/HeroSection.tsx lib/loading-screen.test.ts
npm run build
```

Expected: all unit tests pass, TypeScript exits `0`, ESLint exits `0`, and the production build completes successfully.

- [ ] **Step 6: Perform browser verification**

Open the production build at desktop and mobile widths and confirm:

- The top remains solid teal.
- The middle transitions directly from teal to white with no arc or gray halo layer.
- The bottom remains solid white.
- The portrait and hero text retain their existing positions.
- The entry animation changes opacity only and does not stutter.

- [ ] **Step 7: Commit the hero implementation**

```bash
git add rammah-next/components/HeroSection.tsx rammah-next/lib/loading-screen.test.ts
git commit -m "fix(web): simplify hero to two-color gradient"
```
