# Services Portrait Scroll Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an identity-faithful portrait motion asset for Ahmed Rammah and use it as a responsive full-screen, scroll-scrubbed services-section stage.

**Architecture:** Generate one approved 9:16 start/end pair and one short master video, then export an optimized WebP sequence. Keep the existing dual-canvas and GSAP structure; only change the frame source, canvas drawing position, and wrappers needed to make the black stage fill the viewport.

**Tech Stack:** Built-in image generation, image-to-video generation, FFmpeg, Next.js 16, React 19, canvas, GSAP ScrollTrigger, Tailwind CSS.

## Global Constraints

- Use identity references only from `rammah-next/public/WhatsApp Unknown 2026-07-30 at 1.08.54 AM`.
- Preserve Ahmed's face, glasses, proportions, and natural skin texture.
- Use the same dark-green turtleneck as the hero.
- Use a pure black background with no props, text, particles, or set.
- Create one 9:16 master video; do not create device-specific videos unless responsive QA fails.
- Keep the camera locked and the motion limited to a slow head turn, raised gaze, and slight smile.
- Preserve the approved first and last stills as fallback assets.

---

### Task 1: Generate and approve the portrait endpoints

**Files:**
- Create: `rammah-next/public/services-portrait-end.png`
- Create: `rammah-next/public/services-portrait-start.png`

**Interfaces:**
- Consumes: JPEG identity references from the approved WhatsApp photo folder.
- Produces: two matched 9:16 PNG images used by the video generator.

- [ ] **Step 1: Select four identity references**

Use sharp images that collectively show Ahmed's neutral expression, smile,
face shape, glasses, and hairline. Inspect each selected file at original
resolution before generation.

- [ ] **Step 2: Generate the end frame**

Use the selected photos as identity references with this prompt:

```text
Use case: identity-preserve
Asset type: 9:16 endpoint image for a scroll-controlled website portrait
Primary request: Create a photorealistic editorial studio portrait of Ahmed Rammah, preserving his exact recognizable facial identity from the reference photos.
Scene/backdrop: perfectly pure black seamless studio background
Subject: Ahmed faces the camera, chest-up, shoulders relaxed, calm confident expression, very slight natural closed-mouth smile, wearing the same dark-green turtleneck seen in the website hero
Style/medium: premium black-and-white editorial photography with the turtleneck retaining an extremely subtle dark-green tone
Composition/framing: 9:16 portrait, subject centered, generous black negative space above and around the shoulders, no crop through hair, glasses, chin, or shoulders
Lighting/mood: soft directional studio key light, controlled contrast, realistic skin texture, quiet confidence
Constraints: preserve face shape, glasses, hairline, ears, nose, mouth, beard pattern, age, and body proportions; locked camera; no text; no watermark
Avoid: beautification, plastic skin, exaggerated smile, changed glasses, extra accessories, furniture, props, visible room, gradients, particles, glow, lens effects
```

Save the approved output non-destructively as
`rammah-next/public/services-portrait-end.png`.

- [ ] **Step 3: Derive the start frame from the approved end frame**

Use `services-portrait-end.png` as the edit target and the same identity photos
as supporting references:

```text
Use case: identity-preserve
Asset type: matching start endpoint for portrait animation
Primary request: Change only Ahmed's head direction and gaze. Turn his head to a gentle three-quarter side angle and lower his eyes slightly, with a calm neutral expression.
Constraints: preserve the exact identity, camera position, 9:16 crop, body position, shoulders, dark-green turtleneck, black background, glasses, lighting, skin texture, and image resolution from the end frame; no text; no watermark
Avoid: profile silhouette, closed eyes, changed face, changed clothing, changed crop, camera movement, smile, props, effects
```

Save as `rammah-next/public/services-portrait-start.png`.

- [ ] **Step 4: Validate the pair**

Open both images at original resolution. Reject the pair if facial structure,
glasses, clothing, lighting, shoulder position, or crop changes between them.

- [ ] **Step 5: Commit the approved stills**

```powershell
git add -- rammah-next/public/services-portrait-end.png rammah-next/public/services-portrait-start.png
git commit -m "feat: add services portrait endpoints"
```

Expected: one commit containing only the two approved PNG assets.

---

### Task 2: Generate one master video and frame sequence

**Files:**
- Create: `rammah-next/public/videos/services-portrait.mp4`
- Create: `rammah-next/public/services-frames/frame0001.webp` through the final sequential frame.

**Interfaces:**
- Consumes: `services-portrait-start.png` and `services-portrait-end.png`.
- Produces: a locked-camera portrait video and sequential WebP frames.

- [ ] **Step 1: Generate the image-to-video motion**

Use the start and end images with this motion prompt:

```text
Locked-off studio portrait. Ahmed slowly and naturally turns his head from the three-quarter side angle toward the camera, gently raises his gaze, and settles into the exact slight closed-mouth smile shown in the end frame. Preserve his exact facial identity, glasses, beard, dark-green turtleneck, shoulders, lighting, framing, and pure black background throughout. Subtle continuous human motion only. No speech, lip movement, camera movement, zoom, body movement, blinking emphasis, morphing, effects, particles, or background change.
```

Use one 9:16 generation of approximately 5–6 seconds. Save the approved result
as `rammah-next/public/videos/services-portrait.mp4`.

- [ ] **Step 2: Export optimized frames**

```powershell
New-Item -ItemType Directory -Force 'rammah-next/public/services-frames'
ffmpeg -y -i 'rammah-next/public/videos/services-portrait.mp4' -vf "fps=24,scale=720:1280:flags=lanczos" -c:v libwebp -quality 82 -compression_level 6 'rammah-next/public/services-frames/frame%04d.webp'
```

Expected: sequential 720×1280 WebP files with no missing numbers.

- [ ] **Step 3: Record the exact frame count**

```powershell
(Get-ChildItem 'rammah-next/public/services-frames' -Filter 'frame*.webp').Count
```

Expected: approximately 120–144. Use the returned integer as
`TOTAL_FRAMES` in Task 3.

- [ ] **Step 4: Validate endpoints**

Open `frame0001.webp` and the final frame. Confirm they visually match the
approved start and end images without a first-frame jump or final-frame morph.

- [ ] **Step 5: Commit the motion assets**

```powershell
git add -- rammah-next/public/videos/services-portrait.mp4 rammah-next/public/services-frames
git commit -m "feat: add services portrait motion"
```

Expected: one commit containing only the approved MP4 and WebP sequence.

---

### Task 3: Make the services portrait stage full-screen

**Files:**
- Modify: `rammah-next/components/ServicesSection.tsx`

**Interfaces:**
- Consumes: `/services-frames/frameNNNN.webp`.
- Produces: responsive full-screen canvas staging using the existing scroll timeline.

- [ ] **Step 1: Point the component at the new sequence**

Replace the frame configuration with the exact count from Task 2:

```ts
const TOTAL_FRAMES = 120; // Replace 120 only if Task 2 returns a different count.
const FRAME_VERSION = "services_v1";
const FRAME_PATH = (n: number) =>
  `/services-frames/frame${String(n).padStart(4, "0")}.webp?v=${FRAME_VERSION}`;
```

- [ ] **Step 2: Position the contained portrait on a black stage**

Replace `drawImageContain` with:

```ts
const drawPortraitFrame = (
  img: HTMLImageElement,
  canvas: HTMLCanvasElement | null,
  anchorX: number
) => {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = canvas.offsetWidth || img.naturalWidth;
  const cssHeight = canvas.offsetHeight || img.naturalHeight;
  const width = Math.round(cssWidth * dpr);
  const height = Math.round(cssHeight * dpr);

  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
  const drawWidth = img.naturalWidth * scale;
  const drawHeight = img.naturalHeight * scale;
  const x = width * anchorX - drawWidth / 2;
  const y = (height - drawHeight) / 2;

  ctx.drawImage(img, x, y, drawWidth, drawHeight);
};
```

Update `drawFrame` and the first-frame preload calls:

```ts
const drawFrame = (
  index: number,
  targetCanvas: HTMLCanvasElement | null,
  anchorX: number
) => {
  const img = framesRef.current[index];
  if (!img?.complete) return;
  drawPortraitFrame(img, targetCanvas, anchorX);
};
```

Use `0.75` for desktop and `0.5` for mobile.

- [ ] **Step 3: Make both canvas wrappers fill the sticky viewport**

Use a full-screen desktop canvas layer:

```tsx
<div className="pointer-events-none absolute inset-0 z-10 max-md:hidden">
  <div ref={videoWrapRef} className="absolute inset-0">
    <canvas ref={canvasRef} className="block h-full w-full" />
  </div>
</div>
```

Make the mobile canvas a full-screen layer behind the copy:

```tsx
<div
  ref={mobileVideoWrapRef}
  className="pointer-events-none absolute inset-0 z-10"
>
  <canvas ref={mobileCanvasRef} className="block h-full w-full" />
</div>
```

Keep `mobileRolesRef` and `mobileCardsWrapRef` above it with their existing
`z-20` and `z-30` layers.

- [ ] **Step 4: Preserve the desktop right-to-left composition change**

Change the desktop wrapper movement from a full-width exit to a half-width
shift:

```ts
tl.fromTo(
  videoWrapRef.current,
  { xPercent: 0 },
  { xPercent: -50, duration: 0.22, ease: "none" },
  0.15
);
```

The portrait begins around the right-quarter anchor and moves toward the left
while the black section background remains full-screen.

- [ ] **Step 5: Run static checks**

```powershell
npm run typecheck
npm run lint
npm run build
```

Run from `rammah-next`. Expected: all three commands exit with code 0.

- [ ] **Step 6: Commit the component change**

```powershell
git add -- rammah-next/components/ServicesSection.tsx
git commit -m "feat: make services portrait full screen"
```

Expected: one commit containing only `ServicesSection.tsx`.

---

### Task 4: Responsive visual QA

**Files:**
- Verify: `rammah-next/components/ServicesSection.tsx`
- Verify: `rammah-next/public/services-portrait-start.png`
- Verify: `rammah-next/public/services-portrait-end.png`

**Interfaces:**
- Consumes: the completed local Next.js page.
- Produces: approval evidence for mobile and desktop behavior.

- [ ] **Step 1: Start the production server on a free port**

```powershell
npm run start -- --port 3010
```

Expected: Next.js serves the site at `http://localhost:3010`.

- [ ] **Step 2: Verify desktop at 1920×1080**

Confirm the black stage fills the viewport, Ahmed begins on the right without
head or shoulder cropping, role text remains readable on the left, the scrub
reaches the smile cleanly, and the portrait moves left as service cards enter.

- [ ] **Step 3: Verify mobile at 390×844**

Confirm the black stage fills the viewport, Ahmed remains centered and slightly
lower, roles stay readable above him, cards do not cover his face, and no white
or transparent band appears around the canvas.

- [ ] **Step 4: Verify reverse scrolling**

Scrub backward through the portrait phase. Confirm that the motion reverses
without a frame jump and that the first frame settles exactly.

- [ ] **Step 5: Final repository check**

```powershell
git status --short
git log -4 --oneline
```

Expected: only pre-existing unrelated user changes remain unstaged; the new
work is represented by the three scoped commits from this plan.
