# Loading Screen Match-Cut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the loading video at 7.2 seconds with a subtle 5% crop and make its held final frame the first hero image so the loader and homepage connect without a visual jump.

**Architecture:** Generate the optimized video, poster, and hero still from one processed video master so their geometry cannot drift. `LoadingScreen` and `HeroSection` will render the assets with the same centered, bottom-aligned viewport-height geometry; the loader owns playback and progress, while the hero keeps the final still visible after the video unmounts.

**Tech Stack:** FFmpeg 8, H.264 MP4, Next.js 16, React 19, Tailwind CSS 4, Vitest 4, Playwright CLI.

## Global Constraints

- Source file: `rammah-next/public/intro.mp4`; it must remain unchanged.
- Target duration: 7.2 seconds with an allowed encoding tolerance of ±0.15 seconds.
- Crop: centered 5% crop, restored to `720×1280`.
- Final hold: 0.3 seconds with an allowed encoding tolerance of ±0.05 seconds.
- Video: H.264 High Profile Level 3.1, `yuv420p`, no audio, fast-start metadata.
- Responsive verification: `390×844` and `1440×900`.
- Playback: `autoPlay`, `muted`, `playsInline`, poster fallback, retry on `canplay` and visibility restore.

---

### Task 1: Build the Synchronized Media Assets

**Files:**
- Modify: `rammah-next/lib/loading-screen.test.ts`
- Replace: `rammah-next/public/videos/intro-loading.mp4`
- Replace: `rammah-next/public/videos/intro-loading-poster.jpg`
- Create: `rammah-next/public/intro-hero-final.jpg`

**Interfaces:**
- Consumes: `rammah-next/public/intro.mp4`
- Produces: `/videos/intro-loading.mp4`, `/videos/intro-loading-poster.jpg`, and `/intro-hero-final.jpg`, all with identical crop geometry.

- [ ] **Step 1: Extend the asset regression test**

Add the hero still assertion:

```ts
expect(
  existsSync(resolve(projectRoot, "public", "intro-hero-final.jpg"))
).toBe(true);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm run test:unit -- lib/loading-screen.test.ts
```

Expected: FAIL because `public/intro-hero-final.jpg` does not exist.

- [ ] **Step 3: Generate the 7.2-second master**

Run from `rammah-next`:

```powershell
ffmpeg -y -i "public\intro.mp4" -an -vf "trim=duration=6.9,setpts=PTS-STARTPTS,crop=684:1216:18:32,scale=720:1280:flags=lanczos,tpad=stop_mode=clone:stop_duration=0.3,format=yuv420p" -r 24 -c:v libx264 -profile:v high -level 3.1 -preset slow -crf 22 -movflags +faststart "public\videos\intro-loading.mp4"
```

This preserves the natural motion, removes only the excess end time, applies a centered 5% crop, and clones the final processed frame for 0.3 seconds.

- [ ] **Step 4: Extract synchronized stills**

Run:

```powershell
ffmpeg -y -ss 0.08 -i "public\videos\intro-loading.mp4" -frames:v 1 -q:v 3 -update 1 "public\videos\intro-loading-poster.jpg"
ffmpeg -y -ss 7.05 -i "public\videos\intro-loading.mp4" -frames:v 1 -q:v 2 -update 1 "public\intro-hero-final.jpg"
```

- [ ] **Step 5: Verify media properties**

Run:

```powershell
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,profile,level,pix_fmt,width,height -of json "public\videos\intro-loading.mp4"
```

Expected: duration between `7.05` and `7.35`, H.264 High profile, level `31`, `yuv420p`, `720×1280`, and no audio stream.

- [ ] **Step 6: Run the test and verify GREEN**

Run:

```powershell
npm run test:unit -- lib/loading-screen.test.ts
```

Expected: PASS.

### Task 2: Match Loader and Hero Geometry

**Files:**
- Modify: `rammah-next/lib/loading-screen.test.ts`
- Modify: `rammah-next/components/LoadingScreen.tsx`
- Modify: `rammah-next/components/HeroSection.tsx`

**Interfaces:**
- Consumes: the three synchronized assets from Task 1 and `entryReady: boolean`.
- Produces: identical loader/hero image geometry using `h-[100dvh] md:h-[96dvh]`, centered horizontally and aligned to the viewport bottom.

- [ ] **Step 1: Add failing source assertions**

Read `HeroSection.tsx` beside `LoadingScreen.tsx` and assert:

```ts
expect(heroSource).toContain('src="/intro-hero-final.jpg"');
expect(heroSource).toContain("h-[100dvh]");
expect(componentSource).toContain("7.2");
expect(componentSource).toContain("7200");
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
npm run test:unit -- lib/loading-screen.test.ts
```

Expected: FAIL because the hero still and 7.2-second timing are not wired yet.

- [ ] **Step 3: Update loading playback timing**

In `LoadingScreen.tsx`:

- Keep the existing mobile autoplay recovery.
- Change the duration fallback to `7.2`.
- Change the normal fallback timer to `7200`.
- Change the hard timeout to `9000`.
- Keep `src="/videos/intro-loading.mp4"` and `poster="/videos/intro-loading-poster.jpg"`.
- Keep `className="h-[100dvh] w-auto max-w-none object-contain object-bottom md:h-[96dvh]"`.

- [ ] **Step 4: Wire the final frame into the hero**

In `HeroSection.tsx`:

- Change the section base background to black.
- Change the portrait source to `/intro-hero-final.jpg`.
- Render it at `h-[100dvh] md:h-[96dvh]`, centered, bottom-aligned, and always fully opaque.
- Remove the portrait's entry scale, translation, and opacity transition so it is already in the exact final-video geometry while hidden beneath the loader.
- Keep the hero typography animations driven by `entryReady`.
- Keep the existing teal/white treatment behind the full-frame hero still; black areas of the vertical still blend into the black section and preserve the match cut.

The hero image should use:

```tsx
className="h-[100dvh] w-auto max-w-none object-contain object-bottom md:h-[96dvh]"
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```powershell
npm run test:unit -- lib/loading-screen.test.ts
```

Expected: PASS.

### Task 3: Verify the Transition End to End

**Files:**
- Verify: `rammah-next/components/LoadingScreen.tsx`
- Verify: `rammah-next/components/HeroSection.tsx`
- Verify: `rammah-next/public/videos/intro-loading.mp4`
- Verify: `rammah-next/public/intro-hero-final.jpg`

**Interfaces:**
- Consumes: the production build and synchronized assets.
- Produces: browser evidence that playback advances, the loader exits, and the final frame does not jump when the hero appears.

- [ ] **Step 1: Run automated checks**

Run:

```powershell
npm run test:unit
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit `0`.

- [ ] **Step 2: Start the production server**

Run:

```powershell
npm start
```

Expected: Next.js listens on `http://127.0.0.1:3000`.

- [ ] **Step 3: Verify mobile playback at `390×844`**

With Playwright CLI:

1. Reload the homepage.
2. After 1.2 seconds, inspect the loading video.
3. Confirm `paused=false`, `readyState=4`, `currentTime>0`, and `error=0`.
4. Capture the final video frame just before 7.2 seconds.
5. Capture the hero immediately after loader removal.
6. Compare center, bottom alignment, chair scale, and Ahmed's seated position.

Expected: no black flash, scale jump, or vertical jump.

- [ ] **Step 4: Verify desktop playback at `1440×900`**

Repeat the same checks at `1440×900`.

Expected: the vertical composition remains centered, the black side space is stable, and the final-video/hero geometry matches.

- [ ] **Step 5: Inspect the final diff**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only the approved loading-screen, hero, test, and generated media changes are part of this task.
