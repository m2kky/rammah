import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bookings,
  offerings,
  payments,
  paymentWebhookEvents,
} from "../../db/schema/index.js";
import { pool as applicationPool } from "../../db/client.js";
import { getTestDatabase } from "../../test/db.js";
import { reconcileAdminPayment } from "./admin-payments.service.js";
import { verifyKashierCallbackSignature } from "./kashier.adapter.js";
import {
  handleKashierCallback,
  reconcilePublicPayment,
} from "./public-payments.service.js";

const signingKey = "integration-kashier-api-key";
let fixtureSequence = 0;

const createPaymentFixture = async (input: {
  provider?: string;
  providerPaymentId?: string | null;
} = {}) => {
  const sequence = ++fixtureSequence;
  const db = getTestDatabase().db;
  const [offering] = await db
    .insert(offerings)
    .values({
      title: `Callback test ${sequence}`,
      slug: `callback-test-${sequence}`,
      offeringType: "coaching",
      attendanceMode: "online",
      bookingMode: "paid",
      durationMinutes: 60,
      requiresPayment: true,
      status: "published",
    })
    .returning({ id: offerings.id });
  const [booking] = await db
    .insert(bookings)
    .values({
      offeringId: offering!.id,
      attendanceMode: "online",
      status: "pending_payment",
      customerFullName: "Callback Test",
      customerEmail: `callback-${sequence}@example.test`,
      timezone: "Africa/Cairo",
      priceCurrency: "EGP",
      baseAmountMinor: 12345,
      totalAmountMinor: 12345,
      paymentRequired: true,
      slotStartAt: new Date("2027-01-01T10:00:00Z"),
      slotEndAt: new Date("2027-01-01T11:00:00Z"),
    })
    .returning({ id: bookings.id, publicToken: bookings.publicToken });
  const merchantOrderId = `SEC01-${sequence}`;
  const [payment] = await db
    .insert(payments)
    .values({
      bookingId: booking!.id,
      provider: input.provider ?? "kashier",
      providerPaymentId: input.providerPaymentId ?? null,
      status: "pending",
      currency: "EGP",
      amountMinor: 12345,
      idempotencyKey: merchantOrderId,
    })
    .returning({ id: payments.id });

  return { booking: booking!, merchantOrderId, paymentId: payment!.id };
};

const officialSignature = (params: URLSearchParams) => {
  const payload = [
    "paymentStatus",
    "cardDataToken",
    "maskedCard",
    "merchantOrderId",
    "orderId",
    "cardBrand",
    "orderReference",
    "transactionId",
    "amount",
    "currency",
  ]
    .map((key) => `${key}=${params.get(key) ?? ""}`)
    .join("&");
  return crypto.createHmac("sha256", signingKey).update(payload).digest("hex");
};

const callbackQuery = (input: {
  merchantOrderId: string;
  transactionId: string;
  paymentStatus?: string;
  amount?: string;
  currency?: string;
  booking?: string;
  validSignature?: boolean;
}) => {
  const params = new URLSearchParams({
    merchantOrderId: input.merchantOrderId,
    transactionId: input.transactionId,
    paymentStatus: input.paymentStatus ?? "SUCCESS",
    ...(input.amount === undefined ? {} : { amount: input.amount }),
    ...(input.currency === undefined ? {} : { currency: input.currency }),
    ...(input.booking === undefined ? {} : { booking: input.booking }),
  });
  params.set(
    "signature",
    input.validSignature === false ? "0".repeat(64) : officialSignature(params),
  );
  return params.toString();
};

const readState = async (paymentId: string, providerEventId: string) => {
  const db = getTestDatabase().db;
  const [payment] = await db
    .select({ status: payments.status, providerPaymentId: payments.providerPaymentId })
    .from(payments)
    .where(eq(payments.id, paymentId));
  const events = await db
    .select({
      id: paymentWebhookEvents.id,
      paymentId: paymentWebhookEvents.paymentId,
      processingStatus: paymentWebhookEvents.processingStatus,
    })
    .from(paymentWebhookEvents)
    .where(
      and(
        eq(paymentWebhookEvents.provider, "kashier"),
        eq(paymentWebhookEvents.providerEventId, providerEventId),
      ),
    );
  return { payment, events };
};

const readPaymentAndBooking = async (paymentId: string) => {
  const db = getTestDatabase().db;
  const [row] = await db
    .select({
      paymentStatus: payments.status,
      providerPaymentId: payments.providerPaymentId,
      bookingStatus: bookings.status,
    })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .where(eq(payments.id, paymentId));
  return row!;
};

const providerResponse = (input: {
  orderId?: string | null;
  status?: string | null;
  amount?: string | null;
  currency?: string | null;
}) =>
  new Response(
    JSON.stringify({
      response: {
        ...(input.orderId === null ? {} : { orderId: input.orderId ?? "provider-order" }),
        ...(input.status === null ? {} : { status: input.status ?? "SUCCESS" }),
        order: {
          ...(input.amount === null ? {} : { amount: input.amount ?? "123.45" }),
          ...(input.currency === null ? {} : { currency: input.currency ?? "EGP" }),
        },
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );

const aliasOnlyQuery = (fixture: Awaited<ReturnType<typeof createPaymentFixture>>) => {
  const params = new URLSearchParams({
    merchantOrderID: fixture.merchantOrderId,
    paymentId: "alias-event",
    status: "SUCCESS",
    amount: "123.45",
    currency: "EGP",
    booking: crypto.randomUUID(),
  });
  params.set("signature", officialSignature(params));
  return params.toString();
};

const officialCallbackValues = (fixture: { merchantOrderId: string }, eventId: string) => ({
  paymentStatus: "SUCCESS",
  cardDataToken: "card-token",
  maskedCard: "411111******1111",
  merchantOrderId: fixture.merchantOrderId,
  orderId: fixture.merchantOrderId,
  cardBrand: "visa",
  orderReference: `${eventId}-reference`,
  transactionId: eventId,
  amount: "123.45",
  currency: "EGP",
});

const duplicateOfficialFieldQuery = (input: {
  fixture: { merchantOrderId: string };
  eventId: string;
  field: keyof ReturnType<typeof officialCallbackValues> | "signature";
  position: "appended" | "prepended";
}) => {
  const values = officialCallbackValues(input.fixture, input.eventId);
  const entries = Object.entries(values);
  const duplicateValue = input.field === "signature" ? null : values[input.field];
  const params = new URLSearchParams(
    input.field === "signature"
      ? entries
      : input.position === "prepended"
        ? [[input.field, duplicateValue!], ...entries]
        : [...entries, [input.field, duplicateValue!]],
  );
  params.set("booking", crypto.randomUUID());
  const signature = officialSignature(params);

  if (input.field === "signature") {
    if (input.position === "prepended") {
      params.append("signature", signature);
      params.append("signature", signature);
    } else {
      params.append("signature", signature);
      params.append("signature", "0".repeat(64));
    }
  } else {
    params.set("signature", signature);
  }

  return params.toString();
};

const duplicateProtectedFields = [
  "paymentStatus",
  "cardDataToken",
  "maskedCard",
  "merchantOrderId",
  "orderId",
  "cardBrand",
  "orderReference",
  "transactionId",
  "amount",
  "currency",
  "signature",
] as const;

describe.sequential("Kashier callback trust boundary", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unstubbed Kashier test lookup"));
  });

  it("rejects appended and prepended duplicates of every signed callback field before trust", async () => {
    const scenarios = await Promise.all(
      duplicateProtectedFields.flatMap((field) =>
        (["appended", "prepended"] as const).map(async (position) => {
          const fixture = await createPaymentFixture();
          const eventId = `duplicate-${field}-${position}`;
          const rawQuery = duplicateOfficialFieldQuery({ fixture, eventId, field, position });
          return { fixture, eventId, rawQuery };
        }),
      ),
    );

    const outcomes = [];
    for (const scenario of scenarios) {
      outcomes.push({
        signatureValid: verifyKashierCallbackSignature(scenario.rawQuery),
        result: await handleKashierCallback(scenario.rawQuery),
      });
    }

    expect(outcomes).toEqual(
      scenarios.map(() => ({
        signatureValid: false,
        result: { processed: false, publicToken: null },
      })),
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(await getTestDatabase().db.select().from(paymentWebhookEvents)).toEqual([]);
    for (const scenario of scenarios) {
      expect(await readPaymentAndBooking(scenario.fixture.paymentId)).toMatchObject({
        paymentStatus: "pending",
        providerPaymentId: null,
        bookingStatus: "pending_payment",
      });
    }
  });

  it("ignores a forged first callback without reserving its event or reflecting its booking token", async () => {
    const fixture = await createPaymentFixture();
    const forgedToken = crypto.randomUUID();

    const result = await handleKashierCallback(
      callbackQuery({
        merchantOrderId: fixture.merchantOrderId,
        transactionId: "txn-forged-first",
        amount: "123.45",
        currency: "EGP",
        booking: forgedToken,
        validSignature: false,
      }),
    );
    const state = await readState(fixture.paymentId, "txn-forged-first");

    expect(result).toEqual({ processed: false, publicToken: null });
    expect(state.payment).toMatchObject({ status: "pending", providerPaymentId: null });
    expect(state.events).toEqual([]);
  });

  it("lets a valid callback claim the same provider event id after a forged attempt", async () => {
    const fixture = await createPaymentFixture();
    const eventId = "txn-forged-then-valid";

    await handleKashierCallback(
      callbackQuery({
        merchantOrderId: fixture.merchantOrderId,
        transactionId: eventId,
        amount: "123.45",
        currency: "EGP",
        validSignature: false,
      }),
    );
    const result = await handleKashierCallback(
      callbackQuery({
        merchantOrderId: fixture.merchantOrderId,
        transactionId: eventId,
        amount: "123.45",
        currency: "EGP",
      }),
    );
    const state = await readState(fixture.paymentId, eventId);

    expect(result).toEqual({ processed: true, publicToken: fixture.booking.publicToken });
    expect(state.payment).toMatchObject({ status: "paid", providerPaymentId: eventId });
    expect(state.events).toHaveLength(1);
  });

  it("does not directly trust a signed callback with missing exact amount and currency", async () => {
    const fixture = await createPaymentFixture();
    const eventId = "txn-missing-evidence";
    const fetchStub = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("provider down"));

    const result = await handleKashierCallback(callbackQuery({
      merchantOrderId: fixture.merchantOrderId,
      transactionId: eventId,
    })).finally(() => fetchStub.mockRestore());
    const state = await readState(fixture.paymentId, eventId);

    expect(result.publicToken).toBe(fixture.booking.publicToken);
    expect(state.payment).toMatchObject({ status: "pending", providerPaymentId: null });
    expect(state.events).toEqual([]);
  });

  it("does not let a replayed event use current callback identity to affect another payment", async () => {
    const first = await createPaymentFixture();
    const second = await createPaymentFixture();
    const eventId = "txn-cross-payment-replay";

    await handleKashierCallback(
      callbackQuery({
        merchantOrderId: first.merchantOrderId,
        transactionId: eventId,
        paymentStatus: "FAILED",
        amount: "123.45",
        currency: "EGP",
      }),
    );
    const replay = await handleKashierCallback(
      callbackQuery({
        merchantOrderId: second.merchantOrderId,
        transactionId: eventId,
        amount: "123.45",
        currency: "EGP",
      }),
    );
    const secondState = await readState(second.paymentId, eventId);

    expect(replay.publicToken).toBe(first.booking.publicToken);
    expect(secondState.payment).toMatchObject({ status: "pending", providerPaymentId: null });
    expect(secondState.events[0]?.paymentId).toBe(first.paymentId);
  });

  it("does not reserve either a same or different event id for forged callbacks", async () => {
    const fixture = await createPaymentFixture();

    await handleKashierCallback(callbackQuery({
      merchantOrderId: fixture.merchantOrderId,
      transactionId: "forged-different",
      amount: "123.45",
      currency: "EGP",
      validSignature: false,
    }));
    const valid = await handleKashierCallback(callbackQuery({
      merchantOrderId: fixture.merchantOrderId,
      transactionId: "valid-different",
      amount: "123.45",
      currency: "EGP",
    }));

    expect(valid).toEqual({ processed: true, publicToken: fixture.booking.publicToken });
    expect((await readState(fixture.paymentId, "forged-different")).events).toEqual([]);
    expect((await readState(fixture.paymentId, "valid-different")).events).toHaveLength(1);
  });

  it("returns the stored processed result and token on identical replay without another event", async () => {
    const fixture = await createPaymentFixture();
    const query = callbackQuery({
      merchantOrderId: fixture.merchantOrderId,
      transactionId: "identical-replay",
      amount: "123.45",
      currency: "EGP",
      booking: crypto.randomUUID(),
    });

    const first = await handleKashierCallback(query);
    const replay = await handleKashierCallback(query);
    const state = await readState(fixture.paymentId, "identical-replay");

    expect(first.processed).toBe(true);
    expect(replay).toEqual({ processed: true, publicToken: fixture.booking.publicToken });
    expect(state.events).toHaveLength(1);
  });

  it("conflict-safely claims two concurrent identical valid callbacks once", async () => {
    const fixture = await createPaymentFixture();
    const query = callbackQuery({
      merchantOrderId: fixture.merchantOrderId,
      transactionId: "concurrent-identical",
      amount: "123.45",
      currency: "EGP",
    });

    const results = await Promise.all([
      handleKashierCallback(query),
      handleKashierCallback(query),
    ]);
    const state = await readState(fixture.paymentId, "concurrent-identical");

    expect(results.some((result) => result.processed)).toBe(true);
    expect(results.every((result) => result.publicToken === fixture.booking.publicToken)).toBe(true);
    expect(state.events).toHaveLength(1);
    expect(state.payment?.status).toBe("paid");
  });

  it("rejects unknown merchant orders and non-Kashier payments without state or token leakage", async () => {
    const nonKashier = await createPaymentFixture({ provider: "mock" });

    const unknown = await handleKashierCallback(callbackQuery({
      merchantOrderId: "unknown-order",
      transactionId: "unknown-event",
      amount: "123.45",
      currency: "EGP",
      booking: crypto.randomUUID(),
    }));
    const rejected = await handleKashierCallback(callbackQuery({
      merchantOrderId: nonKashier.merchantOrderId,
      transactionId: "non-kashier-event",
      amount: "123.45",
      currency: "EGP",
      booking: crypto.randomUUID(),
    }));

    expect(unknown).toEqual({ processed: false, publicToken: null });
    expect(rejected).toEqual({ processed: false, publicToken: null });
    expect(await readPaymentAndBooking(nonKashier.paymentId)).toMatchObject({
      paymentStatus: "pending",
      bookingStatus: "pending_payment",
    });
    expect((await readState(nonKashier.paymentId, "unknown-event")).events).toEqual([]);
    expect((await readState(nonKashier.paymentId, "non-kashier-event")).events).toEqual([]);
  });

  it("does not directly trust malformed or mismatched signed evidence or unsigned aliases", async () => {
    const cases = [
      { amount: undefined, currency: "EGP" },
      { amount: "123.44", currency: "EGP" },
      { amount: "1.2345e2", currency: "EGP" },
      { amount: "123.450", currency: "EGP" },
      { amount: "123.45", currency: undefined },
      { amount: "123.45", currency: "USD" },
      { amount: "123.45", currency: "EGPT" },
    ];

    for (const [index, evidence] of cases.entries()) {
      const fixture = await createPaymentFixture();
      const eventId = `bad-evidence-${index}`;
      const fetchStub = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("provider down"));
      try {
        const result = await handleKashierCallback(callbackQuery({
          merchantOrderId: fixture.merchantOrderId,
          transactionId: eventId,
          ...evidence,
        }));
        expect(result).toEqual({ processed: false, publicToken: fixture.booking.publicToken });
      } finally {
        fetchStub.mockRestore();
      }
      expect((await readState(fixture.paymentId, eventId)).events).toEqual([]);
      expect((await readState(fixture.paymentId, eventId)).payment?.status).toBe("pending");
    }

    const aliasFixture = await createPaymentFixture();
    const aliasResult = await handleKashierCallback(aliasOnlyQuery(aliasFixture));
    expect(aliasResult).toEqual({ processed: false, publicToken: null });
    expect((await readState(aliasFixture.paymentId, "alias-event")).events).toEqual([]);
    expect((await readState(aliasFixture.paymentId, "alias-event")).payment?.status).toBe("pending");
  });

  it("always ignores callback booking tokens on valid, duplicate, and incomplete paths", async () => {
    const direct = await createPaymentFixture();
    const forgedToken = crypto.randomUUID();
    const query = callbackQuery({
      merchantOrderId: direct.merchantOrderId,
      transactionId: "stored-token-direct",
      amount: "123.45",
      currency: "EGP",
      booking: forgedToken,
    });
    const first = await handleKashierCallback(query);
    const duplicate = await handleKashierCallback(query);
    const incomplete = await createPaymentFixture();
    const fetchStub = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("provider down"));
    const incompleteResult = await handleKashierCallback(callbackQuery({
      merchantOrderId: incomplete.merchantOrderId,
      transactionId: "stored-token-incomplete",
      booking: forgedToken,
    })).finally(() => fetchStub.mockRestore());

    expect(first.publicToken).toBe(direct.booking.publicToken);
    expect(duplicate.publicToken).toBe(direct.booking.publicToken);
    expect(incompleteResult.publicToken).toBe(incomplete.booking.publicToken);
  });

  it("allows failed then paid while keeping paid terminal against later failed", async () => {
    const failedThenPaid = await createPaymentFixture();
    await handleKashierCallback(callbackQuery({
      merchantOrderId: failedThenPaid.merchantOrderId,
      transactionId: "failed-first",
      paymentStatus: "FAILED",
      amount: "123.45",
      currency: "EGP",
    }));
    const reconciliationFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(providerResponse({
      orderId: "paid-second",
    }));
    await handleKashierCallback(callbackQuery({
      merchantOrderId: failedThenPaid.merchantOrderId,
      transactionId: "paid-second",
      amount: "123.45",
      currency: "EGP",
    })).finally(() => reconciliationFetch.mockRestore());

    const paidThenFailed = await createPaymentFixture();
    await handleKashierCallback(callbackQuery({
      merchantOrderId: paidThenFailed.merchantOrderId,
      transactionId: "paid-first",
      amount: "123.45",
      currency: "EGP",
    }));
    const failedReconciliationFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(providerResponse({
      orderId: "failed-second",
      status: "FAILED",
    }));
    await handleKashierCallback(callbackQuery({
      merchantOrderId: paidThenFailed.merchantOrderId,
      transactionId: "failed-second",
      paymentStatus: "FAILED",
      amount: "123.45",
      currency: "EGP",
    })).finally(() => failedReconciliationFetch.mockRestore());

    expect(await readPaymentAndBooking(failedThenPaid.paymentId)).toMatchObject({
      paymentStatus: "paid",
      bookingStatus: "confirmed",
    });
    expect(await readPaymentAndBooking(paidThenFailed.paymentId)).toMatchObject({
      paymentStatus: "paid",
      bookingStatus: "confirmed",
    });
  });

  it("applies an exact authoritative result for an identifiable incomplete callback", async () => {
    const fixture = await createPaymentFixture();
    const providerResult = () => providerResponse({ orderId: "authoritative-provider-id" });
    const fetchStub = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(providerResult());
    const query = callbackQuery({
      merchantOrderId: fixture.merchantOrderId,
      transactionId: "incomplete-callback-event",
    });

    const result = await handleKashierCallback(query).finally(() => fetchStub.mockRestore());
    const replayFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(providerResult());
    const replay = await handleKashierCallback(query).finally(() => replayFetch.mockRestore());
    const state = await readPaymentAndBooking(fixture.paymentId);
    const callbackEvent = await readState(fixture.paymentId, "incomplete-callback-event");
    const reconciliationEvent = await readState(
      fixture.paymentId,
      `reconcile:${fixture.merchantOrderId}:authoritative-provider-id:paid`,
    );

    expect(result).toEqual({ processed: true, publicToken: fixture.booking.publicToken });
    expect(replay).toEqual({ processed: true, publicToken: fixture.booking.publicToken });
    expect(state).toMatchObject({
      paymentStatus: "paid",
      providerPaymentId: "authoritative-provider-id",
      bookingStatus: "confirmed",
    });
    expect(callbackEvent.events).toEqual([]);
    expect(reconciliationEvent.events).toHaveLength(1);
  });

  it("reconciles rather than trusting missing event identity or an unknown callback status", async () => {
    const fixture = await createPaymentFixture();
    const params = new URLSearchParams({
      merchantOrderId: fixture.merchantOrderId,
      paymentStatus: "PENDING_REVIEW",
      amount: "123.45",
      currency: "EGP",
      booking: crypto.randomUUID(),
    });
    params.set("signature", officialSignature(params));
    const fetchStub = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("provider down"));

    const result = await handleKashierCallback(params.toString()).finally(() => fetchStub.mockRestore());

    expect(result).toEqual({ processed: false, publicToken: fixture.booking.publicToken });
    expect(await readPaymentAndBooking(fixture.paymentId)).toMatchObject({
      paymentStatus: "pending",
      providerPaymentId: null,
      bookingStatus: "pending_payment",
    });
    const events = await getTestDatabase().db.select().from(paymentWebhookEvents);
    expect(events).toEqual([]);
  });

  it("accepts signed orderReference only as the canonical transaction fallback", async () => {
    const fixture = await createPaymentFixture();
    const params = new URLSearchParams({
      merchantOrderId: fixture.merchantOrderId,
      paymentStatus: "SUCCESS",
      orderReference: "signed-order-reference",
      amount: "123.45",
      currency: "EGP",
    });
    params.set("signature", officialSignature(params));

    const result = await handleKashierCallback(params.toString());

    expect(result).toEqual({ processed: true, publicToken: fixture.booking.publicToken });
    expect(await readPaymentAndBooking(fixture.paymentId)).toMatchObject({
      paymentStatus: "paid",
      providerPaymentId: "signed-order-reference",
    });
    expect((await readState(fixture.paymentId, "signed-order-reference")).events).toHaveLength(1);
  });

  it("uses authoritative identity rather than a conflicting callback payment identity", async () => {
    const fixture = await createPaymentFixture({ providerPaymentId: "stored-provider-id" });
    const fetchStub = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(providerResponse({
      orderId: "stored-provider-id",
    }));

    const result = await handleKashierCallback(callbackQuery({
      merchantOrderId: fixture.merchantOrderId,
      transactionId: "conflicting-callback-id",
      amount: "123.45",
      currency: "EGP",
    })).finally(() => fetchStub.mockRestore());

    expect(result.processed).toBe(true);
    expect(await readPaymentAndBooking(fixture.paymentId)).toMatchObject({
      paymentStatus: "paid",
      providerPaymentId: "stored-provider-id",
    });
    expect((await readState(fixture.paymentId, "conflicting-callback-id")).events).toEqual([]);
  });

  it("bounds callback reconciliation with the native five-second abort signal", async () => {
    const fixture = await createPaymentFixture();
    let receivedSignal: AbortSignal | undefined;
    const fetchStub = vi.spyOn(globalThis, "fetch").mockImplementationOnce((_url, init) => {
      receivedSignal = init?.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        receivedSignal?.addEventListener("abort", () => reject(receivedSignal!.reason), { once: true });
      });
    });
    const startedAt = Date.now();

    const result = await handleKashierCallback(callbackQuery({
      merchantOrderId: fixture.merchantOrderId,
      transactionId: "provider-timeout",
    })).finally(() => fetchStub.mockRestore());

    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(Date.now() - startedAt).toBeLessThan(6_500);
    expect(result).toEqual({ processed: false, publicToken: fixture.booking.publicToken });
    expect(await readPaymentAndBooking(fixture.paymentId)).toMatchObject({
      paymentStatus: "pending",
      bookingStatus: "pending_payment",
    });
    expect((await readState(fixture.paymentId, "provider-timeout")).events).toEqual([]);
  }, 8_000);

  it("requires present exact evidence in public and admin authoritative reconciliation", async () => {
    const publicFixture = await createPaymentFixture();
    const publicFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(providerResponse({
      orderId: "public-missing-amount",
      amount: null,
    }));
    await reconcilePublicPayment(publicFixture.booking.publicToken).finally(() => publicFetch.mockRestore());

    const adminFixture = await createPaymentFixture();
    const adminFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(providerResponse({
      orderId: "admin-missing-currency",
      currency: null,
    }));
    await reconcileAdminPayment(adminFixture.paymentId).finally(() => adminFetch.mockRestore());

    expect((await readPaymentAndBooking(publicFixture.paymentId)).paymentStatus).toBe("pending");
    expect((await readPaymentAndBooking(adminFixture.paymentId)).paymentStatus).toBe("pending");
    expect((await readState(
      publicFixture.paymentId,
      `reconcile:${publicFixture.merchantOrderId}:public-missing-amount:paid`,
    )).events).toEqual([]);
    expect((await readState(
      adminFixture.paymentId,
      `reconcile:${adminFixture.merchantOrderId}:admin-missing-currency:paid`,
    )).events).toEqual([]);
  });

  it("does not reapply a duplicate reconciliation from current provider data", async () => {
    const fixture = await createPaymentFixture();
    const response = () => providerResponse({ orderId: "shared-reconciliation-id" });
    const publicFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response());
    await reconcilePublicPayment(fixture.booking.publicToken).finally(() => publicFetch.mockRestore());
    const context = getTestDatabase();
    await context.pool.query(`
      CREATE FUNCTION sec01_reject_duplicate_reconcile() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'duplicate reconciliation reapplied';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER sec01_reject_duplicate_reconcile
      BEFORE UPDATE ON payments
      FOR EACH ROW EXECUTE FUNCTION sec01_reject_duplicate_reconcile();
    `);

    try {
      const adminFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response());
      await expect(reconcileAdminPayment(fixture.paymentId)).resolves.toBeDefined();
      adminFetch.mockRestore();
    } finally {
      await context.pool.query(`
        DROP TRIGGER IF EXISTS sec01_reject_duplicate_reconcile ON payments;
        DROP FUNCTION IF EXISTS sec01_reject_duplicate_reconcile();
      `);
      vi.restoreAllMocks();
    }

    const eventId = `reconcile:${fixture.merchantOrderId}:shared-reconciliation-id:paid`;
    expect((await readState(fixture.paymentId, eventId)).events).toHaveLength(1);
  });

  it("leaves a claimed event pending after a split-commit failure and never reapplies it", async () => {
    const fixture = await createPaymentFixture();
    const context = getTestDatabase();
    const eventId = "split-commit-failure";
    await context.pool.query(`
      CREATE FUNCTION sec01_reject_payment_update() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'SEC-01 test payment update failure';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER sec01_reject_payment_update
      BEFORE UPDATE ON payments
      FOR EACH ROW EXECUTE FUNCTION sec01_reject_payment_update();
    `);

    try {
      await expect(handleKashierCallback(callbackQuery({
        merchantOrderId: fixture.merchantOrderId,
        transactionId: eventId,
        amount: "123.45",
        currency: "EGP",
      }))).rejects.toThrow("Failed query: update \"payments\"");
    } finally {
      await context.pool.query(`
        DROP TRIGGER IF EXISTS sec01_reject_payment_update ON payments;
        DROP FUNCTION IF EXISTS sec01_reject_payment_update();
      `);
    }

    const afterFailure = await readState(fixture.paymentId, eventId);
    expect(afterFailure.payment?.status).toBe("pending");
    expect(afterFailure.events).toHaveLength(1);
    expect(afterFailure.events[0]?.processingStatus).toBe("pending");

    const replay = await handleKashierCallback(callbackQuery({
      merchantOrderId: fixture.merchantOrderId,
      transactionId: eventId,
      amount: "123.45",
      currency: "EGP",
    }));
    expect(replay).toEqual({ processed: false, publicToken: fixture.booking.publicToken });
    expect((await readState(fixture.paymentId, eventId)).payment?.status).toBe("pending");
  });

  it("rejects oversized callbacks before parsing, database work, provider lookup, or token return", async () => {
    const fixture = await createPaymentFixture();
    const fetchStub = vi.spyOn(globalThis, "fetch");

    const result = await handleKashierCallback(`merchantOrderId=${fixture.merchantOrderId}&${"x".repeat(17 * 1024)}`);

    expect(result).toEqual({ processed: false, publicToken: null });
    expect(fetchStub).not.toHaveBeenCalled();
    fetchStub.mockRestore();
    expect(await readPaymentAndBooking(fixture.paymentId)).toMatchObject({
      paymentStatus: "pending",
      bookingStatus: "pending_payment",
    });
    const eventCount = await getTestDatabase().db
      .select({ id: paymentWebhookEvents.id })
      .from(paymentWebhookEvents);
    expect(eventCount).toEqual([]);
  });

  it("rejects duplicate signed fields before any database lookup", async () => {
    const fixture = { merchantOrderId: "closed-pool-order" };
    const queries = duplicateProtectedFields.flatMap((field) =>
      (["appended", "prepended"] as const).map((position) =>
        duplicateOfficialFieldQuery({
          fixture,
          eventId: `closed-pool-${field}-${position}`,
          field,
          position,
        }),
      ),
    );
    await applicationPool.end();

    const outcomes = await Promise.allSettled(queries.map(handleKashierCallback));

    expect(outcomes).toEqual(
      queries.map(() => ({
        status: "fulfilled",
        value: { processed: false, publicToken: null },
      })),
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
