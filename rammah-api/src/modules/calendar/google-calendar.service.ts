import crypto from "node:crypto";
import { google, type calendar_v3 } from "googleapis";
import { env, frontendOrigins } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { logger } from "../../shared/logger/logger.js";
import { decryptSecret, encryptSecret } from "../../shared/crypto/secret-box.js";
import {
  ensurePendingCalendarEvent,
  findCalendarEventByBookingId,
  findConfirmedBookingForCalendarSync,
  findGoogleCalendarConnection,
  markCalendarEventCreated,
  markCalendarEventCancelled,
  markCalendarEventFailed,
  markCalendarEventPending,
  markCalendarEventUpdated,
  markGoogleCalendarConnectionError,
  updateGoogleCalendarConnectionSettings,
  updateGoogleCalendarConnectionTokens,
  upsertGoogleCalendarConnection,
} from "./google-calendar.repository.js";

const googleCalendarScope = "https://www.googleapis.com/auth/calendar.events";
const stateMaxAgeMs = 10 * 60 * 1000;

const getGoogleCalendarClientId = () =>
  env.GOOGLE_CALENDAR_CLIENT_ID ?? env.GOOGLE_CLIENT_ID;

const getGoogleCalendarClientSecret = () =>
  env.GOOGLE_CALENDAR_CLIENT_SECRET ?? env.GOOGLE_CLIENT_SECRET;

const isGoogleCalendarConfigured = () =>
  Boolean(
    getGoogleCalendarClientId() &&
      getGoogleCalendarClientSecret() &&
      env.GOOGLE_CALENDAR_REDIRECT_URI,
  );

const assertGoogleCalendarConfigured = () => {
  if (!isGoogleCalendarConfigured()) {
    throw new AppError({
      code: "CONFIGURATION_ERROR",
      message: "Google Calendar OAuth is not configured.",
      statusCode: httpStatus.internalServerError,
      expose: false,
    });
  }
};

const createOAuthClient = () => {
  assertGoogleCalendarConfigured();

  return new google.auth.OAuth2(
    getGoogleCalendarClientId(),
    getGoogleCalendarClientSecret(),
    env.GOOGLE_CALENDAR_REDIRECT_URI,
  );
};

const createState = (adminUserId: string) => {
  const body = Buffer.from(
    JSON.stringify({
      adminUserId,
      issuedAt: Date.now(),
      nonce: crypto.randomUUID(),
    }),
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", env.ADMIN_SESSION_SECRET)
    .update(body)
    .digest("base64url");

  return `${body}.${signature}`;
};

const verifyState = (state: string, adminUserId: string) => {
  const [body, signature] = state.split(".");

  if (!body || !signature) return false;

  const expected = crypto
    .createHmac("sha256", env.ADMIN_SESSION_SECRET)
    .update(body)
    .digest("base64url");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return false;
  }

  let payload: {
    adminUserId?: string;
    issuedAt?: number;
  };

  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      adminUserId?: string;
      issuedAt?: number;
    };
  } catch {
    return false;
  }

  return (
    payload.adminUserId === adminUserId &&
    typeof payload.issuedAt === "number" &&
    Date.now() - payload.issuedAt <= stateMaxAgeMs
  );
};

const toIsoStringOrNull = (value: Date | null | undefined) =>
  value ? value.toISOString() : null;

const toCalendarEventPayload = (event: Awaited<ReturnType<typeof findCalendarEventByBookingId>>) =>
  event
    ? {
        id: event.id,
        bookingId: event.bookingId,
        provider: event.provider,
        externalEventId: event.externalEventId,
        meetUrl: event.meetUrl,
        status: event.status,
        lastError: event.lastError,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      }
    : null;

const serializeError = (error: unknown) => {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) return error.message;
  return "Google Calendar sync failed.";
};

export const getGoogleCalendarIntegrationStatus = async () => {
  const connection = await findGoogleCalendarConnection();

  return {
    configured: isGoogleCalendarConfigured(),
    connected: Boolean(connection?.status === "connected" && connection.refreshTokenEncrypted),
    calendarId: connection?.calendarId ?? env.GOOGLE_CALENDAR_DEFAULT_CALENDAR_ID,
    connectedEmail: connection?.connectedEmail ?? null,
    status: connection?.status ?? "disconnected",
    lastError: connection?.lastError ?? null,
    tokenExpiresAt: toIsoStringOrNull(connection?.expiryDate),
    updatedAt: toIsoStringOrNull(connection?.updatedAt),
  };
};

export const getGoogleCalendarConnectUrl = (adminUserId: string) => {
  const oauthClient = createOAuthClient();

  return oauthClient.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [googleCalendarScope],
    state: createState(adminUserId),
  });
};

export const completeGoogleCalendarOAuth = async (input: {
  code: string;
  state: string;
  adminUserId: string;
}) => {
  if (!verifyState(input.state, input.adminUserId)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Google Calendar OAuth state is invalid or expired.",
      statusCode: httpStatus.badRequest,
    });
  }

  const oauthClient = createOAuthClient();
  const existingConnection = await findGoogleCalendarConnection();
  const { tokens } = await oauthClient.getToken(input.code);
  const existingRefreshToken = existingConnection?.refreshTokenEncrypted
    ? decryptSecret(existingConnection.refreshTokenEncrypted)
    : null;
  const refreshToken = tokens.refresh_token ?? existingRefreshToken;

  if (!refreshToken) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Google did not return a refresh token. Revoke access and connect again.",
      statusCode: httpStatus.badRequest,
    });
  }

  const connection = await upsertGoogleCalendarConnection({
    calendarId:
      existingConnection?.calendarId || env.GOOGLE_CALENDAR_DEFAULT_CALENDAR_ID || "primary",
    accessTokenEncrypted: tokens.access_token ? encryptSecret(tokens.access_token) : null,
    refreshTokenEncrypted: encryptSecret(refreshToken),
    tokenType: tokens.token_type ?? null,
    scope: Array.isArray(tokens.scope) ? tokens.scope.join(" ") : tokens.scope ?? googleCalendarScope,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    connectedEmail: existingConnection?.connectedEmail ?? null,
    status: "connected",
    lastError: null,
  });

  return {
    connected: true,
    calendarId: connection?.calendarId ?? "primary",
  };
};

export const updateGoogleCalendarSettings = async (input: { calendarId: string }) => {
  const calendarId = input.calendarId.trim() || "primary";
  const existingConnection = await findGoogleCalendarConnection();
  const connection = existingConnection
    ? await updateGoogleCalendarConnectionSettings({ calendarId })
    : await upsertGoogleCalendarConnection({
        calendarId,
        status: "disconnected",
        lastError: null,
      });

  return {
    calendarId: connection?.calendarId ?? calendarId,
    status: connection?.status ?? "disconnected",
  };
};

const persistRefreshedTokens = async (
  tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    token_type?: string | null;
    scope?: string | null;
    expiry_date?: number | null;
  },
  existingRefreshTokenEncrypted: string | null,
) => {
  await updateGoogleCalendarConnectionTokens({
    accessTokenEncrypted: tokens.access_token ? encryptSecret(tokens.access_token) : undefined,
    refreshTokenEncrypted: tokens.refresh_token
      ? encryptSecret(tokens.refresh_token)
      : existingRefreshTokenEncrypted ?? undefined,
    tokenType: tokens.token_type ?? undefined,
    scope: tokens.scope ?? undefined,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
  });
};

export const getAuthorizedCalendarClient = async () => {
  const connection = await findGoogleCalendarConnection();

  if (!connection?.refreshTokenEncrypted || connection.status !== "connected") {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Google Calendar is not connected.",
      statusCode: httpStatus.badRequest,
    });
  }

  const oauthClient = createOAuthClient();
  oauthClient.setCredentials({
    access_token: connection.accessTokenEncrypted
      ? decryptSecret(connection.accessTokenEncrypted)
      : undefined,
    refresh_token: decryptSecret(connection.refreshTokenEncrypted),
    expiry_date: connection.expiryDate?.getTime(),
    token_type: connection.tokenType ?? undefined,
    scope: connection.scope ?? undefined,
  });
  oauthClient.on("tokens", (tokens) => {
    void persistRefreshedTokens(tokens, connection.refreshTokenEncrypted).catch((error: unknown) => {
      logger.warn("Could not persist refreshed Google Calendar token.", {
        error: serializeError(error),
      });
    });
  });

  return {
    calendar: google.calendar({ version: "v3", auth: oauthClient }),
    calendarId: connection.calendarId || env.GOOGLE_CALENDAR_DEFAULT_CALENDAR_ID || "primary",
  };
};

const deterministicGoogleEventId = (bookingId: string) =>
  `r${crypto.createHash("sha256").update(bookingId).digest("hex").slice(0, 32)}`;

const extractMeetUrl = (event: calendar_v3.Schema$Event) =>
  event.hangoutLink ??
  event.conferenceData?.entryPoints?.find((entryPoint) => entryPoint.entryPointType === "video")
    ?.uri ??
  null;

const isGoogleConflict = (error: unknown) => {
  const maybeError = error as { code?: number; response?: { status?: number } };
  return maybeError?.code === 409 || maybeError?.response?.status === 409;
};

const isGoogleNotFound = (error: unknown) => {
  const maybeError = error as { code?: number; response?: { status?: number } };
  return maybeError?.code === 404 || maybeError?.response?.status === 404;
};

const buildEventDescription = (booking: Awaited<ReturnType<typeof findConfirmedBookingForCalendarSync>>) => {
  if (!booking) return "";

  return [
    `Booking reference: ${booking.bookingReference}`,
    `Customer: ${booking.customerFullName}`,
    `Email: ${booking.customerEmail}`,
    booking.customerPhone ? `Phone: ${booking.customerPhone}` : null,
    `Source: Rammah booking system`,
  ]
    .filter(Boolean)
    .join("\n");
};

const isSyncedCalendarEvent = (
  event: Awaited<ReturnType<typeof findCalendarEventByBookingId>>,
) => Boolean(event?.externalEventId && ["created", "updated"].includes(event.status));

const buildCalendarEventBody = (
  booking: NonNullable<Awaited<ReturnType<typeof findConfirmedBookingForCalendarSync>>>,
  eventId: string,
  includeConference: boolean,
): calendar_v3.Schema$Event => ({
  id: eventId,
  summary: `${booking.offeringTitle} - ${booking.customerFullName}`,
  description: buildEventDescription(booking),
  start: {
    dateTime: booking.slotStartAt?.toISOString(),
    timeZone: booking.timezone,
  },
  end: {
    dateTime: booking.slotEndAt?.toISOString(),
    timeZone: booking.timezone,
  },
  ...(includeConference
    ? {
        conferenceData: {
          createRequest: {
            requestId: `meet-${eventId}`,
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        },
      }
    : {}),
  extendedProperties: {
    private: {
      source: "rammah",
      bookingId: booking.id,
      publicToken: booking.publicToken,
    },
  },
});

export const ensureGoogleCalendarEventForBooking = async (
  bookingId: string,
  options: { forceRetry?: boolean } = {},
) => {
  const existingEvent = await findCalendarEventByBookingId(bookingId);

  if (!options.forceRetry && isSyncedCalendarEvent(existingEvent)) {
    return toCalendarEventPayload(existingEvent);
  }

  const booking = await findConfirmedBookingForCalendarSync(bookingId);

  if (!booking || booking.status !== "confirmed") {
    return toCalendarEventPayload(existingEvent);
  }

  const pendingEvent = options.forceRetry
    ? await markCalendarEventPending(bookingId)
    : await ensurePendingCalendarEvent(bookingId);

  if (pendingEvent?.status === "created" && pendingEvent.externalEventId) {
    return toCalendarEventPayload(pendingEvent);
  }

  if (!booking.slotStartAt || !booking.slotEndAt) {
    const failedEvent = await markCalendarEventFailed({
      bookingId,
      lastError: "Booking does not have a scheduled slot.",
    });
    return toCalendarEventPayload(failedEvent);
  }

  try {
    const { calendar, calendarId } = await getAuthorizedCalendarClient();
    const eventId = deterministicGoogleEventId(booking.id);
    const requestBody = buildCalendarEventBody(booking, eventId, true);

    const response = await calendar.events
      .insert({
        calendarId,
        conferenceDataVersion: 1,
        requestBody,
      })
      .catch(async (error: unknown) => {
        if (!isGoogleConflict(error)) {
          throw error;
        }

        return calendar.events.get({
          calendarId,
          eventId,
        });
      });
    const event = response.data;
    const createdEvent = await markCalendarEventCreated({
      bookingId,
      externalEventId: event.id ?? eventId,
      meetUrl: extractMeetUrl(event),
    });

    return toCalendarEventPayload(createdEvent);
  } catch (error) {
    const message = serializeError(error);
    await markGoogleCalendarConnectionError(message).catch(() => null);
    const failedEvent = await markCalendarEventFailed({
      bookingId,
      lastError: message,
    });

    logger.warn("Google Calendar event sync failed.", {
      bookingId,
      error: message,
    });

    return toCalendarEventPayload(failedEvent);
  }
};

export const updateGoogleCalendarEventForBooking = async (bookingId: string) => {
  const existingEvent = await findCalendarEventByBookingId(bookingId);
  const booking = await findConfirmedBookingForCalendarSync(bookingId);

  if (!booking || booking.status !== "confirmed") {
    return toCalendarEventPayload(existingEvent);
  }

  if (!booking.slotStartAt || !booking.slotEndAt) {
    const failedEvent = await markCalendarEventFailed({
      bookingId,
      lastError: "Booking does not have a scheduled slot.",
    });
    return toCalendarEventPayload(failedEvent);
  }

  if (!existingEvent?.externalEventId) {
    return ensureGoogleCalendarEventForBooking(bookingId, { forceRetry: true });
  }

  await markCalendarEventPending(bookingId);

  try {
    const { calendar, calendarId } = await getAuthorizedCalendarClient();
    const eventId = existingEvent.externalEventId;
    const response = await calendar.events.patch({
      calendarId,
      conferenceDataVersion: 1,
      eventId,
      requestBody: buildCalendarEventBody(booking, eventId, false),
    });
    const event = response.data;
    const updatedEvent = await markCalendarEventUpdated({
      bookingId,
      externalEventId: event.id ?? eventId,
      meetUrl: extractMeetUrl(event) ?? existingEvent.meetUrl,
    });

    return toCalendarEventPayload(updatedEvent);
  } catch (error) {
    if (isGoogleNotFound(error)) {
      return ensureGoogleCalendarEventForBooking(bookingId, { forceRetry: true });
    }

    const message = serializeError(error);
    await markGoogleCalendarConnectionError(message).catch(() => null);
    const failedEvent = await markCalendarEventFailed({
      bookingId,
      lastError: message,
    });

    logger.warn("Google Calendar event update failed.", {
      bookingId,
      error: message,
    });

    return toCalendarEventPayload(failedEvent);
  }
};

export const cancelGoogleCalendarEventForBooking = async (bookingId: string) => {
  const existingEvent = await findCalendarEventByBookingId(bookingId);

  if (!existingEvent || existingEvent.status === "cancelled") {
    return toCalendarEventPayload(existingEvent);
  }

  if (!existingEvent.externalEventId) {
    const cancelledEvent = await markCalendarEventCancelled(bookingId);
    return toCalendarEventPayload(cancelledEvent);
  }

  try {
    const { calendar, calendarId } = await getAuthorizedCalendarClient();

    await calendar.events.delete({
      calendarId,
      eventId: existingEvent.externalEventId,
    });

    const cancelledEvent = await markCalendarEventCancelled(bookingId);
    return toCalendarEventPayload(cancelledEvent);
  } catch (error) {
    if (isGoogleNotFound(error)) {
      const cancelledEvent = await markCalendarEventCancelled(bookingId);
      return toCalendarEventPayload(cancelledEvent);
    }

    const message = serializeError(error);
    await markGoogleCalendarConnectionError(message).catch(() => null);
    const failedEvent = await markCalendarEventFailed({
      bookingId,
      lastError: message,
    });

    logger.warn("Google Calendar event cancellation failed.", {
      bookingId,
      error: message,
    });

    return toCalendarEventPayload(failedEvent);
  }
};

export const buildGoogleCalendarCallbackRedirectUrl = (status: "connected" | "failed") => {
  const url = new URL("/admin/integrations", frontendOrigins[0] ?? env.FRONTEND_ORIGIN);
  url.searchParams.set("googleCalendar", status);

  return url.toString();
};
