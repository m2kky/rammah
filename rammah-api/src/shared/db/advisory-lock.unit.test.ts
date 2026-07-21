import { describe, expect, it } from "vitest";
import {
  fixedSessionCapacityLockKey,
  recurringSlotCapacityLockKey,
} from "./advisory-lock.js";

describe("capacity advisory lock keys", () => {
  it("returns a stable signed bigint for a fixed session identity", () => {
    const first = fixedSessionCapacityLockKey("27e466d8-26f4-46fd-b825-69ed814b79c3");
    const second = fixedSessionCapacityLockKey("27e466d8-26f4-46fd-b825-69ed814b79c3");

    expect(typeof first).toBe("bigint");
    expect(second).toBe(first);
    expect(first).toBe(1546872114717083004n);
    expect(first).toBeGreaterThanOrEqual(-(1n << 63n));
    expect(first).toBeLessThan(1n << 63n);
  });

  it("normalizes equivalent UTC instants for recurring slot identities", () => {
    const utc = recurringSlotCapacityLockKey({
      offeringId: "a22cf994-ef5b-4bb2-8512-5c843f5b34c4",
      startsAt: new Date("2030-08-05T07:00:00.000Z"),
      endsAt: new Date("2030-08-05T08:00:00.000Z"),
    });
    const offset = recurringSlotCapacityLockKey({
      offeringId: "a22cf994-ef5b-4bb2-8512-5c843f5b34c4",
      startsAt: new Date("2030-08-05T09:00:00.000+02:00"),
      endsAt: new Date("2030-08-05T10:00:00.000+02:00"),
    });

    expect(offset).toBe(utc);
    expect(utc).toBe(-2010108646769725880n);
  });

  it("keeps distinct capacity identities distinct", () => {
    const fixed = fixedSessionCapacityLockKey("27e466d8-26f4-46fd-b825-69ed814b79c3");
    const anotherFixed = fixedSessionCapacityLockKey("54af9328-bcad-45ac-b2a1-a51d8e260304");
    const recurring = recurringSlotCapacityLockKey({
      offeringId: "a22cf994-ef5b-4bb2-8512-5c843f5b34c4",
      startsAt: new Date("2030-08-05T07:00:00.000Z"),
      endsAt: new Date("2030-08-05T08:00:00.000Z"),
    });

    expect(new Set([fixed, anotherFixed, recurring])).toHaveLength(3);
  });
});
