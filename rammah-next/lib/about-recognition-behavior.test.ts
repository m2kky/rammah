import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "components", "about", "AboutExperience.tsx"),
  "utf8",
);

describe("About recognition placement", () => {
  it("renders recognition between story and reach with the updated numbering", () => {
    expect(source).toContain('findPublicSection(page, "recognition")');
    const storyIndex = source.indexOf(`className={styles.story}`);
    const recognitionIndex = source.indexOf("<RecognitionSection");
    const reachIndex = source.indexOf(`className={styles.world}`);

    expect(storyIndex).toBeGreaterThan(-1);
    expect(recognitionIndex).toBeGreaterThan(storyIndex);
    expect(reachIndex).toBeGreaterThan(recognitionIndex);
    expect(source).toContain('"(05) The reach"');
    expect(source).toContain('"(06) Start the work"');
  });

  it("uses one non-scrubbed recognition reveal and no recognition pinning", () => {
    const start = source.indexOf('gsap.from("[data-recognition-reveal]"');
    const end = source.indexOf("const globeTimeline", start);
    const recognitionAnimation = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(recognitionAnimation).toContain('trigger: "[data-recognition]"');
    expect(recognitionAnimation).toContain("once: true");
    expect(recognitionAnimation).not.toContain("scrub:");
    expect(recognitionAnimation).not.toContain("pin:");
  });
});
