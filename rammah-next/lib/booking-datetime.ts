const dateKeyInstant = (value: string) => new Date(`${value}T00:00:00.000Z`);

export const dateKeyForInstantInTimeZone = (instant: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(instant);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return `${valueByType.get("year")}-${valueByType.get("month")}-${valueByType.get("day")}`;
};

export const addDaysToDateKey = (value: string, days: number) => {
  const date = dateKeyInstant(value);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
};

export const formatBookingDateKey = (value: string) =>
  new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateKeyInstant(value));

export const formatBookingWeekday = (value: string) =>
  new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(
    dateKeyInstant(value),
  );

export const formatBookingDayNumber = (value: string) =>
  new Intl.DateTimeFormat("en", { day: "2-digit", timeZone: "UTC" }).format(
    dateKeyInstant(value),
  );

export const formatBookingMonth = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(
    dateKeyInstant(value),
  );

export const formatBookingTime = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));

export const formatBookingInstantDate = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date(value));
