import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const bookingFlowSource = readFileSync(
  resolve(process.cwd(), "components/BookingFlow.tsx"),
  "utf8",
);
const bookingDateTimeSource = readFileSync(
  resolve(process.cwd(), "lib/booking-datetime.ts"),
  "utf8",
);

describe("reported Program and availability regression", () => {
  it("selects the schedule source from explicit Offering scheduling mode", () => {
    expect(
      bookingFlowSource.includes("schedulingMode"),
      "BookingFlow must branch on the Offering schedulingMode contract",
    ).toBe(true);
    expect(
      bookingFlowSource.includes("const hasSessionOptions = sessions.length > 0"),
      "Legacy sessions must not gain precedence merely because rows exist",
    ).toBe(false);
    expect(bookingFlowSource).toContain(
      "dateKeyForInstantInTimeZone(new Date(), configuredOffering.schedulingTimezone)",
    );
  });

  it("formats returned instants in their authoritative schedule timezone", () => {
    expect(
      /Intl\.DateTimeFormat\([\s\S]*timeZone:/.test(bookingDateTimeSource),
      "Booking time formatting must pass the DTO timezone to Intl.DateTimeFormat",
    ).toBe(true);
    expect(bookingFlowSource).toContain(
      "formatTime(occurrence.startsAt, occurrence.timezone)",
    );
    expect(bookingFlowSource).toContain("formatTime(slot.startsAt, slot.timezone)");
    expect(bookingFlowSource).toContain(
      "formatTime(selectedBookableTime.startsAt, selectedBookableTime.timezone)",
    );
  });
});
