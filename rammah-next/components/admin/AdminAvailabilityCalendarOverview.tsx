"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAdminAvailabilitySlotPreview,
  fetchAdminOfferings,
  type AdminAvailabilitySlot,
  type AdminAvailabilitySlotPreview,
  type AdminOffering,
} from "@/lib/api/admin";

type CalendarSlot = AdminAvailabilitySlot & {
  offering: AdminAvailabilitySlotPreview["offering"];
};

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const padNumber = (value: number) => String(value).padStart(2, "0");

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const formatDayNumber = (date: Date) =>
  new Intl.DateTimeFormat("en", {
    day: "2-digit",
  }).format(date);

const formatMonth = (date: Date) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
  }).format(date);

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
};

const slotStatusStyles: Record<CalendarSlot["status"], string> = {
  available: "border-[#0F3B46] text-[#102329]/65",
  blocked: "border-red-700 text-red-700",
  booked: "border-[#8A6F2A] text-[#8A6F2A]",
  held: "border-[#102329]/35 text-[#102329]/55",
};

const slotStatusLabels: Record<CalendarSlot["status"], string> = {
  available: "Available",
  blocked: "Blocked",
  booked: "Booked",
  held: "Held",
};

const getSlotLabel = (slot: CalendarSlot, showOffering: boolean) => {
  const prefix = showOffering ? `${slot.offering.title}: ` : "";
  const range = `${formatTime(slot.startsAt)}-${formatTime(slot.endsAt)}`;

  return `${prefix}${range}`;
};

export default function AdminAvailabilityCalendarOverview() {
  const [offerings, setOfferings] = useState<AdminOffering[]>([]);
  const [previews, setPreviews] = useState<AdminAvailabilitySlotPreview[]>([]);
  const [offeringFilter, setOfferingFilter] = useState<string | "all">("all");
  const [daysCount, setDaysCount] = useState("14");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const dateRange = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const days = Number(daysCount);
    const end = addDays(start, Math.max(days - 1, 0));

    return {
      start,
      dateFrom: toDateKey(start),
      dateTo: toDateKey(end),
    };
  }, [daysCount]);

  const visibleOfferings = useMemo(
    () =>
      offerings.filter(
        (offering) =>
          offering.status !== "archived" &&
          (offeringFilter === "all" || offering.id === offeringFilter),
      ),
    [offeringFilter, offerings],
  );

  const days = useMemo(
    () =>
      Array.from({ length: Number(daysCount) }, (_, index) => {
        const date = addDays(dateRange.start, index);
        const dateKey = toDateKey(date);
        const slots = previews.flatMap((preview) => {
          const day = preview.days.find((previewDay) => previewDay.date === dateKey);

          if (!day) return [];

          return day.slots.map((slot) => ({
            ...slot,
            offering: preview.offering,
          }));
        });

        return {
          date,
          dateKey,
          slots: slots.sort(
            (left, right) =>
              new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime() ||
              left.offering.title.localeCompare(right.offering.title),
          ),
          availableCount: slots.filter((slot) => slot.status === "available").length,
          totalCount: slots.length,
        };
      }),
    [dateRange.start, daysCount, previews],
  );

  const totals = useMemo(
    () =>
      previews.reduce(
        (acc, preview) => ({
          available: acc.available + preview.availableCount,
          total: acc.total + preview.totalCount,
        }),
        { available: 0, total: 0 },
      ),
    [previews],
  );

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const nextOfferings = await fetchAdminOfferings({ status: "all" });
      const previewOfferings = nextOfferings.filter(
        (offering) =>
          offering.status !== "archived" &&
          (offeringFilter === "all" || offering.id === offeringFilter),
      );
      const nextPreviews = await Promise.all(
        previewOfferings.map((offering) =>
          fetchAdminAvailabilitySlotPreview({
            offeringId: offering.id,
            dateFrom: dateRange.dateFrom,
            dateTo: dateRange.dateTo,
          }),
        ),
      );

      setOfferings(nextOfferings);
      setPreviews(nextPreviews);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load overview.");
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.dateFrom, dateRange.dateTo, offeringFilter]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const showOffering = offeringFilter === "all";

  return (
    <section className="space-y-7 border-t border-[#102329]/12 pt-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
            Calendar
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
            Availability overview
          </h2>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Calculated slot preview from weekly rules, date overrides, bookings, and active holds.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadOverview()}
          disabled={isLoading}
          className="h-11 w-fit border border-[#102329]/20 px-5 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
        >
          {isLoading ? "Refreshing" : "Refresh overview"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border-t border-[#102329]/12 pt-3">
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/45">
            Offerings
          </p>
          <p className="mt-2 text-3xl font-semibold">{visibleOfferings.length}</p>
        </div>
        <div className="border-t border-[#102329]/12 pt-3">
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/45">
            Available slots
          </p>
          <p className="mt-2 text-3xl font-semibold">{totals.available}</p>
        </div>
        <div className="border-t border-[#102329]/12 pt-3">
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/45">
            Generated slots
          </p>
          <p className="mt-2 text-3xl font-semibold">{totals.total}</p>
        </div>
      </div>

      <div className="grid gap-3 border-y border-[#102329]/10 py-4 lg:grid-cols-[minmax(220px,360px)_minmax(140px,180px)]">
        <label className="block">
          <span className="sr-only">Filter calendar by offering</span>
          <select
            value={offeringFilter}
            onChange={(event) => setOfferingFilter(event.target.value)}
            className="h-11 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          >
            <option value="all">All offerings</option>
            {offerings.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offering.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Calendar range</span>
          <select
            value={daysCount}
            onChange={(event) => setDaysCount(event.target.value)}
            className="h-11 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          >
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="28">28 days</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="border-l-2 border-red-600 pl-3 font-inter text-sm leading-6 text-red-700">
          {error}
        </p>
      )}

      <div className="grid overflow-hidden border border-[#102329]/12 bg-white/35 sm:grid-cols-2 lg:grid-cols-7">
        {isLoading
          ? Array.from({ length: Number(daysCount) }).map((_, index) => (
              <div key={index} className="min-h-[210px] border-b border-r border-[#102329]/10 p-4">
                <div className="h-5 animate-pulse bg-[#102329]/8" />
                <div className="mt-5 h-16 animate-pulse bg-[#102329]/8" />
              </div>
            ))
          : days.map((day) => (
              <div key={day.dateKey} className="min-h-[210px] border-b border-r border-[#102329]/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                      {weekdays[day.date.getDay()]}
                    </p>
                    <p className="mt-2 text-3xl font-semibold leading-none">
                      {formatDayNumber(day.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-inter text-xs font-semibold text-[#102329]/45">
                      {formatMonth(day.date)}
                    </p>
                    <p className="mt-2 font-inter text-xs font-semibold text-[#0F3B46]">
                      {day.availableCount}/{day.totalCount}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {day.slots.length === 0 ? (
                    <p className="font-inter text-sm text-[#102329]/42">No slots</p>
                  ) : null}

                  {day.slots.map((slot) => (
                    <p
                      key={`${slot.offering.id}-${slot.startsAt}-${slot.endsAt}`}
                      className={`border-l-2 pl-2 font-inter text-xs leading-5 ${slotStatusStyles[slot.status]}`}
                    >
                      {slotStatusLabels[slot.status]}: {getSlotLabel(slot, showOffering)}
                      {slot.status === "available" && slot.remainingCapacity > 1
                        ? ` (${slot.remainingCapacity} left)`
                        : ""}
                      {slot.blockedReason ? ` - ${slot.blockedReason}` : ""}
                    </p>
                  ))}
                </div>
              </div>
            ))}
      </div>
    </section>
  );
}
