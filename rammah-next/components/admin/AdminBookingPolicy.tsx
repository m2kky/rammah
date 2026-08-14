"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  fetchAdminBookingPolicy,
  updateAdminBookingPolicy,
} from "@/lib/api/admin";
import {
  addDaysToDateKey,
  dateKeyForInstantInTimeZone,
} from "@/lib/booking-datetime";

const weekday = (dateKey: string) =>
  new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${dateKey}T12:00:00.000Z`),
  );

export default function AdminBookingPolicy() {
  const [days, setDays] = useState("1");
  const [timezone, setTimezone] = useState("Africa/Cairo");
  const [effectiveDate, setEffectiveDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const policy = await fetchAdminBookingPolicy();
        setDays(String(policy.bookingMinimumAdvanceDays));
        setTimezone(policy.bookingDefaultTimezone);
        setEffectiveDate(policy.earliestBookableDate);
      } catch (loadError) {
        setError(loadError instanceof AdminApiError ? loadError.message : "Could not load booking policy.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const preview = useMemo(() => {
    const parsedDays = Number(days);
    if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 365) return null;
    try {
      const today = dateKeyForInstantInTimeZone(new Date(), timezone.trim());
      return { today, earliest: addDaysToDateKey(today, parsedDays), parsedDays };
    } catch {
      return null;
    }
  }, [days, timezone]);

  const save = async () => {
    if (!preview) return;
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await updateAdminBookingPolicy({
        bookingMinimumAdvanceDays: preview.parsedDays,
        bookingDefaultTimezone: timezone.trim(),
      });
      setDays(String(saved.bookingMinimumAdvanceDays));
      setTimezone(saved.bookingDefaultTimezone);
      setEffectiveDate(saved.earliestBookableDate);
      setMessage(`Saved. Customers can book from ${saved.earliestBookableDate}.`);
    } catch (saveError) {
      setError(saveError instanceof AdminApiError ? saveError.message : "Could not save booking policy.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="border border-[#102329]/12 bg-white p-5 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">
            Global control
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#102329]">Booking policy</h1>
          <p className="mt-2 max-w-2xl font-inter text-sm leading-6 text-[#102329]/60">
            Closes whole calendar dates in the booking timezone for every appointment and Program.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={isLoading || isSaving || !preview}
          className="h-11 bg-[#0F3B46] px-5 font-inter text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSaving ? "Saving..." : "Save policy"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/50">
            Minimum advance booking days
          </span>
          <input
            type="number"
            min={1}
            max={365}
            step={1}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            disabled={isLoading}
            className="h-11 w-full border border-[#102329]/18 px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
          />
        </label>
        <label className="space-y-2">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/50">
            Booking timezone
          </span>
          <input
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            disabled={isLoading}
            placeholder="Africa/Cairo"
            className="h-11 w-full border border-[#102329]/18 px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
          />
        </label>
      </div>

      <div className="mt-5 border-l-2 border-[#B1FF4A] bg-[#F7F9F2] px-4 py-3 font-inter text-sm text-[#102329]/75">
        {preview ? (
          <>
            If today is {weekday(preview.today)} and this is {preview.parsedDays}, customers can book from {weekday(preview.earliest)} ({preview.earliest}).
          </>
        ) : (
          <>Enter a whole number from 1 to 365 and a valid IANA timezone.</>
        )}
        {effectiveDate && <span className="ml-2 text-[#102329]/45">Currently effective: {effectiveDate}.</span>}
      </div>
      {error && <p className="mt-4 font-inter text-sm text-red-700">{error}</p>}
      {message && <p className="mt-4 font-inter text-sm text-[#0F3B46]">{message}</p>}
    </section>
  );
}
