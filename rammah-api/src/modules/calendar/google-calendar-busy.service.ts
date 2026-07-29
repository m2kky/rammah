import type { calendar_v3 } from "googleapis";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  calendarSyncRuns,
  externalCalendarBusyBlocks,
} from "../../db/schema/index.js";
import { findGoogleCalendarConnection } from "./google-calendar.repository.js";
import { getAuthorizedCalendarClient } from "./google-calendar.service.js";

export const toExternalBusyBlock = (event: calendar_v3.Schema$Event) => {
  if (
    event.status === "cancelled" ||
    event.transparency === "transparent" ||
    event.extendedProperties?.private?.source === "rammah"
  ) {
    return null;
  }
  const startValue = event.start?.dateTime ?? event.start?.date;
  const endValue = event.end?.dateTime ?? event.end?.date;
  if (!startValue || !endValue) return null;

  const startsAt = new Date(startValue);
  const endsAt = new Date(endValue);
  if (
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(endsAt.getTime()) ||
    startsAt >= endsAt
  ) {
    return null;
  }

  return {
    externalEventId: event.id ?? null,
    startsAt,
    endsAt,
  };
};

export const syncGoogleCalendarBusyBlocks = async (now = new Date()) => {
  const connection = await findGoogleCalendarConnection();
  if (connection?.status !== "connected" || !connection.refreshTokenEncrypted) return 0;

  const [run] = await db
    .insert(calendarSyncRuns)
    .values({ provider: "google", startedAt: now, status: "pending" })
    .returning({ id: calendarSyncRuns.id });

  try {
    const { calendar, calendarId } = await getAuthorizedCalendarClient();
    const events: calendar_v3.Schema$Event[] = [];
    let pageToken: string | undefined;
    const timeMin = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
    const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60_000).toISOString();

    do {
      const response = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        showDeleted: false,
        maxResults: 2500,
        pageToken,
      });
      events.push(...(response.data.items ?? []));
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    const blocks = events
      .map(toExternalBusyBlock)
      .filter((block): block is NonNullable<typeof block> => block !== null);

    await db.transaction(async (tx) => {
      await tx
        .delete(externalCalendarBusyBlocks)
        .where(eq(externalCalendarBusyBlocks.provider, "google"));
      if (blocks.length) {
        await tx.insert(externalCalendarBusyBlocks).values(
          blocks.map((block) => ({
            ...block,
            provider: "google",
            status: "published" as const,
            syncedAt: now,
          })),
        );
      }
      await tx
        .update(calendarSyncRuns)
        .set({
          status: "processed",
          finishedAt: new Date(),
          recordsImported: blocks.length,
          lastError: null,
        })
        .where(eq(calendarSyncRuns.id, run!.id));
    });

    return blocks.length;
  } catch (error) {
    await db
      .update(calendarSyncRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        lastError: error instanceof Error ? error.message.slice(0, 2000) : "Calendar sync failed.",
      })
      .where(eq(calendarSyncRuns.id, run!.id));
    throw error;
  }
};
