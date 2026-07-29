import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  bookings,
  calendarEvents,
  googleCalendarConnections,
  offerings,
} from "../../db/schema/index.js";

export const calendarEventSelect = {
  id: calendarEvents.id,
  bookingId: calendarEvents.bookingId,
  provider: calendarEvents.provider,
  externalEventId: calendarEvents.externalEventId,
  meetUrl: calendarEvents.meetUrl,
  status: calendarEvents.status,
  lastError: calendarEvents.lastError,
  createdAt: calendarEvents.createdAt,
  updatedAt: calendarEvents.updatedAt,
};

const googleCalendarConnectionSelect = {
  id: googleCalendarConnections.id,
  provider: googleCalendarConnections.provider,
  calendarId: googleCalendarConnections.calendarId,
  accessTokenEncrypted: googleCalendarConnections.accessTokenEncrypted,
  refreshTokenEncrypted: googleCalendarConnections.refreshTokenEncrypted,
  tokenType: googleCalendarConnections.tokenType,
  scope: googleCalendarConnections.scope,
  expiryDate: googleCalendarConnections.expiryDate,
  connectedEmail: googleCalendarConnections.connectedEmail,
  status: googleCalendarConnections.status,
  lastError: googleCalendarConnections.lastError,
  createdAt: googleCalendarConnections.createdAt,
  updatedAt: googleCalendarConnections.updatedAt,
};

export type GoogleCalendarConnection = typeof googleCalendarConnections.$inferSelect;

export type CalendarEventRow = typeof calendarEvents.$inferSelect;

export const findGoogleCalendarConnection = async () => {
  const rows = await db
    .select(googleCalendarConnectionSelect)
    .from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.provider, "google"))
    .limit(1);

  return rows[0] ?? null;
};

export const upsertGoogleCalendarConnection = async (input: {
  calendarId: string;
  accessTokenEncrypted?: string | null;
  refreshTokenEncrypted?: string | null;
  tokenType?: string | null;
  scope?: string | null;
  expiryDate?: Date | null;
  connectedEmail?: string | null;
  status?: "connected" | "disconnected" | "error";
  lastError?: string | null;
}) => {
  const now = new Date();
  const rows = await db
    .insert(googleCalendarConnections)
    .values({
      provider: "google",
      calendarId: input.calendarId,
      accessTokenEncrypted: input.accessTokenEncrypted ?? null,
      refreshTokenEncrypted: input.refreshTokenEncrypted ?? null,
      tokenType: input.tokenType ?? null,
      scope: input.scope ?? null,
      expiryDate: input.expiryDate ?? null,
      connectedEmail: input.connectedEmail ?? null,
      status: input.status ?? "connected",
      lastError: input.lastError ?? null,
    })
    .onConflictDoUpdate({
      target: googleCalendarConnections.provider,
      set: {
        calendarId: input.calendarId,
        accessTokenEncrypted: input.accessTokenEncrypted ?? null,
        refreshTokenEncrypted: input.refreshTokenEncrypted ?? null,
        tokenType: input.tokenType ?? null,
        scope: input.scope ?? null,
        expiryDate: input.expiryDate ?? null,
        connectedEmail: input.connectedEmail ?? null,
        status: input.status ?? "connected",
        lastError: input.lastError ?? null,
        updatedAt: now,
      },
    })
    .returning(googleCalendarConnectionSelect);

  return rows[0] ?? null;
};

export const updateGoogleCalendarConnectionSettings = async (input: {
  calendarId: string;
}) => {
  const rows = await db
    .update(googleCalendarConnections)
    .set({
      calendarId: input.calendarId,
      updatedAt: new Date(),
    })
    .where(eq(googleCalendarConnections.provider, "google"))
    .returning(googleCalendarConnectionSelect);

  return rows[0] ?? null;
};

export const updateGoogleCalendarConnectionTokens = async (input: {
  accessTokenEncrypted?: string | null;
  refreshTokenEncrypted?: string | null;
  tokenType?: string | null;
  scope?: string | null;
  expiryDate?: Date | null;
}) => {
  const rows = await db
    .update(googleCalendarConnections)
    .set({
      accessTokenEncrypted: input.accessTokenEncrypted ?? undefined,
      refreshTokenEncrypted: input.refreshTokenEncrypted ?? undefined,
      tokenType: input.tokenType ?? undefined,
      scope: input.scope ?? undefined,
      expiryDate: input.expiryDate ?? undefined,
      status: "connected",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(googleCalendarConnections.provider, "google"))
    .returning(googleCalendarConnectionSelect);

  return rows[0] ?? null;
};

export const markGoogleCalendarConnectionError = async (lastError: string) => {
  const rows = await db
    .update(googleCalendarConnections)
    .set({
      status: "error",
      lastError,
      updatedAt: new Date(),
    })
    .where(eq(googleCalendarConnections.provider, "google"))
    .returning(googleCalendarConnectionSelect);

  return rows[0] ?? null;
};

export const findCalendarEventByBookingId = async (bookingId: string) => {
  const rows = await db
    .select(calendarEventSelect)
    .from(calendarEvents)
    .where(and(eq(calendarEvents.bookingId, bookingId), eq(calendarEvents.provider, "google")))
    .limit(1);

  return rows[0] ?? null;
};

export const ensurePendingCalendarEvent = async (bookingId: string) => {
  const rows = await db
    .insert(calendarEvents)
    .values({
      bookingId,
      provider: "google",
      status: "pending",
      lastError: null,
    })
    .onConflictDoNothing({
      target: [calendarEvents.bookingId, calendarEvents.provider],
    })
    .returning(calendarEventSelect);

  return rows[0] ?? findCalendarEventByBookingId(bookingId);
};

export const markCalendarEventPending = async (bookingId: string) => {
  const existing = await ensurePendingCalendarEvent(bookingId);

  if (!existing) return null;

  const rows = await db
    .update(calendarEvents)
    .set({
      status: "pending",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(calendarEvents.id, existing.id))
    .returning(calendarEventSelect);

  return rows[0] ?? null;
};

export const markCalendarEventCreated = async (input: {
  bookingId: string;
  externalEventId: string;
  meetUrl?: string | null;
}) => {
  const rows = await db
    .update(calendarEvents)
    .set({
      externalEventId: input.externalEventId,
      meetUrl: input.meetUrl ?? null,
      status: "created",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(and(eq(calendarEvents.bookingId, input.bookingId), eq(calendarEvents.provider, "google")))
    .returning(calendarEventSelect);

  return rows[0] ?? null;
};

export const markCalendarEventUpdated = async (input: {
  bookingId: string;
  externalEventId: string;
  meetUrl?: string | null;
}) => {
  const rows = await db
    .update(calendarEvents)
    .set({
      externalEventId: input.externalEventId,
      meetUrl: input.meetUrl ?? null,
      status: "updated",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(and(eq(calendarEvents.bookingId, input.bookingId), eq(calendarEvents.provider, "google")))
    .returning(calendarEventSelect);

  return rows[0] ?? null;
};

export const markCalendarEventFailed = async (input: {
  bookingId: string;
  lastError: string;
}) => {
  await ensurePendingCalendarEvent(input.bookingId);

  const rows = await db
    .update(calendarEvents)
    .set({
      status: "failed",
      lastError: input.lastError,
      updatedAt: new Date(),
    })
    .where(and(eq(calendarEvents.bookingId, input.bookingId), eq(calendarEvents.provider, "google")))
    .returning(calendarEventSelect);

  return rows[0] ?? null;
};

export const markCalendarEventCancelled = async (bookingId: string) => {
  const rows = await db
    .update(calendarEvents)
    .set({
      status: "cancelled",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(and(eq(calendarEvents.bookingId, bookingId), eq(calendarEvents.provider, "google")))
    .returning(calendarEventSelect);

  return rows[0] ?? null;
};

export const findConfirmedBookingForCalendarSync = async (bookingId: string) => {
  const rows = await db
    .select({
      id: bookings.id,
      publicToken: bookings.publicToken,
      bookingReference: bookings.bookingReference,
      status: bookings.status,
      attendanceMode: bookings.attendanceMode,
      customerFullName: bookings.customerFullName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      slotStartAt: bookings.slotStartAt,
      slotEndAt: bookings.slotEndAt,
      timezone: bookings.timezone,
      offeringTitle: offerings.title,
      offeringSlug: offerings.slug,
    })
    .from(bookings)
    .innerJoin(offerings, eq(bookings.offeringId, offerings.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  return rows[0] ?? null;
};
