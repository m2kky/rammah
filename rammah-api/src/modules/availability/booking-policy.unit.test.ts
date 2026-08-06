import { describe, expect, it } from "vitest";
import {
  advancePolicyEnforces,
  buildBookingPolicy,
  isEligibleBookingTarget,
  validateBookingPolicyInput,
} from "./booking-policy.js";

const wednesdayInCairo = new Date("2026-08-05T09:00:00.000Z");

describe("calendar-day booking policy", () => {
  it("opens Thursday for one day and Friday for two days when today is Wednesday", () => {
    expect(
      buildBookingPolicy({
        minimumAdvanceDays: 1,
        timezone: "Africa/Cairo",
        now: wednesdayInCairo,
      }),
    ).toEqual({
      minimumAdvanceDays: 1,
      timezone: "Africa/Cairo",
      localToday: "2026-08-05",
      earliestBookableDate: "2026-08-06",
    });
    expect(
      buildBookingPolicy({
        minimumAdvanceDays: 2,
        timezone: "Africa/Cairo",
        now: wednesdayInCairo,
      }).earliestBookableDate,
    ).toBe("2026-08-07");
  });

  it("accepts every instant on the earliest local date and rejects the previous date", () => {
    const policy = buildBookingPolicy({
      minimumAdvanceDays: 1,
      timezone: "Africa/Cairo",
      now: wednesdayInCairo,
    });

    expect(isEligibleBookingTarget(new Date("2026-08-05T21:00:00.000Z"), policy)).toBe(true);
    expect(isEligibleBookingTarget(new Date("2026-08-05T20:59:59.999Z"), policy)).toBe(false);
    expect(isEligibleBookingTarget(new Date("2026-08-06T20:59:59.999Z"), policy)).toBe(true);
  });

  it("uses local calendar addition across Cairo daylight-saving transitions", () => {
    const beforeDstStart = buildBookingPolicy({
      minimumAdvanceDays: 2,
      timezone: "Africa/Cairo",
      now: new Date("2026-04-23T12:00:00.000Z"),
    });

    expect(beforeDstStart.localToday).toBe("2026-04-23");
    expect(beforeDstStart.earliestBookableDate).toBe("2026-04-25");
  });

  it("validates the approved range and IANA timezone", () => {
    expect(validateBookingPolicyInput({ minimumAdvanceDays: 1, timezone: "Africa/Cairo" })).toEqual([]);
    expect(validateBookingPolicyInput({ minimumAdvanceDays: 365, timezone: "Europe/London" })).toEqual([]);
    expect(validateBookingPolicyInput({ minimumAdvanceDays: 0, timezone: "Cairo-ish" })).toEqual([
      { field: "bookingMinimumAdvanceDays", message: "Use a whole number from 1 through 365." },
      { field: "bookingDefaultTimezone", message: "Use a valid IANA timezone." },
    ]);
    expect(validateBookingPolicyInput({ minimumAdvanceDays: 1.5, timezone: "Africa/Cairo" })).toHaveLength(1);
  });

  it("requires every capacity caller to choose an explicit enforcement context", () => {
    expect(advancePolicyEnforces("public_hold")).toBe(true);
    expect(advancePolicyEnforces("public_reschedule")).toBe(true);
    expect(advancePolicyEnforces("active_hold_conversion")).toBe(false);
    expect(advancePolicyEnforces("admin_reschedule")).toBe(false);
  });
});
