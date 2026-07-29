import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboxEvent } from "../modules/outbox/outbox.repository.js";
import { PermanentJobError } from "./handler-registry.js";

const mocks = vi.hoisted(() => ({
  ensureCalendar: vi.fn(),
  sendConfirmedEmails: vi.fn(),
  expireHolds: vi.fn(),
  reconcilePayments: vi.fn(),
  syncBusy: vi.fn(),
}));

vi.mock("../modules/calendar/google-calendar.service.js", () => ({
  ensureGoogleCalendarEventForBooking: mocks.ensureCalendar,
}));
vi.mock("../modules/emails/email.service.js", () => ({
  sendBookingConfirmedEmails: mocks.sendConfirmedEmails,
}));
vi.mock("../modules/availability/booking-maintenance.service.js", () => ({
  expireStaleBookingHolds: mocks.expireHolds,
}));
vi.mock("../modules/payments/payment-maintenance.service.js", () => ({
  reconcilePendingPayments: mocks.reconcilePayments,
}));
vi.mock("../modules/calendar/google-calendar-busy.service.js", () => ({
  syncGoogleCalendarBusyBlocks: mocks.syncBusy,
}));

import { productHandlers } from "./product-handlers.js";

const event = (topic: string, payload: Record<string, unknown>): OutboxEvent => ({
  id: "00000000-0000-4000-8000-000000000001",
  topic,
  aggregateType: "booking",
  aggregateId: "00000000-0000-4000-8000-000000000002",
  payload,
  idempotencyKey: `${topic}:booking`,
  state: "processing",
  attempts: 1,
  availableAt: new Date(),
  lockedAt: new Date(),
  lockToken: "00000000-0000-4000-8000-000000000003",
  processedAt: null,
  lastError: null,
  createdAt: new Date(),
});

const context = { signal: new AbortController().signal };

describe("product worker handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dispatches booking calendar and confirmation email jobs", async () => {
    const bookingId = "00000000-0000-4000-8000-000000000004";

    await productHandlers["calendar.booking.create"]!(
      event("calendar.booking.create", { bookingId }),
      context,
    );
    await productHandlers["email.booking.confirmed"]!(
      event("email.booking.confirmed", { bookingId }),
      context,
    );

    expect(mocks.ensureCalendar).toHaveBeenCalledOnce();
    expect(mocks.ensureCalendar).toHaveBeenCalledWith(bookingId);
    expect(mocks.sendConfirmedEmails).toHaveBeenCalledOnce();
    expect(mocks.sendConfirmedEmails).toHaveBeenCalledWith(bookingId);
  });

  it("rejects malformed payloads permanently", async () => {
    await expect(
      productHandlers["calendar.booking.create"]!(
        event("calendar.booking.create", {}),
        context,
      ),
    ).rejects.toBeInstanceOf(PermanentJobError);
  });

  it("runs scheduled booking maintenance jobs", async () => {
    await productHandlers["maintenance.holds.expire"]!(
      event("maintenance.holds.expire", {}),
      context,
    );
    await productHandlers["maintenance.payments.reconcile"]!(
      event("maintenance.payments.reconcile", {}),
      context,
    );
    await productHandlers["calendar.busy.sync"]!(
      event("calendar.busy.sync", {}),
      context,
    );

    expect(mocks.expireHolds).toHaveBeenCalledOnce();
    expect(mocks.reconcilePayments).toHaveBeenCalledOnce();
    expect(mocks.syncBusy).toHaveBeenCalledOnce();
  });
});
