import { describe, expect, it } from "vitest";
import { toExternalBusyBlock } from "./google-calendar-busy.service.js";

describe("Google Calendar busy event mapping", () => {
  it("imports a normal opaque external event", () => {
    expect(
      toExternalBusyBlock({
        id: "external-1",
        status: "confirmed",
        start: { dateTime: "2030-08-05T10:00:00+02:00" },
        end: { dateTime: "2030-08-05T11:00:00+02:00" },
      }),
    ).toMatchObject({
      externalEventId: "external-1",
      startsAt: new Date("2030-08-05T08:00:00.000Z"),
      endsAt: new Date("2030-08-05T09:00:00.000Z"),
    });
  });

  it("ignores transparent, cancelled, malformed, and Rammah-created events", () => {
    const base = {
      id: "external-1",
      start: { dateTime: "2030-08-05T10:00:00Z" },
      end: { dateTime: "2030-08-05T11:00:00Z" },
    };

    expect(toExternalBusyBlock({ ...base, transparency: "transparent" })).toBeNull();
    expect(toExternalBusyBlock({ ...base, status: "cancelled" })).toBeNull();
    expect(
      toExternalBusyBlock({
        ...base,
        extendedProperties: { private: { source: "rammah" } },
      }),
    ).toBeNull();
    expect(toExternalBusyBlock({ ...base, end: {} })).toBeNull();
  });
});
