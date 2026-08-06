import { and, eq, gt } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { env } from "../../config/env.js";
import {
  availabilityWindows,
  bookingSlotHolds,
  bookings,
  externalCalendarBusyBlocks,
  globalAvailabilityOverrides,
  offeringSessions,
  offerings,
  scheduledProgramOccurrences,
  scheduledPrograms,
} from "../../db/schema/index.js";
import { recurringSlotCapacityLockKey } from "../../shared/db/advisory-lock.js";
import { getTestDatabase } from "../../test/db.js";
import { listPublicOfferingSessions } from "../sessions/public-sessions.service.js";
import { createSlotHold, type SlotHoldInput } from "./slot-holds.service.js";

const recurringDate = "2030-08-05";
const recurringWindowStart = new Date(`${recurringDate}T10:00:00`);
const recurringWindowEnd = new Date(`${recurringDate}T14:00:00`);
const firstRecurringSlot = {
  startsAt: new Date(`${recurringDate}T10:00:00`),
  endsAt: new Date(`${recurringDate}T11:00:00`),
};
const secondRecurringSlot = {
  startsAt: new Date(`${recurringDate}T11:00:00`),
  endsAt: new Date(`${recurringDate}T12:00:00`),
};

const seedOffering = async (capacity: number) => {
  const { db } = getTestDatabase();
  const [offering] = await db
    .insert(offerings)
    .values({
      title: `Capacity ${capacity}`,
      slug: `capacity-${capacity}-${crypto.randomUUID()}`,
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode: "free",
      durationMinutes: 60,
      capacity,
      status: "published",
    })
    .returning();

  return offering!;
};

const seedRecurringTarget = async (capacity: number) => {
  const { db } = getTestDatabase();
  const offering = await seedOffering(capacity);
  const [window] = await db
    .insert(availabilityWindows)
    .values({
      weekday: recurringWindowStart.getDay(),
      startLocalTime: "10:00",
      endLocalTime: "14:00",
      status: "published",
    })
    .returning();

  return {
    offering,
    window: window!,
    input: {
      offeringId: offering.id,
      startsAt: firstRecurringSlot.startsAt.toISOString(),
      endsAt: firstRecurringSlot.endsAt.toISOString(),
    } satisfies SlotHoldInput,
  };
};

const seedFixedTarget = async (capacity: number) => {
  const { db } = getTestDatabase();
  const offering = await seedOffering(capacity);
  await db
    .update(offerings)
    .set({ schedulingMode: "scheduled_program", durationMinutes: null })
    .where(eq(offerings.id, offering.id));
  const [session] = await db
    .insert(offeringSessions)
    .values({
      offeringId: offering.id,
      startsAt: new Date("2030-09-10T07:00:00.000Z"),
      endsAt: new Date("2030-09-10T08:00:00.000Z"),
      timezone: "Africa/Cairo",
      capacity,
      attendanceMode: "online",
      status: "published",
    })
    .returning();
  await db.insert(scheduledPrograms).values({
    id: session!.id,
    offeringId: offering.id,
    title: offering.title,
    timezone: session!.timezone,
    attendanceMode: session!.attendanceMode,
    locationId: session!.locationId,
    capacity,
    status: "published",
  });
  await db.insert(scheduledProgramOccurrences).values({
    id: session!.id,
    scheduledProgramId: session!.id,
    startsAt: session!.startsAt,
    endsAt: session!.endsAt,
    timezone: session!.timezone,
    attendanceMode: session!.attendanceMode,
    locationId: session!.locationId,
    status: "scheduled",
  });

  return {
    offering,
    session: session!,
    input: {
      offeringId: offering.id,
      offeringSessionId: session!.id,
      startsAt: session!.startsAt.toISOString(),
      endsAt: session!.endsAt.toISOString(),
    } satisfies SlotHoldInput,
  };
};

const expectUnavailable = async (promise: Promise<unknown>) => {
  await expect(promise).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
};

const activeHoldCount = async (offeringId: string) => {
  const { db } = getTestDatabase();
  const rows = await db
    .select({ id: bookingSlotHolds.id })
    .from(bookingSlotHolds)
    .where(
      and(
        eq(bookingSlotHolds.offeringId, offeringId),
        eq(bookingSlotHolds.status, "active"),
        gt(bookingSlotHolds.expiresAt, new Date()),
      ),
    );
  return rows.length;
};

const createInParallel = async (input: SlotHoldInput) =>
  Promise.allSettled(Array.from({ length: 20 }, () => createSlotHold(input)));

const expectExactlyCapacity = async (
  results: PromiseSettledResult<unknown>[],
  offeringId: string,
  capacity: number,
) => {
  expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(capacity);
  expect(results.filter(({ status }) => status === "rejected")).toHaveLength(20 - capacity);
  expect(await activeHoldCount(offeringId)).toBe(capacity);
};

const seedBooking = async (
  offeringId: string,
  status: typeof bookings.$inferInsert.status,
  slot = firstRecurringSlot,
) => {
  const { db } = getTestDatabase();
  await db.insert(bookings).values({
    offeringId,
    attendanceMode: "online",
    status,
    customerFullName: "Capacity Test",
    customerEmail: `${status}-${crypto.randomUUID()}@example.test`,
    slotStartAt: slot.startsAt,
    slotEndAt: slot.endsAt,
    timezone: "Africa/Cairo",
  });
};

describe.sequential("atomic public slot-hold capacity", () => {
  it("allows one group session to fill but blocks a different offering at the same time", async () => {
    const first = await seedFixedTarget(3);
    const second = await seedFixedTarget(3);
    const { db } = getTestDatabase();

    await db
      .update(offeringSessions)
      .set({
        startsAt: first.session.startsAt,
        endsAt: first.session.endsAt,
      })
      .where(eq(offeringSessions.id, second.session.id));
    await db
      .update(scheduledProgramOccurrences)
      .set({
        startsAt: first.session.startsAt,
        endsAt: first.session.endsAt,
      })
      .where(eq(scheduledProgramOccurrences.id, second.session.id));
    second.input.startsAt = first.session.startsAt.toISOString();
    second.input.endsAt = first.session.endsAt.toISOString();

    await expect(createSlotHold(first.input)).resolves.toBeDefined();
    await expect(createSlotHold(first.input)).resolves.toBeDefined();
    await expectUnavailable(createSlotHold(second.input));
  });

  it("serializes competing offerings so only one overlapping schedule wins", async () => {
    const first = await seedFixedTarget(1);
    const second = await seedFixedTarget(1);
    const { db } = getTestDatabase();

    await db
      .update(offeringSessions)
      .set({
        startsAt: first.session.startsAt,
        endsAt: first.session.endsAt,
      })
      .where(eq(offeringSessions.id, second.session.id));
    await db
      .update(scheduledProgramOccurrences)
      .set({
        startsAt: first.session.startsAt,
        endsAt: first.session.endsAt,
      })
      .where(eq(scheduledProgramOccurrences.id, second.session.id));
    second.input.startsAt = first.session.startsAt.toISOString();
    second.input.endsAt = first.session.endsAt.toISOString();

    const results = await Promise.allSettled([
      createSlotHold(first.input),
      createSlotHold(second.input),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
  });

  it("blocks a ninth distinct schedule group on the same day", async () => {
    const target = await seedRecurringTarget(1);

    for (let index = 0; index < env.BOOKING_DAILY_LIMIT; index += 1) {
      const offering = await seedOffering(1);
      await seedBooking(offering.id, "confirmed", {
        startsAt: new Date(`${recurringDate}T${String(index).padStart(2, "0")}:00:00`),
        endsAt: new Date(`${recurringDate}T${String(index).padStart(2, "0")}:30:00`),
      });
    }

    await expectUnavailable(createSlotHold(target.input));
  });

  it.each([1, 3])(
    "persists exactly capacity=%i recurring holds from 20 parallel requests",
    async (capacity) => {
      const { offering, input } = await seedRecurringTarget(capacity);

      const results = await createInParallel(input);

      await expectExactlyCapacity(results, offering.id, capacity);
    },
  );

  it.each([1, 3])(
    "persists exactly capacity=%i fixed-session holds from 20 parallel requests",
    async (capacity) => {
      const { offering, input } = await seedFixedTarget(capacity);

      const results = await createInParallel(input);

      await expectExactlyCapacity(results, offering.id, capacity);
    },
  );

  it("does not count expired, released, or converted holds", async () => {
    const { db } = getTestDatabase();
    const { offering, input } = await seedRecurringTarget(1);
    const common = {
      offeringId: offering.id,
      slotStartAt: firstRecurringSlot.startsAt,
      slotEndAt: firstRecurringSlot.endsAt,
    };
    await db.insert(bookingSlotHolds).values([
      {
        ...common,
        status: "active",
        expiresAt: new Date(Date.now() - 60_000),
      },
      {
        ...common,
        status: "released",
        expiresAt: new Date(Date.now() + 60_000),
      },
      {
        ...common,
        status: "converted",
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);

    await expect(createSlotHold(input)).resolves.toMatchObject({ status: "active" });
    expect(await activeHoldCount(offering.id)).toBe(1);
  });

  it.each(["pending_payment", "confirmed", "rescheduled"] as const)(
    "counts %s bookings against recurring capacity",
    async (status) => {
      const { offering, input } = await seedRecurringTarget(1);
      await seedBooking(offering.id, status);

      await expectUnavailable(createSlotHold(input));
    },
  );

  it("does not count terminal bookings against recurring capacity", async () => {
    const { offering, input } = await seedRecurringTarget(1);
    for (const status of [
      "payment_failed",
      "cancelled",
      "completed",
      "no_show",
      "expired",
      "rejected",
    ] as const) {
      await seedBooking(offering.id, status);
    }

    await expect(createSlotHold(input)).resolves.toMatchObject({ status: "active" });
  });

  it("shows a fixed session as booked when a rescheduled booking consumes capacity", async () => {
    const { db } = getTestDatabase();
    const { offering, session } = await seedFixedTarget(1);
    await db.insert(bookings).values({
      offeringId: offering.id,
      scheduledProgramId: session.id,
      attendanceMode: "online",
      status: "rescheduled",
      customerFullName: "Rescheduled Capacity",
      customerEmail: "rescheduled-fixed@example.test",
      timezone: "Africa/Cairo",
    });

    const result = await listPublicOfferingSessions({
      offeringId: offering.id,
      dateFrom: "2030-09-10",
      dateTo: "2030-09-10",
    });

    expect(result.sessions[0]).toMatchObject({
      status: "booked",
      bookedCount: 1,
      remainingCapacity: 0,
    });
  });

  it("matches generated buffer spacing without counting the buffer as occupied time", async () => {
    const { db } = getTestDatabase();
    const offering = await seedOffering(1);
    await db
      .update(offerings)
      .set({
        durationMinutes: 30,
        bufferBeforeMinutes: 10,
        bufferAfterMinutes: 5,
      })
      .where(eq(offerings.id, offering.id));
    await db.insert(availabilityWindows).values({
      weekday: recurringWindowStart.getDay(),
      startLocalTime: "10:00",
      endLocalTime: "12:00",
      status: "published",
    });
    const startsAt = new Date(`${recurringDate}T10:10:00`);
    const endsAt = new Date(`${recurringDate}T10:40:00`);
    await seedBooking(offering.id, "confirmed", {
      startsAt: new Date(`${recurringDate}T10:45:00`),
      endsAt: new Date(`${recurringDate}T10:55:00`),
    });

    await expect(
      createSlotHold({
        offeringId: offering.id,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      }),
    ).resolves.toMatchObject({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
    await expectUnavailable(
      createSlotHold({
        offeringId: offering.id,
        startsAt: new Date(`${recurringDate}T10:00:00`).toISOString(),
        endsAt: new Date(`${recurringDate}T10:30:00`).toISOString(),
      }),
    );
  });

  it("rejects a recurring candidate overlapped by a blocked override", async () => {
    const { db } = getTestDatabase();
    const { input } = await seedRecurringTarget(1);
    await db.insert(globalAvailabilityOverrides).values({
      date: recurringDate,
      overrideMode: "unavailable",
    });

    await expectUnavailable(createSlotHold(input));
  });

  it("rejects recurring and fixed targets overlapped by published external busy blocks", async () => {
    const { db } = getTestDatabase();
    const recurring = await seedRecurringTarget(1);
    const fixed = await seedFixedTarget(1);
    await db.insert(externalCalendarBusyBlocks).values([
      {
        startsAt: firstRecurringSlot.startsAt,
        endsAt: firstRecurringSlot.endsAt,
        status: "published",
      },
      {
        startsAt: fixed.session.startsAt,
        endsAt: fixed.session.endsAt,
        status: "published",
      },
    ]);

    await expectUnavailable(createSlotHold(recurring.input));
    await expectUnavailable(createSlotHold(fixed.input));
  });

  it("uses PAYMENT_HOLD_MINUTES for the persisted expiry", async () => {
    const { input } = await seedRecurringTarget(1);
    const before = Date.now();

    const hold = await createSlotHold(input);

    const durationMs = new Date(hold.expiresAt).getTime() - before;
    expect(durationMs).toBeGreaterThanOrEqual(env.PAYMENT_HOLD_MINUTES * 60_000);
    expect(durationMs).toBeLessThan(env.PAYMENT_HOLD_MINUTES * 60_000 + 5_000);
  });

  it("refreshes the active-hold cutoff after waiting for the capacity lock", async () => {
    const { db, pool } = getTestDatabase();
    const { offering, input } = await seedRecurringTarget(1);
    const key = recurringSlotCapacityLockKey({ offeringId: offering.id, ...firstRecurringSlot });
    await db.insert(bookingSlotHolds).values({
      offeringId: offering.id,
      slotStartAt: firstRecurringSlot.startsAt,
      slotEndAt: firstRecurringSlot.endsAt,
      status: "active",
      expiresAt: new Date(Date.now() + 500),
    });
    const lockClient = await pool.connect();

    try {
      await lockClient.query("BEGIN");
      await lockClient.query("SELECT pg_advisory_xact_lock($1::bigint)", [key.toString()]);
      const request = createSlotHold(input);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      await lockClient.query("ROLLBACK");

      await expect(request).resolves.toMatchObject({ status: "active" });
      expect(await activeHoldCount(offering.id)).toBe(1);
    } finally {
      await lockClient.query("ROLLBACK").catch(() => undefined);
      lockClient.release();
    }
  });

  it("does not serialize a different recurring slot behind a held capacity lock", async () => {
    const { pool } = getTestDatabase();
    const { offering } = await seedRecurringTarget(1);
    const lockClient = await pool.connect();
    const key = recurringSlotCapacityLockKey({ offeringId: offering.id, ...firstRecurringSlot });
    const input = {
      offeringId: offering.id,
      startsAt: secondRecurringSlot.startsAt.toISOString(),
      endsAt: secondRecurringSlot.endsAt.toISOString(),
    };

    try {
      await lockClient.query("BEGIN");
      await lockClient.query("SELECT pg_advisory_xact_lock($1::bigint)", [key.toString()]);
      const request = createSlotHold(input);
      const result = await Promise.race([
        request.then(() => "created" as const),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 750)),
      ]);

      expect(result).toBe("created");
      await request;
    } finally {
      await lockClient.query("ROLLBACK");
      lockClient.release();
    }
  });

  it("rolls back a failed insert and releases the capacity lock", async () => {
    const { pool } = getTestDatabase();
    const { offering, input } = await seedRecurringTarget(1);
    const key = recurringSlotCapacityLockKey({ offeringId: offering.id, ...firstRecurringSlot });
    await pool.query(`
      CREATE FUNCTION fail_capacity_hold_insert_test() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'forced capacity hold failure';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_capacity_hold_insert
      BEFORE INSERT ON booking_slot_holds
      FOR EACH ROW EXECUTE FUNCTION fail_capacity_hold_insert_test();
    `);

    try {
      await expect(createSlotHold(input)).rejects.toThrow();
      expect(await activeHoldCount(offering.id)).toBe(0);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<{ acquired: boolean }>(
          "SELECT pg_try_advisory_xact_lock($1::bigint) AS acquired",
          [key.toString()],
        );
        expect(result.rows[0]?.acquired).toBe(true);
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    } finally {
      await pool.query("DROP TRIGGER IF EXISTS fail_capacity_hold_insert ON booking_slot_holds");
      await pool.query("DROP FUNCTION IF EXISTS fail_capacity_hold_insert_test()");
    }
  });
});
