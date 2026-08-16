import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  archiveAdminOfferingPrice: vi.fn(),
  createAdminOfferingPrice: vi.fn(),
  fetchAdminOfferingPrices: vi.fn(),
  updateAdminOfferingPrice: vi.fn(),
}));

vi.mock("@/lib/api/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin")>();
  return { ...actual, ...apiMocks };
});

import {
  AdminApiError,
  type AdminOfferingPrice,
  type AdminOfferingPriceMetadata,
} from "@/lib/api/admin";
import AdminOfferingPricing from "./AdminOfferingPricing";

const metadata: AdminOfferingPriceMetadata = {
  supportedCurrencies: ["EGP", "USD"],
  countries: [
    { code: "EG", name: "Egypt" },
    { code: "SA", name: "Saudi Arabia" },
    { code: "AE", name: "United Arab Emirates" },
  ],
};

const price = (overrides: Partial<AdminOfferingPrice> = {}): AdminOfferingPrice => ({
  id: "11111111-1111-4111-8111-111111111111",
  offeringId: "22222222-2222-4222-8222-222222222222",
  name: "GCC",
  countryCodes: ["AE", "SA"],
  currency: "USD",
  baseAmountMinor: 15_000,
  earlyBirdAmountMinor: null,
  earlyBirdEndsAt: null,
  status: "published",
  createdAt: "2030-01-01T00:00:00.000Z",
  updatedAt: "2030-01-01T00:00:00.000Z",
  ...overrides,
});

describe("AdminOfferingPricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchAdminOfferingPrices.mockResolvedValue({ prices: [], meta: metadata });
    apiMocks.createAdminOfferingPrice.mockResolvedValue(price());
  });

  it("uses API metadata for searchable countries and supported currencies", async () => {
    const user = userEvent.setup();
    render(<AdminOfferingPricing offeringId="22222222-2222-4222-8222-222222222222" />);

    const currency = await screen.findByLabelText("Currency");
    expect(within(currency).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "EGP",
      "USD",
    ]);
    await user.type(screen.getByLabelText("Search countries"), "Saudi");
    expect(screen.getByRole("button", { name: "Add Saudi Arabia" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Egypt" })).not.toBeInTheDocument();
  });

  it("creates one group with multiple selected countries", async () => {
    const user = userEvent.setup();
    render(<AdminOfferingPricing offeringId="22222222-2222-4222-8222-222222222222" />);

    await screen.findByLabelText("Group name");
    await user.type(screen.getByLabelText("Group name"), "GCC");
    await user.click(screen.getByRole("button", { name: "Add Saudi Arabia" }));
    await user.click(screen.getByRole("button", { name: "Add United Arab Emirates" }));
    await user.selectOptions(screen.getByLabelText("Currency"), "USD");
    await user.type(screen.getByLabelText("Standard price"), "150");
    await user.click(screen.getByRole("button", { name: "Add price group" }));

    await waitFor(() => expect(apiMocks.createAdminOfferingPrice).toHaveBeenCalledTimes(1));
    expect(apiMocks.createAdminOfferingPrice).toHaveBeenCalledWith(
      "22222222-2222-4222-8222-222222222222",
      expect.objectContaining({
        name: "GCC",
        countryCodes: ["SA", "AE"],
        currency: "USD",
        baseAmountMinor: 15_000,
        status: "published",
      }),
    );
  });

  it("shows every country conflict returned by the API", async () => {
    apiMocks.createAdminOfferingPrice.mockRejectedValue(
      new AdminApiError({
        code: "PRICE_COUNTRY_CONFLICT",
        message: "Countries already belong to another group.",
        status: 409,
        details: [
          { field: "countryCodes", message: "SA is already assigned to Saudi." },
          { field: "countryCodes", message: "AE is already assigned to Emirates." },
        ],
      }),
    );
    const user = userEvent.setup();
    render(<AdminOfferingPricing offeringId="22222222-2222-4222-8222-222222222222" />);

    await screen.findByLabelText("Group name");
    await user.type(screen.getByLabelText("Group name"), "GCC");
    await user.click(screen.getByRole("button", { name: "Add Saudi Arabia" }));
    await user.type(screen.getByLabelText("Standard price"), "150");
    await user.click(screen.getByRole("button", { name: "Add price group" }));

    expect(await screen.findByText("SA is already assigned to Saudi.")).toBeInTheDocument();
    expect(screen.getByText("AE is already assigned to Emirates.")).toBeInTheDocument();
  });

  it("opens archived groups as read-only and offers no mutation action", async () => {
    apiMocks.fetchAdminOfferingPrices.mockResolvedValue({
      prices: [price({ status: "archived" })],
      meta: metadata,
    });
    const user = userEvent.setup();
    render(<AdminOfferingPricing offeringId="22222222-2222-4222-8222-222222222222" />);

    await user.click(await screen.findByRole("button", { name: "View GCC" }));
    expect(screen.getByText("Archived groups are read-only.")).toBeInTheDocument();
    expect(screen.getByLabelText("Group name")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Update price group" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive GCC" })).not.toBeInTheDocument();
  });
});
