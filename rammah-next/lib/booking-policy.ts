import { addDaysToDateKey } from "./booking-datetime";

export type PublicBookingPolicySummary = {
  minimumAdvanceDays: number;
  timezone: string;
  localToday: string;
  earliestBookableDate: string;
};

export type BookingDateRailItem = {
  date: string;
  count: number;
  closedByPolicy: boolean;
};

export const buildBoundedBookingRange = (startDate: string, days: number) => ({
  from: startDate,
  to: addDaysToDateKey(startDate, Math.max(days - 1, 0)),
});

export const buildBookingDateRail = (input: {
  startDate: string;
  days?: number;
  availableDateCounts: ReadonlyMap<string, number>;
  bookingPolicy: PublicBookingPolicySummary | null;
  includeAvailableDatesOutsideRail?: boolean;
}): BookingDateRailItem[] => {
  const days = input.days ?? 14;
  const dateKeys = Array.from({ length: days }, (_, index) =>
    addDaysToDateKey(input.startDate, index),
  );

  if (input.includeAvailableDatesOutsideRail) {
    for (const date of [...input.availableDateCounts.keys()].sort()) {
      if (!dateKeys.includes(date)) dateKeys.push(date);
    }
  }

  return dateKeys.map((date) => ({
    date,
    count: input.availableDateCounts.get(date) ?? 0,
    closedByPolicy: Boolean(
      input.bookingPolicy && date < input.bookingPolicy.earliestBookableDate,
    ),
  }));
};

export const isFirstBookableDateBeyondRail = (input: {
  startDate: string;
  days?: number;
  earliestBookableDate: string;
}) =>
  input.earliestBookableDate >
  addDaysToDateKey(input.startDate, Math.max((input.days ?? 14) - 1, 0));
