import { describe, expect, it } from "vitest";
import { buildWindowSlots, dedupeSlots } from "./availability-slots.service.js";

const appointmentOffering = {
  id: "offering-1",
  title: "Appointment",
  slug: "appointment",
  schedulingMode: "appointment" as const,
  durationMinutes: 60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  capacity: 1,
  status: "published" as const,
};

const splitThursdayWindows = [
  {
    id: "window-morning",
    weekday: 4,
    startLocalTime: "09:00:00",
    endLocalTime: "13:00:00",
    status: "published" as const,
  },
  {
    id: "window-evening",
    weekday: 4,
    startLocalTime: "14:00:00",
    endLocalTime: "22:00:00",
    status: "published" as const,
  },
];

describe("reported split-window booking regression", () => {
  it("combines both Thursday windows using Offering duration", () => {
    const slots = dedupeSlots(
      buildWindowSlots(
        [new Date("2026-08-13T00:00:00.000Z")],
        splitThursdayWindows,
        appointmentOffering,
        "Africa/Cairo",
      ),
    );

    expect(slots).toHaveLength(12);
    expect(slots.map((slot) => slot.availabilityWindowId)).toEqual([
      ...Array(4).fill("window-morning"),
      ...Array(8).fill("window-evening"),
    ]);
  });

  it("converts Cairo wall times independently of the API process timezone", () => {
    const slots = dedupeSlots(
      buildWindowSlots(
        [new Date("2026-08-13T00:00:00.000Z")],
        splitThursdayWindows,
        appointmentOffering,
        "Africa/Cairo",
      ),
    );

    expect(slots[0]?.startsAt.toISOString()).toBe("2026-08-13T06:00:00.000Z");
    expect(slots.at(-1)?.startsAt.toISOString()).toBe("2026-08-13T18:00:00.000Z");
  });

  it("uses Offering buffers when partitioning a global window", () => {
    const slots = buildWindowSlots(
      [new Date("2026-08-13T00:00:00.000Z")],
      [splitThursdayWindows[0]!],
      { ...appointmentOffering, bufferBeforeMinutes: 10, bufferAfterMinutes: 5 },
      "Africa/Cairo",
    );

    expect(slots).toHaveLength(3);
    expect(slots[0]?.startsAt.toISOString()).toBe("2026-08-13T06:10:00.000Z");
    expect(slots[1]?.startsAt.toISOString()).toBe("2026-08-13T07:25:00.000Z");
  });

  it("keeps a Cairo after-midnight slot on its configured local date", () => {
    const slots = buildWindowSlots(
      [new Date("2026-08-13T00:00:00.000Z")],
      [{
        ...splitThursdayWindows[0]!,
        id: "window-midnight",
        startLocalTime: "00:30:00",
        endLocalTime: "01:30:00",
      }],
      appointmentOffering,
      "Africa/Cairo",
    );

    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ date: "2026-08-13" });
    expect(slots[0]?.startsAt.toISOString()).toBe("2026-08-12T21:30:00.000Z");
  });

  it("uses the Cairo DST offset that applies to each local date", () => {
    const oneHourWindow = [{
      ...splitThursdayWindows[0]!,
      startLocalTime: "09:00:00",
      endLocalTime: "10:00:00",
    }];

    const winterSlots = buildWindowSlots(
      [new Date("2026-01-15T00:00:00.000Z")],
      oneHourWindow,
      appointmentOffering,
      "Africa/Cairo",
    );
    const summerSlots = buildWindowSlots(
      [new Date("2026-08-13T00:00:00.000Z")],
      oneHourWindow,
      appointmentOffering,
      "Africa/Cairo",
    );

    expect(winterSlots[0]?.startsAt.toISOString()).toBe("2026-01-15T07:00:00.000Z");
    expect(summerSlots[0]?.startsAt.toISOString()).toBe("2026-08-13T06:00:00.000Z");
  });

  it.each([
    {
      date: "2026-04-24",
      weekday: 5,
      startLocalTime: "00:30:00",
      endLocalTime: "01:30:00",
      transition: "nonexistent",
    },
    {
      date: "2026-10-29",
      weekday: 4,
      startLocalTime: "23:30:00",
      endLocalTime: "23:59:00",
      transition: "ambiguous",
    },
  ])("rejects a $transition Cairo wall time", ({ date, weekday, startLocalTime, endLocalTime }) => {
    expect(() =>
      buildWindowSlots(
        [new Date(`${date}T00:00:00.000Z`)],
        [{
          ...splitThursdayWindows[0]!,
          id: `window-${date}`,
          weekday,
          startLocalTime,
          endLocalTime,
        }],
        appointmentOffering,
        "Africa/Cairo",
      ),
    ).toThrow(RangeError);
  });
});
