# About and Booking Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the About cinematic copy readable, show the shared navbar on every booking route, and reuse the clean About video in the fullscreen menu.

**Architecture:** Make three local changes only: responsive CSS/markup in the existing About component, one route-level booking layout, and responsive `<source>` elements in the existing navbar video. Reuse all current assets and CMS fetchers; add no dependency or abstraction.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Tailwind CSS, GSAP.

## Global Constraints

- Preserve the existing cinematic layout and subtle parallax.
- Use the mobile About WebM below 900px and the desktop WebM otherwise.
- Keep booking page-owned `<main>` elements and do not add the public footer.
- Add no dependency and do not modify unrelated working-tree files.

---

### Task 1: Viewport-safe About cinematic copy

**Files:**
- Modify: `components/about/AboutExperience.tsx:371-381`
- Modify: `components/about/AboutExperience.module.css:169-216, 638-655`

**Interfaces:**
- Consumes: existing `data-cinematic-line` GSAP hooks.
- Produces: the same cinematic copy with a mobile-only wrap opportunity.

- [ ] **Step 1: Add a mobile-only line break to the long phrase**

```tsx
<p className={styles.cinematicLine} data-cinematic-line="left">
  Rewrite the<span className={styles.mobileBreak}><br /></span> response
</p>
```

- [ ] **Step 2: Constrain the copy with responsive padding and sizes**

```css
.cinematicCopy { padding-inline: clamp(1.25rem, 3vw, 3rem); }
.cinematicLine { max-width: 100%; }
.mobileBreak { display: none; }

@media (max-width: 899px) {
  .cinematicCopy { padding-inline: 1.25rem; }
  .cinematicLine { width: auto; font-size: clamp(3.4rem, 19vw, 6.4rem); }
  .cinematicLine:nth-of-type(4) { margin-left: 0; font-size: clamp(2.7rem, 14vw, 4.8rem); }
  .mobileBreak { display: inline; }
}
```

- [ ] **Step 3: Reduce GSAP horizontal travel**

Use small symmetric travel values rather than the existing double-digit offsets while preserving the `ScrollTrigger` hooks.

- [ ] **Step 4: Run static checks**

Run: `npm run typecheck && npm run lint -- components/about/AboutExperience.tsx`

Expected: both commands exit 0.

### Task 2: Shared navbar for every booking route

**Files:**
- Create: `app/booking/layout.tsx`

**Interfaces:**
- Consumes: `Navbar`, `fetchPublicNavigation`, `fetchPublicSiteSettings`, and `getSiteBrand`.
- Produces: an async route layout wrapping every `/booking/**` page.

- [ ] **Step 1: Create the minimal booking layout**

```tsx
import Navbar from "@/components/Navbar";
import { fetchPublicNavigation, fetchPublicSiteSettings } from "@/lib/api/cms";
import { getSiteBrand } from "@/lib/api/cms-content";

export default async function BookingLayout({ children }: { children: React.ReactNode }) {
  const [navigation, settings] = await Promise.all([
    fetchPublicNavigation("header").catch(() => []),
    fetchPublicSiteSettings().catch(() => null),
  ]);

  return (
    <>
      <Navbar entryReady navigation={navigation} siteName={getSiteBrand(settings)} />
      <div className="pt-12 md:pt-20">{children}</div>
    </>
  );
}
```

- [ ] **Step 2: Run static checks**

Run: `npm run typecheck && npm run lint -- app/booking/layout.tsx`

Expected: both commands exit 0 and all nested booking routes compile through the layout.

### Task 3: Reuse the clean About video in the fullscreen menu

**Files:**
- Modify: `components/Navbar.tsx:165-175`

**Interfaces:**
- Consumes: `/videos/about-fastcut-mobile.webm` and `/videos/about-fastcut-desktop.webm`.
- Produces: the existing fullscreen menu with responsive video selection and unchanged readability overlays.

- [ ] **Step 1: Replace the old video `src` with responsive sources**

```tsx
<video className="absolute inset-0 h-full w-full object-cover" autoPlay muted loop playsInline preload="metadata">
  <source src="/videos/about-fastcut-mobile.webm" type="video/webm" media="(max-width: 899px)" />
  <source src="/videos/about-fastcut-desktop.webm" type="video/webm" />
</video>
```

- [ ] **Step 2: Run project verification**

Run: `npm run typecheck && npm run lint && npm run build`

Expected: all commands exit 0; the build lists the About and booking routes without errors.

- [ ] **Step 3: Verify responsive behavior in-browser**

Check `/about`, `/booking`, `/booking/status`, and the fullscreen menu at 390x844 and 1440x900. Expected: cinematic copy remains readable; each booking page exposes the navbar/menu; the menu uses the About video without cinematic HTML copy.

- [ ] **Step 4: Commit only the scoped files**

Run `git add` only for the four implementation files and this plan, then commit with `fix: align about video and booking navigation`.
