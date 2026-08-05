import { and, eq, gt, inArray, lt, ne, type SQL } from "drizzle-orm";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import {
  availabilityOverrides,
  availabilityRules,
  bookingSlotHolds,
  bookings,
  externalCalendarBusyBlocks,
  offeringSessions,
  offerings,
} from "../../db/schema/index.js";
import {
  acquireCapacityLock,
  acquireCapacityLocks,
  bookingScheduleLockKeys,
  fixedSessionCapacityLockKey,
  recurringSlotCapacityLockKey,
} from "../../shared/db/advisory-lock.js";
import {
  instantToDateKey,
  localDayRangeForInstant,
} from "../../shared/datetime/iana-wall-time.js";
import {
  buildAvailableOverrideSlots,
  buildRuleSlots,
  dedupeSlots,
  findBlockingOverride,
} from "./availability-slots.service.js";
import { insertSlotHold } from "./slot-holds.repository.js";

export type AtomicSlotHoldInput = {
  offeringId: string;
  offeringSessionId: string | null;
  startsAt: Date;
  endsAt: Date;
  holdDurationMinutes: number;
  holdSecretHash: string;
};

export type SlotCapacityInput = Pick<
  AtomicSlotHoldInput,
  "offeringId" | "offeringSessionId" | "startsAt" | "endsAt"
>;
export type CapacityTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type AvailableSlotCapacity = {
  timezone: string | null;
  now: Date;
  sessionLocationId: string | null;
  offering: {
    id: string;
    title: string;
    slug: string;
    attendanceMode: "online" | "offline" | "hybrid";
    bookingMode: "free" | "paid" | "quote_only";
    requiresPayment: boolean;
    quoteOnly: boolean;
    status: "draft" | "published" | "scheduled" | "archived";
  };
};

export const meetsMinimumNotice = (
  startsAt: Date,
  now: Date,
  minimumMinutes = env.BOOKING_MINIMUM_NOTICE_MINUTES,
) => startsAt.getTime() - now.getTime() >= minimumMinutes * 60_000;

const scheduleGroupKey = (input: {
  offeringId: string;
  offeringSessionId: string | null;
  startsAt: Date;
  endsAt: Date;
}) =>
  input.offeringSessionId
    ? `session:${input.offeringSessionId}`
    : `slot:${input.offeringId}:${input.startsAt.toISOString()}:${input.endsAt.toISOString()}`;

const hasGlobalScheduleConflict = async (
  tx: CapacityTransaction,
  input: SlotCapacityInput,
  now: Date,
  options: { excludeBookingId?: string; excludeHoldId?: string },
) => {
  const bookingConditions: SQL[] = [
    inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
    lt(bookings.slotStartAt, input.endsAt),
    gt(bookings.slotEndAt, input.startsAt),
  ];
  if (options.excludeBookingId) {
    bookingConditions.push(ne(bookings.id, options.excludeBookingId));
  }
  const holdConditions: SQL[] = [
    eq(bookingSlotHolds.status, "active"),
    gt(bookingSlotHolds.expiresAt, now),
    lt(bookingSlotHolds.slotStartAt, input.endsAt),
    gt(bookingSlotHolds.slotEndAt, input.startsAt),
  ];
  if (options.excludeHoldId) {
    holdConditions.push(ne(bookingSlotHolds.id, options.excludeHoldId));
  }
  const [bookingRows, holdRows] = await Promise.all([
    tx
      .select({
        offeringId: bookings.offeringId,
        offeringSessionId: bookings.offeringSessionId,
        startsAt: bookings.slotStartAt,
        endsAt: bookings.slotEndAt,
      })
      .from(bookings)
      .where(and(...bookingConditions)),
    tx
      .select({
        offeringId: bookingSlotHolds.offeringId,
        offeringSessionId: bookingSlotHolds.offeringSessionId,
        startsAt: bookingSlotHolds.slotStartAt,
        endsAt: bookingSlotHolds.slotEndAt,
      })
      .from(bookingSlotHolds)
      .where(and(...holdConditions)),
  ]);
  const targetKey = scheduleGroupKey(input);

  return [...bookingRows, ...holdRows].some(
    (row) =>
      row.startsAt &&
      row.endsAt &&
      scheduleGroupKey({
        offeringId: row.offeringId,
        offeringSessionId: row.offeringSessionId,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
      }) !== targetKey,
  );
};

const exceedsDailyScheduleLimit = async (
  tx: CapacityTransaction,
  input: SlotCapacityInput,
  now: Date,
  options: { excludeBookingId?: string; excludeHoldId?: string },
  timezone: string,
) => {
  const { start: dayStart, end: dayEnd } = localDayRangeForInstant(
    input.startsAt,
    timezone,
  );
  const bookingConditions: SQL[] = [
    inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
    gt(bookings.slotStartAt, new Date(dayStart.getTime() - 1)),
    lt(bookings.slotStartAt, dayEnd),
  ];
  if (options.excludeBookingId) {
    bookingConditions.push(ne(bookings.id, options.excludeBookingId));
  }
  const holdConditions: SQL[] = [
    eq(bookingSlotHolds.status, "active"),
    gt(bookingSlotHolds.expiresAt, now),
    gt(bookingSlotHolds.slotStartAt, new Date(dayStart.getTime() - 1)),
    lt(bookingSlotHolds.slotStartAt, dayEnd),
  ];
  if (options.excludeHoldId) {
    holdConditions.push(ne(bookingSlotHolds.id, options.excludeHoldId));
  }
  const [bookingRows, holdRows] = await Promise.all([
    tx
      .select({
        offeringId: bookings.offeringId,
        offeringSessionId: bookings.offeringSessionId,
        startsAt: bookings.slotStartAt,
        endsAt: bookings.slotEndAt,
      })
      .from(bookings)
      .where(and(...bookingConditions)),
    tx
      .select({
        offeringId: bookingSlotHolds.offeringId,
        offeringSessionId: bookingSlotHolds.offeringSessionId,
        startsAt: bookingSlotHolds.slotStartAt,
        endsAt: bookingSlotHolds.slotEndAt,
      })
      .from(bookingSlotHolds)
      .where(and(...holdConditions)),
  ]);
  const groupKeys = new Set(
    [...bookingRows, ...holdRows]
      .filter((row) => row.startsAt && row.endsAt)
      .map((row) =>
        scheduleGroupKey({
          offeringId: row.offeringId,
          offeringSessionId: row.offeringSessionId,
          startsAt: row.startsAt!,
          endsAt: row.endsAt!,
        }),
      ),
  );
  const targetKey = scheduleGroupKey(input);

  return !groupKeys.has(targetKey) && groupKeys.size >= env.BOOKING_DAILY_LIMIT;
};

const hasPublishedBusyOverlap = async (
  tx: CapacityTransaction,
  startsAt: Date,
  endsAt: Date,
) => {
  const rows = await tx
    .select({ id: externalCalendarBusyBlocks.id })
    .from(externalCalendarBusyBlocks)
    .where(
      and(
        eq(externalCalendarBusyBlocks.status, "published"),
        lt(externalCalendarBusyBlocks.startsAt, endsAt),
        gt(externalCalendarBusyBlocks.endsAt, startsAt),
      ),
    )
    .limit(1);

  return rows.length > 0;
};

const insertHold = async (
  tx: CapacityTransaction,
  input: AtomicSlotHoldInput,
  now: Date,
) =>
  insertSlotHold(tx, {
    offeringId: input.offeringId,
    offeringSessionId: input.offeringSessionId,
    slotStartAt: input.startsAt,
    slotEndAt: input.endsAt,
    holdSecretHash: input.holdSecretHash,
    status: "active",
    expiresAt: new Date(now.getTime() + input.holdDurationMinutes * 60_000),
  });

export const withAvailableSlotCapacity = async <T>(
  tx: CapacityTransaction,
  input: SlotCapacityInput,
  options: { excludeBookingId?: string; excludeHoldId?: string } = {},
  mutate: (capacity: AvailableSlotCapacity) => Promise<T>,
): Promise<T | null> => {
    await acquireCapacityLocks(tx, bookingScheduleLockKeys(input));

    if (input.offeringSessionId) {
      await acquireCapacityLock(
        tx,
        fixedSessionCapacityLockKey(input.offeringSessionId),
      );
      const now = new Date();
      if (
        !meetsMinimumNotice(input.startsAt, now) ||
        (await hasGlobalScheduleConflict(tx, input, now, options))
      ) {
        return null;
      }
      const sessionRows = await tx
        .select({
          id: offeringSessions.id,
          offeringId: offeringSessions.offeringId,
          startsAt: offeringSessions.startsAt,
          endsAt: offeringSessions.endsAt,
          timezone: offeringSessions.timezone,
          capacity: offeringSessions.capacity,
          locationId: offeringSessions.locationId,
          sessionStatus: offeringSessions.status,
          offeringTitle: offerings.title,
          offeringSlug: offerings.slug,
          offeringAttendanceMode: offerings.attendanceMode,
          offeringBookingMode: offerings.bookingMode,
          offeringRequiresPayment: offerings.requiresPayment,
          offeringQuoteOnly: offerings.quoteOnly,
          offeringStatus: offerings.status,
        })
        .from(offeringSessions)
        .innerJoin(offerings, eq(offeringSessions.offeringId, offerings.id))
        .where(eq(offeringSessions.id, input.offeringSessionId))
        .for("update", { of: offeringSessions })
        .limit(1);
      const session = sessionRows[0];

      if (
        !session ||
        session.offeringId !== input.offeringId ||
        session.sessionStatus !== "published" ||
        session.offeringStatus !== "published" ||
        session.startsAt <= now ||
        session.startsAt.getTime() !== input.startsAt.getTime() ||
        session.endsAt.getTime() !== input.endsAt.getTime() ||
        session.capacity <= 0
      ) {
        return null;
      }

      if (await exceedsDailyScheduleLimit(tx, input, now, options, session.timezone)) {
        return null;
      }

      const bookingConditions: SQL[] = [
        eq(bookings.offeringSessionId, session.id),
        inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
      ];
      if (options.excludeBookingId) {
        bookingConditions.push(ne(bookings.id, options.excludeBookingId));
      }
      const blockingBookings = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(...bookingConditions));
      const activeHoldConditions: SQL[] = [
        eq(bookingSlotHolds.offeringSessionId, session.id),
        eq(bookingSlotHolds.status, "active"),
        gt(bookingSlotHolds.expiresAt, now),
      ];
      if (options.excludeHoldId) {
        activeHoldConditions.push(ne(bookingSlotHolds.id, options.excludeHoldId));
      }
      const activeHolds = await tx
        .select({ id: bookingSlotHolds.id })
        .from(bookingSlotHolds)
        .where(and(...activeHoldConditions));
      const busy = await hasPublishedBusyOverlap(tx, input.startsAt, input.endsAt);

      if (busy || blockingBookings.length + activeHolds.length >= session.capacity) {
        return null;
      }

      return mutate({
        timezone: session.timezone,
        now,
        sessionLocationId: session.locationId,
        offering: {
          id: session.offeringId,
          title: session.offeringTitle,
          slug: session.offeringSlug,
          attendanceMode: session.offeringAttendanceMode,
          bookingMode: session.offeringBookingMode,
          requiresPayment: session.offeringRequiresPayment,
          quoteOnly: session.offeringQuoteOnly,
          status: session.offeringStatus,
        },
      });
    }

    await acquireCapacityLock(
      tx,
      recurringSlotCapacityLockKey({
        offeringId: input.offeringId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      }),
    );
    const now = new Date();
    if (
      !meetsMinimumNotice(input.startsAt, now) ||
      (await hasGlobalScheduleConflict(tx, input, now, options))
    ) {
      return null;
    }
    const offeringRows = await tx
      .select({
        id: offerings.id,
        title: offerings.title,
        slug: offerings.slug,
        durationMinutes: offerings.durationMinutes,
        capacity: offerings.capacity,
        status: offerings.status,
        attendanceMode: offerings.attendanceMode,
        bookingMode: offerings.bookingMode,
        requiresPayment: offerings.requiresPayment,
        quoteOnly: offerings.quoteOnly,
      })
      .from(offerings)
      .where(eq(offerings.id, input.offeringId))
      .limit(1);
    const offering = offeringRows[0];

    if (
      !offering ||
      offering.status !== "published" ||
      offering.capacity <= 0 ||
      input.startsAt <= now
    ) {
      return null;
    }

    const rules = await tx
      .select({
        id: availabilityRules.id,
        offeringId: availabilityRules.offeringId,
        weekday: availabilityRules.weekday,
        startTime: availabilityRules.startTime,
        endTime: availabilityRules.endTime,
        timezone: availabilityRules.timezone,
        slotDurationMinutes: availabilityRules.slotDurationMinutes,
        bufferBeforeMinutes: availabilityRules.bufferBeforeMinutes,
        bufferAfterMinutes: availabilityRules.bufferAfterMinutes,
        status: availabilityRules.status,
      })
      .from(availabilityRules)
      .where(
        and(
          eq(availabilityRules.offeringId, input.offeringId),
          eq(availabilityRules.status, "published"),
        ),
      );
    const timezoneCandidates = new Set(rules.map((rule) => rule.timezone));
    if (timezoneCandidates.size === 0) {
      timezoneCandidates.add("Africa/Cairo");
    }
    const dates = [...timezoneCandidates]
      .map((timezone) => instantToDateKey(input.startsAt, timezone))
      .filter((date, index, values) => values.indexOf(date) === index);
    const dateValues = dates.map((date) => new Date(`${date}T00:00:00.000Z`));
    const overrides = await tx
      .select({
        id: availabilityOverrides.id,
        availabilityRuleId: availabilityOverrides.availabilityRuleId,
        offeringId: availabilityOverrides.offeringId,
        date: availabilityOverrides.date,
        overrideType: availabilityOverrides.overrideType,
        startsAt: availabilityOverrides.startsAt,
        endsAt: availabilityOverrides.endsAt,
        reason: availabilityOverrides.reason,
        ruleWeekday: availabilityRules.weekday,
        ruleTimezone: availabilityRules.timezone,
        ruleSlotDurationMinutes: availabilityRules.slotDurationMinutes,
        ruleBufferBeforeMinutes: availabilityRules.bufferBeforeMinutes,
        ruleBufferAfterMinutes: availabilityRules.bufferAfterMinutes,
      })
      .from(availabilityOverrides)
      .leftJoin(
        availabilityRules,
        eq(availabilityOverrides.availabilityRuleId, availabilityRules.id),
      )
      .where(
        and(
          eq(availabilityOverrides.offeringId, input.offeringId),
          inArray(availabilityOverrides.date, dates),
        ),
      );
    const candidates = dedupeSlots([
      ...buildRuleSlots(dateValues, rules),
      ...buildAvailableOverrideSlots(offering, overrides),
    ]);
    const target = candidates.find(
      (candidate) =>
        candidate.startsAt.getTime() === input.startsAt.getTime() &&
        candidate.endsAt.getTime() === input.endsAt.getTime(),
    );

    if (!target || findBlockingOverride(target, overrides)) {
      return null;
    }

    if (await exceedsDailyScheduleLimit(tx, input, now, options, target.timezone)) {
      return null;
    }

    const bookingConditions: SQL[] = [
      eq(bookings.offeringId, input.offeringId),
      inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
      lt(bookings.slotStartAt, input.endsAt),
      gt(bookings.slotEndAt, input.startsAt),
    ];
    if (options.excludeBookingId) {
      bookingConditions.push(ne(bookings.id, options.excludeBookingId));
    }
    const blockingBookings = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(...bookingConditions));
    const activeHoldConditions: SQL[] = [
      eq(bookingSlotHolds.offeringId, input.offeringId),
      eq(bookingSlotHolds.status, "active"),
      gt(bookingSlotHolds.expiresAt, now),
      lt(bookingSlotHolds.slotStartAt, input.endsAt),
      gt(bookingSlotHolds.slotEndAt, input.startsAt),
    ];
    if (options.excludeHoldId) {
      activeHoldConditions.push(ne(bookingSlotHolds.id, options.excludeHoldId));
    }
    const activeHolds = await tx
      .select({ id: bookingSlotHolds.id })
      .from(bookingSlotHolds)
      .where(and(...activeHoldConditions));
    const busy = await hasPublishedBusyOverlap(tx, input.startsAt, input.endsAt);

    if (busy || blockingBookings.length + activeHolds.length >= offering.capacity) {
      return null;
    }

    return mutate({
      timezone: target.timezone,
      now,
      sessionLocationId: null,
      offering: {
        id: offering.id,
        title: offering.title,
        slug: offering.slug,
        attendanceMode: offering.attendanceMode,
        bookingMode: offering.bookingMode,
        requiresPayment: offering.requiresPayment,
        quoteOnly: offering.quoteOnly,
        status: offering.status,
      },
    });
};

export const createAtomicSlotHold = async (input: AtomicSlotHoldInput) =>
  db.transaction((tx) =>
    withAvailableSlotCapacity(tx, input, {}, ({ now }) => insertHold(tx, input, now)),
  );
