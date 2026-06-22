"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  fetchPublicBookingStatus,
  fetchPublicPaymentSession,
  PublicApiError,
  startPublicPaymentForBooking,
  type PublicBooking,
  type PublicPaymentSessionResult,
} from "@/lib/api/bookings";

const formatMoney = (amountMinor: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);

type BookingPaymentFrameProps = {
  publicToken: string;
};

export default function BookingPaymentFrame({ publicToken }: BookingPaymentFrameProps) {
  const frameContainerRef = useRef<HTMLDivElement | null>(null);
  const [paymentSession, setPaymentSession] = useState<PublicPaymentSessionResult | null>(null);
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [isPaymentClosed, setIsPaymentClosed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    const loadPayment = async () => {
      setIsLoading(true);
      setError("");

      try {
        const nextBooking = await fetchPublicBookingStatus(publicToken);

        if (!isCancelled) {
          setBooking(nextBooking);
        }

        if (nextBooking.status === "confirmed") {
          if (!isCancelled) {
            setPaymentSession(null);
            setIsPaymentClosed(false);
          }
          return;
        }

        const nextSession = await fetchPublicPaymentSession(publicToken).catch((loadError) => {
          if (loadError instanceof PublicApiError && loadError.code === "PAYMENT_ATTEMPT_CLOSED") {
            return null;
          }

          throw loadError;
        });

        if (!isCancelled) {
          setPaymentSession(nextSession);
          setIsPaymentClosed(!nextSession);
        }
      } catch (loadError) {
        if (isCancelled) return;

        if (loadError instanceof PublicApiError && loadError.status === 404) {
          setError("Payment was not found.");
        } else {
          setError(loadError instanceof Error ? loadError.message : "Could not load payment.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPayment();

    return () => {
      isCancelled = true;
    };
  }, [publicToken]);

  const handleStartPayment = async () => {
    setIsStartingPayment(true);
    setError("");

    try {
      const nextSession = await startPublicPaymentForBooking(publicToken);
      const nextBooking = await fetchPublicBookingStatus(publicToken);
      setPaymentSession(nextSession);
      setBooking(nextBooking);
      setIsPaymentClosed(false);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start payment.");
    } finally {
      setIsStartingPayment(false);
    }
  };

  useEffect(() => {
    if (!paymentSession || !frameContainerRef.current) {
      return;
    }

    const container = frameContainerRef.current;
    container.replaceChildren();

    const script = document.createElement("script");
    script.id = "kashier-iFrame";
    script.src = paymentSession.paymentSession.scriptUrl;
    script.async = true;
    script.setAttribute("data-amount", paymentSession.paymentSession.iframe.amount);
    script.setAttribute("data-description", paymentSession.booking.offering.title);
    script.setAttribute("data-hash", paymentSession.paymentSession.iframe.hash);
    script.setAttribute("data-currency", paymentSession.paymentSession.iframe.currency);
    script.setAttribute("data-orderId", paymentSession.paymentSession.iframe.merchantOrderId);
    script.setAttribute("data-merchantId", paymentSession.paymentSession.iframe.merchantId);
    script.setAttribute("data-allowedMethods", paymentSession.paymentSession.iframe.allowedMethods);
    script.setAttribute("data-merchantRedirect", paymentSession.paymentSession.iframe.merchantRedirect);
    script.setAttribute("data-mode", paymentSession.paymentSession.mode);
    script.setAttribute("data-store", paymentSession.paymentSession.iframe.store);
    script.setAttribute("data-type", paymentSession.paymentSession.iframe.type);
    script.setAttribute("data-display", paymentSession.paymentSession.iframe.display);

    container.appendChild(script);

    return () => {
      container.replaceChildren();
    };
  }, [paymentSession]);

  const payment = paymentSession?.payment ?? null;
  const isSettled = booking?.status === "confirmed" || payment?.status === "paid";

  return (
    <main className="min-h-screen bg-[#F7F4EE] text-[#102329]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-[#102329]/12 pb-5">
          <Link href="/" className="font-inter text-xs font-semibold uppercase tracking-normal">
            Rammah
          </Link>
          <Link
            href={`/booking/status/${encodeURIComponent(publicToken)}`}
            className="font-inter text-sm font-semibold text-[#102329]/62 transition-colors hover:text-[#0F3B46]"
          >
            Status
          </Link>
        </header>

        <section className="grid flex-1 gap-8 py-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(420px,0.78fr)] lg:items-start">
          <div>
            <p className="font-inter text-xs font-semibold uppercase text-[#0F3B46]">
              Secure payment
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-none tracking-normal sm:text-6xl">
              Complete your booking payment.
            </h1>
            <p className="mt-5 max-w-2xl font-inter text-base leading-7 text-[#102329]/68">
              The payment form is provided by Kashier. Booking confirmation is applied
              only after the backend verifies the signed payment result.
            </p>

            {payment && (
              <dl className="mt-8 grid gap-4 border-y border-[#102329]/12 py-5 sm:grid-cols-2">
                <div>
                  <dt className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                    Amount
                  </dt>
                  <dd className="mt-2 font-inter text-sm font-semibold">
                    {formatMoney(payment.amountMinor, payment.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                    Payment state
                  </dt>
                  <dd className="mt-2 font-inter text-sm font-semibold capitalize">
                    {payment.status.replace("_", " ")}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          <div className="border border-[#102329]/14 bg-white p-5 sm:p-6">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-5 w-28 animate-pulse bg-[#102329]/10" />
                <div className="h-80 animate-pulse bg-[#102329]/8" />
              </div>
            ) : error ? (
              <div className="space-y-4">
                <p className="font-inter text-xs font-semibold uppercase text-red-700">
                  Payment unavailable
                </p>
                <h2 className="text-3xl font-semibold tracking-normal">{error}</h2>
                <Link
                  href={`/booking/status/${encodeURIComponent(publicToken)}`}
                  className="inline-flex h-11 items-center justify-center bg-[#102329] px-5 font-inter text-sm font-semibold text-white"
                >
                  View booking status
                </Link>
              </div>
            ) : isSettled ? (
              <div className="space-y-5">
                <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#0F3B46]">
                  Confirmed
                </p>
                <h2 className="text-3xl font-semibold tracking-normal">Payment confirmed.</h2>
                <Link
                  href={`/booking/status/${encodeURIComponent(publicToken)}`}
                  className="inline-flex h-11 items-center justify-center bg-[#102329] px-5 font-inter text-sm font-semibold text-white"
                >
                  View booking status
                </Link>
              </div>
            ) : isPaymentClosed || !paymentSession ? (
              <div className="space-y-5">
                <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#8A6F2A]">
                  Payment attempt closed
                </p>
                <h2 className="text-3xl font-semibold tracking-normal">
                  Start a new payment attempt.
                </h2>
                <p className="font-inter text-sm leading-6 text-[#102329]/62">
                  The backend will create a new payment reference and keep the previous attempt in the ledger.
                </p>
                <button
                  type="button"
                  onClick={() => void handleStartPayment()}
                  disabled={isStartingPayment}
                  className="h-11 bg-[#102329] px-5 font-inter text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-55"
                >
                  {isStartingPayment ? "Starting..." : "Start payment"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#0F3B46]">
                  Kashier checkout
                </p>
                <div ref={frameContainerRef} className="min-h-[520px] w-full" />
                <p className="font-inter text-xs leading-5 text-[#102329]/50">
                  Do not refresh while the bank challenge is open. If the page reloads,
                  your payment state will be restored from the booking reference.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
