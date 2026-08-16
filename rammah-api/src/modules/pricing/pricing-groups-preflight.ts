export type LegacyPriceStatus = "draft" | "published" | "scheduled" | "archived";
export type LegacyOfferingBookingMode = "free" | "paid" | "quote_only";

export type LegacyPriceRow = {
  id: string;
  offeringId: string;
  countryCode: string;
  currency: string;
  baseAmountMinor: number;
  earlyBirdAmountMinor: number | null;
  earlyBirdEndsAt: Date | null;
  status: LegacyPriceStatus;
  offeringRequiresPayment: boolean;
  offeringBookingMode: LegacyOfferingBookingMode;
};

export type PricingGroupsMigrationReport = {
  ok: boolean;
  totalRows: number;
  duplicateActiveCountryPriceIds: string[];
  invalidCountryPriceIds: string[];
  negativeAmountPriceIds: string[];
  zeroPublishedPaidPriceIds: string[];
  incompleteEarlyBookingPriceIds: string[];
  invalidEarlyBookingAmountPriceIds: string[];
  unsupportedCurrencyPriceIds: string[];
  scheduledPriceIds: string[];
};

type QueryResult<TRow> = { rows: TRow[] };

export type PricingGroupsPreflightQueryable = {
  query<TRow extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<TRow>>;
};

const uniqueSorted = (values: string[]) => [...new Set(values)].sort();

export const parseSupportedCurrencies = (value: string) => {
  const currencies = uniqueSorted(
    value
      .split(",")
      .map((currency) => currency.trim().toUpperCase())
      .filter(Boolean),
  );

  if (currencies.length === 0 || currencies.some((currency) => !/^[A-Z]{3}$/.test(currency))) {
    throw new Error("PAYMENT_SUPPORTED_CURRENCIES must contain comma-separated 3-letter currency codes.");
  }

  return new Set(currencies);
};

export const analyzeLegacyPriceRows = (
  rows: LegacyPriceRow[],
  supportedCurrencies: ReadonlySet<string>,
  isoCountryCodes: ReadonlySet<string>,
): PricingGroupsMigrationReport => {
  const activeRowsByCountry = new Map<string, LegacyPriceRow[]>();

  for (const row of rows) {
    if (row.status === "archived") continue;
    const key = `${row.offeringId}:${row.countryCode.toUpperCase()}`;
    const matchingRows = activeRowsByCountry.get(key) ?? [];
    matchingRows.push(row);
    activeRowsByCountry.set(key, matchingRows);
  }

  const duplicateActiveCountryPriceIds = uniqueSorted(
    [...activeRowsByCountry.values()]
      .filter((matchingRows) => matchingRows.length > 1)
      .flatMap((matchingRows) => matchingRows.map(({ id }) => id)),
  );
  const invalidCountryPriceIds = uniqueSorted(
    rows
      .filter((row) => !isoCountryCodes.has(row.countryCode.toUpperCase()))
      .map(({ id }) => id),
  );
  const negativeAmountPriceIds = uniqueSorted(
    rows
      .filter(
        (row) =>
          row.baseAmountMinor < 0 ||
          (row.earlyBirdAmountMinor !== null && row.earlyBirdAmountMinor < 0),
      )
      .map(({ id }) => id),
  );
  const zeroPublishedPaidPriceIds = uniqueSorted(
    rows
      .filter(
        (row) =>
          row.status === "published" &&
          row.baseAmountMinor === 0 &&
          (row.offeringRequiresPayment || row.offeringBookingMode === "paid"),
      )
      .map(({ id }) => id),
  );
  const incompleteEarlyBookingPriceIds = uniqueSorted(
    rows
      .filter(
        (row) =>
          (row.earlyBirdAmountMinor === null) !== (row.earlyBirdEndsAt === null),
      )
      .map(({ id }) => id),
  );
  const invalidEarlyBookingAmountPriceIds = uniqueSorted(
    rows
      .filter(
        (row) =>
          row.earlyBirdAmountMinor !== null &&
          row.earlyBirdEndsAt !== null &&
          (row.earlyBirdAmountMinor >= row.baseAmountMinor ||
            (row.status === "published" && row.earlyBirdAmountMinor <= 0)),
      )
      .map(({ id }) => id),
  );
  const unsupportedCurrencyPriceIds = uniqueSorted(
    rows
      .filter((row) => !supportedCurrencies.has(row.currency.toUpperCase()))
      .map(({ id }) => id),
  );
  const scheduledPriceIds = uniqueSorted(
    rows.filter(({ status }) => status === "scheduled").map(({ id }) => id),
  );
  const blockers = [
    duplicateActiveCountryPriceIds,
    invalidCountryPriceIds,
    negativeAmountPriceIds,
    zeroPublishedPaidPriceIds,
    incompleteEarlyBookingPriceIds,
    invalidEarlyBookingAmountPriceIds,
    unsupportedCurrencyPriceIds,
  ];

  return {
    ok: blockers.every((ids) => ids.length === 0),
    totalRows: rows.length,
    duplicateActiveCountryPriceIds,
    invalidCountryPriceIds,
    negativeAmountPriceIds,
    zeroPublishedPaidPriceIds,
    incompleteEarlyBookingPriceIds,
    invalidEarlyBookingAmountPriceIds,
    unsupportedCurrencyPriceIds,
    scheduledPriceIds,
  };
};

export const assertPricingGroupsMigrationReady = (
  report: PricingGroupsMigrationReport,
) => {
  if (report.ok) return;

  const blockingIds = uniqueSorted([
    ...report.duplicateActiveCountryPriceIds,
    ...report.invalidCountryPriceIds,
    ...report.negativeAmountPriceIds,
    ...report.zeroPublishedPaidPriceIds,
    ...report.incompleteEarlyBookingPriceIds,
    ...report.invalidEarlyBookingAmountPriceIds,
    ...report.unsupportedCurrencyPriceIds,
  ]);

  throw new Error(
    `Pricing groups migration preflight failed for price IDs: ${blockingIds.join(", ")}`,
  );
};

export const inspectPricingGroupsMigration = async (
  queryable: PricingGroupsPreflightQueryable,
  supportedCurrencies: ReadonlySet<string>,
  isoCountryCodes: ReadonlySet<string>,
) => {
  const result = await queryable.query<{
    id: string;
    offering_id: string;
    country_code: string;
    currency: string;
    base_amount_minor: number;
    early_bird_amount_minor: number | null;
    early_bird_ends_at: Date | null;
    status: LegacyPriceStatus;
    offering_requires_payment: boolean;
    offering_booking_mode: LegacyOfferingBookingMode;
  }>(`
    SELECT
      p.id::text,
      p.offering_id::text,
      p.country_code,
      p.currency,
      p.base_amount_minor,
      p.early_bird_amount_minor,
      p.early_bird_ends_at,
      p.status,
      o.requires_payment AS offering_requires_payment,
      o.booking_mode AS offering_booking_mode
    FROM offering_prices p
    INNER JOIN offerings o ON o.id = p.offering_id
    ORDER BY p.offering_id, p.country_code, p.currency, p.id
  `);

  return analyzeLegacyPriceRows(
    result.rows.map((row) => ({
      id: row.id,
      offeringId: row.offering_id,
      countryCode: row.country_code,
      currency: row.currency,
      baseAmountMinor: row.base_amount_minor,
      earlyBirdAmountMinor: row.early_bird_amount_minor,
      earlyBirdEndsAt: row.early_bird_ends_at,
      status: row.status,
      offeringRequiresPayment: row.offering_requires_payment,
      offeringBookingMode: row.offering_booking_mode,
    })),
    supportedCurrencies,
    isoCountryCodes,
  );
};
