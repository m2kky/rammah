import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  ensurePendingCalendarEvent: vi.fn(),
  findCalendarEventByBookingId: vi.fn(),
  findConfirmedBookingForCalendarSync: vi.fn(),
  findGoogleCalendarConnection: vi.fn(),
  findProgramForCalendarSync: vi.fn(),
  markCalendarEventCreated: vi.fn(),
  markCalendarEventCancelled: vi.fn(),
  markCalendarEventFailed: vi.fn(),
  markCalendarEventPending: vi.fn(),
  markCalendarEventUpdated: vi.fn(),
  markGoogleCalendarConnectionError: vi.fn(),
  saveProgramOccurrenceCalendarEvent: vi.fn(),
  updateGoogleCalendarConnectionSettings: vi.fn(),
  updateGoogleCalendarConnectionTokens: vi.fn(),
  upsertGoogleCalendarConnection: vi.fn(),
}));

vi.mock("./google-calendar.repository.js", () => repository);

import {
  ensureGoogleCalendarEventForBooking,
  syncGoogleCalendarEventsForProgram,
} from "./google-calendar.service.js";

describe("Program calendar ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.findCalendarEventByBookingId.mockResolvedValue(null);
    repository.findGoogleCalendarConnection.mockResolvedValue(null);
  });

  it("does not create one coach event for every customer enrollment", async () => {
    repository.findConfirmedBookingForCalendarSync.mockResolvedValue({
      id: "booking-1",
      status: "confirmed",
      target: {
        kind: "scheduled_program",
        scheduledProgramId: "program-1",
        timezone: "Africa/Cairo",
        occurrences: [],
      },
    });

    await expect(ensureGoogleCalendarEventForBooking("booking-1")).resolves.toBeNull();
    expect(repository.ensurePendingCalendarEvent).not.toHaveBeenCalled();
  });

  it("reports every occurrence as retryable when Google Calendar is disconnected", async () => {
    repository.findProgramForCalendarSync.mockResolvedValue([
      {
        programId: "program-1",
        occurrenceId: "occurrence-1",
        googleCalendarEventId: null,
        meetUrl: null,
      },
      {
        programId: "program-1",
        occurrenceId: "occurrence-2",
        googleCalendarEventId: null,
        meetUrl: null,
      },
    ]);

    await expect(syncGoogleCalendarEventsForProgram("program-1")).resolves.toEqual([
      expect.objectContaining({ occurrenceId: "occurrence-1", status: "failed" }),
      expect.objectContaining({ occurrenceId: "occurrence-2", status: "failed" }),
    ]);
    expect(repository.saveProgramOccurrenceCalendarEvent).not.toHaveBeenCalled();
  });
});
