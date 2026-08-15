import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const componentSource = readFileSync(
  resolve(projectRoot, "components", "LoadingScreen.tsx"),
  "utf8"
);
const heroSource = readFileSync(
  resolve(projectRoot, "components", "HeroSection.tsx"),
  "utf8"
);

describe("LoadingScreen mobile video", () => {
  it("uses the optimized intro asset with mobile autoplay attributes", () => {
    expect(componentSource).toContain("src={video.publicUrl}");
    expect(componentSource).toContain("autoPlay");
    expect(componentSource).toContain("muted");
    expect(componentSource).toContain("playsInline");
    expect(componentSource).toContain("poster={poster.publicUrl}");
  });

  it("keeps the intro video visible to Safari while fading it in", () => {
    expect(componentSource).toContain(
      "gsap.set(videoWrapRef.current, { opacity: 0 })"
    );
    expect(componentSource).not.toContain(
      "gsap.set(videoWrapRef.current, { autoAlpha: 0 })"
    );
    expect(componentSource).toContain("onStart: startPlayback");
  });

  it("ships both the optimized video and its poster", () => {
    expect(
      existsSync(resolve(projectRoot, "public", "videos", "intro-loading.mp4"))
    ).toBe(true);
    expect(
      existsSync(
        resolve(projectRoot, "public", "videos", "intro-loading-poster.jpg")
      )
    ).toBe(true);
    expect(
      existsSync(resolve(projectRoot, "public", "hero.png"))
    ).toBe(true);
  });

  it("keeps the loader alive for the full 7.2 second match-cut intro", () => {
    expect(componentSource).toContain("INTRO_DURATION_SECONDS = 7.2");
    expect(componentSource).toContain("INTRO_START_TIMEOUT_MS = 6000");
    expect(componentSource).toContain("INTRO_PLAYBACK_TIMEOUT_MS = 9000");
    expect(componentSource).toContain("clearTimeout(fallbackTimerRef.current)");
    expect(componentSource).toMatch(
      /setTimeout\(\s*\(\) => finishLoading\(\),\s*INTRO_PLAYBACK_TIMEOUT_MS\s*\)/
    );
  });

  it("starts progress polling even when the initial playing event was missed", () => {
    expect(componentSource).toMatch(
      /document\.addEventListener\("visibilitychange", handleVisibilityChange\);\s*startProgressTracking\(\);/
    );
  });

  it("uses the video's final frame with matching loader geometry in the hero", () => {
    const synchronizedGeometry =
      'className="h-[100dvh] w-auto max-w-none object-contain object-bottom"';

    expect(heroSource).toContain("src={portrait.publicUrl}");
    expect(heroSource).toContain("width={portrait.width ?? 720}");
    expect(heroSource).toContain("height={portrait.height ?? 1280}");
    expect(componentSource).toContain(synchronizedGeometry);
    expect(heroSource).toContain(synchronizedGeometry);
  });

  it("renders the hero glow without an animated blur filter", () => {
    expect(heroSource).toContain("radial-gradient(ellipse at center");
    expect(heroSource).toContain("transition-[opacity,transform]");
    expect(heroSource).not.toContain("blur-[30px] md:blur-[60px]");
  });
});
