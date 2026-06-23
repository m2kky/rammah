"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  fetchAdminBooking,
  fetchAdminBookings,
  rescheduleAdminBooking,
  retryAdminBookingCalendarSync,
  updateAdminBookingStatus,
  type AdminBooking,
  type AdminCalendarStatus,
  type AdminBookingStatus,
} from "@/lib/api/admin";

const statusOptions: Array<AdminBookingStatus | "all"> = [
  "all",
  "confirmed",
  "pending_payment",
  "cancelled",
  "completed",
  "expired",
];

const statusLabels: Record<AdminBookingStatus | "all", string> = {
  all: "All",
  draft: "Draft",
  pending_payment: "Pending payment",
  payment_failed: "Payment failed",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
  completed: "Completed",
  no_show: "No show",
  expired: "Expired",
  rejected: "Rejected",
};

const statusClasses: Record<AdminBookingStatus, string> = {
  draft: "border-[#102329]/20 text-[#102329]/65",
  pending_payment: "border-[#8A6F2A] text-[#8A6F2A]",
  payment_failed: "border-red-700 text-red-700",
  confirmed: "border-[#0F3B46] bg-[#0F3B46] text-white",
  cancelled: "border-[#102329]/15 text-[#102329]/38",
  rescheduled: "border-[#8A6F2A] text-[#8A6F2A]",
  completed: "border-[#102329] text-[#102329]",
  no_show: "border-red-700 text-red-700",
  expired: "border-[#102329]/15 text-[#102329]/38",
  rejected: "border-red-700 text-red-700",
};

const calendarStatusLabels: Record<AdminCalendarStatus | "not_started", string> = {
  not_started: "Not synced",
  pending: "Pending",
  created: "Created",
  updated: "Updated",
  cancelled: "Cancelled",
  failed: "Failed",
};

const calendarStatusClasses: Record<AdminCalendarStatus | "not_started", string> = {
  not_started: "border-[#102329]/15 text-[#102329]/45",
  pending: "border-[#8A6F2A] text-[#8A6F2A]",
  created: "border-[#0F3B46] bg-[#0F3B46] text-white",
  updated: "border-[#0F3B46] text-[#0F3B46]",
  cancelled: "border-[#102329]/15 text-[#102329]/38",
  failed: "border-red-700 text-red-700",
};

type BookingStatusAction = {
  status: AdminBookingStatus;
  label: string;
  tone: "primary" | "neutral" | "danger";
};

const getStatusActions = (status: AdminBookingStatus): BookingStatusAction[] => {
  switch (status) {
    case "draft":
      return [
        { status: "confirmed", label: "Confirm", tone: "primary" },
        { status: "rejected", label: "Reject", tone: "danger" },
        { status: "cancelled", label: "Cancel", tone: "danger" },
      ];
    case "pending_payment":
      return [
        { status: "confirmed", label: "Confirm", tone: "primary" },
        { status: "expired", label: "Expire", tone: "neutral" },
        { status: "cancelled", label: "Cancel", tone: "danger" },
      ];
    case "payment_failed":
      return [
        { status: "pending_payment", label: "Retry payment", tone: "neutral" },
        { status: "expired", label: "Expire", tone: "neutral" },
        { status: "cancelled", label: "Cancel", tone: "danger" },
      ];
    case "confirmed":
    case "rescheduled":
      return [
        { status: "completed", label: "Complete", tone: "primary" },
        { status: "no_show", label: "No-show", tone: "neutral" },
        { status: "cancelled", label: "Cancel", tone: "danger" },
      ];
    default:
      return [];
  }
};

const actionButtonClasses: Record<BookingStatusAction["tone"], string> = {
  primary: "border-[#0F3B46] bg-[#0F3B46] text-white hover:bg-[#102329]",
  neutral: "border-[#102329]/18 text-[#102329]/70 hover:border-[#0F3B46] hover:text-[#0F3B46]",
  danger: "border-red-700 text-red-700 hover:bg-red-700 hover:text-white",
};

const formatDateTime = (value: string | null) => {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const formatAmount = (minor: number, currency: string | null) => {
  if (!currency) return "No payment";

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);
};

const toDatetimeLocalValue = (value: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
};

export default function AdminBookingsInbox() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [status, setStatus] = useState<AdminBookingStatus | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [statusAction, setStatusAction] = useState<AdminBookingStatus | null>(null);
  const [isRetryingCalendar, setIsRetryingCalendar] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleStartsAt, setRescheduleStartsAt] = useState("");
  const [rescheduleEndsAt, setRescheduleEndsAt] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    return bookings.reduce(
      (acc, booking) => {
        acc[booking.status] += 1;
        return acc;
      },
      {
        draft: 0,
        pending_payment: 0,
        payment_failed: 0,
        confirmed: 0,
        cancelled: 0,
        rescheduled: 0,
        completed: 0,
        no_show: 0,
        expired: 0,
        rejected: 0,
      } as Record<AdminBookingStatus, number>,
    );
  }, [bookings]);

  const selectedStatusActions = selectedBooking ? getStatusActions(selectedBooking.status) : [];

  const syncRescheduleForm = (booking: AdminBooking | null) => {
    setRescheduleStartsAt(toDatetimeLocalValue(booking?.slot.startsAt ?? null));
    setRescheduleEndsAt(toDatetimeLocalValue(booking?.slot.endsAt ?? null));
    setRescheduleReason("");
  };

  const loadBookings = async () => {
    setIsLoading(true);
    setError("");

    try {
      const nextBookings = await fetchAdminBookings({ status, search });
      const nextSelected = selectedBooking
        ? nextBookings.find((booking) => booking.id === selectedBooking.id) ?? nextBookings[0] ?? null
        : nextBookings[0] ?? null;
      setBookings(nextBookings);
      setSelectedBooking(nextSelected);
      syncRescheduleForm(nextSelected);
    } catch (loadError) {
      if (loadError instanceof AdminApiError) {
        setError(loadError.message);
      } else {
        setError("Could not load bookings.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleSelectBooking = async (booking: AdminBooking) => {
    setSelectedBooking(booking);
    setIsLoadingDetail(true);
    setError("");
    setMessage("");

    try {
      const detail = await fetchAdminBooking(booking.id);
      setSelectedBooking(detail);
      syncRescheduleForm(detail);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Could not load booking.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleStatusUpdate = async (nextStatus: AdminBookingStatus) => {
    if (!selectedBooking) return;

    setStatusAction(nextStatus);
    setError("");
    setMessage("");

    try {
      const updatedBooking = await updateAdminBookingStatus(selectedBooking.id, {
        status: nextStatus,
      });

      setSelectedBooking(updatedBooking);
      setBookings((currentBookings) => {
        if (status !== "all" && updatedBooking.status !== status) {
          return currentBookings.filter((booking) => booking.id !== updatedBooking.id);
        }

        return currentBookings.map((booking) =>
          booking.id === updatedBooking.id ? updatedBooking : booking,
        );
      });
    } catch (updateError) {
      if (updateError instanceof AdminApiError) {
        setError(updateError.message);
      } else {
        setError("Could not update booking status.");
      }
    } finally {
      setStatusAction(null);
    }
  };

  const handleCalendarRetry = async () => {
    if (!selectedBooking) return;

    setIsRetryingCalendar(true);
    setError("");
    setMessage("");

    try {
      const updatedBooking = await retryAdminBookingCalendarSync(selectedBooking.id);
      setSelectedBooking(updatedBooking);
      setBookings((currentBookings) =>
        currentBookings.map((booking) =>
          booking.id === updatedBooking.id ? updatedBooking : booking,
        ),
      );
      setMessage(
        updatedBooking.calendar?.status === "created"
          ? "Google Calendar event is synced."
          : "Google Calendar retry finished with a visible status.",
      );
    } catch (retryError) {
      setError(retryError instanceof AdminApiError ? retryError.message : "Could not retry calendar sync.");
    } finally {
      setIsRetryingCalendar(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedBooking) return;

    setIsRescheduling(true);
    setError("");
    setMessage("");

    try {
      const updatedBooking = await rescheduleAdminBooking(selectedBooking.id, {
        startsAt: new Date(rescheduleStartsAt).toISOString(),
        endsAt: new Date(rescheduleEndsAt).toISOString(),
        timezone: selectedBooking.slot.timezone,
        reason: rescheduleReason.trim() || null,
      });
      setSelectedBooking(updatedBooking);
      syncRescheduleForm(updatedBooking);
      setBookings((currentBookings) =>
        currentBookings.map((booking) =>
          booking.id === updatedBooking.id ? updatedBooking : booking,
        ),
      );
      setMessage("Booking rescheduled.");
    } catch (rescheduleError) {
      setError(
        rescheduleError instanceof AdminApiError
          ? rescheduleError.message
          : "Could not reschedule booking.",
      );
    } finally {
      setIsRescheduling(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 border-b border-[#102329]/10 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
            Operations
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">Bookings</h1>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Confirmed and in-progress customer bookings generated from public slot holds.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadBookings()}
          disabled={isLoading}
          className="h-11 w-fit border border-[#102329]/20 px-5 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
        >
          {isLoading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(["confirmed", "pending_payment", "completed", "cancelled"] as AdminBookingStatus[]).map((item) => (
          <div key={item} className="border-t border-[#102329]/12 pt-3">
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/45">
              {statusLabels[item]}
            </p>
            <p className="mt-2 text-3xl font-semibold">{counts[item]}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-y border-[#102329]/10 py-4 xl:flex-row xl:items-center xl:justify-between">
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search customer, email, or offering"
            className="h-11 w-full min-w-0 border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46] sm:w-[360px]"
          />
          <button
            type="submit"
            className="h-11 bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46]"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2 overflow-x-auto">
          {statusOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              className={`h-10 whitespace-nowrap border px-4 font-inter text-sm font-semibold transition-colors ${
                status === option
                  ? "border-[#0F3B46] bg-[#0F3B46] text-white"
                  : "border-[#102329]/16 text-[#102329]/65 hover:border-[#102329]/35"
              }`}
            >
              {statusLabels[option]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="border-l-2 border-red-600 pl-3 font-inter text-sm leading-6 text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="border-l-2 border-[#0F3B46] pl-3 font-inter text-sm leading-6 text-[#0F3B46]">
          {message}
        </p>
      )}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="border-b border-[#102329]/14 text-left">
                <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Customer
                </th>
                <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Offering
                </th>
                <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Slot
                </th>
                <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Status
                </th>
                <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Payment
                </th>
                <th className="py-3 text-right font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index} className="border-b border-[#102329]/8">
                    <td colSpan={6} className="py-5">
                      <div className="h-7 animate-pulse bg-[#102329]/8" />
                    </td>
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center font-inter text-sm text-[#102329]/55">
                    No bookings match the current filters.
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-[#102329]/8 align-top transition-colors hover:bg-white/55">
                    <td className="py-5 pr-5">
                      <p className="text-lg font-semibold leading-tight">{booking.customer.fullName}</p>
                      <p className="mt-1 font-inter text-xs text-[#102329]/48">{booking.customer.email}</p>
                    </td>
                    <td className="py-5 pr-5">
                      <p className="font-inter text-sm font-semibold">{booking.offering.title}</p>
                      <p className="mt-1 font-inter text-xs text-[#102329]/48">/{booking.offering.slug}</p>
                    </td>
                    <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">
                      {formatDateTime(booking.slot.startsAt)}
                      <p className="mt-1 text-xs text-[#102329]/45">{booking.slot.timezone}</p>
                      {booking.location && (
                        <p className="mt-1 text-xs text-[#102329]/45">
                          {[booking.location.name, booking.location.city, booking.location.countryCode]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="py-5 pr-5">
                      <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${statusClasses[booking.status]}`}>
                        {statusLabels[booking.status]}
                      </span>
                    </td>
                    <td className="py-5 pr-5 font-inter text-sm text-[#102329]/65">
                      {booking.payment.required
                        ? formatAmount(booking.payment.totalAmountMinor, booking.payment.currency)
                        : "Free"}
                    </td>
                    <td className="py-5 text-right">
                      <button
                        type="button"
                        onClick={() => void handleSelectBooking(booking)}
                        className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <aside className="border-t border-[#102329]/14 pt-5 xl:border-t-0 xl:pt-0">
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">
            Selected
          </p>

          {!selectedBooking ? (
            <p className="mt-5 font-inter text-sm leading-6 text-[#102329]/55">
              Select a booking to review details.
            </p>
          ) : (
            <div className="mt-5 space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">{selectedBooking.customer.fullName}</h2>
                <p className="mt-1 font-inter text-sm text-[#102329]/55">
                  {selectedBooking.customer.email}
                </p>
                {selectedBooking.customer.phone && (
                  <p className="mt-1 font-inter text-sm text-[#102329]/55">
                    {selectedBooking.customer.phone}
                  </p>
                )}
              </div>

              <div className="grid gap-4 border-y border-[#102329]/10 py-4">
                <div>
                  <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Offering
                  </p>
                  <p className="mt-2 font-inter text-sm font-semibold">{selectedBooking.offering.title}</p>
                </div>
                <div>
                  <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Slot
                  </p>
                  <p className="mt-2 font-inter text-sm text-[#102329]/70">
                    {formatDateTime(selectedBooking.slot.startsAt)}
                  </p>
                  {selectedBooking.location && (
                    <p className="mt-1 font-inter text-xs text-[#102329]/48">
                      {[selectedBooking.location.name, selectedBooking.location.city, selectedBooking.location.countryCode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                </div>
                <div>
                  <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Token
                  </p>
                  <p className="mt-2 break-all font-inter text-xs text-[#102329]/55">
                    {selectedBooking.publicToken}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${statusClasses[selectedBooking.status]}`}>
                  {statusLabels[selectedBooking.status]}
                </span>
                <span className="inline-flex h-8 items-center border border-[#102329]/14 px-3 font-inter text-xs font-semibold text-[#102329]/55">
                  {selectedBooking.attendanceMode}
                </span>
              </div>

              {selectedStatusActions.length > 0 && (
                <div className="border-t border-[#102329]/10 pt-4">
                  <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Actions
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedStatusActions.map((action) => (
                      <button
                        key={action.status}
                        type="button"
                        onClick={() => void handleStatusUpdate(action.status)}
                        disabled={statusAction !== null || isLoadingDetail}
                        className={`h-10 border px-4 font-inter text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-50 ${actionButtonClasses[action.tone]}`}
                      >
                        {statusAction === action.status ? "Updating" : action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedBooking.status === "confirmed" && (
                <div className="border-t border-[#102329]/10 pt-4">
                  <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Google Calendar
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(() => {
                      const calendarStatus = selectedBooking.calendar?.status ?? "not_started";
                      return (
                        <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${calendarStatusClasses[calendarStatus]}`}>
                          {calendarStatusLabels[calendarStatus]}
                        </span>
                      );
                    })()}
                    {(selectedBooking.calendar?.status === "failed" || !selectedBooking.calendar) && (
                      <button
                        type="button"
                        onClick={() => void handleCalendarRetry()}
                        disabled={isRetryingCalendar || isLoadingDetail}
                        className="h-8 border border-[#0F3B46] px-3 font-inter text-xs font-semibold text-[#0F3B46] transition-colors hover:bg-[#0F3B46] hover:text-white disabled:cursor-wait disabled:opacity-50"
                      >
                        {isRetryingCalendar ? "Retrying" : "Retry"}
                      </button>
                    )}
                  </div>
                  {selectedBooking.calendar?.meetUrl && (
                    <a
                      href={selectedBooking.calendar.meetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 block break-all font-inter text-xs font-semibold text-[#0F3B46] underline decoration-[#0F3B46]/30 underline-offset-4"
                    >
                      {selectedBooking.calendar.meetUrl}
                    </a>
                  )}
                  {selectedBooking.calendar?.lastError && (
                    <p className="mt-3 font-inter text-xs leading-5 text-red-700">
                      {selectedBooking.calendar.lastError}
                    </p>
                  )}
                </div>
              )}

              {["confirmed", "rescheduled"].includes(selectedBooking.status) && (
                <div className="border-t border-[#102329]/10 pt-4">
                  <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Reschedule
                  </p>
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-2 font-inter text-xs font-semibold uppercase tracking-[0.12em] text-[#102329]/45">
                      Start
                      <input
                        type="datetime-local"
                        value={rescheduleStartsAt}
                        onChange={(event) => setRescheduleStartsAt(event.target.value)}
                        className="h-10 border border-[#102329]/18 bg-white px-3 font-inter text-sm font-normal normal-case tracking-normal text-[#102329] outline-none focus:border-[#0F3B46]"
                      />
                    </label>
                    <label className="grid gap-2 font-inter text-xs font-semibold uppercase tracking-[0.12em] text-[#102329]/45">
                      End
                      <input
                        type="datetime-local"
                        value={rescheduleEndsAt}
                        onChange={(event) => setRescheduleEndsAt(event.target.value)}
                        className="h-10 border border-[#102329]/18 bg-white px-3 font-inter text-sm font-normal normal-case tracking-normal text-[#102329] outline-none focus:border-[#0F3B46]"
                      />
                    </label>
                    <textarea
                      value={rescheduleReason}
                      onChange={(event) => setRescheduleReason(event.target.value)}
                      placeholder="Reason, optional"
                      rows={3}
                      className="resize-none border border-[#102329]/18 bg-white px-3 py-2 font-inter text-sm leading-6 outline-none focus:border-[#0F3B46]"
                    />
                    <button
                      type="button"
                      onClick={() => void handleReschedule()}
                      disabled={
                        isRescheduling ||
                        !rescheduleStartsAt ||
                        !rescheduleEndsAt ||
                        (rescheduleStartsAt === toDatetimeLocalValue(selectedBooking.slot.startsAt) &&
                          rescheduleEndsAt === toDatetimeLocalValue(selectedBooking.slot.endsAt))
                      }
                      className="h-10 border border-[#0F3B46] bg-[#0F3B46] px-4 font-inter text-xs font-semibold text-white transition-colors hover:bg-[#102329] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isRescheduling ? "Rescheduling" : "Save new slot"}
                    </button>
                  </div>
                </div>
              )}

              {isLoadingDetail && (
                <p className="font-inter text-xs font-semibold text-[#102329]/45">Refreshing detail</p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
