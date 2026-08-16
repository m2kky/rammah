export type PriceResolutionRow = {
  id: string;
  offeringId: string;
  name: string;
  countryCode: string;
  currency: string;
  baseAmountMinor: number;
  earlyBirdAmountMinor: number | null;
  earlyBirdEndsAt: Date | null;
};

export type EffectivePrice = {
  priceId: string;
  offeringId: string;
  groupName: string;
  countryCode: string;
  currency: string;
  baseAmountMinor: number;
  amountMinor: number;
  earlyBirdAmountMinor: number | null;
  earlyBirdEndsAt: string | null;
  earlyBirdApplied: boolean;
  discountAmountMinor: number;
  taxAmountMinor: number;
  totalAmountMinor: number;
};

export type ExpectedPrice = Pick<
  EffectivePrice,
  | "priceId"
  | "countryCode"
  | "currency"
  | "baseAmountMinor"
  | "discountAmountMinor"
  | "taxAmountMinor"
  | "totalAmountMinor"
>;

const expectationFields: ReadonlyArray<keyof ExpectedPrice> = [
  "priceId",
  "countryCode",
  "currency",
  "baseAmountMinor",
  "discountAmountMinor",
  "taxAmountMinor",
  "totalAmountMinor",
];

export const calculateEffectivePrice = (
  price: PriceResolutionRow,
  now: Date,
): EffectivePrice => {
  const earlyBirdApplied =
    price.earlyBirdAmountMinor !== null &&
    price.earlyBirdEndsAt !== null &&
    price.earlyBirdAmountMinor < price.baseAmountMinor &&
    price.earlyBirdEndsAt.getTime() >= now.getTime();
  const amountMinor = earlyBirdApplied
    ? price.earlyBirdAmountMinor!
    : price.baseAmountMinor;
  const discountAmountMinor = price.baseAmountMinor - amountMinor;
  const taxAmountMinor = 0;

  return {
    priceId: price.id,
    offeringId: price.offeringId,
    groupName: price.name,
    countryCode: price.countryCode,
    currency: price.currency,
    baseAmountMinor: price.baseAmountMinor,
    amountMinor,
    earlyBirdAmountMinor: price.earlyBirdAmountMinor,
    earlyBirdEndsAt: price.earlyBirdEndsAt?.toISOString() ?? null,
    earlyBirdApplied,
    discountAmountMinor,
    taxAmountMinor,
    totalAmountMinor: price.baseAmountMinor - discountAmountMinor + taxAmountMinor,
  };
};

export const toExpectedPrice = (price: EffectivePrice): ExpectedPrice => ({
  priceId: price.priceId,
  countryCode: price.countryCode,
  currency: price.currency,
  baseAmountMinor: price.baseAmountMinor,
  discountAmountMinor: price.discountAmountMinor,
  taxAmountMinor: price.taxAmountMinor,
  totalAmountMinor: price.totalAmountMinor,
});

export const toPublicPriceDetails = (price: EffectivePrice) => ({
  resolvedCountryCode: price.countryCode,
  priceGroup: {
    id: price.priceId,
    name: price.groupName,
  },
  price: {
    priceId: price.priceId,
    countryCode: price.countryCode,
    currency: price.currency,
    baseAmountMinor: price.baseAmountMinor,
    amountMinor: price.amountMinor,
    earlyBirdAmountMinor: price.earlyBirdAmountMinor,
    earlyBirdEndsAt: price.earlyBirdEndsAt,
    earlyBirdApplied: price.earlyBirdApplied,
    discountAmountMinor: price.discountAmountMinor,
    taxAmountMinor: price.taxAmountMinor,
    totalAmountMinor: price.totalAmountMinor,
  },
  expectedPrice: toExpectedPrice(price),
});

export const compareExpectedPrice = (
  expected: ExpectedPrice,
  current: ExpectedPrice,
) => expectationFields.every((field) => expected[field] === current[field]);
