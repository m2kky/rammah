import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const navbarSource = readFileSync(
  resolve(process.cwd(), "components", "Navbar.tsx"),
  "utf8"
);

describe("Navbar fullscreen menu overlay", () => {
  it("does not leave the video compositor mounted while the menu is closed", () => {
    expect(navbarSource).toMatch(
      /menuOpen\s*\?\s*"opacity-100 visible"\s*:\s*"hidden"/
    );
  });
});
