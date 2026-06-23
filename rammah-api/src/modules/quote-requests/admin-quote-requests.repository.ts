import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "../../db/client.js";
import { offerings, quoteRequests, quoteStatusEnum } from "../../db/schema/index.js";

export type QuoteRequestStatus = (typeof quoteStatusEnum.enumValues)[number];

export type AdminQuoteRequestFilters = {
  status?: QuoteRequestStatus;
  search?: string;
};

export type AdminQuoteRequestPatch = {
  status?: QuoteRequestStatus;
  adminNotes?: string | null;
};

const adminQuoteRequestSelect = {
  id: quoteRequests.id,
  offeringId: quoteRequests.offeringId,
  offeringTitle: offerings.title,
  offeringSlug: offerings.slug,
  status: quoteRequests.status,
  fullName: quoteRequests.fullName,
  email: quoteRequests.email,
  phone: quoteRequests.phone,
  companyName: quoteRequests.companyName,
  participantsCount: quoteRequests.participantsCount,
  preferredDate: quoteRequests.preferredDate,
  message: quoteRequests.message,
  adminNotes: quoteRequests.adminNotes,
  createdAt: quoteRequests.createdAt,
  updatedAt: quoteRequests.updatedAt,
};

export type AdminQuoteRequestRow = Awaited<ReturnType<typeof findAdminQuoteRequests>>[number];

export const findAdminQuoteRequests = async (filters: AdminQuoteRequestFilters = {}) => {
  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(quoteRequests.status, filters.status));
  }

  if (filters.search?.trim()) {
    const searchPattern = `%${filters.search.trim()}%`;
    const searchCondition = or(
      ilike(quoteRequests.fullName, searchPattern),
      ilike(quoteRequests.email, searchPattern),
      ilike(quoteRequests.companyName, searchPattern),
      ilike(offerings.title, searchPattern),
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  let query = db
    .select(adminQuoteRequestSelect)
    .from(quoteRequests)
    .leftJoin(offerings, eq(quoteRequests.offeringId, offerings.id))
    .$dynamic();
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  if (where) {
    query = query.where(where);
  }

  return query.orderBy(desc(quoteRequests.createdAt)).limit(100);
};

export const findAdminQuoteRequestById = async (id: string) => {
  const rows = await db
    .select(adminQuoteRequestSelect)
    .from(quoteRequests)
    .leftJoin(offerings, eq(quoteRequests.offeringId, offerings.id))
    .where(eq(quoteRequests.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const updateAdminQuoteRequest = async (
  id: string,
  input: AdminQuoteRequestPatch,
) => {
  const rows = await db
    .update(quoteRequests)
    .set({
      status: input.status,
      adminNotes: input.adminNotes,
      updatedAt: new Date(),
    })
    .where(eq(quoteRequests.id, id))
    .returning({ id: quoteRequests.id });

  return rows[0] ? findAdminQuoteRequestById(rows[0].id) : null;
};
