import { and, eq, gt, inArray, lt } from "drizzle-orm";
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
  fixedSessionCapacityLockKey,
  recurringSlotCapacityLockKey,
} from "../../shared/db/advisory-lock.js";
import {
  buildAvailableOverrideSlots,
  buildRuleSlots,
  dedupeSlots,
  findBlockingOverride,
  toDateKey,
} from "./availability-slots.service.js";
import { insertSlotHold } from "./slot-holds.repository.js";

export type AtomicSlotHoldInput = {
  offeringId: string;
  offeringSessionId: string | null;
  startsAt: Date;
  endsAt: Date;
  holdDurationMinutes: number;
};

const hasPublishedBusyOverlap = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
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
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: AtomicSlotHoldInput,
  now: Date,
) =>
  insertSlotHold(tx, {
    offeringId: input.offeringId,
    offeringSessionId: input.offeringSessionId,
    slotStartAt: input.startsAt,
    slotEndAt: input.endsAt,
    status: "active",
    expiresAt: new Date(now.getTime() + input.holdDurationMinutes * 60_000),
  });

export const createAtomicSlotHold = async (input: AtomicSlotHoldInput) =>
  db.transaction(async (tx) => {
    if (input.offeringSessionId) {
      await acquireCapacityLock(
        tx,
        fixedSessionCapacityLockKey(input.offeringSessionId),
      );
      const now = new Date();

      const sessionRows = await tx
        .select({
          id: offeringSessions.id,
          offeringId: offeringSessions.offeringId,
          startsAt: offeringSessions.startsAt,
          endsAt: offeringSessions.endsAt,
          capacity: offeringSessions.capacity,
          sessionStatus: offeringSessions.status,
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

      const blockingBookings = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.offeringSessionId, session.id),
            inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
          ),
        );
      const activeHolds = await tx
        .select({ id: bookingSlotHolds.id })
        .from(bookingSlotHolds)
        .where(
          and(
            eq(bookingSlotHolds.offeringSessionId, session.id),
            eq(bookingSlotHolds.status, "active"),
            gt(bookingSlotHolds.expiresAt, now),
          ),
        );
      const busy = await hasPublishedBusyOverlap(tx, input.startsAt, input.endsAt);

      if (busy || blockingBookings.length + activeHolds.length >= session.capacity) {
        return null;
      }

      return insertHold(tx, input, now);
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

    const offeringRows = await tx
      .select({
        id: offerings.id,
        title: offerings.title,
        slug: offerings.slug,
        durationMinutes: offerings.durationMinutes,
        capacity: offerings.capacity,
        status: offerings.status,
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

    const date = toDateKey(input.startsAt);
    const dateValue = new Date(`${date}T00:00:00`);
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
          eq(availabilityOverrides.date, date),
        ),
      );
    const candidates = dedupeSlots([
      ...buildRuleSlots([dateValue], rules),
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

    const blockingBookings = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.offeringId, input.offeringId),
          inArray(bookings.status, ["pending_payment", "confirmed", "rescheduled"]),
          lt(bookings.slotStartAt, input.endsAt),
          gt(bookings.slotEndAt, input.startsAt),
        ),
      );
    const activeHolds = await tx
      .select({ id: bookingSlotHolds.id })
      .from(bookingSlotHolds)
      .where(
        and(
          eq(bookingSlotHolds.offeringId, input.offeringId),
          eq(bookingSlotHolds.status, "active"),
          gt(bookingSlotHolds.expiresAt, now),
          lt(bookingSlotHolds.slotStartAt, input.endsAt),
          gt(bookingSlotHolds.slotEndAt, input.startsAt),
        ),
      );
    const busy = await hasPublishedBusyOverlap(tx, input.startsAt, input.endsAt);

    if (busy || blockingBookings.length + activeHolds.length >= offering.capacity) {
      return null;
    }

    return insertHold(tx, input, now);
  });
