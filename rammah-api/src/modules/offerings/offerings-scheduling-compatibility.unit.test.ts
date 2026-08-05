import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  findPublishedOfferingById: vi.fn(),
  findPublishedOfferingBySlug: vi.fn(),
  findPublishedLocationsForOffering: vi.fn(),
  findPublishedOfferings: vi.fn(),
  findPublishedPricesByOfferingIds: vi.fn(),
  findPublicOfferingSchedulingSources: vi.fn(),
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
  durationMinutes: 60,
  capacity: 1,
  requiresPayment: false,
  quoteOnly: false,
  sortOrder: 0,
  displayConfig: {},
  categoryId: null,
  categoryName: null,
  categorySlug: null,
};

describe("temporary scheduling-mode compatibility projection", () => {
  beforeEach(() => {
    repositoryMocks.findPublishedOfferingById.mockResolvedValue(publishedOffering);
    repositoryMocks.findPublishedPricesByOfferingIds.mockResolvedValue([]);
    repositoryMocks.findPublishedLocationsForOffering.mockResolvedValue([]);
    formFieldMocks.listPublicBookingFormFields.mockResolvedValue([]);
  });

  it("keeps recurring availability authoritative when legacy sessions also exist", async () => {
    repositoryMocks.findPublicOfferingSchedulingSources.mockResolvedValue({
      hasPublishedAvailability: true,
      hasPublishedSessions: true,
      availabilityTimezone: "Africa/Cairo",
      sessionTimezone: "Europe/London",
    });

    const config = await getPublicOfferingBookingConfig(publishedOffering.id);

    expect(config.offering.schedulingMode).toBe("appointment");
    expect(config.offering.schedulingTimezone).toBe("Africa/Cairo");
  });

  it("projects session-only legacy offerings as scheduled programs", async () => {
    repositoryMocks.findPublicOfferingSchedulingSources.mockResolvedValue({
      hasPublishedAvailability: false,
      hasPublishedSessions: true,
      availabilityTimezone: null,
      sessionTimezone: "Europe/London",
    });

    const config = await getPublicOfferingBookingConfig(publishedOffering.id);

    expect(config.offering.schedulingMode).toBe("scheduled_program");
    expect(config.offering.schedulingTimezone).toBe("Europe/London");
  });

  it("defaults empty legacy offerings to appointments", async () => {
    repositoryMocks.findPublicOfferingSchedulingSources.mockResolvedValue({
      hasPublishedAvailability: false,
      hasPublishedSessions: false,
      availabilityTimezone: null,
      sessionTimezone: null,
    });

    const config = await getPublicOfferingBookingConfig(publishedOffering.id);

    expect(config.offering.schedulingMode).toBe("appointment");
    expect(config.offering.schedulingTimezone).toBe("Africa/Cairo");
  });
});
