import { describe, expect, it } from "vitest";
import { buildRuleSlots, dedupeSlots } from "./availability-slots.service.js";

const splitThursdayRules = [
  {
    id: "rule-morning",
    offeringId: "offering-1",
    weekday: 4,
    startTime: "09:00:00",
    endTime: "13:00:00",
    timezone: "Africa/Cairo",
    slotDurationMinutes: 60,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    status: "published" as const,
  },
  {
    id: "rule-evening",
    offeringId: "offering-1",
    weekday: 4,
    startTime: "14:00:00",
    endTime: "22:00:00",
    timezone: "Africa/Cairo",
    slotDurationMinutes: 60,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    status: "published" as const,
  },
];

describe("reported split-window booking regression", () => {
  it("combines both Thursday windows in chronological order", () => {
    const slots = dedupeSlots(
      buildRuleSlots(
        [new Date("2026-08-13T00:00:00.000Z")],
        splitThursdayRules,
      ),
    );

    expect(slots).toHaveLength(12);
    expect(slots.map((slot) => slot.availabilityRuleId)).toEqual([
      ...Array(4).fill("rule-morning"),
      ...Array(8).fill("rule-evening"),
    ]);
  });

  it("converts Cairo wall times independently of the API process timezone", () => {
    const slots = dedupeSlots(
      buildRuleSlots(
        [new Date("2026-08-13T00:00:00.000Z")],
        splitThursdayRules,
      ),
    );

    expect(slots[0]?.startsAt.toISOString()).toBe("2026-08-13T06:00:00.000Z");
    expect(slots.at(-1)?.startsAt.toISOString()).toBe("2026-08-13T18:00:00.000Z");
  });

  it("keeps a Cairo after-midnight slot on its configured local date", () => {
    const slots = buildRuleSlots(
      [new Date("2026-08-13T00:00:00.000Z")],
      [
        {
          ...splitThursdayRules[0]!,
          id: "rule-midnight",
          startTime: "00:30:00",
          endTime: "01:30:00",
        },
      ],
    );

    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ date: "2026-08-13" });
    expect(slots[0]?.startsAt.toISOString()).toBe("2026-08-12T21:30:00.000Z");
  });

  it("uses the Cairo DST offset that applies to each local date", () => {
    const winterThursday = {
      ...splitThursdayRules[0]!,
      id: "rule-winter",
      startTime: "09:00:00",
      endTime: "10:00:00",
    };
    const summerThursday = {
      ...winterThursday,
      id: "rule-summer",
    };

    const winterSlots = buildRuleSlots(
      [new Date("2026-01-15T00:00:00.000Z")],
      [winterThursday],
    );
    const summerSlots = buildRuleSlots(
      [new Date("2026-08-13T00:00:00.000Z")],
      [summerThursday],
    );

    expect(winterSlots[0]?.startsAt.toISOString()).toBe("2026-01-15T07:00:00.000Z");
    expect(summerSlots[0]?.startsAt.toISOString()).toBe("2026-08-13T06:00:00.000Z");
  });

  it.each([
    {
      date: "2026-04-24",
      weekday: 5,
      startTime: "00:30:00",
      endTime: "01:30:00",
      transition: "nonexistent",
    },
    {
      date: "2026-10-29",
      weekday: 4,
      startTime: "23:30:00",
      endTime: "23:59:00",
      transition: "ambiguous",
    },
  ])("rejects a $transition Cairo wall time", ({ date, weekday, startTime, endTime }) => {
    expect(() =>
      buildRuleSlots(
        [new Date(`${date}T00:00:00.000Z`)],
        [
          {
            ...splitThursdayRules[0]!,
            id: `rule-${date}`,
            weekday,
            startTime,
            endTime,
          },
        ],
      ),
    ).toThrow(RangeError);
  });
});
