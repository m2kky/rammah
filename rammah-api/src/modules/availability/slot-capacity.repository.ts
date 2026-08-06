import { and, asc, eq, gt, inArray, lt, ne, type SQL } from "drizzle-orm";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import {
  availabilityWindows,
  bookingSlotHolds,
  bookings,
  externalCalendarBusyBlocks,
  globalAvailabilityOverrides,
  offeringSessions,
  offerings,
  scheduledProgramOccurrences,
  scheduledPrograms,
  siteSettings,
} from "../../db/schema/index.js";
import {
  acquireCapacityLock,
  acquireCapacityLocks,
  bookingScheduleLockKeys,
  fixedSessionCapacityLockKey,
  recurringSlotCapacityLockKey,
  scheduledProgramCapacityLockKey,
} from "../../shared/db/advisory-lock.js";
import {
  instantToDateKey,
  localDayRangeForInstant,
} from "../../shared/datetime/iana-wall-time.js";
import {
  buildAvailableOverrideSlots,
  buildWindowSlots,
  dedupeSlots,
  findBlockingOverride,
} from "./availability-slots.service.js";
import { insertSlotHold } from "./slot-holds.repository.js";
import {
  advancePolicyEnforces,
  isEligibleBookingTarget,
  type AdvancePolicyContext,
  type BookingPolicy,
} from "./booking-policy.js";
import { getLockedBookingPolicy } from "./booking-policy.service.js";

export type SlotCapacityInput =
  | {
      offeringId: string;
      offeringSessionId: string | null;
      scheduledProgramId: null;
      startsAt: Date;
      endsAt: Date;
    }
  | {
      offeringId: string;
      offeringSessionId: null;
      scheduledProgramId: string;
      startsAt: null;
      endsAt: null;
    };

export type AtomicSlotHoldInput = SlotCapacityInput & {
  holdDurationMinutes: number;
  holdSecretHash: string;
};
export type CapacityTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type AvailableSlotCapacity = {
  timezone: string | null;
  now: Date;
  sessionLocationId: string | null;
  target:
    | {
        kind: "appointment";
        scheduledProgramId: null;
        startsAt: Date;
        endsAt: Date;
        timezone: string;
      }
    | {
        kind: "scheduled_program";
        scheduledProgramId: string;
        startsAt: Date;
        endsAt: Date;
        timezone: string;
      };
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

type AppointmentCapacityInput = Extract<
  SlotCapacityInput,
  { scheduledProgramId: null }
>;

const scheduleGroupKey = (input: Pick<
  AppointmentCapacityInput,
  "offeringId" | "offeringSessionId" | "startsAt" | "endsAt"
>) =>
  input.offeringSessionId
    ? `session:${input.offeringSessionId}`
    : `slot:${input.offeringId}:${input.startsAt.toISOString()}:${input.endsAt.toISOString()}`;

const hasGlobalScheduleConflict = async (
  tx: CapacityTransaction,
  input: AppointmentCapacityInput,
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
  const bookingRows = await tx
    .select({
      offeringId: bookings.offeringId,
      offeringSessionId: bookings.offeringSessionId,
      startsAt: bookings.slotStartAt,
      endsAt: bookings.slotEndAt,
    })
    .from(bookings)
    .where(and(...bookingConditions));
  const holdRows = await tx
    .select({
      offeringId: bookingSlotHolds.offeringId,
      offeringSessionId: bookingSlotHolds.offeringSessionId,
      startsAt: bookingSlotHolds.slotStartAt,
      endsAt: bookingSlotHolds.slotEndAt,
    })
    .from(bookingSlotHolds)
    .where(and(...holdConditions));
  const programBookingConditions: SQL[] = [
    inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
    eq(scheduledProgramOccurrences.status, "scheduled"),
    lt(scheduledProgramOccurrences.startsAt, input.endsAt),
    gt(scheduledProgramOccurrences.endsAt, input.startsAt),
  ];
  const programHoldConditions: SQL[] = [
    eq(bookingSlotHolds.status, "active"),
    gt(bookingSlotHolds.expiresAt, now),
    eq(scheduledProgramOccurrences.status, "scheduled"),
    lt(scheduledProgramOccurrences.startsAt, input.endsAt),
    gt(scheduledProgramOccurrences.endsAt, input.startsAt),
  ];
  if (options.excludeBookingId) {
    programBookingConditions.push(ne(bookings.id, options.excludeBookingId));
  }
  if (options.excludeHoldId) {
    programHoldConditions.push(ne(bookingSlotHolds.id, options.excludeHoldId));
  }
  const programBookingRows = await tx
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(
      scheduledProgramOccurrences,
      eq(scheduledProgramOccurrences.scheduledProgramId, bookings.scheduledProgramId),
    )
    .where(and(...programBookingConditions))
    .limit(1);
  const programHoldRows = await tx
    .select({ id: bookingSlotHolds.id })
    .from(bookingSlotHolds)
    .innerJoin(
      scheduledProgramOccurrences,
      eq(
        scheduledProgramOccurrences.scheduledProgramId,
        bookingSlotHolds.scheduledProgramId,
      ),
    )
    .where(and(...programHoldConditions))
    .limit(1);
  const publishedProgramRows = await tx
    .select({ id: scheduledProgramOccurrences.id })
    .from(scheduledProgramOccurrences)
    .innerJoin(
      scheduledPrograms,
      eq(scheduledProgramOccurrences.scheduledProgramId, scheduledPrograms.id),
    )
    .where(
      and(
        eq(scheduledPrograms.status, "published"),
        eq(scheduledProgramOccurrences.status, "scheduled"),
        lt(scheduledProgramOccurrences.startsAt, input.endsAt),
        gt(scheduledProgramOccurrences.endsAt, input.startsAt),
      ),
    )
    .limit(1);
  const targetKey = scheduleGroupKey(input);

  return (
    publishedProgramRows.length > 0 ||
    programBookingRows.length > 0 ||
    programHoldRows.length > 0 ||
    [...bookingRows, ...holdRows].some(
      (row) =>
        row.startsAt &&
        row.endsAt &&
        scheduleGroupKey({
          offeringId: row.offeringId,
          offeringSessionId: row.offeringSessionId,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
        }) !== targetKey,
    )
  );
};

const exceedsDailyScheduleLimit = async (
  tx: CapacityTransaction,
  input: AppointmentCapacityInput,
  now: Date,
  options: { excludeBookingId?: string; excludeHoldId?: string },
  timezone: string,
  targetScheduledProgramId?: string,
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
  const bookingRows = await tx
    .select({
      offeringId: bookings.offeringId,
      offeringSessionId: bookings.offeringSessionId,
      startsAt: bookings.slotStartAt,
      endsAt: bookings.slotEndAt,
    })
    .from(bookings)
    .where(and(...bookingConditions));
  const holdRows = await tx
    .select({
      offeringId: bookingSlotHolds.offeringId,
      offeringSessionId: bookingSlotHolds.offeringSessionId,
      startsAt: bookingSlotHolds.slotStartAt,
      endsAt: bookingSlotHolds.slotEndAt,
    })
    .from(bookingSlotHolds)
    .where(and(...holdConditions));
  const programBookingConditions: SQL[] = [
    inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
    eq(scheduledProgramOccurrences.status, "scheduled"),
    gt(scheduledProgramOccurrences.startsAt, new Date(dayStart.getTime() - 1)),
    lt(scheduledProgramOccurrences.startsAt, dayEnd),
  ];
  const programHoldConditions: SQL[] = [
    eq(bookingSlotHolds.status, "active"),
    gt(bookingSlotHolds.expiresAt, now),
    eq(scheduledProgramOccurrences.status, "scheduled"),
    gt(scheduledProgramOccurrences.startsAt, new Date(dayStart.getTime() - 1)),
    lt(scheduledProgramOccurrences.startsAt, dayEnd),
  ];
  if (options.excludeBookingId) {
    programBookingConditions.push(ne(bookings.id, options.excludeBookingId));
  }
  if (options.excludeHoldId) {
    programHoldConditions.push(ne(bookingSlotHolds.id, options.excludeHoldId));
  }
  const programBookingRows = await tx
    .select({ scheduledProgramId: bookings.scheduledProgramId })
    .from(bookings)
    .innerJoin(
      scheduledProgramOccurrences,
      eq(scheduledProgramOccurrences.scheduledProgramId, bookings.scheduledProgramId),
    )
    .where(and(...programBookingConditions));
  const programHoldRows = await tx
    .select({ scheduledProgramId: bookingSlotHolds.scheduledProgramId })
    .from(bookingSlotHolds)
    .innerJoin(
      scheduledProgramOccurrences,
      eq(
        scheduledProgramOccurrences.scheduledProgramId,
        bookingSlotHolds.scheduledProgramId,
      ),
    )
    .where(and(...programHoldConditions));
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
  for (const row of [...programBookingRows, ...programHoldRows]) {
    if (row.scheduledProgramId) {
      groupKeys.add(`program:${row.scheduledProgramId}`);
    }
  }
  const targetKey = targetScheduledProgramId
    ? `program:${targetScheduledProgramId}`
    : scheduleGroupKey(input);

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
    scheduledProgramId: input.scheduledProgramId,
    slotStartAt: input.startsAt,
    slotEndAt: input.endsAt,
    holdSecretHash: input.holdSecretHash,
    status: "active",
    expiresAt: new Date(now.getTime() + input.holdDurationMinutes * 60_000),
  });

const intervalsOverlap = (
  left: { startsAt: Date; endsAt: Date },
  right: { startsAt: Date; endsAt: Date },
) => left.startsAt < right.endsAt && left.endsAt > right.startsAt;

const hasProgramScheduleConflict = async (
  tx: CapacityTransaction,
  input: { scheduledProgramId: string; occurrences: Array<{ startsAt: Date; endsAt: Date }> },
  now: Date,
  options: { excludeBookingId?: string; excludeHoldId?: string },
) => {
  const appointmentBookingConditions: SQL[] = [
    inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
  ];
  const appointmentHoldConditions: SQL[] = [
    eq(bookingSlotHolds.status, "active"),
    gt(bookingSlotHolds.expiresAt, now),
  ];
  const programBookingConditions: SQL[] = [
    inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
    ne(bookings.scheduledProgramId, input.scheduledProgramId),
    eq(scheduledProgramOccurrences.status, "scheduled"),
  ];
  const programHoldConditions: SQL[] = [
    eq(bookingSlotHolds.status, "active"),
    gt(bookingSlotHolds.expiresAt, now),
    ne(bookingSlotHolds.scheduledProgramId, input.scheduledProgramId),
    eq(scheduledProgramOccurrences.status, "scheduled"),
  ];
  if (options.excludeBookingId) {
    appointmentBookingConditions.push(ne(bookings.id, options.excludeBookingId));
    programBookingConditions.push(ne(bookings.id, options.excludeBookingId));
  }
  if (options.excludeHoldId) {
    appointmentHoldConditions.push(ne(bookingSlotHolds.id, options.excludeHoldId));
    programHoldConditions.push(ne(bookingSlotHolds.id, options.excludeHoldId));
  }

  const appointmentBookings = await tx
    .select({ startsAt: bookings.slotStartAt, endsAt: bookings.slotEndAt })
    .from(bookings)
    .where(and(...appointmentBookingConditions));
  const appointmentHolds = await tx
    .select({ startsAt: bookingSlotHolds.slotStartAt, endsAt: bookingSlotHolds.slotEndAt })
    .from(bookingSlotHolds)
    .where(and(...appointmentHoldConditions));
  const programBookings = await tx
    .select({
      startsAt: scheduledProgramOccurrences.startsAt,
      endsAt: scheduledProgramOccurrences.endsAt,
    })
    .from(bookings)
    .innerJoin(
      scheduledProgramOccurrences,
      eq(scheduledProgramOccurrences.scheduledProgramId, bookings.scheduledProgramId),
    )
    .where(and(...programBookingConditions));
  const programHolds = await tx
    .select({
      startsAt: scheduledProgramOccurrences.startsAt,
      endsAt: scheduledProgramOccurrences.endsAt,
    })
    .from(bookingSlotHolds)
    .innerJoin(
      scheduledProgramOccurrences,
      eq(
        scheduledProgramOccurrences.scheduledProgramId,
        bookingSlotHolds.scheduledProgramId,
      ),
    )
    .where(and(...programHoldConditions));
  const publishedPrograms = await tx
    .select({
      startsAt: scheduledProgramOccurrences.startsAt,
      endsAt: scheduledProgramOccurrences.endsAt,
    })
    .from(scheduledProgramOccurrences)
    .innerJoin(
      scheduledPrograms,
      eq(scheduledProgramOccurrences.scheduledProgramId, scheduledPrograms.id),
    )
    .where(
      and(
        eq(scheduledPrograms.status, "published"),
        ne(scheduledPrograms.id, input.scheduledProgramId),
        eq(scheduledProgramOccurrences.status, "scheduled"),
      ),
    );

  const occupied = [
    ...appointmentBookings,
    ...appointmentHolds,
    ...programBookings,
    ...programHolds,
    ...publishedPrograms,
  ].filter(
    (interval): interval is { startsAt: Date; endsAt: Date } =>
      interval.startsAt !== null && interval.endsAt !== null,
  );

  return input.occurrences.some((occurrence) =>
    occupied.some((interval) => intervalsOverlap(occurrence, interval)),
  );
};

const withAvailableProgramCapacity = async <T>(
  tx: CapacityTransaction,
  input: Extract<SlotCapacityInput, { scheduledProgramId: string }>,
  options: { excludeBookingId?: string; excludeHoldId?: string },
  enforceBookingPolicy: boolean,
  mutate: (capacity: AvailableSlotCapacity) => Promise<T>,
): Promise<T | null> => {
  await acquireCapacityLock(
    tx,
    scheduledProgramCapacityLockKey(input.scheduledProgramId),
  );
  const programRows = await tx
    .select({
      id: scheduledPrograms.id,
      offeringId: scheduledPrograms.offeringId,
      timezone: scheduledPrograms.timezone,
      capacity: scheduledPrograms.capacity,
      locationId: scheduledPrograms.locationId,
      programStatus: scheduledPrograms.status,
      registrationOpensAt: scheduledPrograms.registrationOpensAt,
      registrationClosesAt: scheduledPrograms.registrationClosesAt,
      offeringTitle: offerings.title,
      offeringSlug: offerings.slug,
      offeringAttendanceMode: offerings.attendanceMode,
      offeringBookingMode: offerings.bookingMode,
      offeringRequiresPayment: offerings.requiresPayment,
      offeringQuoteOnly: offerings.quoteOnly,
      offeringSchedulingMode: offerings.schedulingMode,
      offeringStatus: offerings.status,
    })
    .from(scheduledPrograms)
    .innerJoin(offerings, eq(scheduledPrograms.offeringId, offerings.id))
    .where(eq(scheduledPrograms.id, input.scheduledProgramId))
    .for("update", { of: scheduledPrograms })
    .limit(1);
  const program = programRows[0];
  const occurrences = await tx
    .select({
      startsAt: scheduledProgramOccurrences.startsAt,
      endsAt: scheduledProgramOccurrences.endsAt,
    })
    .from(scheduledProgramOccurrences)
    .where(
      and(
        eq(scheduledProgramOccurrences.scheduledProgramId, input.scheduledProgramId),
        eq(scheduledProgramOccurrences.status, "scheduled"),
      ),
    )
    .orderBy(scheduledProgramOccurrences.startsAt);
  const now = new Date();
  const bookingPolicy: BookingPolicy | null = enforceBookingPolicy
    ? await getLockedBookingPolicy(tx, now)
    : null;
  if (
    !program ||
    program.offeringId !== input.offeringId ||
    program.programStatus !== "published" ||
    program.offeringStatus !== "published" ||
    program.offeringSchedulingMode !== "scheduled_program" ||
    program.capacity <= 0 ||
    occurrences.length === 0 ||
    occurrences[0]!.startsAt <= now ||
    (bookingPolicy && !isEligibleBookingTarget(occurrences[0]!.startsAt, bookingPolicy)) ||
    (program.registrationOpensAt && program.registrationOpensAt > now) ||
    (program.registrationClosesAt && program.registrationClosesAt <= now)
  ) {
    return null;
  }

  await acquireCapacityLocks(
    tx,
    occurrences.flatMap((occurrence) => bookingScheduleLockKeys(occurrence)),
  );

  if (
    await hasProgramScheduleConflict(
      tx,
      { scheduledProgramId: program.id, occurrences },
      now,
      options,
    )
  ) {
    return null;
  }
  for (const occurrence of occurrences) {
    if (
      await exceedsDailyScheduleLimit(
        tx,
        {
          offeringId: program.offeringId,
          offeringSessionId: null,
          scheduledProgramId: null,
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
        },
        now,
        options,
        program.timezone,
        program.id,
      )
    ) {
      return null;
    }
    if (await hasPublishedBusyOverlap(tx, occurrence.startsAt, occurrence.endsAt)) {
      return null;
    }
  }

  const bookingConditions: SQL[] = [
    eq(bookings.scheduledProgramId, program.id),
    inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
  ];
  const holdConditions: SQL[] = [
    eq(bookingSlotHolds.scheduledProgramId, program.id),
    eq(bookingSlotHolds.status, "active"),
    gt(bookingSlotHolds.expiresAt, now),
  ];
  if (options.excludeBookingId) {
    bookingConditions.push(ne(bookings.id, options.excludeBookingId));
  }
  if (options.excludeHoldId) {
    holdConditions.push(ne(bookingSlotHolds.id, options.excludeHoldId));
  }
  const blockingBookings = await tx
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(...bookingConditions));
  const activeHolds = await tx
    .select({ id: bookingSlotHolds.id })
    .from(bookingSlotHolds)
    .where(and(...holdConditions));

  if (blockingBookings.length + activeHolds.length >= program.capacity) {
    return null;
  }

  return mutate({
    timezone: program.timezone,
    now,
    sessionLocationId: program.locationId,
    target: {
      kind: "scheduled_program",
      scheduledProgramId: program.id,
      startsAt: occurrences[0]!.startsAt,
      endsAt: occurrences[occurrences.length - 1]!.endsAt,
      timezone: program.timezone,
    },
    offering: {
      id: program.offeringId,
      title: program.offeringTitle,
      slug: program.offeringSlug,
      attendanceMode: program.offeringAttendanceMode,
      bookingMode: program.offeringBookingMode,
      requiresPayment: program.offeringRequiresPayment,
      quoteOnly: program.offeringQuoteOnly,
      status: program.offeringStatus,
    },
  });
};

export const withAvailableSlotCapacity = async <T>(
  tx: CapacityTransaction,
  input: SlotCapacityInput,
  options: {
    policyContext: AdvancePolicyContext;
    excludeBookingId?: string;
    excludeHoldId?: string;
  },
  mutate: (capacity: AvailableSlotCapacity) => Promise<T>,
): Promise<T | null> => {
    const enforceBookingPolicy = advancePolicyEnforces(options.policyContext);
    if (enforceBookingPolicy) {
      await getLockedBookingPolicy(tx, new Date());
    }
    if (input.scheduledProgramId !== null) {
      return withAvailableProgramCapacity(tx, input, options, enforceBookingPolicy, mutate);
    }

    await acquireCapacityLocks(tx, bookingScheduleLockKeys(input));

    if (input.offeringSessionId) {
      await acquireCapacityLock(
        tx,
        fixedSessionCapacityLockKey(input.offeringSessionId),
      );
      const now = new Date();
      const bookingPolicy = enforceBookingPolicy
        ? await getLockedBookingPolicy(tx, now)
        : null;
      if (
        (bookingPolicy && !isEligibleBookingTarget(input.startsAt, bookingPolicy)) ||
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
        target: {
          kind: "appointment",
          scheduledProgramId: null,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          timezone: session.timezone,
        },
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
    const bookingPolicy = enforceBookingPolicy
      ? await getLockedBookingPolicy(tx, now)
      : null;
    if (
      (bookingPolicy && !isEligibleBookingTarget(input.startsAt, bookingPolicy)) ||
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
        bufferBeforeMinutes: offerings.bufferBeforeMinutes,
        bufferAfterMinutes: offerings.bufferAfterMinutes,
        capacity: offerings.capacity,
        status: offerings.status,
        attendanceMode: offerings.attendanceMode,
        bookingMode: offerings.bookingMode,
        requiresPayment: offerings.requiresPayment,
        quoteOnly: offerings.quoteOnly,
        schedulingMode: offerings.schedulingMode,
      })
      .from(offerings)
      .where(eq(offerings.id, input.offeringId))
      .limit(1);
    const offering = offeringRows[0];

    if (
      !offering ||
      offering.status !== "published" ||
      offering.schedulingMode !== "appointment" ||
      offering.capacity <= 0 ||
      input.startsAt <= now
    ) {
      return null;
    }

    const windows = await tx
      .select({
        id: availabilityWindows.id,
        weekday: availabilityWindows.weekday,
        startLocalTime: availabilityWindows.startLocalTime,
        endLocalTime: availabilityWindows.endLocalTime,
        status: availabilityWindows.status,
      })
      .from(availabilityWindows)
      .where(eq(availabilityWindows.status, "published"));
    const timezoneRows = await tx
      .select({ timezone: siteSettings.bookingDefaultTimezone })
      .from(siteSettings)
      .orderBy(asc(siteSettings.createdAt), asc(siteSettings.id))
      .limit(1);
    const timezone = timezoneRows[0]?.timezone ?? "Africa/Cairo";
    const dates = [instantToDateKey(input.startsAt, timezone)];
    const dateValues = dates.map((date) => new Date(`${date}T00:00:00.000Z`));
    const overrides = await tx
      .select({
        id: globalAvailabilityOverrides.id,
        date: globalAvailabilityOverrides.date,
        overrideMode: globalAvailabilityOverrides.overrideMode,
        startLocalTime: globalAvailabilityOverrides.startLocalTime,
        endLocalTime: globalAvailabilityOverrides.endLocalTime,
        reason: globalAvailabilityOverrides.reason,
      })
      .from(globalAvailabilityOverrides)
      .where(inArray(globalAvailabilityOverrides.date, dates));
    const candidates = dedupeSlots([
      ...buildWindowSlots(dateValues, windows, offering, timezone),
      ...buildAvailableOverrideSlots(offering, overrides, timezone),
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
      target: {
        kind: "appointment",
        scheduledProgramId: null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        timezone: target.timezone,
      },
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

export const isScheduledProgramFull = async (
  scheduledProgramId: string,
  now = new Date(),
) => {
  const [programRows, bookingRows, holdRows] = await Promise.all([
    db
      .select({ capacity: scheduledPrograms.capacity })
      .from(scheduledPrograms)
      .where(eq(scheduledPrograms.id, scheduledProgramId))
      .limit(1),
    db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.scheduledProgramId, scheduledProgramId),
          inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
        ),
      ),
    db
      .select({ id: bookingSlotHolds.id })
      .from(bookingSlotHolds)
      .where(
        and(
          eq(bookingSlotHolds.scheduledProgramId, scheduledProgramId),
          eq(bookingSlotHolds.status, "active"),
          gt(bookingSlotHolds.expiresAt, now),
        ),
      ),
  ]);
  const capacity = programRows[0]?.capacity;
  return capacity !== undefined && bookingRows.length + holdRows.length >= capacity;
};

export const createAtomicSlotHold = async (input: AtomicSlotHoldInput) =>
  db.transaction((tx) =>
    withAvailableSlotCapacity(tx, input, { policyContext: "public_hold" }, async ({ now, target }) => {
      const hold = await insertHold(tx, input, now);
      return hold ? { ...hold, target } : null;
    }),
  );
