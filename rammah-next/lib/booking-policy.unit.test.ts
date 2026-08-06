import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildBookingDateRail,
  buildBoundedBookingRange,
  isFirstBookableDateBeyondRail,
} from "./booking-policy";

const policy = {
  minimumAdvanceDays: 2,
  timezone: "Africa/Cairo",
  localToday: "2026-08-05",
  earliestBookableDate: "2026-08-07",
};

describe("booking policy date rail", () => {
  it("keeps closed dates visible with no selectable times", () => {
    const rail = buildBookingDateRail({
      startDate: "2026-08-05",
      availableDateCounts: new Map([
        ["2026-08-05", 3],
        ["2026-08-07", 2],
      ]),
      bookingPolicy: policy,
    });

    expect(rail.slice(0, 3)).toEqual([
      { date: "2026-08-05", count: 3, closedByPolicy: true },
      { date: "2026-08-06", count: 0, closedByPolicy: true },
      { date: "2026-08-07", count: 2, closedByPolicy: false },
    ]);
  });

  it("keeps the request bounded when jumping to the first bookable date", () => {
    expect(buildBoundedBookingRange("2027-08-05", 14)).toEqual({
      from: "2027-08-05",
      to: "2027-08-18",
    });
    expect(
      isFirstBookableDateBeyondRail({
        startDate: "2026-08-05",
        earliestBookableDate: "2026-08-19",
      }),
    ).toBe(true);
  });

  it("adds actual Program dates outside the contiguous rail", () => {
    const rail = buildBookingDateRail({
      startDate: "2026-08-05",
      availableDateCounts: new Map([["2026-09-03", 1]]),
      bookingPolicy: policy,
      includeAvailableDatesOutsideRail: true,
    });

    expect(rail.at(-1)).toEqual({
      date: "2026-09-03",
      count: 1,
      closedByPolicy: false,
    });
  });
});

describe("booking policy dashboard ownership", () => {
  const policyCard = readFileSync(
    new URL("../components/admin/AdminBookingPolicy.tsx", import.meta.url),
    "utf8",
  );
  const cmsEditor = readFileSync(
    new URL("../components/admin/AdminCms.tsx", import.meta.url),
    "utf8",
  );

  it("owns both booking settings on the Availability policy card", () => {
    expect(policyCard).toContain("Minimum advance booking days");
    expect(policyCard).toContain("Booking timezone");
    expect(policyCard).toContain("Currently effective");
  });

  it("does not duplicate the booking timezone in CMS settings", () => {
    expect(cmsEditor).not.toContain("bookingDefaultTimezone");
    expect(cmsEditor).not.toContain("Booking timezone");
  });
});

describe("public booking policy UI contracts", () => {
  const bookingFlow = readFileSync(
    new URL("../components/BookingFlow.tsx", import.meta.url),
    "utf8",
  );
  const bookingStatus = readFileSync(
    new URL("../components/BookingStatus.tsx", import.meta.url),
    "utf8",
  );

  it("shows closed-date guidance and a bounded first-date jump", () => {
    expect(bookingFlow).toContain("closedByPolicy");
    expect(bookingFlow).toContain("View first bookable date");
    expect(bookingFlow).toContain("fetchBookingWindow");
    expect(bookingFlow).toContain("submitError.meta?.earliestBookableDate");
    expect(bookingFlow).toContain("Refresh available times");
  });

  it("uses server-derived booking change permissions", () => {
    expect(bookingStatus).toContain("booking?.changePolicy.canCancel");
    expect(bookingStatus).toContain("booking?.changePolicy.canReschedule");
    expect(bookingStatus).toContain("availabilityPreview.bookingPolicy");
  });
});
