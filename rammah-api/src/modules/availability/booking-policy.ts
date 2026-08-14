import { Temporal } from "@js-temporal/polyfill";
import { instantToDateKey } from "../../shared/datetime/iana-wall-time.js";

export const defaultBookingPolicySettings = {
  minimumAdvanceDays: 1,
  timezone: "Africa/Cairo",
} as const;

export type AdvancePolicyContext =
  | "public_hold"
  | "public_reschedule"
  | "active_hold_conversion"
  | "admin_reschedule";

export type BookingPolicy = {
  minimumAdvanceDays: number;
  timezone: string;
  localToday: string;
  earliestBookableDate: string;
};

export type BookingPolicyValidationIssue = {
  field: "bookingMinimumAdvanceDays" | "bookingDefaultTimezone";
  message: string;
};

export const isValidIanaTimezone = (timezone: string) => {
  try {
    Temporal.ZonedDateTime.from({
      timeZone: timezone,
      year: 2000,
      month: 1,
      day: 1,
      hour: 0,
    });
    return true;
  } catch {
    return false;
  }
};

export const validateBookingPolicyInput = (input: {
  minimumAdvanceDays: number;
  timezone: string;
}): BookingPolicyValidationIssue[] => {
  const issues: BookingPolicyValidationIssue[] = [];
  if (
    !Number.isInteger(input.minimumAdvanceDays) ||
    input.minimumAdvanceDays < 1 ||
    input.minimumAdvanceDays > 365
  ) {
    issues.push({
      field: "bookingMinimumAdvanceDays",
      message: "Use a whole number from 1 through 365.",
    });
  }
  if (!isValidIanaTimezone(input.timezone)) {
    issues.push({
      field: "bookingDefaultTimezone",
      message: "Use a valid IANA timezone.",
    });
  }
  return issues;
};

export const buildBookingPolicy = (input: {
  minimumAdvanceDays: number;
  timezone: string;
  now?: Date;
}): BookingPolicy => {
  const now = input.now ?? new Date();
  const localToday = instantToDateKey(now, input.timezone);
  const earliestBookableDate = Temporal.PlainDate.from(localToday)
    .add({ days: input.minimumAdvanceDays })
    .toString();
  return {
    minimumAdvanceDays: input.minimumAdvanceDays,
    timezone: input.timezone,
    localToday,
    earliestBookableDate,
  };
};

export const isEligibleBookingTarget = (startsAt: Date, policy: BookingPolicy) =>
  instantToDateKey(startsAt, policy.timezone) >= policy.earliestBookableDate;

export const advancePolicyEnforces = (context: AdvancePolicyContext) =>
  context === "public_hold" || context === "public_reschedule";

export const toPublicBookingPolicy = (policy: BookingPolicy) => ({
  minimumAdvanceDays: policy.minimumAdvanceDays,
  timezone: policy.timezone,
  localToday: policy.localToday,
  earliestBookableDate: policy.earliestBookableDate,
});

export const toAdminPublicBookingPolicy = (startsAt: Date, policy: BookingPolicy) => {
  const bookable = isEligibleBookingTarget(startsAt, policy);
  return {
    bookable,
    reason: bookable ? null : ("minimum_advance_days" as const),
    earliestBookableDate: policy.earliestBookableDate,
  };
};
