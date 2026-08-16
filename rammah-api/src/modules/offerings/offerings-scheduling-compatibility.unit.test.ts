import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  findPublishedOfferingById: vi.fn(),
  findPublishedOfferingBySlug: vi.fn(),
  findPublishedLocationsForOffering: vi.fn(),
  findPublishedOfferings: vi.fn(),
  findPublicBookingTimezone: vi.fn(),
}));

const formFieldMocks = vi.hoisted(() => ({
  listPublicBookingFormFields: vi.fn(),
}));

vi.mock("./offerings.repository.js", () => repositoryMocks);
vi.mock("../booking-form-fields/booking-form-fields.service.js", () => formFieldMocks);

import { getPublicOfferingBookingConfig } from "./offerings.service.js";

const publishedOffering = {
  id: "offering-1",
  slug: "one-to-one",
  title: "One-to-one",
  shortDescription: null,
  longDescription: null,
  offeringType: "coaching",
  attendanceMode: "online",
  bookingMode: "free",
  schedulingMode: "scheduled_program",
  durationMinutes: null,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  capacity: 1,
  requiresPayment: false,
  quoteOnly: false,
  sortOrder: 0,
  displayConfig: {},
  categoryId: null,
  categoryName: null,
  categorySlug: null,
};

describe("persisted scheduling-mode contract", () => {
  beforeEach(() => {
    repositoryMocks.findPublishedOfferingById.mockResolvedValue(publishedOffering);
    repositoryMocks.findPublishedLocationsForOffering.mockResolvedValue([]);
    repositoryMocks.findPublicBookingTimezone.mockResolvedValue("Africa/Cairo");
    formFieldMocks.listPublicBookingFormFields.mockResolvedValue([]);
  });

  it("returns the persisted mode without consulting legacy scheduling sources", async () => {
    const config = await getPublicOfferingBookingConfig(publishedOffering.id);

    expect(config.offering.schedulingMode).toBe("scheduled_program");
    expect(config.offering.schedulingTimezone).toBe("Africa/Cairo");
    expect(config.offering.durationMinutes).toBeNull();
    expect(config.offering.bufferBeforeMinutes).toBe(0);
    expect(config.offering.bufferAfterMinutes).toBe(0);
  });

  it("keeps mode independent from offering and commercial booking types", async () => {
    repositoryMocks.findPublishedOfferingById.mockResolvedValue({
      ...publishedOffering,
      offeringType: "course",
      bookingMode: "quote_only",
      schedulingMode: "appointment",
      durationMinutes: 90,
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 30,
    });

    const config = await getPublicOfferingBookingConfig(publishedOffering.id);

    expect(config.offering).toMatchObject({
      offeringType: "course",
      bookingMode: "quote_only",
      schedulingMode: "appointment",
      durationMinutes: 90,
      bufferBeforeMinutes: 15,
      bufferAfterMinutes: 30,
    });
  });
});
