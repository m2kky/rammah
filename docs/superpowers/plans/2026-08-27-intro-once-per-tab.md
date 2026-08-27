# Intro Once Per Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play the homepage intro only once per browser tab without changing its playback implementation.

**Architecture:** `HomeClient` checks a single `sessionStorage` marker in `useLayoutEffect`. A missing marker is written before showing `LoadingScreen`; an existing marker marks the page ready before paint.

**Tech Stack:** Next.js 16.3.0, React 19, Vitest, Testing Library

## Global Constraints

- No new dependencies.
- Storage failure falls back to playing the intro.
- Existing intro playback and CMS media handling stay unchanged.

---

### Task 1: Per-tab intro gate

**Files:**
- Modify: `rammah-next/components/HomeClient.tsx`
- Create: `rammah-next/components/HomeClient.test.tsx`

**Interfaces:**
- Consumes: browser `sessionStorage` and the existing `LoadingScreen` `onComplete` callback.
- Produces: `INTRO_PLAYED_KEY` gated loading state local to `HomeClient`.

- [ ] **Step 1: Write the failing component tests**

Mock the homepage child sections and assert that the loader renders on the first mount, does not render after a same-tab remount, renders with fresh storage, and still renders when storage throws.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm exec -- vitest run --config vitest.components.config.ts components/HomeClient.test.tsx`

Expected: the same-tab remount test fails because the loader currently renders on every mount.

- [ ] **Step 3: Add the minimal session gate**

```tsx
const INTRO_PLAYED_KEY = "rammah:intro-played";

useLayoutEffect(() => {
  try {
    if (sessionStorage.getItem(INTRO_PLAYED_KEY)) {
      setIsLoaded(true);
      return;
    }
    sessionStorage.setItem(INTRO_PLAYED_KEY, "1");
  } catch {
    // Storage can be unavailable; playing the intro is the safe fallback.
  }
}, []);
```

- [ ] **Step 4: Run GREEN and regression checks**

Run: `npm exec -- vitest run --config vitest.components.config.ts components/HomeClient.test.tsx`

Run: `npm exec -- vitest run lib/loading-screen.test.ts`

Run: `npm run typecheck`

Expected: all commands exit `0`.

- [ ] **Step 5: Commit**

```bash
git add rammah-next/components/HomeClient.tsx rammah-next/components/HomeClient.test.tsx
git commit -m "fix(web): play intro once per tab"
```
