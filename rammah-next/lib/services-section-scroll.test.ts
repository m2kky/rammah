import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const servicesSectionSource = readFileSync(
  new URL("../components/ServicesSection.tsx", import.meta.url),
  "utf8",
);

describe("services section scroll", () => {
  it("returns the first panel fully off-screen when scrolling back before its phase", () => {
    expect(servicesSectionSource).not.toContain(
      "yPercent: i === 0 ? 22 : 105",
    );
    expect(servicesSectionSource).toMatch(
      /tl\.fromTo\(\s*panel,\s*\{\s*yPercent:\s*105/,
    );
  });

  it("keeps the pinned container on-screen until the section unpins", () => {
    expect(servicesSectionSource).not.toMatch(
      /tl\.to\(\s*container,\s*\{\s*xPercent:\s*-100/,
    );
    expect(servicesSectionSource).not.toMatch(
      /tl\.to\(\s*servicePanelContentRefs\.current\[last\],\s*\{[^}]*autoAlpha:\s*0[^}]*\},\s*0\.94/,
    );
    expect(servicesSectionSource).not.toMatch(
      /tl\.set\(servicePanelRefs\.current\[last\],\s*\{\s*pointerEvents:\s*"none"\s*\},\s*0\.94/,
    );
  });
});
