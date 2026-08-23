import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const globeSource = readFileSync(
  resolve(process.cwd(), "components", "about", "AboutGlobe.tsx"),
  "utf8",
);
const experienceSource = readFileSync(
  resolve(process.cwd(), "components", "about", "AboutExperience.tsx"),
  "utf8",
);
const stylesSource = readFileSync(
  resolve(process.cwd(), "components", "about", "AboutExperience.module.css"),
  "utf8",
);

describe("about globe behavior", () => {
  it("does not accept mouse or touch rotation", () => {
    expect(globeSource).not.toContain("useMotionValue");
    expect(globeSource).not.toMatch(
      /onPointerDown|onPointerUp|onPointerOut|onMouseMove|onTouchMove/,
    );
    expect(stylesSource).toMatch(
      /\.globeCanvas\s*\{[^}]*pointer-events:\s*none;/,
    );
  });

  it("keeps the globe at a fixed scale while the world section scrolls", () => {
    expect(experienceSource).not.toMatch(
      /\.fromTo\("\[data-globe\]"[\s\S]*?scale:/,
    );
    expect(experienceSource).not.toContain("scale: 2.15");
    expect(experienceSource).toMatch(
      /globeTimeline\.from\("\[data-stat\]"/,
    );
  });
});
