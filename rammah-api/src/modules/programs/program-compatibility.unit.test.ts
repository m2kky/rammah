import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  findLegacyProgramAdapterTarget: vi.fn(),
}));

vi.mock("./program-compatibility.repository.js", () => repositoryMocks);

import { resolveLegacySessionTarget } from "./program-compatibility.service.js";

describe("legacy session Program compatibility", () => {
  beforeEach(() => {
    repositoryMocks.findLegacyProgramAdapterTarget.mockReset();
  });

  it("resolves only the canonical Program/occurrence mapping for a legacy session ID", async () => {
    repositoryMocks.findLegacyProgramAdapterTarget.mockResolvedValue({
      scheduledProgramId: "program-1",
      occurrenceId: "legacy-session-1",
      startsAt: new Date("2030-08-08T06:00:00.000Z"),
      endsAt: new Date("2030-08-08T09:00:00.000Z"),
      timezone: "Africa/Cairo",
    });

    await expect(
      resolveLegacySessionTarget({
        offeringId: "offering-1",
        offeringSessionId: "legacy-session-1",
      }),
    ).resolves.toEqual({
      scheduledProgramId: "program-1",
      occurrence: {
        id: "legacy-session-1",
        startsAt: new Date("2030-08-08T06:00:00.000Z"),
        endsAt: new Date("2030-08-08T09:00:00.000Z"),
        timezone: "Africa/Cairo",
      },
    });
    expect(repositoryMocks.findLegacyProgramAdapterTarget).toHaveBeenCalledWith({
      offeringId: "offering-1",
      legacySessionId: "legacy-session-1",
    });
  });

  it("rejects unknown or unmigrated legacy IDs", async () => {
    repositoryMocks.findLegacyProgramAdapterTarget.mockResolvedValue(null);

    await expect(
      resolveLegacySessionTarget({
        offeringId: "offering-1",
        offeringSessionId: "unknown",
      }),
    ).resolves.toBeNull();
  });
});
