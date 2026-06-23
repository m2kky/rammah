import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  contentStatusEnum,
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

export const findPublishedPricesForOffering = async (offeringId: string) =>
  db
    .select({
      id: offeringPrices.id,
      offeringId: offeringPrices.offeringId,
      countryCode: offeringPrices.countryCode,
      currency: offeringPrices.currency,
      baseAmountMinor: offeringPrices.baseAmountMinor,
      earlyBirdAmountMinor: offeringPrices.earlyBirdAmountMinor,
      earlyBirdEndsAt: offeringPrices.earlyBirdEndsAt,
    })
    .from(offeringPrices)
    .where(
      and(
        eq(offeringPrices.offeringId, offeringId),
        eq(offeringPrices.status, publishedStatus),
      ),
    )
    .orderBy(asc(offeringPrices.countryCode), asc(offeringPrices.currency));
