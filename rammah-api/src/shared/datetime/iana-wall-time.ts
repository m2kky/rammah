import { Temporal } from "@js-temporal/polyfill";

export const wallTimeToInstant = (input: {
  date: string;
  time: string;
  timezone: string;
}) => {
  const plainDateTime = Temporal.PlainDateTime.from(`${input.date}T${input.time}`);
  const zonedDateTime = plainDateTime.toZonedDateTime(input.timezone, {
    disambiguation: "reject",
  });

  return new Date(zonedDateTime.epochMilliseconds);
};

export const instantToDateKey = (instant: Date, timezone: string) =>
  Temporal.Instant.fromEpochMilliseconds(instant.getTime())
    .toZonedDateTimeISO(timezone)
    .toPlainDate()
    .toString();

export const localDayRangeForInstant = (instant: Date, timezone: string) => {
  const date = instantToDateKey(instant, timezone);
  const plainDate = Temporal.PlainDate.from(date);
  const nextDate = plainDate.add({ days: 1 });

  return {
    start: new Date(plainDate.toZonedDateTime(timezone).epochMilliseconds),
    end: new Date(nextDate.toZonedDateTime(timezone).epochMilliseconds),
  };
};
