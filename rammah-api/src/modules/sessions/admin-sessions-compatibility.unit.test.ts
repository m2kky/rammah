import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  archiveAdminSession: vi.fn(),
  findAdminSessionById: vi.fn(),
  findAdminSessions: vi.fn(),
  findLocationForSession: vi.fn(),
  findOfferingForSession: vi.fn(),
  insertAdminSession: vi.fn(),
  updateAdminSession: vi.fn(),
}));

vi.mock("./admin-sessions.repository.js", () => repositoryMocks);
vi.mock("../audit/audit.service.js", () => ({ writeAuditLog: vi.fn() }));

import {
  archiveAdminSessionById,
  createAdminSession,
  updateAdminSessionById,
} from "./admin-sessions.service.js";

const legacySession = {
  id: "session-1",
  scheduledProgramId: "session-1",
  offeringId: "offering-1",
  offeringTitle: "Legacy program",
  offeringSlug: "legacy-program",
  offeringAttendanceMode: "online" as const,
  startsAt: new Date("2030-08-08T06:00:00.000Z"),
  endsAt: new Date("2030-08-08T09:00:00.000Z"),
  timezone: "Africa/Cairo",
  capacity: 12,
  attendanceMode: "online" as const,
  locationId: null,
  locationName: null,
  locationCity: null,
  locationCountryCode: null,
  googleCalendarEventId: null,
  status: "published" as const,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

const expectLegacyWriteConflict = async (operation: Promise<unknown>) => {
  await expect(operation).rejects.toMatchObject({
    code: "CONFLICT",
    statusCode: 409,
  });
};

describe("deprecated admin session writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositoryMocks.findOfferingForSession.mockResolvedValue({
      id: "offering-1",
      attendanceMode: "online",
    });
    repositoryMocks.findAdminSessionById.mockResolvedValue(legacySession);
    repositoryMocks.insertAdminSession.mockResolvedValue(legacySession);
    repositoryMocks.updateAdminSession.mockResolvedValue(legacySession);
    repositoryMocks.archiveAdminSession.mockResolvedValue(legacySession);
  });

  it("rejects create before writing a legacy session", async () => {
    await expectLegacyWriteConflict(
      createAdminSession({
        offeringId: "offering-1",
        startsAt: "2030-08-08T06:00:00.000Z",
        endsAt: "2030-08-08T09:00:00.000Z",
        timezone: "Africa/Cairo",
        capacity: 12,
        attendanceMode: "online",
        status: "published",
      }),
    );
    expect(repositoryMocks.insertAdminSession).not.toHaveBeenCalled();
  });

  it("rejects update and archive before mutating the compatibility row", async () => {
    await expectLegacyWriteConflict(
      updateAdminSessionById("session-1", { capacity: 20 }),
    );
    await expectLegacyWriteConflict(archiveAdminSessionById("session-1"));
    expect(repositoryMocks.updateAdminSession).not.toHaveBeenCalled();
    expect(repositoryMocks.archiveAdminSession).not.toHaveBeenCalled();
  });
});
