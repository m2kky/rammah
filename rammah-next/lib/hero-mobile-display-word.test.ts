import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const heroSource = readFileSync(
  new URL("../components/HeroSection.tsx", import.meta.url),
  "utf8",
);

describe("home hero mobile display word", () => {
  it("caps the display word font size by the viewport width", () => {
    expect(heroSource).toContain("text-[min(7.15rem,22.5vw)]");
    expect(heroSource).not.toContain("leading-none text-[7.15rem]");
  });
});
