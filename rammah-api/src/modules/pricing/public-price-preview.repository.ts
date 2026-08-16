import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  contentStatusEnum,
  offeringPriceCountries,
  offeringPrices,
  offerings,
} from "../../db/schema/index.js";

const publishedStatus = contentStatusEnum.enumValues[1];

export const findPublishedOfferingForPricingById = async (id: string) => {
  const rows = await db
    .select({
      id: offerings.id,
      title: offerings.title,
      slug: offerings.slug,
      bookingMode: offerings.bookingMode,
      requiresPayment: offerings.requiresPayment,
      quoteOnly: offerings.quoteOnly,
    })
    .from(offerings)
    .where(and(eq(offerings.id, id), eq(offerings.status, publishedStatus)))
    .limit(1);

  return rows[0] ?? null;
};

export type PricingQueryExecutor = Pick<typeof db, "select">;

export const findPublishedPriceGroupForCountry = async (input: {
  offeringId: string;
  countryCode: string;
  executor?: PricingQueryExecutor;
  lock?: boolean;
}) => {
  const executor = input.executor ?? db;
  const query = executor
    .select({
      id: offeringPrices.id,
      offeringId: offeringPrices.offeringId,
      name: offeringPrices.name,
      countryCode: offeringPriceCountries.countryCode,
      currency: offeringPrices.currency,
      baseAmountMinor: offeringPrices.baseAmountMinor,
      earlyBirdAmountMinor: offeringPrices.earlyBirdAmountMinor,
      earlyBirdEndsAt: offeringPrices.earlyBirdEndsAt,
    })
    .from(offeringPriceCountries)
    .innerJoin(offeringPrices, eq(offeringPrices.id, offeringPriceCountries.priceId))
    .where(
      and(
        eq(offeringPriceCountries.offeringId, input.offeringId),
        eq(offeringPriceCountries.countryCode, input.countryCode),
        eq(offeringPriceCountries.active, true),
        eq(offeringPrices.status, publishedStatus),
      ),
    )
    .limit(1)
    .$dynamic();

  const rows = input.lock ? await query.for("update") : await query;
  return rows[0] ?? null;
};
