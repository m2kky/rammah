import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  contentStatusEnum,
  availabilityRules,
  offlineLocations,
  offeringCategories,
  offeringLocations,
  offeringPrices,
  offeringSessions,
  offerings,
} from "../../db/schema/index.js";

const publishedStatus = contentStatusEnum.enumValues[1];

export type OfferingRow = Awaited<ReturnType<typeof findPublishedOfferings>>[number];

export const findPublishedOfferings = async () => {
  const rows = await db
    .select({
      id: offerings.id,
      slug: offerings.slug,
      title: offerings.title,
      shortDescription: offerings.shortDescription,
      longDescription: offerings.longDescription,
      offeringType: offerings.offeringType,
      attendanceMode: offerings.attendanceMode,
      bookingMode: offerings.bookingMode,
      durationMinutes: offerings.durationMinutes,
      capacity: offerings.capacity,
      requiresPayment: offerings.requiresPayment,
      quoteOnly: offerings.quoteOnly,
      sortOrder: offerings.sortOrder,
      displayConfig: offerings.displayConfig,
      categoryId: offeringCategories.id,
      categoryName: offeringCategories.name,
      categorySlug: offeringCategories.slug,
    })
    .from(offerings)
    .leftJoin(offeringCategories, eq(offerings.categoryId, offeringCategories.id))
    .where(eq(offerings.status, publishedStatus))
    .orderBy(asc(offerings.sortOrder), asc(offerings.title));

  return rows;
};

export const findPublishedOfferingBySlug = async (slug: string) => {
  const rows = await db
    .select({
      id: offerings.id,
      slug: offerings.slug,
      title: offerings.title,
      shortDescription: offerings.shortDescription,
      longDescription: offerings.longDescription,
      offeringType: offerings.offeringType,
      attendanceMode: offerings.attendanceMode,
      bookingMode: offerings.bookingMode,
      durationMinutes: offerings.durationMinutes,
      capacity: offerings.capacity,
      requiresPayment: offerings.requiresPayment,
      quoteOnly: offerings.quoteOnly,
      sortOrder: offerings.sortOrder,
      displayConfig: offerings.displayConfig,
      categoryId: offeringCategories.id,
      categoryName: offeringCategories.name,
      categorySlug: offeringCategories.slug,
    })
    .from(offerings)
    .leftJoin(offeringCategories, eq(offerings.categoryId, offeringCategories.id))
    .where(and(eq(offerings.status, publishedStatus), eq(offerings.slug, slug)))
    .limit(1);

  return rows[0] ?? null;
};

export const findPublishedOfferingById = async (id: string) => {
  const rows = await db
    .select({
      id: offerings.id,
      slug: offerings.slug,
      title: offerings.title,
      shortDescription: offerings.shortDescription,
      longDescription: offerings.longDescription,
      offeringType: offerings.offeringType,
      attendanceMode: offerings.attendanceMode,
      bookingMode: offerings.bookingMode,
      durationMinutes: offerings.durationMinutes,
      capacity: offerings.capacity,
      requiresPayment: offerings.requiresPayment,
      quoteOnly: offerings.quoteOnly,
      sortOrder: offerings.sortOrder,
      displayConfig: offerings.displayConfig,
      categoryId: offeringCategories.id,
      categoryName: offeringCategories.name,
      categorySlug: offeringCategories.slug,
    })
    .from(offerings)
    .leftJoin(offeringCategories, eq(offerings.categoryId, offeringCategories.id))
    .where(and(eq(offerings.status, publishedStatus), eq(offerings.id, id)))
    .limit(1);

  return rows[0] ?? null;
};

export const findPublicOfferingSchedulingSources = async (offeringId: string) => {
  const [availabilityRows, sessionRows] = await Promise.all([
    db
      .select({
        id: availabilityRules.id,
        timezone: availabilityRules.timezone,
      })
      .from(availabilityRules)
      .where(
        and(
          eq(availabilityRules.offeringId, offeringId),
          eq(availabilityRules.status, publishedStatus),
        ),
      )
      .limit(1),
    db
      .select({
        id: offeringSessions.id,
        timezone: offeringSessions.timezone,
      })
      .from(offeringSessions)
      .where(
        and(
          eq(offeringSessions.offeringId, offeringId),
          eq(offeringSessions.status, publishedStatus),
          gt(offeringSessions.endsAt, new Date()),
        ),
      )
      .limit(1),
  ]);

  return {
    hasPublishedAvailability: availabilityRows.length > 0,
    hasPublishedSessions: sessionRows.length > 0,
    availabilityTimezone: availabilityRows[0]?.timezone ?? null,
    sessionTimezone: sessionRows[0]?.timezone ?? null,
  };
};

export const findPublishedPricesByOfferingIds = async (offeringIds: string[]) => {
  if (offeringIds.length === 0) {
    return [];
  }

  return db
    .select({
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
        inArray(offeringPrices.offeringId, offeringIds),
        eq(offeringPrices.status, publishedStatus),
      ),
    );
};

const publicLocationSelect = {
  id: offlineLocations.id,
  name: offlineLocations.name,
  addressLine1: offlineLocations.addressLine1,
  addressLine2: offlineLocations.addressLine2,
  city: offlineLocations.city,
  countryCode: offlineLocations.countryCode,
  mapUrl: offlineLocations.mapUrl,
  instructions: offlineLocations.instructions,
};

const orderLocations = () => [
  asc(offlineLocations.countryCode),
  asc(offlineLocations.city),
  asc(offlineLocations.name),
];

export const findPublishedLocationsForOffering = async (offeringId: string) => {
  const linkedLocations = await db
    .select(publicLocationSelect)
    .from(offeringLocations)
    .innerJoin(offlineLocations, eq(offeringLocations.locationId, offlineLocations.id))
    .where(
      and(
        eq(offeringLocations.offeringId, offeringId),
        eq(offlineLocations.status, publishedStatus),
      ),
    )
    .orderBy(...orderLocations());

  if (linkedLocations.length > 0) {
    return linkedLocations;
  }

  // ponytail: global location fallback, add admin offering-location assignment when locations diverge by offering.
  return db
    .select(publicLocationSelect)
    .from(offlineLocations)
    .where(eq(offlineLocations.status, publishedStatus))
    .orderBy(...orderLocations());
};
