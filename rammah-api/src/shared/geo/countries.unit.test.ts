import { describe, expect, it } from "vitest";
import { countryCatalog, isoCountryCodes, isIsoCountryCode } from "./countries.js";

describe("canonical ISO country catalog", () => {
  it("contains the 249 assigned ISO alpha-2 countries with stable labels", () => {
    expect(isoCountryCodes.size).toBe(249);
    expect(isIsoCountryCode("eg")).toBe(true);
    expect(countryCatalog.find(({ code }) => code === "EG")?.name).toBe("Egypt");
  });

  it.each(["", "ZZ", "XX", "T1", "AC", "TA", "XK"])(
    "rejects non-ISO pricing country %j",
    (value) => {
      expect(isIsoCountryCode(value)).toBe(false);
    },
  );
});
