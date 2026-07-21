import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { and, eq, gt, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import {
  availabilityRules,
  bookingAnswers,
  bookingFormFields,
  bookingSlotHolds,
  bookings,
  offeringPrices,
  offeringSessions,
  offerings,
  payments,
} from "../../db/schema/index.js";
import {
  fixedSessionCapacityLockKey,
  recurringSlotCapacityLockKey,
} from "../../shared/db/advisory-lock.js";
import { getTestDatabase } from "../../test/db.js";
import { createSlotHold, releaseSlotHoldById } from "../availability/slot-holds.service.js";
import { createPaidBookingFromHold } from "../payments/public-payments.repository.js";
import {
  startPublicPaymentForBooking,
  submitPaidBooking,
} from "../payments/public-payments.service.js";
import { createFreeBookingFromHold } from "./public-bookings.repository.js";
import { submitFreeBooking } from "./public-bookings.service.js";

const recurringDate = "2031-03-03";
const recurringSlot = {
  startsAt: new Date(`${recurringDate}T10:00:00`),
  endsAt: new Date(`${recurringDate}T11:00:00`),
};

const digest = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

type BookingMode = "free" | "paid";

const seedOffering = async (input: {
  bookingMode?: BookingMode;
  capacity?: number;
}) => {
  const { db } = getTestDatabase();
  const bookingMode = input.bookingMode ?? "free";
  const [offering] = await db
    .insert(offerings)
    .values({
      title: `${bookingMode} conversion`,
      slug: `${bookingMode}-conversion-${randomUUID()}`,
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode,
      durationMinutes: 60,
      capacity: input.capacity ?? 1,
      requiresPayment: bookingMode === "paid",
      status: "published",
    })
    .returning();

  if (bookingMode === "paid") {
    await db.insert(offeringPrices).values({
      offeringId: offering!.id,
      countryCode: "EG",
      currency: "EGP",
      baseAmountMinor: 25_000,
      status: "published",
    });
  }

  return offering!;
};

const seedRecurringTarget = async (input: {
  bookingMode?: BookingMode;
  capacity?: number;
}) => {
  const { db } = getTestDatabase();
  const offering = await seedOffering(input);
  await db.insert(availabilityRules).values({
    offeringId: offering.id,
    weekday: recurringSlot.startsAt.getDay(),
    startTime: "10:00",
    endTime: "12:00",
    timezone: "Africa/Cairo",
    slotDurationMinutes: 60,
    status: "published",
  });

  return {
    offering,
    holdInput: {
      offeringId: offering.id,
      startsAt: recurringSlot.startsAt.toISOString(),
      endsAt: recurringSlot.endsAt.toISOString(),
    },
  };
};

const seedFixedTarget = async (input: {
  bookingMode?: BookingMode;
  capacity?: number;
}) => {
  const { db } = getTestDatabase();
  const offering = await seedOffering(input);
  const [session] = await db
    .insert(offeringSessions)
    .values({
      offeringId: offering.id,
      startsAt: new Date("2031-04-08T10:00:00.000Z"),
      endsAt: new Date("2031-04-08T11:00:00.000Z"),
      timezone: "Africa/Cairo",
      capacity: input.capacity ?? 1,
      attendanceMode: "online",
      status: "published",
    })
    .returning();

  return {
    offering,
    session: session!,
    holdInput: {
      offeringId: offering.id,
      offeringSessionId: session!.id,
      startsAt: session!.startsAt.toISOString(),
      endsAt: session!.endsAt.toISOString(),
    },
  };
};

const freeInput = (hold: { id: string; holdToken: string }) => ({
  holdId: hold.id,
  holdToken: hold.holdToken,
  attendanceMode: "online" as const,
  customerFullName: "Free Owner",
  customerEmail: "free-owner@example.test",
  timezone: "Africa/Cairo",
  answers: [
    {
      fieldKey: "goal",
      label: "Goal",
      value: "Ship safely",
    },
  ],
});

const paidInput = (hold: { id: string; holdToken: string }, suffix = "first") => ({
  holdId: hold.id,
  holdToken: hold.holdToken,
  attendanceMode: "online" as const,
  customerFullName: "Paid Owner",
  customerEmail: "paid-owner@example.test",
  timezone: "Africa/Cairo",
  answers: [
    {
      fieldKey: "goal",
      label: "Goal",
      value: "Pay once",
    },
  ],
  price: {
    currency: "EGP",
    baseAmountMinor: 25_000,
    discountAmountMinor: 0,
    taxAmountMinor: 0,
    totalAmountMinor: 25_000,
  },
  payment: {
    provider: "kashier",
    idempotencyKey: `hold-conversion-${suffix}-${randomUUID()}`,
  },
});

const unknownAnswer = {
  fieldKey: "unknown-current-field",
  label: "Unknown current field",
  value: "must not become an ownership oracle",
};

const freeServiceInput = (
  holdId: string,
  holdToken?: string | null,
  answers = [unknownAnswer],
) => ({
  holdId,
  holdToken,
  attendanceMode: "online" as const,
  customer: {
    fullName: "Free Service Owner",
    email: "free-service-owner@example.test",
  },
  timezone: "Africa/Cairo",
  answers,
});

const paidServiceInput = (
  holdId: string,
  holdToken?: string | null,
  answers = [unknownAnswer],
) => ({
  holdId,
  holdToken,
  attendanceMode: "online" as const,
  customer: {
    fullName: "Paid Service Owner",
    email: "paid-service-owner@example.test",
  },
  countryCode: "EG",
  timezone: "Africa/Cairo",
  answers,
});

const seedRequiredGoalField = async (offeringId: string) => {
  const { db } = getTestDatabase();
  const [field] = await db
    .insert(bookingFormFields)
    .values({
      offeringId,
      fieldKey: "goal",
      label: "Goal",
      fieldType: "text",
      required: true,
      status: "published",
    })
    .returning();
  return field!;
};

const expectUnavailable = async (promise: Promise<unknown>) => {
  await expect(promise).rejects.toMatchObject({ code: "SLOT_UNAVAILABLE" });
};

const countRows = async (offeringId: string) => {
  const { db } = getTestDatabase();
  const bookingRows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.offeringId, offeringId));
  const answerRows = bookingRows.length
    ? await db
        .select({ id: bookingAnswers.id })
        .from(bookingAnswers)
        .where(inArray(bookingAnswers.bookingId, bookingRows.map(({ id }) => id)))
    : [];
  const paymentRows = bookingRows.length
    ? await db
        .select({ id: payments.id })
        .from(payments)
        .where(inArray(payments.bookingId, bookingRows.map(({ id }) => id)))
    : [];

  return {
    bookings: bookingRows.length,
    answers: answerRows.length,
    payments: paymentRows.length,
  };
};

describe.sequential("owned slot holds and atomic conversion", () => {
  it("returns the raw owner token once and persists only its digest", async () => {
    const { db } = getTestDatabase();
    const target = await seedRecurringTarget({});

    const hold = await createSlotHold(target.holdInput);
    const [stored] = await db
      .select({ holdSecretHash: bookingSlotHolds.holdSecretHash })
      .from(bookingSlotHolds)
      .where(eq(bookingSlotHolds.id, hold.id));

    expect(Buffer.from(hold.holdToken, "base64url")).toHaveLength(32);
    expect(stored!.holdSecretHash).toBe(digest(hold.holdToken));
    expect(stored!.holdSecretHash).not.toBe(hold.holdToken);
    expect(JSON.stringify(stored)).not.toContain(hold.holdToken);
  });

  it("rejects missing, wrong, and ID-only release generically", async () => {
    const target = await seedRecurringTarget({});
    const hold = await createSlotHold(target.holdInput);

    await expectUnavailable(releaseSlotHoldById(hold.id, undefined));
    await expectUnavailable(releaseSlotHoldById(hold.id, "wrong-token"));

    const app = createApp();
    const server = app.listen(0);
    try {
      await new Promise<void>((resolve) => server.once("listening", resolve));
      const { port } = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${port}/api/v1/public/slot-holds/${hold.id}`,
        { method: "DELETE" },
      );
      const body = (await response.json()) as { error: { code: string } };

      expect(response.status).toBe(409);
      expect(body.error.code).toBe("SLOT_UNAVAILABLE");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("rejects every unauthenticated or unusable free hold before mutable validation", async () => {
    const { db } = getTestDatabase();
    const target = await seedRecurringTarget({});
    const hold = await createSlotHold(target.holdInput);
    await expectUnavailable(submitFreeBooking(freeServiceInput(hold.id, undefined)));
    await expectUnavailable(submitFreeBooking(freeServiceInput(hold.id, "wrong-token")));
    await db.update(bookingSlotHolds).set({ holdSecretHash: null }).where(eq(bookingSlotHolds.id, hold.id));
    await expectUnavailable(submitFreeBooking(freeServiceInput(hold.id, hold.holdToken)));
    await db
      .update(bookingSlotHolds)
      .set({ holdSecretHash: digest(hold.holdToken), status: "released" })
      .where(eq(bookingSlotHolds.id, hold.id));
    await expectUnavailable(submitFreeBooking(freeServiceInput(hold.id, hold.holdToken)));
    await db
      .update(bookingSlotHolds)
      .set({ status: "active", expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(bookingSlotHolds.id, hold.id));
    await expectUnavailable(submitFreeBooking(freeServiceInput(hold.id, hold.holdToken)));
    await db
      .update(bookingSlotHolds)
      .set({ expiresAt: new Date(Date.now() + 60_000) })
      .where(eq(bookingSlotHolds.id, hold.id));
    await expect(submitFreeBooking(freeServiceInput(hold.id, hold.holdToken))).rejects
      .toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects every unauthenticated or unusable paid hold before form and price validation", async () => {
    const { db } = getTestDatabase();
    const target = await seedRecurringTarget({ bookingMode: "paid" });
    const hold = await createSlotHold(target.holdInput);
    await db.delete(offeringPrices).where(eq(offeringPrices.offeringId, target.offering.id));
    await expectUnavailable(submitPaidBooking(paidServiceInput(hold.id, undefined)));
    await expectUnavailable(submitPaidBooking(paidServiceInput(hold.id, "wrong-token")));
    await db.update(bookingSlotHolds).set({ holdSecretHash: null }).where(eq(bookingSlotHolds.id, hold.id));
    await expectUnavailable(submitPaidBooking(paidServiceInput(hold.id, hold.holdToken)));
    await db
      .update(bookingSlotHolds)
      .set({ holdSecretHash: digest(hold.holdToken), status: "released" })
      .where(eq(bookingSlotHolds.id, hold.id));
    await expectUnavailable(submitPaidBooking(paidServiceInput(hold.id, hold.holdToken)));
    await db
      .update(bookingSlotHolds)
      .set({ status: "active", expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(bookingSlotHolds.id, hold.id));
    await expectUnavailable(submitPaidBooking(paidServiceInput(hold.id, hold.holdToken)));
    await db
      .update(bookingSlotHolds)
      .set({ expiresAt: new Date(Date.now() + 60_000) })
      .where(eq(bookingSlotHolds.id, hold.id));
    await expect(submitPaidBooking(paidServiceInput(hold.id, hold.holdToken))).rejects
      .toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("lets the owner release an active hold idempotently and never convert it", async () => {
    const { db } = getTestDatabase();
    const target = await seedRecurringTarget({});
    const hold = await createSlotHold(target.holdInput);

    await expect(releaseSlotHoldById(hold.id, hold.holdToken)).resolves.toBeUndefined();
    await expect(releaseSlotHoldById(hold.id, hold.holdToken)).resolves.toBeUndefined();
    const result = await createFreeBookingFromHold(freeInput(hold));
    const [stored] = await db
      .select({ status: bookingSlotHolds.status })
      .from(bookingSlotHolds)
      .where(eq(bookingSlotHolds.id, hold.id));

    expect(result.rejection).toBe("hold_unavailable");
    expect(stored!.status).toBe("released");
    expect(await countRows(target.offering.id)).toEqual({ bookings: 0, answers: 0, payments: 0 });
  });

  it("rejects expired and legacy holds with the same unavailable result", async () => {
    const { db } = getTestDatabase();
    const target = await seedRecurringTarget({ capacity: 2 });
    const expiredToken = randomBytes(32).toString("base64url");
    const [expired, legacy] = await db
      .insert(bookingSlotHolds)
      .values([
        {
          offeringId: target.offering.id,
          slotStartAt: recurringSlot.startsAt,
          slotEndAt: recurringSlot.endsAt,
          status: "active",
          expiresAt: new Date(Date.now() - 1000),
          holdSecretHash: digest(expiredToken),
        },
        {
          offeringId: target.offering.id,
          slotStartAt: recurringSlot.startsAt,
          slotEndAt: recurringSlot.endsAt,
          status: "active",
          expiresAt: new Date(Date.now() + 60_000),
          holdSecretHash: null,
        },
      ])
      .returning();

    expect(
      (await createFreeBookingFromHold(freeInput({ id: expired!.id, holdToken: expiredToken })))
        .rejection,
    ).toBe("hold_unavailable");
    expect(
      (await createFreeBookingFromHold(freeInput({ id: legacy!.id, holdToken: "legacy" })))
        .rejection,
    ).toBe("hold_unavailable");
    await expectUnavailable(releaseSlotHoldById(expired!.id, expiredToken));
    await expectUnavailable(releaseSlotHoldById(legacy!.id, "legacy"));
  });

  it("converts two concurrent free submissions once and replays the same booking", async () => {
    const target = await seedRecurringTarget({});
    const hold = await createSlotHold(target.holdInput);

    const [first, second] = await Promise.all([
      createFreeBookingFromHold(freeInput(hold)),
      createFreeBookingFromHold(freeInput(hold)),
    ]);

    expect(first.booking?.id).toBeTruthy();
    expect(second.booking?.id).toBe(first.booking?.id);
    expect(first.rejection).toBeNull();
    expect(second.rejection).toBeNull();
    expect(await countRows(target.offering.id)).toEqual({ bookings: 1, answers: 1, payments: 0 });
    await expectUnavailable(releaseSlotHoldById(hold.id, hold.holdToken));
  });

  it("converts two concurrent paid submissions once and replays the original payment", async () => {
    const target = await seedRecurringTarget({ bookingMode: "paid" });
    const hold = await createSlotHold(target.holdInput);

    const [first, second] = await Promise.all([
      createPaidBookingFromHold(paidInput(hold, "one")),
      createPaidBookingFromHold(paidInput(hold, "two")),
    ]);

    expect(first.booking?.id).toBeTruthy();
    expect(second.booking?.id).toBe(first.booking?.id);
    expect(second.payment?.id).toBe(first.payment?.id);
    expect(second.payment?.idempotencyKey).toBe(first.payment?.idempotencyKey);
    expect(await countRows(target.offering.id)).toEqual({ bookings: 1, answers: 1, payments: 1 });
  });

  it("replays one stable provider session for concurrent paid service submissions", async () => {
    const target = await seedRecurringTarget({ bookingMode: "paid" });
    const hold = await createSlotHold(target.holdInput);
    const request = {
      holdId: hold.id,
      holdToken: hold.holdToken,
      attendanceMode: "online" as const,
      customer: {
        fullName: "Paid Service",
        email: "paid-service@example.test",
      },
      countryCode: "EG",
      timezone: "Africa/Cairo",
      answers: [],
    };

    const [first, second] = await Promise.all([
      submitPaidBooking(request),
      submitPaidBooking(request),
    ]);

    expect(second.booking.id).toBe(first.booking.id);
    expect(second.payment.id).toBe(first.payment.id);
    expect(second.paymentSession.iframe.merchantOrderId).toBe(
      first.paymentSession.iframe.merchantOrderId,
    );
    expect(second.paymentSession.checkoutUrl).toBe(first.paymentSession.checkoutUrl);
    expect(await countRows(target.offering.id)).toEqual({ bookings: 1, answers: 0, payments: 1 });
  });

  it("replays a converted free booking before changed form and offering validation", async () => {
    const { db } = getTestDatabase();
    const target = await seedRecurringTarget({});
    const field = await seedRequiredGoalField(target.offering.id);
    const hold = await createSlotHold(target.holdInput);
    const request = freeServiceInput(hold.id, hold.holdToken, [
      { fieldKey: field.fieldKey, label: field.label, value: "Original goal" },
    ]);

    const first = await submitFreeBooking(request);
    await db
      .update(bookingFormFields)
      .set({ status: "archived", label: "Changed current label" })
      .where(eq(bookingFormFields.id, field.id));
    await db
      .update(offerings)
      .set({ status: "archived" })
      .where(eq(offerings.id, target.offering.id));

    const replay = await submitFreeBooking(request);

    expect(replay.id).toBe(first.id);
    expect(replay.publicToken).toBe(first.publicToken);
    await expectUnavailable(
      submitPaidBooking(paidServiceInput(hold.id, hold.holdToken, request.answers)),
    );
    expect(await countRows(target.offering.id)).toEqual({ bookings: 1, answers: 1, payments: 0 });
  });

  it("replays the original paid conversion after mutable data changes and a public retry", async () => {
    const { db } = getTestDatabase();
    const target = await seedRecurringTarget({ bookingMode: "paid" });
    const field = await seedRequiredGoalField(target.offering.id);
    const hold = await createSlotHold(target.holdInput);
    const request = paidServiceInput(hold.id, hold.holdToken, [
      { fieldKey: field.fieldKey, label: field.label, value: "Original goal" },
    ]);

    const first = await submitPaidBooking(request);
    await db
      .update(bookingFormFields)
      .set({ status: "archived", label: "Changed current label" })
      .where(eq(bookingFormFields.id, field.id));
    await db.delete(offeringPrices).where(eq(offeringPrices.offeringId, target.offering.id));
    await db
      .update(payments)
      .set({ status: "failed", failedAt: new Date(), updatedAt: new Date() })
      .where(eq(payments.id, first.payment.id));
    await db
      .update(bookings)
      .set({ status: "payment_failed", updatedAt: new Date() })
      .where(eq(bookings.id, first.booking.id));

    const retry = await startPublicPaymentForBooking(first.booking.publicToken);
    expect(retry.payment.id).not.toBe(first.payment.id);

    const replay = await submitPaidBooking(request);

    expect(replay.booking.id).toBe(first.booking.id);
    expect(replay.payment.id).toBe(first.payment.id);
    expect(replay.paymentSession.iframe.merchantOrderId).toBe(
      first.paymentSession.iframe.merchantOrderId,
    );
    await expectUnavailable(
      submitFreeBooking(freeServiceInput(hold.id, hold.holdToken, request.answers)),
    );
    expect(await countRows(target.offering.id)).toEqual({ bookings: 1, answers: 1, payments: 2 });
  });

  it("makes the free conversion win against an incompatible paid conversion", async () => {
    const target = await seedRecurringTarget({ bookingMode: "free" });
    const hold = await createSlotHold(target.holdInput);

    const [free, paid] = await Promise.all([
      createFreeBookingFromHold(freeInput(hold)),
      createPaidBookingFromHold(paidInput(hold)),
    ]);

    expect(free.booking?.id).toBeTruthy();
    expect(paid.booking).toBeNull();
    expect(["offering_not_paid", "hold_unavailable"]).toContain(paid.rejection);
    expect(await countRows(target.offering.id)).toEqual({ bookings: 1, answers: 1, payments: 0 });
  });

  it.each([
    ["recurring", seedRecurringTarget],
    ["fixed", seedFixedTarget],
  ] as const)(
    "keeps blocking bookings plus active holds within %s capacity during distinct conversions",
    async (_kind, seedTarget) => {
      const { db } = getTestDatabase();
      const target = await seedTarget({ capacity: 2 });
      const [firstHold, secondHold] = await Promise.all([
        createSlotHold(target.holdInput),
        createSlotHold(target.holdInput),
      ]);

      const results = await Promise.all([
        createFreeBookingFromHold(freeInput(firstHold)),
        createFreeBookingFromHold({
          ...freeInput(secondHold),
          customerEmail: "second-owner@example.test",
        }),
      ]);
      const activeRows = await db
        .select({ id: bookingSlotHolds.id })
        .from(bookingSlotHolds)
        .where(
          and(
            eq(bookingSlotHolds.offeringId, target.offering.id),
            eq(bookingSlotHolds.status, "active"),
          ),
        );

      expect(results.every(({ booking }) => Boolean(booking))).toBe(true);
      expect((await countRows(target.offering.id)).bookings + activeRows.length).toBe(2);
    },
  );

  it.each([
    ["recurring", seedRecurringTarget],
    ["fixed", seedFixedTarget],
  ] as const)(
    "admits one owned %s hold when a competing hold expires before the capacity decision",
    async (kind, seedTarget) => {
      const { db, pool } = getTestDatabase();
      const target = await seedTarget({ capacity: 2 });
      const [longHold, expiringHold] = await Promise.all([
        createSlotHold(target.holdInput),
        createSlotHold(target.holdInput),
      ]);
      if (kind === "fixed") {
        await db
          .update(offeringSessions)
          .set({ capacity: 1 })
          .where(eq(offeringSessions.id, (target as Awaited<ReturnType<typeof seedFixedTarget>>).session.id));
      } else {
        await db
          .update(offerings)
          .set({ capacity: 1 })
          .where(eq(offerings.id, target.offering.id));
      }
      await db
        .update(bookingSlotHolds)
        .set({ expiresAt: new Date(Date.now() + 250) })
        .where(eq(bookingSlotHolds.id, expiringHold.id));
      const key =
        kind === "fixed"
          ? fixedSessionCapacityLockKey(
              (target as Awaited<ReturnType<typeof seedFixedTarget>>).session.id,
            )
          : recurringSlotCapacityLockKey({
              offeringId: target.offering.id,
              ...recurringSlot,
            });
      const lockClient = await pool.connect();

      try {
        await lockClient.query("BEGIN");
        await lockClient.query("SELECT pg_advisory_xact_lock($1::bigint)", [key.toString()]);
        const conversions = Promise.all([
          createFreeBookingFromHold(freeInput(longHold)),
          createFreeBookingFromHold(freeInput(expiringHold)),
        ]);
        await new Promise((resolve) => setTimeout(resolve, 500));
        await lockClient.query("ROLLBACK");
        const results = await conversions;
        const activeHolds = await db
          .select({ id: bookingSlotHolds.id })
          .from(bookingSlotHolds)
          .where(
            and(
              eq(bookingSlotHolds.offeringId, target.offering.id),
              eq(bookingSlotHolds.status, "active"),
              gt(bookingSlotHolds.expiresAt, new Date()),
            ),
          );
        const counts = await countRows(target.offering.id);

        expect(results.filter(({ booking }) => Boolean(booking))).toHaveLength(1);
        expect(counts.bookings + activeHolds.length).toBe(1);
      } finally {
        await lockClient.query("ROLLBACK").catch(() => undefined);
        lockClient.release();
      }
    },
  );

  it("rolls back a failed paid insert without partial rows and releases the capacity lock", async () => {
    const { pool } = getTestDatabase();
    const target = await seedRecurringTarget({ bookingMode: "paid" });
    const hold = await createSlotHold(target.holdInput);
    const key = recurringSlotCapacityLockKey({
      offeringId: target.offering.id,
      ...recurringSlot,
    });
    await pool.query(`
      CREATE FUNCTION fail_hold_conversion_payment_test() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'forced paid conversion failure';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_hold_conversion_payment
      BEFORE INSERT ON payments
      FOR EACH ROW EXECUTE FUNCTION fail_hold_conversion_payment_test();
    `);

    try {
      await expect(createPaidBookingFromHold(paidInput(hold))).rejects.toThrow();
      expect(await countRows(target.offering.id)).toEqual({ bookings: 0, answers: 0, payments: 0 });

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
      await pool.query("DROP TRIGGER IF EXISTS fail_hold_conversion_payment ON payments");
      await pool.query("DROP FUNCTION IF EXISTS fail_hold_conversion_payment_test()");
    }

    const [stored] = await getTestDatabase().db
      .select({ status: bookingSlotHolds.status, bookingId: bookingSlotHolds.bookingId })
      .from(bookingSlotHolds)
      .where(eq(bookingSlotHolds.id, hold.id));
    expect(stored).toMatchObject({ status: "active", bookingId: null });
  });
});
