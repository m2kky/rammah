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
    expect(componentSource).toContain("/videos/intro-loading.mp4");
    expect(componentSource).toContain("autoPlay");
    expect(componentSource).toContain("muted");
    expect(componentSource).toContain("playsInline");
    expect(componentSource).toContain('poster="/videos/intro-loading-poster.jpg"');
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
      'className="h-[86dvh] w-auto max-w-none object-contain object-bottom md:h-[96dvh]"';

    expect(heroSource).toContain('src="/hero.png"');
    expect(heroSource).toContain("width={720}");
    expect(heroSource).toContain("height={1280}");
    expect(componentSource).toContain(synchronizedGeometry);
    expect(heroSource).toContain(synchronizedGeometry);
  });
});
