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
});
