import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const consumers = [
  "components/LoadingScreen.tsx",
  "components/Navbar.tsx",
  "components/HeroSection.tsx",
  "components/ServicesSection.tsx",
  "components/about/AboutExperience.tsx",
  "components/about/RecognitionSection.tsx",
  "components/corporate/CorporateExperience.tsx",
  "app/services/[slug]/page.tsx",
];

const knownRenderedPaths = /\/(?:videos\/(?:intro-loading\.mp4|intro-loading-poster\.jpg|about-fastcut-(?:mobile|desktop)\.webm)|hero\.png|about_hero\.png|Systems meet people\.png|RammahPortrait1\.png|acrl-ahmed-rammah\.webp|hero-final-frame\.png|services-frames\/)/;

describe("rendered CMS media inventory", () => {
  it("contains no hard-coded rendered content media paths in consumers", () => {
    for (const file of consumers) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(knownRenderedPaths);
    }
  });
});
