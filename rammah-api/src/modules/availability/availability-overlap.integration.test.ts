import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  availabilityWindows,
  globalAvailabilityOverrides,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import {
  createAdminAvailabilityOverride,
  updateAdminAvailabilityOverrideById,
} from "./admin-availability-overrides.service.js";
import {
  createAdminAvailabilityWindow,
  deleteOrArchiveAdminAvailabilityWindowById,
  updateAdminAvailabilityWindowById,
} from "./admin-availability.service.js";

const windowInput = (overrides: Record<string, unknown> = {}) => ({
  weekday: 1,
  startLocalTime: "09:00",
  endLocalTime: "11:00",
  status: "published" as const,
  ...overrides,
});

const expectValidationError = async (promise: Promise<unknown>) => {
  await expect(promise).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
};

describe.sequential("global availability window invariants", () => {
  it("rejects overlapping published windows and returns both conflicting IDs", async () => {
    const existing = await createAdminAvailabilityWindow(windowInput());

    await expect(
      createAdminAvailabilityWindow(
        windowInput({ startLocalTime: "10:00", endLocalTime: "12:00" }),
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: [expect.objectContaining({ message: expect.stringContaining(existing.id) })],
    });
  });

  it("allows exact boundary adjacency and sorts windows deterministically", async () => {
    await createAdminAvailabilityWindow(
      windowInput({ startLocalTime: "11:00", endLocalTime: "13:00" }),
    );
    await createAdminAvailabilityWindow(windowInput());

    const { listAdminAvailabilityWindows } = await import(
      "./admin-availability.service.js"
    );
    const rows = await listAdminAvailabilityWindows({});

    expect(rows.map((row) => row.startLocalTime)).toEqual(["09:00", "11:00"]);
  });

  it("rejects publishing a draft window whose time overlaps", async () => {
    await createAdminAvailabilityWindow(windowInput());
    const draft = await createAdminAvailabilityWindow(
      windowInput({ startLocalTime: "10:00", endLocalTime: "12:00", status: "draft" }),
    );

    await expectValidationError(
      updateAdminAvailabilityWindowById(draft.id, { status: "published" }),
    );
  });

  it("deletes an unused draft but archives a published window", async () => {
    const { db } = getTestDatabase();
    const draft = await createAdminAvailabilityWindow(
      windowInput({ status: "draft" }),
    );
    const published = await createAdminAvailabilityWindow(
      windowInput({ startLocalTime: "12:00", endLocalTime: "14:00" }),
    );

    expect(draft.allowedActions).toEqual({ edit: true, archive: false, delete: true });
    expect(published.allowedActions).toEqual({ edit: true, archive: true, delete: false });

    await expect(
      deleteOrArchiveAdminAvailabilityWindowById(draft.id),
    ).resolves.toMatchObject({ action: "deleted" });
    await expect(
      deleteOrArchiveAdminAvailabilityWindowById(published.id),
    ).resolves.toMatchObject({ action: "archived" });

    const storedDraft = await db
      .select()
      .from(availabilityWindows)
      .where(eq(availabilityWindows.id, draft.id));
    const [storedPublished] = await db
      .select()
      .from(availabilityWindows)
      .where(eq(availabilityWindows.id, published.id));
    expect(storedDraft).toHaveLength(0);
    expect(storedPublished?.status).toBe("archived");
  });

  it("does not let a published window become a deletable draft", async () => {
    const published = await createAdminAvailabilityWindow(windowInput());

    await expect(
      updateAdminAvailabilityWindowById(published.id, { status: "draft" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe.sequential("global availability override invariants", () => {
  it("rejects overlapping available windows on the same local date", async () => {
    const { db } = getTestDatabase();
    await createAdminAvailabilityOverride({
      date: "2030-08-05",
      type: "available",
      startLocalTime: "09:00",
      endLocalTime: "11:00",
    });

    await expectValidationError(
      createAdminAvailabilityOverride({
        date: "2030-08-05",
        type: "available",
        startLocalTime: "10:30",
        endLocalTime: "12:00",
      }),
    );

    const rows = await db.select().from(globalAvailabilityOverrides);
    expect(rows).toHaveLength(1);
  });

  it("allows adjacent available override windows and returns local times", async () => {
    await createAdminAvailabilityOverride({
      date: "2030-08-05",
      type: "available",
      startLocalTime: "09:00",
      endLocalTime: "10:00",
    });

    await expect(
      createAdminAvailabilityOverride({
        date: "2030-08-05",
        type: "available",
        startLocalTime: "10:00",
        endLocalTime: "11:00",
      }),
    ).resolves.toMatchObject({
      type: "available",
      startLocalTime: "10:00",
      endLocalTime: "11:00",
    });
  });

  it("rejects mixing a closed date with explicit available windows", async () => {
    await createAdminAvailabilityOverride({
      date: "2030-08-05",
      type: "unavailable",
      reason: "Holiday",
    });

    await expectValidationError(
      createAdminAvailabilityOverride({
        date: "2030-08-05",
        type: "available",
        startLocalTime: "09:00",
        endLocalTime: "10:00",
      }),
    );
  });

  it("rejects updating an available override into an overlapping window", async () => {
    await createAdminAvailabilityOverride({
      date: "2030-08-05",
      type: "available",
      startLocalTime: "09:00",
      endLocalTime: "10:00",
    });
    const adjacent = await createAdminAvailabilityOverride({
      date: "2030-08-05",
      type: "available",
      startLocalTime: "10:00",
      endLocalTime: "11:00",
    });

    await expectValidationError(
      updateAdminAvailabilityOverrideById(adjacent.id, {
        startLocalTime: "09:30",
      }),
    );
  });
});
