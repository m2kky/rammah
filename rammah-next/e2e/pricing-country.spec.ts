import { expect, test, type Page, type Route } from "@playwright/test";

const apiBasePath = "/api/v1";
const offeringId = "11111111-1111-4111-8111-111111111111";
const priceId = "22222222-2222-4222-8222-222222222222";
const holdId = "33333333-3333-4333-8333-333333333333";
const publicToken = "44444444-4444-4444-8444-444444444444";
const cairoLocationId = "55555555-5555-4555-8555-555555555555";
const dubaiLocationId = "66666666-6666-4666-8666-666666666666";

const dateKeyInCairo = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1_000);
const slotDate = dateKeyInCairo(tomorrow);
const slotStartsAt = `${slotDate}T09:00:00.000Z`;
const slotEndsAt = `${slotDate}T10:00:00.000Z`;

const expectedPrice = (amountMinor = 25_000) => ({
  priceId,
  countryCode: "EG",
  currency: "EGP",
  baseAmountMinor: amountMinor,
  discountAmountMinor: 0,
  taxAmountMinor: 0,
  totalAmountMinor: amountMinor,
});

const priceDetails = (amountMinor = 25_000) => ({
  resolvedCountryCode: "EG",
  priceGroup: { id: priceId, name: "Egypt" },
  price: {
    ...expectedPrice(amountMinor),
    amountMinor,
    earlyBirdAmountMinor: null,
    earlyBirdEndsAt: null,
    earlyBirdApplied: false,
  },
  expectedPrice: expectedPrice(amountMinor),
});

const offering = (attendanceMode: "online" | "offline" = "online") => ({
  id: offeringId,
  slug: "paid-coaching",
  title: "Paid coaching",
  subtitle: null,
  description: "Choose an available time and confirm your session.",
  category: null,
  offeringType: "coaching",
  attendanceMode,
  bookingMode: "paid",
  schedulingMode: "appointment",
  durationMinutes: 60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  capacity: 1,
  requiresPayment: true,
  quoteOnly: false,
  colors: { background: "#ffffff", text: "#102329" },
  schedulingTimezone: "Africa/Cairo",
});

const locations = [
  {
    id: cairoLocationId,
    name: "Cairo office",
    addressLine1: "Downtown",
    addressLine2: null,
    city: "Cairo",
    countryCode: "EG",
    mapUrl: null,
    instructions: null,
  },
  {
    id: dubaiLocationId,
    name: "Dubai office",
    addressLine1: "Business Bay",
    addressLine2: null,
    city: "Dubai",
    countryCode: "AE",
    mapUrl: null,
    instructions: null,
  },
];

type ApiScenario = {
  attendanceMode?: "online" | "offline";
  unavailableCountry?: boolean;
  changePriceOnFirstConfirmation?: boolean;
};

type ApiObservations = {
  holdRequests: number;
  paidRequests: Array<Record<string, unknown>>;
};

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const installApiScenario = async (
  page: Page,
  scenario: ApiScenario = {},
): Promise<ApiObservations> => {
  const observations: ApiObservations = { holdRequests: 0, paidRequests: [] };
  const configuredOffering = offering(scenario.attendanceMode);

  await page.route("http://localhost:4000/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.slice(apiBasePath.length);

    if (request.method() === "GET" && path === "/public/offerings/paid-coaching") {
      return json(route, 200, { data: configuredOffering });
    }

    if (
      request.method() === "GET" &&
      path === `/public/offerings/${offeringId}/booking-config`
    ) {
      return json(route, 200, {
        data: {
          offering: configuredOffering,
          fields: [],
          locations: scenario.attendanceMode === "offline" ? locations : [],
        },
      });
    }

    if (request.method() === "GET" && path === "/public/availability-slots") {
      const localToday = dateKeyInCairo(new Date());
      return json(route, 200, {
        data: {
          offering: {
            id: offeringId,
            title: configuredOffering.title,
            slug: configuredOffering.slug,
            schedulingMode: "appointment",
            capacity: 1,
            durationMinutes: 60,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 0,
            status: "published",
          },
          timezone: "Africa/Cairo",
          dateFrom: url.searchParams.get("dateFrom"),
          dateTo: url.searchParams.get("dateTo"),
          bookingPolicy: {
            minimumAdvanceDays: 0,
            timezone: "Africa/Cairo",
            localToday,
            earliestBookableDate: localToday,
          },
          days: [
            {
              date: slotDate,
              weekday: tomorrow.getUTCDay(),
              slots: [
                {
                  date: slotDate,
                  startsAt: slotStartsAt,
                  endsAt: slotEndsAt,
                  timezone: "Africa/Cairo",
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
          generatedAt: new Date().toISOString(),
        },
      });
    }

    if (request.method() === "POST" && path === "/public/booking/price-preview") {
      if (scenario.unavailableCountry) {
        return json(route, 422, {
          error: {
            code: "COUNTRY_PRICE_UNAVAILABLE",
            message: "Pricing is not available in your country.",
          },
        });
      }
      return json(route, 200, {
        data: {
          offering: {
            id: offeringId,
            title: configuredOffering.title,
            slug: configuredOffering.slug,
            bookingMode: "paid",
          },
          ...priceDetails(),
          coupon: null,
          generatedAt: new Date().toISOString(),
        },
      });
    }

    if (request.method() === "POST" && path === "/public/slot-holds") {
      observations.holdRequests += 1;
      return json(route, 201, {
        data: {
          id: holdId,
          holdToken: "owned-hold-token",
          offeringId,
          offeringSessionId: null,
          scheduledProgramId: null,
          startsAt: slotStartsAt,
          endsAt: slotEndsAt,
          timezone: "Africa/Cairo",
          target: {
            kind: "appointment",
            scheduledProgramId: null,
            startsAt: slotStartsAt,
            endsAt: slotEndsAt,
            timezone: "Africa/Cairo",
          },
          status: "active",
          expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
          createdAt: new Date().toISOString(),
        },
      });
    }

    if (request.method() === "POST" && path === "/public/payments/paid-bookings") {
      const requestBody = request.postDataJSON() as Record<string, unknown>;
      observations.paidRequests.push(requestBody);
      if (scenario.changePriceOnFirstConfirmation && observations.paidRequests.length === 1) {
        return json(route, 409, {
          error: {
            code: "PRICE_CHANGED",
            message: "The price changed. Review the current price and confirm again.",
            meta: { currentPrice: priceDetails(30_000) },
          },
        });
      }

      return json(route, 201, {
        data: {
          booking: {
            id: "88888888-8888-4888-8888-888888888888",
            publicToken,
            bookingReference: "RAM-2030-0001",
            offering: {
              id: offeringId,
              title: configuredOffering.title,
              slug: configuredOffering.slug,
            },
            attendanceMode: scenario.attendanceMode ?? "online",
            status: "pending_payment",
            customer: {
              fullName: "Mizo User",
              email: "mizo@example.com",
              phone: null,
            },
            countryCode: "EG",
            location: null,
            slot: {
              startsAt: slotStartsAt,
              endsAt: slotEndsAt,
              timezone: "Africa/Cairo",
            },
            target: {
              kind: "appointment",
              scheduledProgramId: null,
              startsAt: slotStartsAt,
              endsAt: slotEndsAt,
              timezone: "Africa/Cairo",
              occurrences: [],
            },
            paymentRequired: true,
            calendar: null,
            confirmedAt: null,
            createdAt: new Date().toISOString(),
          },
          payment: {},
          paymentSession: {},
        },
      });
    }

    return json(route, 404, { error: { code: "NOT_FOUND", message: path } });
  });

  return observations;
};

const reachReview = async (page: Page) => {
  await page.goto("/booking/paid-coaching");
  await expect(page.getByText("Payment amount")).toBeVisible();
  await page.getByRole("textbox", { name: "Full name" }).fill("Mizo User");
  await page.getByRole("textbox", { name: "Email" }).fill("mizo@example.com");
  await page.getByRole("button", { name: "Review and pay" }).click();
  await expect(page.getByText("Confirm your details.")).toBeVisible();
};

test("supported country reaches payment with the previewed snapshot", async ({ page }) => {
  const observations = await installApiScenario(page);
  await reachReview(page);
  await page.getByRole("button", { name: "Continue to payment" }).click();

  await expect(page).toHaveURL(new RegExp(`/booking/payment/${publicToken}$`), {
    timeout: 15_000,
  });
  expect(observations.holdRequests).toBe(1);
  expect(observations.paidRequests[0]).toMatchObject({ expectedPrice: expectedPrice() });
});

test("unsupported country is blocked before a hold or payment", async ({ page }) => {
  const observations = await installApiScenario(page, { unavailableCountry: true });
  await page.goto("/booking/paid-coaching");

  await expect(page.getByText("Pricing is not available in your country.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review and pay" })).toBeDisabled();
  expect(observations.holdRequests).toBe(0);
  expect(observations.paidRequests).toHaveLength(0);
});

test("an admin price edit requires explicit confirmation on the same hold", async ({ page }) => {
  const observations = await installApiScenario(page, {
    changePriceOnFirstConfirmation: true,
  });
  await reachReview(page);
  await page.getByRole("button", { name: "Continue to payment" }).click();

  await expect(page.getByText(/The price changed to .*300/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm updated price" }).click();
  await expect(page).toHaveURL(new RegExp(`/booking/payment/${publicToken}$`), {
    timeout: 15_000,
  });

  expect(observations.holdRequests).toBe(1);
  expect(observations.paidRequests).toHaveLength(2);
  expect(observations.paidRequests[1]).toMatchObject({ expectedPrice: expectedPrice(30_000) });
});

test("pricing country does not hide or override a foreign attendance location", async ({ page }) => {
  const observations = await installApiScenario(page, { attendanceMode: "offline" });
  await page.goto("/booking/paid-coaching");

  await expect(page.getByRole("button", { name: /Cairo office/ })).toBeVisible();
  await page.getByRole("button", { name: /Dubai office/ }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill("Mizo User");
  await page.getByRole("textbox", { name: "Email" }).fill("mizo@example.com");
  await page.getByRole("button", { name: "Review and pay" }).click();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page).toHaveURL(new RegExp(`/booking/payment/${publicToken}$`), {
    timeout: 15_000,
  });

  expect(observations.paidRequests[0]).toMatchObject({
    locationId: dubaiLocationId,
    expectedPrice: expectedPrice(),
  });
});
