"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchPublicOfferingRecords,
  type PublicOffering,
} from "@/lib/api/offerings";

export default function BookingLanding() {
  const [offerings, setOfferings] = useState<PublicOffering[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadOfferings = async () => {
      setIsLoading(true);
      setError("");

      try {
        const nextOfferings = await fetchPublicOfferingRecords();
        setOfferings(nextOfferings);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load offerings.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadOfferings();
  }, []);

  return (
    <main className="min-h-screen bg-[#F7F4EE] text-[#102329]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-[#102329]/12 pb-5">
          <Link href="/" className="font-inter text-xs font-semibold uppercase tracking-[0.22em]">
            Rammah
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              href="/booking/status"
              className="font-inter text-sm font-semibold text-[#102329]/62 transition-colors hover:text-[#0F3B46]"
            >
              Status
            </Link>
            <Link
              href="/#services"
              className="font-inter text-sm font-semibold text-[#102329]/62 transition-colors hover:text-[#0F3B46]"
            >
              Services
            </Link>
          </nav>
        </header>

        <section className="flex flex-1 flex-col justify-center py-12">
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
            Booking
          </p>
          <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-none tracking-normal sm:text-6xl lg:text-7xl">
            Choose a service to start.
          </h1>
          <p className="mt-5 max-w-2xl font-inter text-base leading-7 text-[#102329]/68">
            Free booking is available for services configured as free. Paid and quote-only flows
            will route through their own checkout and quote paths later.
          </p>

          <div className="mt-10 grid gap-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse bg-white/70" />
              ))
            ) : error ? (
              <p className="border-l-2 border-red-700 pl-3 font-inter text-sm text-red-700">
                {error}
              </p>
            ) : offerings.length > 0 ? (
              offerings.map((offering) => (
                <Link
                  key={offering.id}
                  href={`/booking/${offering.slug}`}
                  className="group grid gap-3 border-y border-[#102329]/12 py-5 transition-colors hover:border-[#0F3B46] sm:grid-cols-[minmax(0,1fr)_160px]"
                >
                  <span>
                    <span className="block text-2xl font-semibold tracking-normal">
                      {offering.title}
                    </span>
                    <span className="mt-2 block font-inter text-sm leading-6 text-[#102329]/58">
                      {offering.description || offering.subtitle || "Review availability and booking mode."}
                    </span>
                  </span>
                  <span className="self-center justify-self-start font-inter text-sm font-semibold text-[#0F3B46] sm:justify-self-end">
                    Start booking
                  </span>
                </Link>
              ))
            ) : (
              <p className="font-inter text-sm text-[#102329]/55">No services are published yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
