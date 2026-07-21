import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  availabilityOverrides,
  availabilityRules,
  offerings,
} from "../../db/schema/index.js";
import { getTestDatabase } from "../../test/db.js";
import {
  createAdminAvailabilityOverride,
  updateAdminAvailabilityOverrideById,
} from "./admin-availability-overrides.service.js";
import {
  createAdminAvailabilityRule,
  updateAdminAvailabilityRuleById,
} from "./admin-availability.service.js";

const seedOffering = async () => {
  const { db } = getTestDatabase();
  const [offering] = await db
    .insert(offerings)
    .values({
      title: "Overlap invariant",
      slug: `overlap-${crypto.randomUUID()}`,
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode: "free",
      durationMinutes: 60,
      capacity: 1,
      status: "published",
    })
    .returning();
  return offering!;
};

const ruleInput = (offeringId: string, overrides: Record<string, unknown> = {}) => ({
  offeringId,
  weekday: 1,
  startTime: "09:00",
  endTime: "11:00",
  timezone: "Africa/Cairo",
  slotDurationMinutes: 60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  status: "published" as const,
  ...overrides,
});

const expectValidationError = async (promise: Promise<unknown>) => {
  await expect(promise).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
};

describe.sequential("published availability overlap invariants", () => {
  it("rejects creating a published rule that overlaps another published rule", async () => {
    const { db } = getTestDatabase();
    const offering = await seedOffering();
    await createAdminAvailabilityRule(ruleInput(offering.id));

    await expectValidationError(
      createAdminAvailabilityRule(
        ruleInput(offering.id, { startTime: "10:00", endTime: "12:00" }),
      ),
    );

    const rows = await db
      .select()
      .from(availabilityRules)
      .where(eq(availabilityRules.offeringId, offering.id));
    expect(rows).toHaveLength(1);
  });

  it("allows exact boundary adjacency between published rules", async () => {
    const offering = await seedOffering();
    await createAdminAvailabilityRule(ruleInput(offering.id));

    await expect(
      createAdminAvailabilityRule(
        ruleInput(offering.id, { startTime: "11:00", endTime: "13:00" }),
      ),
    ).resolves.toMatchObject({ startTime: "11:00", endTime: "13:00" });
  });

  it("rejects a conflicting timezone across published rules for one offering", async () => {
    const offering = await seedOffering();
    await createAdminAvailabilityRule(ruleInput(offering.id));

    await expectValidationError(
      createAdminAvailabilityRule(
        ruleInput(offering.id, {
          weekday: 2,
          timezone: "UTC",
          startTime: "13:00",
          endTime: "15:00",
        }),
      ),
    );
  });

  it("rejects publishing a draft rule whose window overlaps", async () => {
    const { db } = getTestDatabase();
    const offering = await seedOffering();
    await createAdminAvailabilityRule(ruleInput(offering.id));
    const draft = await createAdminAvailabilityRule(
      ruleInput(offering.id, {
        startTime: "10:00",
        endTime: "12:00",
        status: "draft",
      }),
    );

    await expectValidationError(
      updateAdminAvailabilityRuleById(draft.id, { status: "published" }),
    );

    const [stored] = await db
      .select({ status: availabilityRules.status })
      .from(availabilityRules)
      .where(eq(availabilityRules.id, draft.id));
    expect(stored?.status).toBe("draft");
  });

  it("rejects updating a published rule into an overlapping window", async () => {
    const offering = await seedOffering();
    await createAdminAvailabilityRule(ruleInput(offering.id));
    const adjacent = await createAdminAvailabilityRule(
      ruleInput(offering.id, { startTime: "11:00", endTime: "13:00" }),
    );

    await expectValidationError(
      updateAdminAvailabilityRuleById(adjacent.id, { startTime: "10:30" }),
    );
  });
});

describe.sequential("available override overlap invariant", () => {
  it("rejects creating an overlapping available override for the same offering and date", async () => {
    const { db } = getTestDatabase();
    const offering = await seedOffering();
    await createAdminAvailabilityOverride({
      offeringId: offering.id,
      date: "2030-08-05",
      overrideType: "available",
      startsAt: "2030-08-05T07:00:00.000Z",
      endsAt: "2030-08-05T08:00:00.000Z",
    });

    await expectValidationError(
      createAdminAvailabilityOverride({
        offeringId: offering.id,
        date: "2030-08-05",
        overrideType: "available",
        startsAt: "2030-08-05T07:30:00.000Z",
        endsAt: "2030-08-05T08:30:00.000Z",
      }),
    );

    const rows = await db
      .select()
      .from(availabilityOverrides)
      .where(eq(availabilityOverrides.offeringId, offering.id));
    expect(rows).toHaveLength(1);
  });

  it("allows exact boundary adjacency between available overrides", async () => {
    const offering = await seedOffering();
    await createAdminAvailabilityOverride({
      offeringId: offering.id,
      date: "2030-08-05",
      overrideType: "available",
      startsAt: "2030-08-05T07:00:00.000Z",
      endsAt: "2030-08-05T08:00:00.000Z",
    });

    await expect(
      createAdminAvailabilityOverride({
        offeringId: offering.id,
        date: "2030-08-05",
        overrideType: "available",
        startsAt: "2030-08-05T08:00:00.000Z",
        endsAt: "2030-08-05T09:00:00.000Z",
      }),
    ).resolves.toMatchObject({
      startsAt: "2030-08-05T08:00:00.000Z",
      endsAt: "2030-08-05T09:00:00.000Z",
    });
  });

  it("rejects updating an available override into an overlapping window", async () => {
    const offering = await seedOffering();
    await createAdminAvailabilityOverride({
      offeringId: offering.id,
      date: "2030-08-05",
      overrideType: "available",
      startsAt: "2030-08-05T07:00:00.000Z",
      endsAt: "2030-08-05T08:00:00.000Z",
    });
    const adjacent = await createAdminAvailabilityOverride({
      offeringId: offering.id,
      date: "2030-08-05",
      overrideType: "available",
      startsAt: "2030-08-05T08:00:00.000Z",
      endsAt: "2030-08-05T09:00:00.000Z",
    });

    await expectValidationError(
      updateAdminAvailabilityOverrideById(adjacent.id, {
        startsAt: "2030-08-05T07:30:00.000Z",
      }),
    );
  });
});
