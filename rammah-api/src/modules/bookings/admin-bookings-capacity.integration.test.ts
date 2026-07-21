import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import {
  availabilityOverrides,
  availabilityRules,
  bookingSlotHolds,
  bookings,
  externalCalendarBusyBlocks,
  offeringSessions,
  offerings,
} from "../../db/schema/index.js";
import { recurringSlotCapacityLockKey } from "../../shared/db/advisory-lock.js";
import { getTestDatabase } from "../../test/db.js";
import { createSlotHold } from "../availability/slot-holds.service.js";
import { rescheduleAdminBookingById } from "./admin-bookings.service.js";

vi.mock("../calendar/google-calendar.service.js", () => ({
  cancelGoogleCalendarEventForBooking: vi.fn(),
  ensureGoogleCalendarEventForBooking: vi.fn(),
  updateGoogleCalendarEventForBooking: vi.fn(),
}));

vi.mock("../emails/email.service.js", () => ({
  sendBookingCancelledEmails: vi.fn(),
  sendBookingConfirmedEmails: vi.fn(),
  sendBookingRescheduledEmails: vi.fn(),
}));

const recurringDate = "2032-08-02";
const slots = [10, 11, 12, 13].map((hour) => ({
  startsAt: new Date(`${recurringDate}T${String(hour).padStart(2, "0")}:00:00`),
  endsAt: new Date(`${recurringDate}T${String(hour + 1).padStart(2, "0")}:00:00`),
}));

const insertOffering = async (capacity: number, status: "draft" | "published" = "published") => {
  const { db } = getTestDatabase();
  const [offering] = await db
    .insert(offerings)
    .values({
      title: `Admin capacity ${capacity}`,
      slug: `admin-capacity-${crypto.randomUUID()}`,
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode: "free",
      durationMinutes: 60,
      capacity,
      status,
    })
    .returning();

  return offering!;
};

const seedRecurringOffering = async (capacity: number, buffers = { before: 0, after: 0 }) => {
  const { db } = getTestDatabase();
  const offering = await insertOffering(capacity);
  const [rule] = await db
    .insert(availabilityRules)
    .values({
      offeringId: offering.id,
      weekday: slots[0]!.startsAt.getDay(),
      startTime: "10:00",
      endTime: "15:00",
      timezone: "Africa/Cairo",
      slotDurationMinutes: 60,
      bufferBeforeMinutes: buffers.before,
      bufferAfterMinutes: buffers.after,
      status: "published",
    })
    .returning();

  return { offering, rule: rule! };
};

const seedFixedSession = async (
  capacity: number,
  options: {
    offering?: typeof offerings.$inferSelect;
    status?: "draft" | "published";
    startsAt?: Date;
    endsAt?: Date;
  } = {},
) => {
  const { db } = getTestDatabase();
  const offering = options.offering ?? (await insertOffering(capacity));
  const [session] = await db
    .insert(offeringSessions)
    .values({
      offeringId: offering.id,
      startsAt: options.startsAt ?? new Date("2032-09-10T07:00:00.000Z"),
      endsAt: options.endsAt ?? new Date("2032-09-10T08:00:00.000Z"),
      timezone: "Africa/Cairo",
      capacity,
      attendanceMode: "online",
      status: options.status ?? "published",
    })
    .returning();

  return { offering, session: session! };
};

const seedBooking = async (input: {
  offeringId: string;
  offeringSessionId?: string | null;
  slot?: { startsAt: Date; endsAt: Date };
  status?: "confirmed" | "rescheduled";
}) => {
  const { db } = getTestDatabase();
  const slot = input.slot ?? {
    startsAt: new Date("2031-01-01T08:00:00.000Z"),
    endsAt: new Date("2031-01-01T09:00:00.000Z"),
  };
  const [booking] = await db
    .insert(bookings)
    .values({
      offeringId: input.offeringId,
      offeringSessionId: input.offeringSessionId ?? null,
      attendanceMode: "online",
      status: input.status ?? "confirmed",
      customerFullName: "Admin capacity test",
      customerEmail: `${crypto.randomUUID()}@example.test`,
      slotStartAt: slot.startsAt,
      slotEndAt: slot.endsAt,
      timezone: "Africa/Cairo",
      confirmedAt: new Date("2030-01-01T00:00:00.000Z"),
    })
    .returning();

  return booking!;
};

const recurringInput = (slot: (typeof slots)[number]) => ({
  startsAt: slot.startsAt.toISOString(),
  endsAt: slot.endsAt.toISOString(),
  timezone: "Africa/Cairo",
});

const fixedInput = (session: typeof offeringSessions.$inferSelect) => ({
  offeringSessionId: session.id,
  startsAt: session.startsAt.toISOString(),
  endsAt: session.endsAt.toISOString(),
  timezone: session.timezone,
});

const blockingAt = async (
  offeringId: string,
  slot: { startsAt: Date; endsAt: Date },
  offeringSessionId?: string,
) => {
  const { db } = getTestDatabase();
  const conditions = [
    eq(bookings.offeringId, offeringId),
    inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
    lt(bookings.slotStartAt, slot.endsAt),
    gt(bookings.slotEndAt, slot.startsAt),
  ];
  if (offeringSessionId) conditions.push(eq(bookings.offeringSessionId, offeringSessionId));
  return (await db.select({ id: bookings.id }).from(bookings).where(and(...conditions))).length;
};

const expectUnchanged = async (
  bookingId: string,
  before: { offeringSessionId: string | null; slotStartAt: Date | null; slotEndAt: Date | null },
) => {
  const { db } = getTestDatabase();
  const [after] = await db
    .select({
      offeringSessionId: bookings.offeringSessionId,
      slotStartAt: bookings.slotStartAt,
      slotEndAt: bookings.slotEndAt,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId));
  expect(after).toEqual(before);
};

const raceMoves = async (
  bookingIds: string[],
  input: Parameters<typeof rescheduleAdminBookingById>[1],
) => Promise.allSettled(bookingIds.map((id) => rescheduleAdminBookingById(id, input)));

describe.sequential("atomic admin booking reschedule capacity", () => {
  it("admits exactly one of 20 recurring moves at capacity 1 without losing bookings", async () => {
    const { db } = getTestDatabase();
    const { offering } = await seedRecurringOffering(1);
    const seeded = await Promise.all(
      Array.from({ length: 20 }, () => seedBooking({ offeringId: offering.id })),
    );

    const results = await raceMoves(seeded.map(({ id }) => id), recurringInput(slots[0]!));

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(19);
    expect(await blockingAt(offering.id, slots[0]!)).toBe(1);
    expect((await db.select({ id: bookings.id }).from(bookings)).length).toBe(20);
  });

  it("admits exactly one of 20 fixed-session moves at capacity 1 without losing bookings", async () => {
    const { db } = getTestDatabase();
    const { offering, session } = await seedFixedSession(1);
    const seeded = await Promise.all(
      Array.from({ length: 20 }, () => seedBooking({ offeringId: offering.id })),
    );

    const results = await raceMoves(seeded.map(({ id }) => id), fixedInput(session));

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(19);
    expect(await blockingAt(offering.id, session, session.id)).toBe(1);
    expect((await db.select({ id: bookings.id }).from(bookings)).length).toBe(20);
  });

  it("admits exactly three of 20 recurring moves at capacity 3", async () => {
    const { offering } = await seedRecurringOffering(3);
    const seeded = await Promise.all(
      Array.from({ length: 20 }, () => seedBooking({ offeringId: offering.id })),
    );

    const results = await raceMoves(seeded.map(({ id }) => id), recurringInput(slots[0]!));

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(3);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(17);
    expect(await blockingAt(offering.id, slots[0]!)).toBe(3);
  });

  it("admits exactly three of 20 fixed-session moves at capacity 3 without losing bookings", async () => {
    const { db } = getTestDatabase();
    const { offering, session } = await seedFixedSession(3);
    const seeded = await Promise.all(
      Array.from({ length: 20 }, () => seedBooking({ offeringId: offering.id })),
    );

    const results = await raceMoves(seeded.map(({ id }) => id), fixedInput(session));
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(3);
    expect(rejected).toHaveLength(17);
    expect(rejected.every(({ reason }) => reason?.code === "SLOT_UNAVAILABLE")).toBe(true);
    expect(await blockingAt(offering.id, session, session.id)).toBe(3);
    expect((await db.select({ id: bookings.id }).from(bookings)).length).toBe(20);
  });

  it("serializes competing moves of the same booking and persists one valid final target", async () => {
    const { offering } = await seedRecurringOffering(1);
    const booking = await seedBooking({ offeringId: offering.id });

    const results = await Promise.allSettled([
      rescheduleAdminBookingById(booking.id, recurringInput(slots[0]!)),
      rescheduleAdminBookingById(booking.id, recurringInput(slots[1]!)),
    ]);

    expect(results.every(({ status }) => status === "fulfilled")).toBe(true);
    expect((await blockingAt(offering.id, slots[0]!)) + (await blockingAt(offering.id, slots[1]!))).toBe(1);
  });

  it("does not serialize an unrelated target behind another target capacity lock", async () => {
    const { pool } = getTestDatabase();
    const { offering } = await seedRecurringOffering(1);
    const booking = await seedBooking({ offeringId: offering.id });
    const lockClient = await pool.connect();
    const key = recurringSlotCapacityLockKey({ offeringId: offering.id, ...slots[0]! });

    try {
      await lockClient.query("BEGIN");
      await lockClient.query("SELECT pg_advisory_xact_lock($1::bigint)", [key.toString()]);
      const move = rescheduleAdminBookingById(booking.id, recurringInput(slots[1]!));
      const result = await Promise.race([
        move.then(() => "moved" as const),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 750)),
      ]);

      expect(result).toBe("moved");
      await move;
    } finally {
      await lockClient.query("ROLLBACK");
      lockClient.release();
    }
  });

  it("excludes the moving booking and frees its source only after a successful move", async () => {
    const { offering } = await seedRecurringOffering(1);
    const booking = await seedBooking({ offeringId: offering.id, slot: slots[0] });

    await expect(rescheduleAdminBookingById(booking.id, recurringInput(slots[0]!))).resolves.toBeDefined();
    await expect(rescheduleAdminBookingById(booking.id, recurringInput(slots[1]!))).resolves.toBeDefined();
    await expect(
      createSlotHold({
        offeringId: offering.id,
        startsAt: slots[0]!.startsAt.toISOString(),
        endsAt: slots[0]!.endsAt.toISOString(),
      }),
    ).resolves.toMatchObject({ status: "active" });
    expect(await blockingAt(offering.id, slots[1]!)).toBe(1);
  });

  it("rejects blocked, busy, buffered, full, unpublished and past targets without mutation", async () => {
    const { db } = getTestDatabase();
    const { offering, rule } = await seedRecurringOffering(1, { before: 10, after: 5 });
    const booking = await seedBooking({ offeringId: offering.id });
    const before = {
      offeringSessionId: booking.offeringSessionId,
      slotStartAt: booking.slotStartAt,
      slotEndAt: booking.slotEndAt,
    };
    await db.insert(availabilityOverrides).values({
      offeringId: offering.id,
      availabilityRuleId: rule.id,
      date: recurringDate,
      overrideType: "blocked",
      startsAt: new Date(`${recurringDate}T11:25:00`),
      endsAt: new Date(`${recurringDate}T12:25:00`),
    });
    await db.insert(externalCalendarBusyBlocks).values({
      startsAt: new Date(`${recurringDate}T12:40:00`),
      endsAt: new Date(`${recurringDate}T13:40:00`),
      status: "published",
    });
    await seedBooking({
      offeringId: offering.id,
      slot: {
        startsAt: new Date(`${recurringDate}T13:55:00`),
        endsAt: new Date(`${recurringDate}T14:55:00`),
      },
    });
    const unpublished = await seedFixedSession(1, { offering, status: "draft" });
    const past = await seedFixedSession(1, {
      offering,
      startsAt: new Date("2020-01-01T07:00:00.000Z"),
      endsAt: new Date("2020-01-01T08:00:00.000Z"),
    });
    const rejectedInputs = [
      recurringInput({
        startsAt: new Date(`${recurringDate}T10:00:00`),
        endsAt: new Date(`${recurringDate}T11:00:00`),
      }),
      recurringInput({
        startsAt: new Date(`${recurringDate}T11:25:00`),
        endsAt: new Date(`${recurringDate}T12:25:00`),
      }),
      recurringInput({
        startsAt: new Date(`${recurringDate}T12:40:00`),
        endsAt: new Date(`${recurringDate}T13:40:00`),
      }),
      recurringInput({
        startsAt: new Date(`${recurringDate}T13:55:00`),
        endsAt: new Date(`${recurringDate}T14:55:00`),
      }),
      fixedInput(unpublished.session),
      fixedInput(past.session),
    ];

    for (const input of rejectedInputs) {
      await expect(rescheduleAdminBookingById(booking.id, input)).rejects.toMatchObject({
        code: "SLOT_UNAVAILABLE",
      });
      await expectUnchanged(booking.id, before);
    }
  });

  it("counts an active hold and a rescheduled booking as capacity blockers", async () => {
    const { db } = getTestDatabase();
    const { offering } = await seedRecurringOffering(2);
    const moving = await seedBooking({ offeringId: offering.id });
    await seedBooking({ offeringId: offering.id, slot: slots[0], status: "rescheduled" });
    await db.insert(bookingSlotHolds).values({
      offeringId: offering.id,
      slotStartAt: slots[0]!.startsAt,
      slotEndAt: slots[0]!.endsAt,
      status: "active",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const before = {
      offeringSessionId: moving.offeringSessionId,
      slotStartAt: moving.slotStartAt,
      slotEndAt: moving.slotEndAt,
    };

    await expect(rescheduleAdminBookingById(moving.id, recurringInput(slots[0]!))).rejects.toMatchObject({
      code: "SLOT_UNAVAILABLE",
    });
    await expectUnchanged(moving.id, before);
  });
});
