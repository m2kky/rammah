import {
  and,
  asc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  contentStatusEnum,
  bookingSlotHolds,
  bookings,
  offeringCategories,
  offeringPrices,
  offerings,
  scheduledProgramOccurrences,
  scheduledPrograms,
} from "../../db/schema/index.js";

export type ContentStatus = (typeof contentStatusEnum.enumValues)[number];
export type AdminOfferingInsert = typeof offerings.$inferInsert;
export type AdminOfferingUpdate = Partial<Omit<AdminOfferingInsert, "id" | "createdAt">>;
export type AdminOfferingPriceInsert = typeof offeringPrices.$inferInsert;
export type AdminOfferingPriceUpdate = Partial<Omit<AdminOfferingPriceInsert, "id" | "createdAt">>;

export type AdminOfferingFilters = {
  status?: ContentStatus;
  search?: string;
};

export type AdminOfferingCategoryRow = Awaited<
  ReturnType<typeof findAdminOfferingCategories>
>[number];

export type AdminOfferingPriceRow = Awaited<
  ReturnType<typeof findAdminOfferingPricesByOfferingId>
>[number];

const adminOfferingSelect = {
  id: offerings.id,
  categoryId: offerings.categoryId,
  categoryName: offeringCategories.name,
  categorySlug: offeringCategories.slug,
  title: offerings.title,
  slug: offerings.slug,
  shortDescription: offerings.shortDescription,
  longDescription: offerings.longDescription,
  offeringType: offerings.offeringType,
  attendanceMode: offerings.attendanceMode,
  bookingMode: offerings.bookingMode,
  schedulingMode: offerings.schedulingMode,
  durationMinutes: offerings.durationMinutes,
  bufferBeforeMinutes: offerings.bufferBeforeMinutes,
  bufferAfterMinutes: offerings.bufferAfterMinutes,
  capacity: offerings.capacity,
  requiresPayment: offerings.requiresPayment,
  quoteOnly: offerings.quoteOnly,
  sortOrder: offerings.sortOrder,
  displayConfig: offerings.displayConfig,
  status: offerings.status,
  createdAt: offerings.createdAt,
  updatedAt: offerings.updatedAt,
};

export const findOfferingSchedulingDependencies = async (
  offeringId: string,
  now = new Date(),
) => {
  const [appointmentBookingRows, appointmentHoldRows, programOccurrenceRows, programBookingRows, programHoldRows] =
    await Promise.all([
      db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.offeringId, offeringId),
            isNull(bookings.scheduledProgramId),
            inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
            gt(bookings.slotStartAt, now),
          ),
        )
        .limit(1),
      db
        .select({ id: bookingSlotHolds.id })
        .from(bookingSlotHolds)
        .where(
          and(
            eq(bookingSlotHolds.offeringId, offeringId),
            isNull(bookingSlotHolds.scheduledProgramId),
            eq(bookingSlotHolds.status, "active"),
            gt(bookingSlotHolds.expiresAt, now),
          ),
        )
        .limit(1),
      db
        .select({ id: scheduledProgramOccurrences.id })
        .from(scheduledProgramOccurrences)
        .innerJoin(
          scheduledPrograms,
          eq(scheduledProgramOccurrences.scheduledProgramId, scheduledPrograms.id),
        )
        .where(
          and(
            eq(scheduledPrograms.offeringId, offeringId),
            ne(scheduledPrograms.status, "archived"),
            eq(scheduledProgramOccurrences.status, "scheduled"),
            gt(scheduledProgramOccurrences.endsAt, now),
          ),
        )
        .limit(1),
      db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.offeringId, offeringId),
            isNotNull(bookings.scheduledProgramId),
            inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
          ),
        )
        .limit(1),
      db
        .select({ id: bookingSlotHolds.id })
        .from(bookingSlotHolds)
        .where(
          and(
            eq(bookingSlotHolds.offeringId, offeringId),
            isNotNull(bookingSlotHolds.scheduledProgramId),
            eq(bookingSlotHolds.status, "active"),
            gt(bookingSlotHolds.expiresAt, now),
          ),
        )
        .limit(1),
    ]);

  return {
    hasAppointmentTargets: appointmentBookingRows.length > 0 || appointmentHoldRows.length > 0,
    hasProgramTargets:
      programOccurrenceRows.length > 0 || programBookingRows.length > 0 || programHoldRows.length > 0,
  };
};

export const findAdminOfferingCategories = async () => {
  return db
    .select({
      id: offeringCategories.id,
      name: offeringCategories.name,
      slug: offeringCategories.slug,
      description: offeringCategories.description,
      sortOrder: offeringCategories.sortOrder,
      status: offeringCategories.status,
      createdAt: offeringCategories.createdAt,
      updatedAt: offeringCategories.updatedAt,
    })
    .from(offeringCategories)
    .where(ne(offeringCategories.status, "archived"))
    .orderBy(asc(offeringCategories.sortOrder), asc(offeringCategories.name));
};

export const findAdminOfferingPricesByOfferingId = async (offeringId: string) => {
  return db
    .select({
      id: offeringPrices.id,
      offeringId: offeringPrices.offeringId,
      countryCode: offeringPrices.countryCode,
      currency: offeringPrices.currency,
      baseAmountMinor: offeringPrices.baseAmountMinor,
      earlyBirdAmountMinor: offeringPrices.earlyBirdAmountMinor,
      earlyBirdEndsAt: offeringPrices.earlyBirdEndsAt,
      status: offeringPrices.status,
      createdAt: offeringPrices.createdAt,
      updatedAt: offeringPrices.updatedAt,
    })
    .from(offeringPrices)
    .where(eq(offeringPrices.offeringId, offeringId))
    .orderBy(
      asc(offeringPrices.status),
      asc(offeringPrices.countryCode),
      asc(offeringPrices.currency),
    );
};

export const findAdminOfferingPriceById = async (
  offeringId: string,
  priceId: string,
) => {
  const rows = await db
    .select({
      id: offeringPrices.id,
      offeringId: offeringPrices.offeringId,
      countryCode: offeringPrices.countryCode,
      currency: offeringPrices.currency,
      baseAmountMinor: offeringPrices.baseAmountMinor,
      earlyBirdAmountMinor: offeringPrices.earlyBirdAmountMinor,
      earlyBirdEndsAt: offeringPrices.earlyBirdEndsAt,
      status: offeringPrices.status,
      createdAt: offeringPrices.createdAt,
      updatedAt: offeringPrices.updatedAt,
    })
    .from(offeringPrices)
    .where(and(eq(offeringPrices.offeringId, offeringId), eq(offeringPrices.id, priceId)))
    .limit(1);

  return rows[0] ?? null;
};

export const findOfferingPriceByCountryCurrency = async (
  offeringId: string,
  countryCode: string,
  currency: string,
  excludeId?: string,
) => {
  const conditions: SQL[] = [
    eq(offeringPrices.offeringId, offeringId),
    eq(offeringPrices.countryCode, countryCode),
    eq(offeringPrices.currency, currency),
  ];

  if (excludeId) {
    conditions.push(ne(offeringPrices.id, excludeId));
  }

  const where = and(...conditions);

  if (!where) {
    return null;
  }

  const rows = await db
    .select({ id: offeringPrices.id })
    .from(offeringPrices)
    .where(where)
    .limit(1);

  return rows[0] ?? null;
};

export const findAdminOfferings = async (filters: AdminOfferingFilters = {}) => {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(offerings.status, filters.status));
  }

  if (filters.search) {
    const searchPattern = `%${filters.search}%`;
    const searchCondition = or(
      ilike(offerings.title, searchPattern),
      ilike(offerings.slug, searchPattern),
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  let query = db
    .select(adminOfferingSelect)
    .from(offerings)
    .leftJoin(offeringCategories, eq(offerings.categoryId, offeringCategories.id))
    .$dynamic();

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  if (where) {
    query = query.where(where);
  }

  return query.orderBy(asc(offerings.sortOrder), asc(offerings.title));
};

export type AdminOfferingRow = Awaited<ReturnType<typeof findAdminOfferings>>[number];

export const findAdminOfferingById = async (id: string) => {
  const rows = await db
    .select(adminOfferingSelect)
    .from(offerings)
    .leftJoin(offeringCategories, eq(offerings.categoryId, offeringCategories.id))
    .where(eq(offerings.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const findOfferingBySlug = async (slug: string, excludeId?: string) => {
  const conditions: SQL[] = [eq(offerings.slug, slug)];

  if (excludeId) {
    conditions.push(ne(offerings.id, excludeId));
  }

  const where = and(...conditions);

  if (!where) {
    return null;
  }

  const rows = await db
    .select({ id: offerings.id })
    .from(offerings)
    .where(where)
    .limit(1);

  return rows[0] ?? null;
};

export const findOfferingCategoryById = async (id: string) => {
  const rows = await db
    .select({ id: offeringCategories.id })
    .from(offeringCategories)
    .where(eq(offeringCategories.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const insertAdminOffering = async (input: AdminOfferingInsert) => {
  const rows = await db
    .insert(offerings)
    .values(input)
    .returning({ id: offerings.id });

  return rows[0] ? findAdminOfferingById(rows[0].id) : null;
};

export const updateAdminOffering = async (
  id: string,
  input: AdminOfferingUpdate,
) => {
  const rows = await db
    .update(offerings)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(offerings.id, id))
    .returning({ id: offerings.id });

  return rows[0] ? findAdminOfferingById(rows[0].id) : null;
};

export const archiveAdminOffering = async (id: string) => {
  const rows = await db
    .update(offerings)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(eq(offerings.id, id))
    .returning({ id: offerings.id });

  return rows[0] ?? null;
};

export const insertAdminOfferingPrice = async (input: AdminOfferingPriceInsert) => {
  const rows = await db
    .insert(offeringPrices)
    .values(input)
    .returning({ id: offeringPrices.id, offeringId: offeringPrices.offeringId });

  return rows[0] ? findAdminOfferingPriceById(rows[0].offeringId, rows[0].id) : null;
};

export const updateAdminOfferingPrice = async (
  offeringId: string,
  priceId: string,
  input: AdminOfferingPriceUpdate,
) => {
  const rows = await db
    .update(offeringPrices)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(and(eq(offeringPrices.offeringId, offeringId), eq(offeringPrices.id, priceId)))
    .returning({ id: offeringPrices.id, offeringId: offeringPrices.offeringId });

  return rows[0] ? findAdminOfferingPriceById(rows[0].offeringId, rows[0].id) : null;
};

export const archiveAdminOfferingPrice = async (
  offeringId: string,
  priceId: string,
) => {
  const rows = await db
    .update(offeringPrices)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(and(eq(offeringPrices.offeringId, offeringId), eq(offeringPrices.id, priceId)))
    .returning({ id: offeringPrices.id });

  return rows[0] ?? null;
};
