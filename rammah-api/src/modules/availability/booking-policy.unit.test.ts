import { describe, expect, it } from "vitest";
import * as capacityRepository from "./slot-capacity.repository.js";

type MinimumNoticeCheck = (startsAt: Date, now: Date, minimumMinutes: number) => boolean;

const getMinimumNoticeCheck = () =>
  (
    capacityRepository as typeof capacityRepository & {
      meetsMinimumNotice?: MinimumNoticeCheck;
    }
  ).meetsMinimumNotice;

describe("booking policy", () => {
  it("rejects slots inside the configured notice window", () => {
    const meetsMinimumNotice = getMinimumNoticeCheck();
    expect(meetsMinimumNotice).toBeTypeOf("function");
    if (!meetsMinimumNotice) return;

    const now = new Date("2026-07-29T10:00:00.000Z");

    expect(meetsMinimumNotice(new Date("2026-07-30T09:59:59.999Z"), now, 1_440)).toBe(false);
    expect(meetsMinimumNotice(new Date("2026-07-30T10:00:00.000Z"), now, 1_440)).toBe(true);
    expect(meetsMinimumNotice(new Date("2026-07-29T10:01:00.000Z"), now, 0)).toBe(true);
  });
});
