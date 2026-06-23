import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { offerings, quoteRequests } from "../../db/schema/index.js";

export type PublicQuoteRequestInsert = typeof quoteRequests.$inferInsert;

export const findPublicQuoteOfferingById = async (id: string) => {
  const rows = await db
    .select({
      id: offerings.id,
      title: offerings.title,
      slug: offerings.slug,
      bookingMode: offerings.bookingMode,
      quoteOnly: offerings.quoteOnly,
      status: offerings.status,
    })
    .from(offerings)
    .where(eq(offerings.id, id))
    .limit(1);

  return rows[0] ?? null;
};

export const insertPublicQuoteRequest = async (
  input: PublicQuoteRequestInsert,
) => {
  const rows = await db
    .insert(quoteRequests)
    .values(input)
    .returning({
      id: quoteRequests.id,
      offeringId: quoteRequests.offeringId,
      status: quoteRequests.status,
      fullName: quoteRequests.fullName,
      email: quoteRequests.email,
      phone: quoteRequests.phone,
      companyName: quoteRequests.companyName,
      participantsCount: quoteRequests.participantsCount,
      preferredDate: quoteRequests.preferredDate,
      message: quoteRequests.message,
      createdAt: quoteRequests.createdAt,
      updatedAt: quoteRequests.updatedAt,
    });

  return rows[0] ?? null;
};
