import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  dateKeyForInstantInTimeZone,
  formatBookingDateKey,
  formatBookingInstantDate,
  formatBookingTime,
} from "./booking-datetime";

const originalProcessTimezone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "America/Los_Angeles";
});

afterAll(() => {
  if (originalProcessTimezone === undefined) {
    delete process.env.TZ;
    return;
  }

  process.env.TZ = originalProcessTimezone;
});

describe("authoritative booking timezone formatting", () => {
  it("formats a returned instant in Cairo rather than the browser timezone", () => {
    expect(formatBookingTime("2026-08-13T06:00:00.000Z", "Africa/Cairo")).toBe(
      "9:00 AM",
    );
  });

  it("keeps an after-midnight Cairo instant on the next local calendar date", () => {
    expect(
      formatBookingInstantDate("2026-08-12T21:30:00.000Z", "Africa/Cairo"),
    ).toBe("Thu, Aug 13");
  });

  it("formats DTO date keys without shifting them in a non-host timezone", () => {
    expect(formatBookingDateKey("2026-08-13")).toBe("Thu, Aug 13");
  });

  it("builds the query date from the schedule timezone at a date boundary", () => {
    expect(
      dateKeyForInstantInTimeZone(
        new Date("2026-08-12T21:30:00.000Z"),
        "Africa/Cairo",
      ),
    ).toBe("2026-08-13");
    expect(addDaysToDateKey("2026-08-13", 13)).toBe("2026-08-26");
  });
});
