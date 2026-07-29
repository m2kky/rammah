import { describe, expect, it } from "vitest";
import {
  filterOfferingLocationsByCountry,
  type PublicOfferingLocation,
} from "./offerings";

const location = (id: string, countryCode: string): PublicOfferingLocation => ({
  id,
  countryCode,
  name: id,
  addressLine1: "Address",
  addressLine2: null,
  city: "City",
  mapUrl: null,
  instructions: null,
});

describe("offering locations", () => {
  it("filters offline locations using the detected attendance country", () => {
    expect(
      filterOfferingLocationsByCountry(
        [location("cairo", "EG"), location("dubai", "AE")],
        "eg",
      ).map(({ id }) => id),
    ).toEqual(["cairo"]);
  });
});
