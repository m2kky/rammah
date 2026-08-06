import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { auditLogs, siteSettings } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import type { AuditContext } from "../audit/audit.service.js";
import {
  buildBookingPolicy,
  defaultBookingPolicySettings,
  validateBookingPolicyInput,
  type BookingPolicy,
} from "./booking-policy.js";

export type BookingPolicyTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const settingsSelect = {
  id: siteSettings.id,
  bookingMinimumAdvanceDays: siteSettings.bookingMinimumAdvanceDays,
  bookingDefaultTimezone: siteSettings.bookingDefaultTimezone,
  updatedAt: siteSettings.updatedAt,
};

const configurationError = (message: string) =>
  new AppError({
    code: "CONFIGURATION_ERROR",
    message,
    statusCode: httpStatus.internalServerError,
    expose: false,
  });

const policyFromSettings = (
  row: {
    bookingMinimumAdvanceDays: number;
    bookingDefaultTimezone: string;
  } | null,
  now: Date,
) => {
  const minimumAdvanceDays = row?.bookingMinimumAdvanceDays ?? defaultBookingPolicySettings.minimumAdvanceDays;
  const timezone = row?.bookingDefaultTimezone ?? defaultBookingPolicySettings.timezone;
  const issues = validateBookingPolicyInput({ minimumAdvanceDays, timezone });
  if (issues.length > 0) {
    throw configurationError("Stored booking policy is invalid.");
  }
  return buildBookingPolicy({ minimumAdvanceDays, timezone, now });
};

export const acquireBookingPolicyLock = async (tx: BookingPolicyTransaction) => {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended('booking-policy:global', 0))`,
  );
};

export const getCurrentBookingPolicy = async (now = new Date()): Promise<BookingPolicy> => {
  const rows = await db
    .select(settingsSelect)
    .from(siteSettings)
    .where(eq(siteSettings.settingsKey, "global"))
    .limit(1);
  return policyFromSettings(rows[0] ?? null, now);
};

export const getLockedBookingPolicy = async (
  tx: BookingPolicyTransaction,
  now = new Date(),
): Promise<BookingPolicy> => {
  await acquireBookingPolicyLock(tx);
  const rows = await tx
    .select(settingsSelect)
    .from(siteSettings)
    .where(eq(siteSettings.settingsKey, "global"))
    .limit(1)
    .for("update");
  return policyFromSettings(rows[0] ?? null, now);
};

const toAdminBookingPolicy = (policy: BookingPolicy, updatedAt: Date | null) => ({
  bookingMinimumAdvanceDays: policy.minimumAdvanceDays,
  bookingDefaultTimezone: policy.timezone,
  localToday: policy.localToday,
  earliestBookableDate: policy.earliestBookableDate,
  updatedAt: updatedAt?.toISOString() ?? null,
});

export const getAdminBookingPolicy = async (now = new Date()) => {
  const rows = await db
    .select(settingsSelect)
    .from(siteSettings)
    .where(eq(siteSettings.settingsKey, "global"))
    .limit(1);
  const row = rows[0] ?? null;
  return toAdminBookingPolicy(policyFromSettings(row, now), row?.updatedAt ?? null);
};

export const updateAdminBookingPolicy = async (
  input: {
    bookingMinimumAdvanceDays: number;
    bookingDefaultTimezone: string;
  },
  auditContext?: AuditContext,
  now = new Date(),
) => {
  const timezone = input.bookingDefaultTimezone.trim();
  const issues = validateBookingPolicyInput({
    minimumAdvanceDays: input.bookingMinimumAdvanceDays,
    timezone,
  });
  if (issues.length > 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Booking policy is invalid.",
      statusCode: httpStatus.badRequest,
      details: issues,
    });
  }

  return db.transaction(async (tx) => {
    await acquireBookingPolicyLock(tx);
    const rows = await tx
      .select(settingsSelect)
      .from(siteSettings)
      .where(eq(siteSettings.settingsKey, "global"))
      .limit(1)
      .for("update");
    const existing = rows[0] ?? null;
    const before = {
      bookingMinimumAdvanceDays:
        existing?.bookingMinimumAdvanceDays ?? defaultBookingPolicySettings.minimumAdvanceDays,
      bookingDefaultTimezone:
        existing?.bookingDefaultTimezone ?? defaultBookingPolicySettings.timezone,
    };
    const updatedAt = new Date();
    const savedRows = existing
      ? await tx
          .update(siteSettings)
          .set({
            bookingMinimumAdvanceDays: input.bookingMinimumAdvanceDays,
            bookingDefaultTimezone: timezone,
            updatedAt,
          })
          .where(eq(siteSettings.id, existing.id))
          .returning(settingsSelect)
      : await tx
          .insert(siteSettings)
          .values({
            settingsKey: "global",
            siteName: "Ahmed Ramah Coaching Platform",
            bookingMinimumAdvanceDays: input.bookingMinimumAdvanceDays,
            bookingDefaultTimezone: timezone,
            updatedAt,
          })
          .returning(settingsSelect);
    const saved = savedRows[0];
    if (!saved) throw configurationError("Booking policy could not be saved.");

    const after = {
      bookingMinimumAdvanceDays: saved.bookingMinimumAdvanceDays,
      bookingDefaultTimezone: saved.bookingDefaultTimezone,
    };
    await tx.insert(auditLogs).values({
      adminUserId: auditContext?.adminUserId,
      action: "admin.booking_policy.update",
      resourceType: "site_settings",
      resourceId: saved.id,
      beforeSnapshot: before,
      afterSnapshot: after,
      ipAddress: auditContext?.ipAddress,
    });

    return toAdminBookingPolicy(policyFromSettings(saved, now), saved.updatedAt);
  });
};
