import { Temporal } from "@js-temporal/polyfill";

export const wallTimeToInstant = (input: {
  date: string;
  time: string;
  timezone: string;
}) => {
  const plainDateTime = Temporal.PlainDateTime.from(`${input.date}T${input.time}`);
  const zonedDateTime = plainDateTime.toZonedDateTime(input.timezone, {
    disambiguation: "compatible",
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
  const nextDate = Temporal.PlainDate.from(date).add({ days: 1 }).toString();

  return {
    start: wallTimeToInstant({ date, time: "00:00:00", timezone }),
    end: wallTimeToInstant({ date: nextDate, time: "00:00:00", timezone }),
  };
};
