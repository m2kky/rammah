import { describe, expect, it, vi } from "vitest";
import {
  classifyLegacyOfferingSources,
  inspectLegacySchedulingMigration,
  summarizeLegacyRuleTruth,
} from "./scheduling-migration-preflight.js";

describe("legacy scheduling migration classification", () => {
  it("maps recurring-only, session-only and empty Offerings deterministically", () => {
    expect(
      classifyLegacyOfferingSources([
        { offeringId: "recurring", hasRules: true, hasSessions: false },
        { offeringId: "fixed", hasRules: false, hasSessions: true },
        { offeringId: "empty", hasRules: false, hasSessions: false },
      ]),
    ).toEqual([
      {
        offeringId: "empty",
        schedulingMode: "appointment",
        blocked: false,
      },
      {
        offeringId: "fixed",
        schedulingMode: "scheduled_program",
        blocked: false,
      },
      {
        offeringId: "recurring",
        schedulingMode: "appointment",
        blocked: false,
      },
    ]);
  });

  it("blocks an Offering that has both published source types", () => {
    expect(
      classifyLegacyOfferingSources([
        { offeringId: "mixed", hasRules: true, hasSessions: true },
      ]),
    ).toEqual([
      {
        offeringId: "mixed",
        schedulingMode: null,
        blocked: true,
      },
    ]);
  });
});

describe("database scheduling migration report", () => {
  it("combines source and rule blockers into one non-green report", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            offering_id: "mixed",
            has_rules: true,
            has_sessions: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            offering_id: "mixed",
            weekday: 4,
            start_time: "09:00:00",
            end_time: "13:00:00",
            timezone: "Africa/Cairo",
            slot_duration_minutes: 60,
            buffer_before_minutes: 0,
            buffer_after_minutes: 0,
          },
        ],
      });

    const report = await inspectLegacySchedulingMigration(
      { query },
      new Date("2026-08-06T00:00:00.000Z"),
    );

    expect(report).toMatchObject({
      ok: false,
      mixedSourceOfferingIds: ["mixed"],
      inconsistentRuleOfferingIds: [],
      incompatibleGlobalScheduleOfferingIds: [],
    });
    expect(query).toHaveBeenCalledTimes(2);
  });
});

describe("legacy availability truth summary", () => {
  it("accepts split windows when duration, buffers and timezone agree", () => {
    const result = summarizeLegacyRuleTruth([
      {
        offeringId: "offering-a",
        weekday: 4,
        startTime: "09:00:00",
        endTime: "13:00:00",
        timezone: "Africa/Cairo",
        slotDurationMinutes: 60,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
      },
      {
        offeringId: "offering-a",
        weekday: 4,
        startTime: "14:00:00",
        endTime: "22:00:00",
        timezone: "Africa/Cairo",
        slotDurationMinutes: 60,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
      },
    ]);

    expect(result.inconsistentRuleOfferingIds).toEqual([]);
    expect(result.incompatibleGlobalScheduleOfferingIds).toEqual([]);
  });

  it("reports inconsistent Offering slot truth and incompatible global schedules", () => {
    const result = summarizeLegacyRuleTruth([
      {
        offeringId: "offering-a",
        weekday: 4,
        startTime: "09:00:00",
        endTime: "13:00:00",
        timezone: "Africa/Cairo",
        slotDurationMinutes: 60,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
      },
      {
        offeringId: "offering-a",
        weekday: 4,
        startTime: "14:00:00",
        endTime: "22:00:00",
        timezone: "Africa/Cairo",
        slotDurationMinutes: 30,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
      },
      {
        offeringId: "offering-b",
        weekday: 2,
        startTime: "10:00:00",
        endTime: "12:00:00",
        timezone: "Africa/Cairo",
        slotDurationMinutes: 60,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
      },
    ]);

    expect(result.inconsistentRuleOfferingIds).toEqual(["offering-a"]);
    expect(result.incompatibleGlobalScheduleOfferingIds).toEqual([
      "offering-a",
      "offering-b",
    ]);
  });
});
