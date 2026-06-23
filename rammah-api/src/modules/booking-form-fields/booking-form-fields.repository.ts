import { and, asc, eq, isNull, ne, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  bookingFormFields,
  contentStatusEnum,
  offerings,
} from "../../db/schema/index.js";

const publishedStatus = contentStatusEnum.enumValues[1];
const archivedStatus = contentStatusEnum.enumValues[3];

export type BookingFormFieldInsert = typeof bookingFormFields.$inferInsert;
export type BookingFormFieldUpdate = Partial<BookingFormFieldInsert>;
export type ContentStatus = (typeof contentStatusEnum.enumValues)[number];

export type AdminBookingFormFieldFilters = {
  offeringId?: string;
  status?: ContentStatus;
};

const adminBookingFormFieldSelect = {
  id: bookingFormFields.id,
  offeringId: bookingFormFields.offeringId,
  offeringTitle: offerings.title,
  offeringSlug: offerings.slug,
  fieldKey: bookingFormFields.fieldKey,
  label: bookingFormFields.label,
  fieldType: bookingFormFields.fieldType,
  required: bookingFormFields.required,
  options: bookingFormFields.options,
  validationRules: bookingFormFields.validationRules,
  sortOrder: bookingFormFields.sortOrder,
  status: bookingFormFields.status,
  createdAt: bookingFormFields.createdAt,
  updatedAt: bookingFormFields.updatedAt,
};

const publicBookingFormFieldSelect = {
  id: bookingFormFields.id,
  offeringId: bookingFormFields.offeringId,
  fieldKey: bookingFormFields.fieldKey,
  label: bookingFormFields.label,
  fieldType: bookingFormFields.fieldType,
  required: bookingFormFields.required,
  options: bookingFormFields.options,
  validationRules: bookingFormFields.validationRules,
  sortOrder: bookingFormFields.sortOrder,
};

export const findPublicBookingFormFieldsByOfferingId = async (offeringId: string) =>
  db
    .select(publicBookingFormFieldSelect)
    .from(bookingFormFields)
    .where(
      and(
        eq(bookingFormFields.status, publishedStatus),
        or(eq(bookingFormFields.offeringId, offeringId), isNull(bookingFormFields.offeringId)),
      ),
    )
    .orderBy(asc(bookingFormFields.sortOrder), asc(bookingFormFields.label));

export type PublicBookingFormFieldRow = Awaited<
  ReturnType<typeof findPublicBookingFormFieldsByOfferingId>
>[number];

export const findAdminBookingFormFields = async (
  filters: AdminBookingFormFieldFilters = {},
) => {
  const conditions: SQL[] = [];

  if (filters.offeringId) {
    conditions.push(eq(bookingFormFields.offeringId, filters.offeringId));
  }

  if (filters.status) {
    conditions.push(eq(bookingFormFields.status, filters.status));
  }

  let query = db
    .select(adminBookingFormFieldSelect)
    .from(bookingFormFields)
    .leftJoin(offerings, eq(bookingFormFields.offeringId, offerings.id))
    .$dynamic();

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  if (where) {
    query = query.where(where);
  }

  return query.orderBy(
    asc(offerings.title),
    asc(bookingFormFields.sortOrder),
    asc(bookingFormFields.label),
  );
};

export type AdminBookingFormFieldRow = Awaited<
  ReturnType<typeof findAdminBookingFormFields>
>[number];

export const findAdminBookingFormFieldById = async (id: string) => {
  const rows = await db
    .select(adminBookingFormFieldSelect)
    .from(bookingFormFields)
    .leftJoin(offerings, eq(bookingFormFields.offeringId, offerings.id))
    .where(eq(bookingFormFields.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const findOfferingExistsById = async (id: string) => {
  const rows = await db.select({ id: offerings.id }).from(offerings).where(eq(offerings.id, id)).limit(1);
  return Boolean(rows[0]);
};

export const findBookingFormFieldKeyConflict = async (
  offeringId: string | null,
  fieldKey: string,
  excludeId?: string,
) => {
  const conditions: SQL[] = [
    offeringId ? eq(bookingFormFields.offeringId, offeringId) : isNull(bookingFormFields.offeringId),
    eq(bookingFormFields.fieldKey, fieldKey),
    ne(bookingFormFields.status, archivedStatus),
  ];

  if (excludeId) {
    conditions.push(ne(bookingFormFields.id, excludeId));
  }

  const rows = await db
    .select({ id: bookingFormFields.id })
    .from(bookingFormFields)
    .where(and(...conditions))
    .limit(1);

  return rows[0] ?? null;
};

export const insertAdminBookingFormField = async (input: BookingFormFieldInsert) => {
  const rows = await db
    .insert(bookingFormFields)
    .values(input)
    .returning({ id: bookingFormFields.id });

  if (!rows[0]) {
    return null;
  }

  return findAdminBookingFormFieldById(rows[0].id);
};

export const updateAdminBookingFormField = async (
  id: string,
  input: BookingFormFieldUpdate,
) => {
  const rows = await db
    .update(bookingFormFields)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(bookingFormFields.id, id))
    .returning({ id: bookingFormFields.id });

  if (!rows[0]) {
    return null;
  }

  return findAdminBookingFormFieldById(rows[0].id);
};

export const archiveAdminBookingFormField = async (id: string) =>
  updateAdminBookingFormField(id, { status: archivedStatus });
