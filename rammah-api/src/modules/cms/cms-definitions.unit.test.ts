import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  globalMediaDefinitions,
  sectionDefinitions,
  resolveSectionMediaSlot,
} from "./cms-definitions.js";

const rendererRegistry = JSON.parse(
  readFileSync(
    new URL("../../../../rammah-next/lib/cms/section-renderer-registry.json", import.meta.url),
    "utf8",
  ),
) as Record<string, string>;

describe("CMS definition registry", () => {
  it("keeps the API section catalog in parity with the Next renderer registry", () => {
    expect(sectionDefinitions.map(({ key }) => key)).toEqual([
      "hero",
      "rich_text",
      "image_with_text",
      "standalone_image",
      "video",
      "gallery",
      "recognition",
      "cta",
      "divider_spacer",
    ]);
    expect(Object.keys(rendererRegistry)).toEqual(sectionDefinitions.map(({ key }) => key));
    expect(new Set(Object.values(rendererRegistry)).size).toBe(sectionDefinitions.length);
  });

  it("gives every section field a unique stable key and typed media cardinality", () => {
    for (const definition of sectionDefinitions) {
      const keys = definition.fields.map(({ key }) => key);
      expect(new Set(keys).size, definition.key).toBe(keys.length);

      for (const field of definition.fields) {
        if (field.type !== "media") continue;
        expect(field.accepts.length, `${definition.key}.${field.key}`).toBeGreaterThan(0);
        expect(["single", "multiple"]).toContain(field.cardinality);
      }
    }

    expect(resolveSectionMediaSlot("gallery", "galleryImages")).toMatchObject({
      accepts: ["image"],
      cardinality: "multiple",
    });
    expect(resolveSectionMediaSlot("video", "video")).toMatchObject({
      accepts: ["video"],
      cardinality: "single",
    });
    expect(resolveSectionMediaSlot("recognition", "portrait")).toMatchObject({
      accepts: ["image"],
      cardinality: "single",
      required: false,
    });
    expect(resolveSectionMediaSlot("unknown_legacy_type", "primaryMedia")).toMatchObject({
      accepts: ["image", "video", "animation_bundle"],
      cardinality: "single",
    });
    expect(resolveSectionMediaSlot("hero", "primaryMedia")).toBeNull();
    expect(resolveSectionMediaSlot("hero", "rawMediaId")).toBeNull();
  });

  it("models loading media as one complete atomic version and inventories custom site media", () => {
    const loading = globalMediaDefinitions.find(({ key }) => key === "loadingMatchCut");
    expect(loading).toMatchObject({ atomic: true });
    expect(loading?.slots.map(({ key, accepts, required }) => ({ key, accepts, required }))).toEqual([
      { key: "video", accepts: ["video"], required: true },
      { key: "poster", accepts: ["image"], required: true },
      { key: "matchedHeroFrame", accepts: ["image"], required: true },
    ]);

    const inventoriedSlots = globalMediaDefinitions.flatMap((definition) =>
      definition.slots.map((slot) => `${definition.key}.${slot.key}`),
    );
    expect(inventoriedSlots).toEqual(
      expect.arrayContaining([
        "navigation.desktopMenuVideo",
        "navigation.mobileMenuVideo",
        "seo.defaultOgImage",
        "homepage.heroPortrait",
        "homepage.servicesAnimation",
        "about.heroImage",
        "about.desktopFastCutVideo",
        "about.mobileFastCutVideo",
        "about.supportingImage",
        "corporateTraining.portrait",
        "corporateTraining.parallaxImage",
        "serviceDetail.portrait",
      ]),
    );
  });
});
