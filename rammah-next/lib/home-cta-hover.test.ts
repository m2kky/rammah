import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const aboutSource = readFileSync(
  resolve(process.cwd(), "components", "AboutSection.tsx"),
  "utf8",
);
const ctaSource = readFileSync(
  resolve(process.cwd(), "components", "CTASection.tsx"),
  "utf8",
);

describe("homepage CTA hover contrast", () => {
  it.each([
    ["about", aboutSource],
    ["contact", ctaSource],
  ])("lets the %s button label inherit its hover color", (_name, source) => {
    expect(source).not.toContain(
      'className="text-[#0F3B46] font-bold leading-[0.8]"',
    );
    expect(source).toContain('className="font-bold leading-[0.8]"');
  });
});
