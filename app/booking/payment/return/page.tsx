import Link from "next/link";
import { reconcilePublicPayment } from "@/lib/api/bookings";

type BookingPaymentReturnPageProps = {
  searchParams: Promise<{
    booking?: string;
  }>;
};

export default async function BookingPaymentReturnPage({
  searchParams,
}: BookingPaymentReturnPageProps) {
  const { booking } = await searchParams;
  const reconciliation = booking
    ? await reconcilePublicPayment(booking).catch(() => null)
    : null;
  const isPaid = reconciliation?.payment.status === "paid";
  const title = isPaid ? "Payment confirmed." : "We are checking your payment.";
  const body = isPaid
    ? "Your booking has been confirmed after verifying the payment with Kashier."
    : "The final booking state is based on the signed payment callback and Kashier reconciliation. Open the booking status page to see the current result.";

  return (
    <main className="min-h-screen bg-[#F7F4EE] text-[#102329]">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-6 sm:px-8">
        <header className="border-b border-[#102329]/12 pb-5">
          <Link href="/" className="font-inter text-xs font-semibold uppercase tracking-normal">
            Rammah
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center py-12">
          <p className="font-inter text-xs font-semibold uppercase text-[#0F3B46]">
            Payment return
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-none tracking-normal">
            {title}
          </h1>
          <p className="mt-5 font-inter text-base leading-7 text-[#102329]/68">
            {body}
          </p>
          {reconciliation && (
            <dl className="mt-6 grid gap-4 border-y border-[#102329]/12 py-5 sm:grid-cols-2">
              <div>
                <dt className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                  Payment state
                </dt>
                <dd className="mt-2 font-inter text-sm font-semibold capitalize">
                  {reconciliation.payment.status.replace("_", " ")}
                </dd>
              </div>
              <div>
                <dt className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                  Kashier state
                </dt>
                <dd className="mt-2 font-inter text-sm font-semibold">
                  {reconciliation.reconciliation.status ?? "Unknown"}
                </dd>
              </div>
            </dl>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {booking ? (
              <Link
                href={`/booking/status/${encodeURIComponent(booking)}`}
                className="inline-flex h-11 items-center justify-center bg-[#102329] px-5 font-inter text-sm font-semibold text-white"
              >
                View booking status
              </Link>
            ) : (
              <Link
                href="/booking/status"
                className="inline-flex h-11 items-center justify-center bg-[#102329] px-5 font-inter text-sm font-semibold text-white"
              >
                Check booking status
              </Link>
            )}
            {booking && (
              <Link
                href={`/booking/payment/${encodeURIComponent(booking)}`}
                className="inline-flex h-11 items-center justify-center border border-[#102329]/18 px-5 font-inter text-sm font-semibold text-[#102329]/70"
              >
                Back to payment
              </Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
