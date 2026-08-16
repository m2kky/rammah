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
  notInArray,
  or,
  type SQL,
} from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  auditLogs,
  contentStatusEnum,
  bookingSlotHolds,
  bookings,
  offeringCategories,
  offeringPriceCountries,
  offeringPrices,
  offerings,
  scheduledProgramOccurrences,
  scheduledPrograms,
} from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";

export type ContentStatus = (typeof contentStatusEnum.enumValues)[number];
export type AdminOfferingInsert = typeof offerings.$inferInsert;
export type AdminOfferingUpdate = Partial<Omit<AdminOfferingInsert, "id" | "createdAt">>;
export type AdminOfferingPriceInsert = typeof offeringPrices.$inferInsert;
export type AdminOfferingPriceUpdate = Partial<Omit<AdminOfferingPriceInsert, "id" | "createdAt">>;

export type AdminOfferingPriceGroupWrite = {
  name: string;
  countryCodes: string[];
  countryCode: string;
  currency: string;
  baseAmountMinor: number;
  earlyBirdAmountMinor: number | null;
  earlyBirdEndsAt: Date | null;
  status: "draft" | "published";
};

export type PriceAuditContext = {
  adminUserId?: string;
  ipAddress?: string;
};

export type AdminOfferingFilters = {
  status?: ContentStatus;
  search?: string;
};

export type AdminOfferingCategoryRow = Awaited<
  ReturnType<typeof findAdminOfferingCategories>
>[number];

export type AdminOfferingPriceRow = {
  id: string;
  offeringId: string;
  name: string;
  countryCodes: string[];
  currency: string;
  baseAmountMinor: number;
  earlyBirdAmountMinor: number | null;
  earlyBirdEndsAt: Date | null;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
};

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

const adminOfferingPriceMembershipSelect = {
  id: offeringPrices.id,
  offeringId: offeringPrices.offeringId,
  name: offeringPrices.name,
  currency: offeringPrices.currency,
  baseAmountMinor: offeringPrices.baseAmountMinor,
  earlyBirdAmountMinor: offeringPrices.earlyBirdAmountMinor,
  earlyBirdEndsAt: offeringPrices.earlyBirdEndsAt,
  status: offeringPrices.status,
  createdAt: offeringPrices.createdAt,
  updatedAt: offeringPrices.updatedAt,
  memberCountryCode: offeringPriceCountries.countryCode,
  memberActive: offeringPriceCountries.active,
};

type AdminOfferingPriceMembershipRow = {
  id: string;
  offeringId: string;
  name: string;
  currency: string;
  baseAmountMinor: number;
  earlyBirdAmountMinor: number | null;
  earlyBirdEndsAt: Date | null;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
  memberCountryCode: string | null;
  memberActive: boolean | null;
};

const groupAdminOfferingPrices = (
  rows: AdminOfferingPriceMembershipRow[],
): AdminOfferingPriceRow[] => {
  const grouped = new Map<string, AdminOfferingPriceRow>();

  for (const row of rows) {
    const existing = grouped.get(row.id) ?? {
      id: row.id,
      offeringId: row.offeringId,
      name: row.name,
      countryCodes: [],
      currency: row.currency,
      baseAmountMinor: row.baseAmountMinor,
      earlyBirdAmountMinor: row.earlyBirdAmountMinor,
      earlyBirdEndsAt: row.earlyBirdEndsAt,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    if (
      row.memberCountryCode &&
      (row.status === "archived" || row.memberActive) &&
      !existing.countryCodes.includes(row.memberCountryCode)
    ) {
      existing.countryCodes.push(row.memberCountryCode);
      existing.countryCodes.sort();
    }
    grouped.set(row.id, existing);
  }

  return [...grouped.values()];
};

export const findAdminOfferingPricesByOfferingId = async (offeringId: string) => {
  const rows = await db
    .select(adminOfferingPriceMembershipSelect)
    .from(offeringPrices)
    .leftJoin(
      offeringPriceCountries,
      eq(offeringPriceCountries.priceId, offeringPrices.id),
    )
    .where(eq(offeringPrices.offeringId, offeringId))
    .orderBy(asc(offeringPrices.status), asc(offeringPrices.name), asc(offeringPriceCountries.countryCode));

  return groupAdminOfferingPrices(rows);
};

export const findAdminOfferingPriceById = async (
  offeringId: string,
  priceId: string,
) => {
  const rows = await db
    .select(adminOfferingPriceMembershipSelect)
    .from(offeringPrices)
    .leftJoin(
      offeringPriceCountries,
      eq(offeringPriceCountries.priceId, offeringPrices.id),
    )
    .where(and(eq(offeringPrices.offeringId, offeringId), eq(offeringPrices.id, priceId)))
    .orderBy(asc(offeringPriceCountries.countryCode));

  return groupAdminOfferingPrices(rows)[0] ?? null;
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

type PriceCountryConflict = {
  countryCode: string;
  priceId: string;
  groupName: string;
};

const priceGroupSnapshot = (price: AdminOfferingPriceRow) => ({
  id: price.id,
  offeringId: price.offeringId,
  name: price.name,
  countryCodes: price.countryCodes,
  currency: price.currency,
  baseAmountMinor: price.baseAmountMinor,
  earlyBirdAmountMinor: price.earlyBirdAmountMinor,
  earlyBirdEndsAt: price.earlyBirdEndsAt?.toISOString() ?? null,
  status: price.status,
  createdAt: price.createdAt.toISOString(),
  updatedAt: price.updatedAt.toISOString(),
});

const countryConflictError = (conflicts: PriceCountryConflict[]) =>
  new AppError({
    code: "PRICE_COUNTRY_CONFLICT",
    message: "One or more countries already belong to another active price group.",
    statusCode: httpStatus.conflict,
    details: conflicts.map(({ countryCode, groupName }) => ({
      field: "countryCodes",
      message: `${countryCode} is already assigned to ${groupName}.`,
    })),
    meta: { conflicts },
  });

const archivedGroupError = () =>
  new AppError({
    code: "CONFLICT",
    message: "Archived price groups are read-only and cannot be restored.",
    statusCode: httpStatus.conflict,
  });

const isActiveCountryUniqueViolation = (error: unknown) => {
  const candidate = error as {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };
  const code = candidate.code ?? candidate.cause?.code;
  const constraint = candidate.constraint ?? candidate.cause?.constraint;
  return code === "23505" && constraint === "offering_price_countries_active_unique";
};

const findPriceCountryConflicts = async (
  offeringId: string,
  countryCodes: string[],
  excludePriceId?: string,
) => {
  const conditions: SQL[] = [
    eq(offeringPriceCountries.offeringId, offeringId),
    eq(offeringPriceCountries.active, true),
    inArray(offeringPriceCountries.countryCode, countryCodes),
  ];
  if (excludePriceId) conditions.push(ne(offeringPriceCountries.priceId, excludePriceId));

  return db
    .select({
      countryCode: offeringPriceCountries.countryCode,
      priceId: offeringPriceCountries.priceId,
      groupName: offeringPrices.name,
    })
    .from(offeringPriceCountries)
    .innerJoin(offeringPrices, eq(offeringPrices.id, offeringPriceCountries.priceId))
    .where(and(...conditions))
    .orderBy(asc(offeringPriceCountries.countryCode));
};

const insertPriceAudit = (
  executor: Parameters<Parameters<typeof db.transaction>[0]>[0],
  context: PriceAuditContext | undefined,
  input: {
    action: string;
    resourceId: string;
    beforeSnapshot: Record<string, unknown> | null;
    afterSnapshot: Record<string, unknown> | null;
  },
) =>
  executor.insert(auditLogs).values({
    adminUserId: context?.adminUserId,
    ipAddress: context?.ipAddress,
    action: input.action,
    resourceType: "offering_price",
    resourceId: input.resourceId,
    beforeSnapshot: input.beforeSnapshot,
    afterSnapshot: input.afterSnapshot,
  });

export const insertAdminOfferingPriceGroup = async (
  offeringId: string,
  input: AdminOfferingPriceGroupWrite,
  auditContext?: PriceAuditContext,
) => {
  try {
    return await db.transaction(async (tx) => {
      const conflicts = await tx
        .select({
          countryCode: offeringPriceCountries.countryCode,
          priceId: offeringPriceCountries.priceId,
          groupName: offeringPrices.name,
        })
        .from(offeringPriceCountries)
        .innerJoin(offeringPrices, eq(offeringPrices.id, offeringPriceCountries.priceId))
        .where(
          and(
            eq(offeringPriceCountries.offeringId, offeringId),
            eq(offeringPriceCountries.active, true),
            inArray(offeringPriceCountries.countryCode, input.countryCodes),
          ),
        )
        .orderBy(asc(offeringPriceCountries.countryCode))
        .for("update");
      if (conflicts.length > 0) throw countryConflictError(conflicts);

      const [header] = await tx
        .insert(offeringPrices)
        .values({
          offeringId,
          name: input.name,
          countryCode: input.countryCode,
          currency: input.currency,
          baseAmountMinor: input.baseAmountMinor,
          earlyBirdAmountMinor: input.earlyBirdAmountMinor,
          earlyBirdEndsAt: input.earlyBirdEndsAt,
          status: input.status,
        })
        .returning();
      if (!header) throw new Error("Offering price group insert returned no row.");

      await tx.insert(offeringPriceCountries).values(
        input.countryCodes.map((countryCode) => ({
          priceId: header.id,
          offeringId,
          countryCode,
          active: true,
        })),
      );

      const created: AdminOfferingPriceRow = {
        ...header,
        countryCodes: input.countryCodes,
      };
      await insertPriceAudit(tx, auditContext, {
        action: "admin.offering_prices.create",
        resourceId: created.id,
        beforeSnapshot: null,
        afterSnapshot: priceGroupSnapshot(created),
      });
      return created;
    });
  } catch (error) {
    if (isActiveCountryUniqueViolation(error)) {
      const conflicts = await findPriceCountryConflicts(offeringId, input.countryCodes);
      throw countryConflictError(conflicts);
    }
    throw error;
  }
};

export const updateAdminOfferingPriceGroup = async (
  offeringId: string,
  priceId: string,
  input: AdminOfferingPriceGroupWrite,
  auditContext?: PriceAuditContext,
) => {
  try {
    return await db.transaction(async (tx) => {
      const [header] = await tx
        .select()
        .from(offeringPrices)
        .where(and(eq(offeringPrices.offeringId, offeringId), eq(offeringPrices.id, priceId)))
        .for("update");
      if (!header) return null;
      if (header.status === "archived") throw archivedGroupError();

      const currentMemberships = await tx
        .select()
        .from(offeringPriceCountries)
        .where(eq(offeringPriceCountries.priceId, priceId))
        .orderBy(asc(offeringPriceCountries.countryCode))
        .for("update");
      const before: AdminOfferingPriceRow = {
        ...header,
        countryCodes: currentMemberships.filter(({ active }) => active).map(({ countryCode }) => countryCode),
      };

      const conflicts = await tx
        .select({
          countryCode: offeringPriceCountries.countryCode,
          priceId: offeringPriceCountries.priceId,
          groupName: offeringPrices.name,
        })
        .from(offeringPriceCountries)
        .innerJoin(offeringPrices, eq(offeringPrices.id, offeringPriceCountries.priceId))
        .where(
          and(
            eq(offeringPriceCountries.offeringId, offeringId),
            eq(offeringPriceCountries.active, true),
            inArray(offeringPriceCountries.countryCode, input.countryCodes),
            ne(offeringPriceCountries.priceId, priceId),
          ),
        )
        .orderBy(asc(offeringPriceCountries.countryCode))
        .for("update");
      if (conflicts.length > 0) throw countryConflictError(conflicts);

      const now = new Date();
      await tx
        .update(offeringPriceCountries)
        .set({ active: false, updatedAt: now })
        .where(
          and(
            eq(offeringPriceCountries.priceId, priceId),
            eq(offeringPriceCountries.active, true),
            notInArray(offeringPriceCountries.countryCode, input.countryCodes),
          ),
        );
      for (const countryCode of input.countryCodes) {
        await tx
          .insert(offeringPriceCountries)
          .values({ priceId, offeringId, countryCode, active: true, updatedAt: now })
          .onConflictDoUpdate({
            target: [offeringPriceCountries.priceId, offeringPriceCountries.countryCode],
            set: { active: true, updatedAt: now },
          });
      }

      const [updatedHeader] = await tx
        .update(offeringPrices)
        .set({
          name: input.name,
          countryCode: input.countryCode,
          currency: input.currency,
          baseAmountMinor: input.baseAmountMinor,
          earlyBirdAmountMinor: input.earlyBirdAmountMinor,
          earlyBirdEndsAt: input.earlyBirdEndsAt,
          status: input.status,
          updatedAt: now,
        })
        .where(and(eq(offeringPrices.offeringId, offeringId), eq(offeringPrices.id, priceId)))
        .returning();
      if (!updatedHeader) return null;

      const after: AdminOfferingPriceRow = {
        ...updatedHeader,
        countryCodes: input.countryCodes,
      };
      await insertPriceAudit(tx, auditContext, {
        action: "admin.offering_prices.update",
        resourceId: priceId,
        beforeSnapshot: priceGroupSnapshot(before),
        afterSnapshot: priceGroupSnapshot(after),
      });
      return after;
    });
  } catch (error) {
    if (isActiveCountryUniqueViolation(error)) {
      const conflicts = await findPriceCountryConflicts(offeringId, input.countryCodes, priceId);
      throw countryConflictError(conflicts);
    }
    throw error;
  }
};

export const archiveAdminOfferingPriceGroup = async (
  offeringId: string,
  priceId: string,
  auditContext?: PriceAuditContext,
) =>
  db.transaction(async (tx) => {
    const [header] = await tx
      .select()
      .from(offeringPrices)
      .where(and(eq(offeringPrices.offeringId, offeringId), eq(offeringPrices.id, priceId)))
      .for("update");
    if (!header) return null;
    if (header.status === "archived") throw archivedGroupError();

    const memberships = await tx
      .select()
      .from(offeringPriceCountries)
      .where(eq(offeringPriceCountries.priceId, priceId))
      .orderBy(asc(offeringPriceCountries.countryCode))
      .for("update");
    const before: AdminOfferingPriceRow = {
      ...header,
      countryCodes: memberships.filter(({ active }) => active).map(({ countryCode }) => countryCode),
    };
    const now = new Date();
    await tx
      .update(offeringPriceCountries)
      .set({ active: false, updatedAt: now })
      .where(eq(offeringPriceCountries.priceId, priceId));
    const [archivedHeader] = await tx
      .update(offeringPrices)
      .set({ status: "archived", updatedAt: now })
      .where(and(eq(offeringPrices.offeringId, offeringId), eq(offeringPrices.id, priceId)))
      .returning();
    if (!archivedHeader) return null;

    const after: AdminOfferingPriceRow = {
      ...archivedHeader,
      countryCodes: before.countryCodes,
    };
    await insertPriceAudit(tx, auditContext, {
      action: "admin.offering_prices.archive",
      resourceId: priceId,
      beforeSnapshot: priceGroupSnapshot(before),
      afterSnapshot: priceGroupSnapshot(after),
    });
    return after;
  });
