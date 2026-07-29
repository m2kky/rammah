import { asc, eq, inArray } from "drizzle-orm";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { bookings, payments } from "../../db/schema/index.js";
import { reconcilePublicPayment } from "./public-payments.service.js";

export const reconcilePendingPayments = async () => {
  if (env.PAYMENT_PROVIDER !== "kashier") return 0;

  const candidates = await db
    .select({ publicToken: bookings.publicToken })
    .from(payments)
    .innerJoin(bookings, eq(payments.bookingId, bookings.id))
    .where(inArray(payments.status, ["created", "pending", "processing"]))
    .orderBy(asc(payments.updatedAt))
    .limit(25);
  const results = await Promise.allSettled(
    candidates.map(({ publicToken }) => reconcilePublicPayment(publicToken)),
  );

  return results.filter((result) => result.status === "fulfilled").length;
};
