"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  fetchAdminPayment,
  fetchAdminPayments,
  reconcileAdminPayment,
  retryAdminBookingCalendarSync,
  type AdminCalendarStatus,
  type AdminPayment,
  type AdminPaymentDetail,
  type AdminPaymentStatus,
} from "@/lib/api/admin";

type AdminPaymentEvent = AdminPaymentDetail["events"][number];

const statusOptions: Array<AdminPaymentStatus | "all"> = [
  "all",
  "processing",
  "pending",
  "paid",
  "failed",
  "abandoned",
  "expired",
  "cancelled",
];

const statusLabels: Record<AdminPaymentStatus | "all", string> = {
  all: "All",
  created: "Created",
  pending: "Pending",
  processing: "Processing",
  paid: "Paid",
  failed: "Failed",
  abandoned: "Abandoned",
  cancelled: "Cancelled",
  expired: "Expired",
  refunded: "Refunded",
};

const statusClasses: Record<AdminPaymentStatus, string> = {
  created: "border-[#102329]/20 text-[#102329]/65",
  pending: "border-[#8A6F2A] text-[#8A6F2A]",
  processing: "border-[#8A6F2A] bg-[#8A6F2A] text-white",
  paid: "border-[#0F3B46] bg-[#0F3B46] text-white",
  failed: "border-red-700 text-red-700",
  abandoned: "border-red-700/60 text-red-700",
  cancelled: "border-[#102329]/15 text-[#102329]/38",
  expired: "border-[#102329]/15 text-[#102329]/38",
  refunded: "border-[#102329] text-[#102329]",
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

const formatDateTime = (value: string | null) => {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const formatAmount = (minor: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);

const hasPaymentEvents = (
  payment: AdminPayment | AdminPaymentDetail | null,
): payment is AdminPaymentDetail => Boolean(payment && "events" in payment);

export default function AdminPaymentsLedger() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentDetail | AdminPayment | null>(null);
  const [status, setStatus] = useState<AdminPaymentStatus | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [isRetryingCalendar, setIsRetryingCalendar] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    return payments.reduce(
      (acc, payment) => {
        acc[payment.status] += 1;
        return acc;
      },
      {
        created: 0,
        pending: 0,
        processing: 0,
        paid: 0,
        failed: 0,
        abandoned: 0,
        cancelled: 0,
        expired: 0,
        refunded: 0,
      } as Record<AdminPaymentStatus, number>,
    );
  }, [payments]);

  const loadPayments = async () => {
    setIsLoading(true);
    setError("");

    try {
      const nextPayments = await fetchAdminPayments({ status, search });
      setPayments(nextPayments);
      setSelectedPayment((current) => {
        if (!current) return nextPayments[0] ?? null;
        return nextPayments.find((payment) => payment.id === current.id) ?? nextPayments[0] ?? null;
      });
    } catch (loadError) {
      setError(loadError instanceof AdminApiError ? loadError.message : "Could not load payments.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleSelectPayment = async (payment: AdminPayment) => {
    setSelectedPayment(payment);
    setIsLoadingDetail(true);
    setError("");
    setMessage("");

    try {
      const detail = await fetchAdminPayment(payment.id);
      setSelectedPayment(detail);
    } catch (loadError) {
      setError(loadError instanceof AdminApiError ? loadError.message : "Could not load payment.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleReconcile = async () => {
    if (!selectedPayment) return;

    setIsReconciling(true);
    setError("");
    setMessage("");

    try {
      const result = await reconcileAdminPayment(selectedPayment.id);
      setMessage(
        `Kashier returned ${result.reconciliation.status ?? "unknown"}; local payment is ${result.payment.status}.`,
      );
      await loadPayments();
      const detail = await fetchAdminPayment(result.payment.id);
      setSelectedPayment(detail);
    } catch (reconcileError) {
      setError(
        reconcileError instanceof AdminApiError
          ? reconcileError.message
          : "Could not reconcile payment.",
      );
    } finally {
      setIsReconciling(false);
    }
  };

  const handleCalendarRetry = async () => {
    if (!selectedPayment) return;

    setIsRetryingCalendar(true);
    setError("");
    setMessage("");

    try {
      await retryAdminBookingCalendarSync(selectedPayment.booking.id);
      const detail = await fetchAdminPayment(selectedPayment.id);
      setSelectedPayment(detail);
      setMessage(
        detail.booking.calendar?.status === "created"
          ? "Google Calendar event is synced."
          : "Google Calendar retry finished with a visible status.",
      );
    } catch (retryError) {
      setError(retryError instanceof AdminApiError ? retryError.message : "Could not retry calendar sync.");
    } finally {
      setIsRetryingCalendar(false);
    }
  };

  const selectedEvents: AdminPaymentEvent[] = hasPaymentEvents(selectedPayment)
    ? selectedPayment.events
    : [];

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#0F3B46]">
            Payments
          </p>
          <h1 className="mt-3 text-5xl font-semibold leading-none tracking-normal">
            Payment ledger
          </h1>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Review paid booking payments, provider references, callback events, and run Kashier reconciliation when callbacks are delayed.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex w-full gap-2 sm:w-auto">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search order, customer, provider"
            className="h-11 min-w-0 flex-1 border border-[#102329]/14 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46] sm:w-72"
          />
          <button className="h-11 bg-[#102329] px-5 font-inter text-sm font-semibold text-white">
            Search
          </button>
        </form>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {statusOptions.map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => setStatus(item)}
            className={`whitespace-nowrap border px-4 py-2 font-inter text-xs font-semibold uppercase tracking-[0.12em] ${
              status === item
                ? "border-[#0F3B46] bg-[#0F3B46] text-white"
                : "border-[#102329]/14 bg-white text-[#102329]/58"
            }`}
          >
            {statusLabels[item]}
            {item !== "all" ? ` ${counts[item]}` : ""}
          </button>
        ))}
      </div>

      {error && (
        <div className="border border-red-700/25 bg-red-50 px-4 py-3 font-inter text-sm text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div className="border border-[#0F3B46]/25 bg-[#0F3B46]/5 px-4 py-3 font-inter text-sm text-[#0F3B46]">
          {message}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(360px,0.55fr)]">
        <section className="border border-[#102329]/12 bg-white">
          {isLoading ? (
            <div className="p-6 font-inter text-sm text-[#102329]/55">Loading payments...</div>
          ) : payments.length === 0 ? (
            <div className="p-6 font-inter text-sm text-[#102329]/55">No payments found.</div>
          ) : (
            <div className="divide-y divide-[#102329]/8">
              {payments.map((payment) => (
                <button
                  key={payment.id}
                  type="button"
                  onClick={() => void handleSelectPayment(payment)}
                  className={`grid w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-[#F7F4EE] md:grid-cols-[minmax(0,1.2fr)_140px_130px_140px] ${
                    selectedPayment?.id === payment.id ? "bg-[#F7F4EE]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-inter text-sm font-semibold">
                      {payment.booking.customer.fullName}
                    </p>
                    <p className="mt-1 truncate font-inter text-xs text-[#102329]/52">
                      {payment.booking.offering.title} · {payment.merchantOrderId ?? "No order id"}
                    </p>
                  </div>
                  <span className="font-inter text-sm font-semibold">
                    {formatAmount(payment.amountMinor, payment.currency)}
                  </span>
                  <span
                    className={`inline-flex h-7 w-fit items-center border px-2 font-inter text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${statusClasses[payment.status]}`}
                  >
                    {statusLabels[payment.status]}
                  </span>
                  <span className="font-inter text-xs text-[#102329]/52">
                    {formatDateTime(payment.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="border border-[#102329]/12 bg-white p-5">
          {!selectedPayment ? (
            <p className="font-inter text-sm text-[#102329]/55">Select a payment.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#0F3B46]">
                  Payment detail
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-normal">
                  {formatAmount(selectedPayment.amountMinor, selectedPayment.currency)}
                </h2>
              </div>

              <dl className="space-y-3 border-y border-[#102329]/10 py-4 font-inter text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-[#102329]/40">Status</dt>
                  <dd className="mt-1 font-semibold capitalize">{selectedPayment.status}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-[#102329]/40">Merchant order</dt>
                  <dd className="mt-1 break-all font-semibold">{selectedPayment.merchantOrderId ?? "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-[#102329]/40">Provider payment</dt>
                  <dd className="mt-1 break-all">{selectedPayment.providerPaymentId ?? "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-[#102329]/40">Customer</dt>
                  <dd className="mt-1">
                    {selectedPayment.booking.customer.fullName}
                    <br />
                    <span className="text-[#102329]/55">{selectedPayment.booking.customer.email}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-[#102329]/40">Calendar</dt>
                  <dd className="mt-2 flex flex-wrap items-center gap-2">
                    {(() => {
                      const calendarStatus = selectedPayment.booking.calendar?.status ?? "not_started";
                      return (
                        <span className={`inline-flex h-7 items-center border px-2 font-inter text-[0.68rem] font-semibold uppercase tracking-[0.12em] ${calendarStatusClasses[calendarStatus]}`}>
                          {calendarStatusLabels[calendarStatus]}
                        </span>
                      );
                    })()}
                    {selectedPayment.booking.status === "confirmed" &&
                      (selectedPayment.booking.calendar?.status === "failed" ||
                        !selectedPayment.booking.calendar) && (
                        <button
                          type="button"
                          onClick={() => void handleCalendarRetry()}
                          disabled={isRetryingCalendar || isLoadingDetail}
                          className="h-7 border border-[#0F3B46] px-2 font-inter text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
                        >
                          {isRetryingCalendar ? "Retrying" : "Retry"}
                        </button>
                      )}
                  </dd>
                  {selectedPayment.booking.calendar?.meetUrl && (
                    <dd className="mt-2 break-all text-xs text-[#0F3B46]">
                      {selectedPayment.booking.calendar.meetUrl}
                    </dd>
                  )}
                  {selectedPayment.booking.calendar?.lastError && (
                    <dd className="mt-2 text-xs text-red-700">
                      {selectedPayment.booking.calendar.lastError}
                    </dd>
                  )}
                </div>
              </dl>

              <button
                type="button"
                onClick={() => void handleReconcile()}
                disabled={isReconciling || selectedPayment.provider !== "kashier"}
                className="h-11 w-full border border-[#0F3B46] bg-[#0F3B46] px-4 font-inter text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isReconciling ? "Reconciling..." : "Reconcile with Kashier"}
              </button>

              <div>
                <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/40">
                  Events
                </p>
                {isLoadingDetail ? (
                  <p className="mt-3 font-inter text-sm text-[#102329]/55">Loading events...</p>
                ) : selectedEvents.length === 0 ? (
                  <p className="mt-3 font-inter text-sm text-[#102329]/55">No provider events yet.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selectedEvents.map((event) => (
                      <div key={event.id} className="border border-[#102329]/10 p-3 font-inter text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{event.eventType}</span>
                          <span className="uppercase text-[#102329]/45">{event.processingStatus}</span>
                        </div>
                        <p className="mt-1 text-[#102329]/48">{formatDateTime(event.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
