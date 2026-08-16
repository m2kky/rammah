import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerPush = vi.hoisted(() => vi.fn());
const bookingMocks = vi.hoisted(() => ({
  createPublicSlotHold: vi.fn(),
  fetchPublicAvailabilitySlots: vi.fn(),
  fetchPublicPrograms: vi.fn(),
  fetchPublicPricePreview: vi.fn(),
  releasePublicSlotHold: vi.fn(),
  submitPublicFreeBooking: vi.fn(),
  submitPublicPaidBooking: vi.fn(),
  submitPublicQuoteRequest: vi.fn(),
}));
const offeringMocks = vi.hoisted(() => ({
  fetchPublicOffering: vi.fn(),
  fetchPublicOfferingBookingConfig: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("@/lib/api/bookings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/bookings")>();
  return { ...actual, ...bookingMocks };
});

vi.mock("@/lib/api/offerings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/offerings")>();
  return { ...actual, ...offeringMocks };
});

import { PublicApiError } from "@/lib/api/bookings";
import type { PublicBookingOffering, PublicOfferingLocation } from "@/lib/api/offerings";
import BookingFlow from "./BookingFlow";

const offering: PublicBookingOffering = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "paid-coaching",
  title: "Paid coaching",
  subtitle: null,
  description: null,
  category: null,
  offeringType: "coaching",
  attendanceMode: "online",
  bookingMode: "paid",
  schedulingMode: "appointment",
  durationMinutes: 60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  capacity: 1,
  requiresPayment: true,
  quoteOnly: false,
  colors: { background: "#fff", text: "#102329" },
  schedulingTimezone: "Africa/Cairo",
};

const pricePreview = {
  offering: {
    id: offering.id,
    title: offering.title,
    slug: offering.slug,
    bookingMode: offering.bookingMode,
  },
  resolvedCountryCode: "EG",
  priceGroup: {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Egypt",
  },
  price: {
    priceId: "22222222-2222-4222-8222-222222222222",
    countryCode: "EG",
    currency: "EGP",
    baseAmountMinor: 25_000,
    amountMinor: 25_000,
    earlyBirdAmountMinor: null,
    earlyBirdEndsAt: null,
    earlyBirdApplied: false,
    discountAmountMinor: 0,
    taxAmountMinor: 0,
    totalAmountMinor: 25_000,
  },
  expectedPrice: {
    priceId: "22222222-2222-4222-8222-222222222222",
    countryCode: "EG",
    currency: "EGP",
    baseAmountMinor: 25_000,
    discountAmountMinor: 0,
    taxAmountMinor: 0,
    totalAmountMinor: 25_000,
  },
  coupon: null,
  generatedAt: "2030-01-01T08:00:00.000Z",
};

const currentPrice = {
  resolvedCountryCode: "EG",
  priceGroup: pricePreview.priceGroup,
  price: {
    ...pricePreview.price,
    baseAmountMinor: 30_000,
    amountMinor: 30_000,
    totalAmountMinor: 30_000,
  },
  expectedPrice: {
    ...pricePreview.expectedPrice,
    baseAmountMinor: 30_000,
    totalAmountMinor: 30_000,
  },
};

const hold = {
  id: "33333333-3333-4333-8333-333333333333",
  holdToken: "owned-hold-token",
  offeringId: offering.id,
  offeringSessionId: null,
  scheduledProgramId: null,
  startsAt: "2030-01-02T09:00:00.000Z",
  endsAt: "2030-01-02T10:00:00.000Z",
  timezone: "Africa/Cairo",
  target: {
    kind: "appointment" as const,
    scheduledProgramId: null,
    startsAt: "2030-01-02T09:00:00.000Z",
    endsAt: "2030-01-02T10:00:00.000Z",
    timezone: "Africa/Cairo",
  },
  status: "active" as const,
  expiresAt: "2030-01-02T08:15:00.000Z",
  createdAt: "2030-01-02T08:00:00.000Z",
};

const bookingResult = {
  booking: {
    id: "88888888-8888-4888-8888-888888888888",
    publicToken: "44444444-4444-4444-8444-444444444444",
    bookingReference: "RAM-2030-0001",
    offering: {
      id: offering.id,
      title: offering.title,
      slug: offering.slug,
    },
    attendanceMode: "online",
    status: "pending_payment",
    customer: {
      fullName: "Mizo User",
      email: "mizo@example.com",
      phone: null,
    },
    countryCode: "EG",
    location: null,
    slot: {
      startsAt: hold.startsAt,
      endsAt: hold.endsAt,
      timezone: hold.timezone,
    },
    target: {
      kind: "appointment",
      scheduledProgramId: null,
      startsAt: hold.startsAt,
      endsAt: hold.endsAt,
      timezone: hold.timezone,
      occurrences: [],
    },
    paymentRequired: true,
    calendar: null,
    confirmedAt: null,
    createdAt: "2030-01-02T08:00:00.000Z",
  },
  payment: {},
  paymentSession: {},
};

const egyptLocation: PublicOfferingLocation = {
  id: "55555555-5555-4555-8555-555555555555",
  name: "Cairo office",
  addressLine1: "Downtown",
  addressLine2: null,
  city: "Cairo",
  countryCode: "EG",
  mapUrl: null,
  instructions: null,
};

const uaeLocation: PublicOfferingLocation = {
  ...egyptLocation,
  id: "66666666-6666-4666-8666-666666666666",
  name: "Dubai office",
  city: "Dubai",
  countryCode: "AE",
};

const primePaidFlow = (locations: PublicOfferingLocation[] = []) => {
  offeringMocks.fetchPublicOffering.mockResolvedValue(offering);
  offeringMocks.fetchPublicOfferingBookingConfig.mockResolvedValue({
    offering,
    fields: [],
    locations,
  });
  bookingMocks.fetchPublicAvailabilitySlots.mockResolvedValue({
    offering: {
      id: offering.id,
      title: offering.title,
      slug: offering.slug,
      schedulingMode: "appointment",
      capacity: 1,
      durationMinutes: 60,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      status: "published",
    },
    timezone: "Africa/Cairo",
    dateFrom: "2030-01-01",
    dateTo: "2030-01-14",
    bookingPolicy: {
      minimumAdvanceDays: 1,
      timezone: "Africa/Cairo",
      localToday: "2030-01-01",
      earliestBookableDate: "2030-01-02",
    },
    days: [
      {
        date: "2030-01-02",
        weekday: 3,
        slots: [
          {
            date: "2030-01-02",
            startsAt: hold.startsAt,
            endsAt: hold.endsAt,
            timezone: hold.timezone,
            status: "available",
            source: "window",
            availabilityWindowId: "77777777-7777-4777-8777-777777777777",
            availabilityOverrideId: null,
            remainingCapacity: 1,
            bookedCount: 0,
            heldCount: 0,
            blockedReason: null,
          },
        ],
        availableCount: 1,
        totalCount: 1,
      },
    ],
    programBlockers: [],
    availableCount: 1,
    totalCount: 1,
    generatedAt: "2030-01-01T08:00:00.000Z",
  });
  bookingMocks.fetchPublicPricePreview.mockResolvedValue(pricePreview);
  bookingMocks.createPublicSlotHold.mockResolvedValue(hold);
  bookingMocks.submitPublicPaidBooking.mockResolvedValue(bookingResult);
};

const reachReview = async () => {
  const user = userEvent.setup();
  render(<BookingFlow slug={offering.slug} />);
  await screen.findByText("Payment amount");
  await user.type(screen.getByRole("textbox", { name: "Full name" }), "Mizo User");
  await user.type(screen.getByRole("textbox", { name: "Email" }), "mizo@example.com");
  await user.click(screen.getByRole("button", { name: "Review and pay" }));
  await screen.findByText("Confirm your details.");
  return user;
};

describe("BookingFlow automatic country pricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primePaidFlow();
  });

  it("never asks the customer for a pricing country and blocks before a hold when pricing is unavailable", async () => {
    bookingMocks.fetchPublicPricePreview.mockRejectedValue(
      new PublicApiError({
        status: 422,
        code: "COUNTRY_PRICE_UNAVAILABLE",
        message: "Pricing is not available in your country.",
      }),
    );
    render(<BookingFlow slug={offering.slug} />);

    expect(await screen.findByText("Pricing is not available in your country.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Country" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review and pay" })).toBeDisabled();
    expect(bookingMocks.createPublicSlotHold).not.toHaveBeenCalled();
  });

  it("submits the exact seven-field price snapshot after preview and before payment", async () => {
    const user = await reachReview();
    await user.click(screen.getByRole("button", { name: "Continue to payment" }));

    await waitFor(() => expect(bookingMocks.submitPublicPaidBooking).toHaveBeenCalledTimes(1));
    expect(bookingMocks.createPublicSlotHold).toHaveBeenCalledTimes(1);
    expect(bookingMocks.submitPublicPaidBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        holdId: hold.id,
        holdToken: hold.holdToken,
        expectedPrice: pricePreview.expectedPrice,
      }),
    );
  });

  it("shows a changed price and reconfirms it using the same hold", async () => {
    bookingMocks.submitPublicPaidBooking
      .mockRejectedValueOnce(
        new PublicApiError({
          status: 409,
          code: "PRICE_CHANGED",
          message: "The price changed. Review the current price and confirm again.",
          meta: { currentPrice },
        }),
      )
      .mockResolvedValueOnce(bookingResult);
    const user = await reachReview();

    await user.click(screen.getByRole("button", { name: "Continue to payment" }));
    expect(
      await screen.findByText(/The price changed to .*300\. Confirm the new amount to continue\./),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm updated price" }));

    await waitFor(() => expect(bookingMocks.submitPublicPaidBooking).toHaveBeenCalledTimes(2));
    expect(bookingMocks.createPublicSlotHold).toHaveBeenCalledTimes(1);
    expect(bookingMocks.submitPublicPaidBooking).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        holdId: hold.id,
        holdToken: hold.holdToken,
        expectedPrice: currentPrice.expectedPrice,
      }),
    );
  });

  it("recovers from an expired held slot by returning to availability and creating a fresh hold", async () => {
    const replacementHold = {
      ...hold,
      id: "99999999-9999-4999-8999-999999999999",
      holdToken: "replacement-hold-token",
    };
    bookingMocks.createPublicSlotHold
      .mockResolvedValueOnce(hold)
      .mockResolvedValueOnce(replacementHold);
    bookingMocks.submitPublicPaidBooking
      .mockRejectedValueOnce(
        new PublicApiError({
          status: 409,
          code: "SLOT_UNAVAILABLE",
          message: "The held time expired.",
        }),
      )
      .mockResolvedValueOnce(bookingResult);
    const user = await reachReview();

    await user.click(screen.getByRole("button", { name: "Continue to payment" }));
    expect(await screen.findByText("That slot is no longer available. Choose another time.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review and pay" }));
    await user.click(screen.getByRole("button", { name: "Continue to payment" }));

    await waitFor(() => expect(bookingMocks.createPublicSlotHold).toHaveBeenCalledTimes(2));
    expect(bookingMocks.submitPublicPaidBooking).toHaveBeenLastCalledWith(
      expect.objectContaining({
        holdId: replacementHold.id,
        holdToken: replacementHold.holdToken,
      }),
    );
  });

  it("keeps attendance locations in other countries selectable", async () => {
    const offlineOffering = { ...offering, attendanceMode: "offline" as const };
    offeringMocks.fetchPublicOffering.mockResolvedValue(offlineOffering);
    offeringMocks.fetchPublicOfferingBookingConfig.mockResolvedValue({
      offering: offlineOffering,
      fields: [],
      locations: [egyptLocation, uaeLocation],
    });

    render(<BookingFlow slug={offering.slug} />);

    expect(await screen.findByRole("button", { name: /Cairo office/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dubai office/ })).toBeInTheDocument();
  });
});
