import { describe, expect, it } from "vitest";
import {
  adminOfferingBodySchema,
  adminOfferingPatchSchema,
} from "./admin-offerings.routes.js";

const baseOffering = {
  title: "Coaching",
  slug: "coaching",
  offeringType: "coaching",
  attendanceMode: "online",
  bookingMode: "free",
  capacity: 1,
  requiresPayment: false,
  quoteOnly: false,
};

describe("Offering scheduling validation", () => {
  it("requires a positive duration for appointments and accepts non-negative buffers", () => {
    expect(
      adminOfferingBodySchema.safeParse({
        ...baseOffering,
        schedulingMode: "appointment",
        durationMinutes: 60,
        bufferBeforeMinutes: 15,
        bufferAfterMinutes: 30,
      }).success,
    ).toBe(true);
    expect(
      adminOfferingBodySchema.safeParse({
        ...baseOffering,
        schedulingMode: "appointment",
        durationMinutes: null,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
      }).success,
    ).toBe(false);
    expect(
      adminOfferingBodySchema.safeParse({
        ...baseOffering,
        schedulingMode: "appointment",
        durationMinutes: 60,
        bufferBeforeMinutes: -1,
        bufferAfterMinutes: 0,
      }).success,
    ).toBe(false);
  });

  it("requires no appointment duration for scheduled programs regardless of product type", () => {
    const result = adminOfferingBodySchema.safeParse({
      ...baseOffering,
      offeringType: "course",
      bookingMode: "paid",
      schedulingMode: "scheduled_program",
      durationMinutes: null,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    });

    expect(result.success).toBe(true);
    expect(
      adminOfferingBodySchema.safeParse({
        ...baseOffering,
        schedulingMode: "scheduled_program",
        durationMinutes: 60,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
      }).success,
    ).toBe(false);
  });

  it("accepts mode and nullable duration in patch requests", () => {
    expect(
      adminOfferingPatchSchema.safeParse({
        schedulingMode: "scheduled_program",
        durationMinutes: null,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
      }).success,
    ).toBe(true);
  });
});
