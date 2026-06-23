"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  fetchPublicBookingStatus,
  PublicApiError,
  type PublicBooking,
} from "@/lib/api/bookings";

const uuidPattern =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const normalizeTokenInput = (value: string) => {
  const trimmed = value.trim();
  const match = trimmed.match(uuidPattern);
  return (match?.[0] ?? trimmed).toLowerCase();
};

const formatDateTime = (value: string | null | undefined, timezone?: string) => {
  if (!value) return "Not scheduled";

  const formatOptions: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };

  if (timezone) {
    formatOptions.timeZone = timezone;
  }

  return new Intl.DateTimeFormat("en", formatOptions).format(new Date(value));
};

const getStatusMeta = (status: string) => {
  switch (status) {
    case "confirmed":
      return {
        label: "Confirmed",
        className: "bg-[#E5F3EB] text-[#236447]",
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-[#E6EEF5] text-[#245B7A]",
      };
    case "pending_payment":
      return {
        label: "Pending payment",
        className: "bg-[#F6EFCF] text-[#7A5C11]",
      };
    case "payment_failed":
      return {
        label: "Payment failed",
        className: "bg-[#F1E3E3] text-[#7A2B2B]",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-[#F3E2DE] text-[#8B3326]",
      };
    case "expired":
      return {
        label: "Expired",
        className: "bg-[#ECE6DD] text-[#6B5540]",
      };
    case "no_show":
      return {
        label: "No show",
        className: "bg-[#F1E3E3] text-[#7A2B2B]",
      };
    case "rejected":
      return {
        label: "Rejected",
        className: "bg-[#F1E3E3] text-[#7A2B2B]",
      };
    default:
      return {
        label: status.replace(/_/g, " "),
        className: "bg-[#102329]/8 text-[#102329]/70",
      };
  }
};

type BookingStatusProps = {
  publicToken?: string;
};

export default function BookingStatus({ publicToken }: BookingStatusProps) {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState(publicToken ?? "");
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(publicToken));
  const [error, setError] = useState("");

  const normalizedRouteToken = useMemo(
    () => (publicToken ? normalizeTokenInput(publicToken) : ""),
    [publicToken],
  );

  useEffect(() => {
    setTokenInput(publicToken ?? "");

    if (!normalizedRouteToken) {
      setBooking(null);
      setError("");
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const loadBooking = async () => {
      setIsLoading(true);
      setError("");

      try {
        const nextBooking = await fetchPublicBookingStatus(normalizedRouteToken);

        if (!isCancelled) {
          setBooking(nextBooking);
        }
      } catch (loadError) {
        if (isCancelled) return;

        if (loadError instanceof PublicApiError && loadError.status === 404) {
          setError("Booking was not found.");
        } else {
          setError(loadError instanceof Error ? loadError.message : "Could not load booking.");
        }

        setBooking(null);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadBooking();

    return () => {
      isCancelled = true;
    };
  }, [normalizedRouteToken, publicToken]);

  const statusMeta = booking ? getStatusMeta(booking.status) : null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedToken = normalizeTokenInput(tokenInput);

    if (!uuidPattern.test(normalizedToken)) {
      setError("Enter a valid reference token.");
      setBooking(null);
      return;
    }

    router.push(`/booking/status/${encodeURIComponent(normalizedToken)}`);
  };

  return (
    <main className="min-h-screen bg-[#F7F4EE] text-[#102329]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-[#102329]/12 pb-5">
          <Link href="/" className="font-inter text-xs font-semibold uppercase tracking-normal">
            Rammah
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              href="/booking"
              className="font-inter text-sm font-semibold text-[#102329]/62 transition-colors hover:text-[#0F3B46]"
            >
              Booking
            </Link>
            <Link
              href="/#services"
              className="font-inter text-sm font-semibold text-[#102329]/62 transition-colors hover:text-[#0F3B46]"
            >
              Services
            </Link>
          </nav>
        </header>

        <section className="grid flex-1 gap-8 py-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)] lg:items-center">
          <div>
            <p className="font-inter text-xs font-semibold uppercase text-[#0F3B46]">
              Booking status
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-none tracking-normal sm:text-6xl lg:text-7xl">
              Check your session details.
            </h1>
            <p className="mt-5 max-w-2xl font-inter text-base leading-7 text-[#102329]/68">
              Use the booking reference from your confirmation to review the current status,
              selected time, and payment state.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 max-w-xl">
              <label
                htmlFor="booking-token"
                className="font-inter text-xs font-semibold uppercase text-[#102329]/48"
              >
                Reference token
              </label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  id="booking-token"
                  value={tokenInput}
                  onChange={(event) => setTokenInput(event.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="h-12 min-w-0 flex-1 border border-[#102329]/16 bg-white px-4 font-inter text-sm outline-none transition-colors placeholder:text-[#102329]/30 focus:border-[#0F3B46]"
                />
                <button
                  type="submit"
                  className="h-12 bg-[#102329] px-6 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46]"
                >
                  View status
                </button>
              </div>
            </form>
          </div>

          <div className="border border-[#102329]/14 bg-white p-5 sm:p-6" aria-live="polite">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-5 w-28 animate-pulse bg-[#102329]/10" />
                <div className="h-9 w-3/4 animate-pulse bg-[#102329]/10" />
                <div className="h-20 animate-pulse bg-[#102329]/8" />
                <div className="h-20 animate-pulse bg-[#102329]/8" />
              </div>
            ) : error ? (
              <div className="space-y-4">
                <p className="font-inter text-xs font-semibold uppercase text-red-700">
                  Lookup failed
                </p>
                <h2 className="text-3xl font-semibold tracking-normal">{error}</h2>
                <p className="font-inter text-sm leading-6 text-[#102329]/62">
                  Check the reference token and try again.
                </p>
              </div>
            ) : booking && statusMeta ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-inter text-xs font-semibold uppercase text-[#102329]/42">
                      Current status
                    </p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-normal">
                      {booking.offering.title}
                    </h2>
                  </div>
                  <span
                    className={`inline-flex w-fit items-center px-3 py-1 font-inter text-xs font-semibold capitalize ${statusMeta.className}`}
                  >
                    {statusMeta.label}
                  </span>
                </div>

                <dl className="grid gap-4 border-y border-[#102329]/10 py-5">
                  <div>
                    <dt className="font-inter text-xs font-semibold uppercase text-[#102329]/42">
                      Session time
                    </dt>
                    <dd className="mt-2 font-inter text-sm text-[#102329]/72">
                      {formatDateTime(booking.slot.startsAt, booking.slot.timezone)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-inter text-xs font-semibold uppercase text-[#102329]/42">
                      Customer
                    </dt>
                    <dd className="mt-2 font-inter text-sm font-semibold">
                      {booking.customer.fullName}
                    </dd>
                    <dd className="mt-1 font-inter text-sm text-[#102329]/58">
                      {booking.customer.email}
                    </dd>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="font-inter text-xs font-semibold uppercase text-[#102329]/42">
                        Mode
                      </dt>
                      <dd className="mt-2 font-inter text-sm capitalize text-[#102329]/72">
                        {booking.attendanceMode.replace("_", " ")}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-inter text-xs font-semibold uppercase text-[#102329]/42">
                        Payment
                      </dt>
                      <dd className="mt-2 font-inter text-sm text-[#102329]/72">
                        {booking.paymentRequired ? "Required" : "Not required"}
                      </dd>
                    </div>
                  </div>
                  {booking.location && (
                    <div>
                      <dt className="font-inter text-xs font-semibold uppercase text-[#102329]/42">
                        Location
                      </dt>
                      <dd className="mt-2 font-inter text-sm text-[#102329]/72">
                        {[booking.location.name, booking.location.city, booking.location.countryCode]
                          .filter(Boolean)
                          .join(", ")}
                      </dd>
                    </div>
                  )}
                  {booking.status === "confirmed" && (
                    <div>
                      <dt className="font-inter text-xs font-semibold uppercase text-[#102329]/42">
                        Meeting
                      </dt>
                      <dd className="mt-2 font-inter text-sm text-[#102329]/72">
                        {booking.calendar?.meetUrl ? (
                          <a
                            href={booking.calendar.meetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-[#0F3B46] underline decoration-[#0F3B46]/35 underline-offset-4"
                          >
                            Open Google Meet
                          </a>
                        ) : booking.calendar?.status === "failed" ? (
                          "Meeting link is being reviewed."
                        ) : (
                          "Meeting link is being prepared."
                        )}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="grid gap-3 font-inter text-xs text-[#102329]/54">
                  <p className="break-all">
                    <span className="font-semibold text-[#102329]/70">Reference:</span>{" "}
                    {booking.publicToken}
                  </p>
                  <p>
                    <span className="font-semibold text-[#102329]/70">Created:</span>{" "}
                    {formatDateTime(booking.createdAt, booking.slot.timezone)}
                  </p>
                  {booking.cancelledAt && (
                    <p>
                      <span className="font-semibold text-[#102329]/70">Cancelled:</span>{" "}
                      {formatDateTime(booking.cancelledAt, booking.slot.timezone)}
                    </p>
                  )}
                  {booking.updatedAt && (
                    <p>
                      <span className="font-semibold text-[#102329]/70">Updated:</span>{" "}
                      {formatDateTime(booking.updatedAt, booking.slot.timezone)}
                    </p>
                  )}
                </div>

                <Link
                  href="/booking"
                  className="inline-flex h-11 items-center justify-center border border-[#102329]/18 px-5 font-inter text-sm font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
                >
                  Book another service
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="font-inter text-xs font-semibold uppercase text-[#102329]/42">
                  Ready
                </p>
                <h2 className="text-3xl font-semibold tracking-normal">No booking loaded.</h2>
                <p className="font-inter text-sm leading-6 text-[#102329]/62">
                  Your booking summary will appear here after lookup.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
