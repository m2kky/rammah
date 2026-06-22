"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AdminApiError,
  archiveAdminOffering,
  fetchAdminOfferings,
  type AdminOffering,
  type AdminOfferingStatus,
} from "@/lib/api/admin";

const statusOptions: Array<AdminOfferingStatus | "all"> = [
  "all",
  "draft",
  "published",
  "scheduled",
  "archived",
];

const statusLabels: Record<AdminOfferingStatus | "all", string> = {
  all: "All",
  draft: "Draft",
  published: "Published",
  scheduled: "Scheduled",
  archived: "Archived",
};

const bookingModeLabels: Record<AdminOffering["bookingMode"], string> = {
  free: "Free",
  paid: "Paid",
  quote_only: "Quote",
};

const statusClasses: Record<AdminOfferingStatus, string> = {
  draft: "border-[#102329]/20 text-[#102329]/65",
  published: "border-[#0F3B46] bg-[#0F3B46] text-white",
  scheduled: "border-[#8A6F2A] text-[#8A6F2A]",
  archived: "border-[#102329]/15 text-[#102329]/38",
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function AdminOfferingsTable() {
  const [offerings, setOfferings] = useState<AdminOffering[]>([]);
  const [status, setStatus] = useState<AdminOfferingStatus | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isArchivingId, setIsArchivingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadOfferings = async () => {
    setIsLoading(true);
    setError("");

    try {
      const nextOfferings = await fetchAdminOfferings({ status, search });
      setOfferings(nextOfferings);
    } catch (loadError) {
      if (loadError instanceof AdminApiError) {
        setError(loadError.message);
      } else {
        setError("Could not load offerings.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOfferings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  const counts = useMemo(() => {
    return offerings.reduce(
      (acc, offering) => {
        acc[offering.status] += 1;
        return acc;
      },
      { draft: 0, published: 0, scheduled: 0, archived: 0 } as Record<AdminOfferingStatus, number>,
    );
  }, [offerings]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleArchive = async (offering: AdminOffering) => {
    if (offering.status === "archived") return;

    setIsArchivingId(offering.id);
    setError("");

    try {
      await archiveAdminOffering(offering.id);
      await loadOfferings();
    } catch (archiveError) {
      if (archiveError instanceof AdminApiError) {
        setError(archiveError.message);
      } else {
        setError("Could not archive offering.");
      }
    } finally {
      setIsArchivingId(null);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 border-b border-[#102329]/10 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
            Content
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">Offerings</h1>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Public services and programs that drive booking, quote, and payment flows.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/offerings/new"
            className="inline-flex h-11 items-center bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46]"
          >
            New offering
          </Link>
          <button
            type="button"
            onClick={() => void loadOfferings()}
            disabled={isLoading}
            className="h-11 w-fit border border-[#102329]/20 px-5 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
          >
            {isLoading ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(["published", "draft", "scheduled", "archived"] as AdminOfferingStatus[]).map((item) => (
          <div key={item} className="border-t border-[#102329]/12 pt-3">
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/45">
              {statusLabels[item]}
            </p>
            <p className="mt-2 text-3xl font-semibold">{counts[item]}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-y border-[#102329]/10 py-4 lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search title or slug"
            className="h-11 w-full min-w-0 border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46] sm:w-[300px]"
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse">
          <thead>
            <tr className="border-b border-[#102329]/14 text-left">
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Offering
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Category
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Booking
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Duration
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Status
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Updated
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
                  <td colSpan={7} className="py-5">
                    <div className="h-7 animate-pulse bg-[#102329]/8" />
                  </td>
                </tr>
              ))
            ) : offerings.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center font-inter text-sm text-[#102329]/55">
                  No offerings match the current filters.
                </td>
              </tr>
            ) : (
              offerings.map((offering) => (
                <tr key={offering.id} className="border-b border-[#102329]/8 align-top transition-colors hover:bg-white/55">
                  <td className="py-5 pr-5">
                    <div className="flex gap-3">
                      <span
                        className="mt-1 h-8 w-8 shrink-0 border border-[#102329]/10"
                        style={{
                          backgroundColor: offering.displayConfig.backgroundColor ?? "#ffffff",
                        }}
                      />
                      <div>
                        <p className="text-lg font-semibold leading-tight">{offering.title}</p>
                        <p className="mt-1 font-inter text-xs text-[#102329]/48">/{offering.slug}</p>
                        {offering.shortDescription && (
                          <p className="mt-2 max-w-sm font-inter text-sm leading-5 text-[#102329]/58">
                            {offering.shortDescription}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm text-[#102329]/65">
                    {offering.category?.name ?? "Unassigned"}
                  </td>
                  <td className="py-5 pr-5">
                    <p className="font-inter text-sm font-semibold">{bookingModeLabels[offering.bookingMode]}</p>
                    <p className="mt-1 font-inter text-xs text-[#102329]/48">{offering.attendanceMode}</p>
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm text-[#102329]/65">
                    {offering.durationMinutes} min
                  </td>
                  <td className="py-5 pr-5">
                    <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${statusClasses[offering.status]}`}>
                      {statusLabels[offering.status]}
                    </span>
                  </td>
                  <td className="py-5 pr-5 font-inter text-xs leading-5 text-[#102329]/55">
                    {formatDateTime(offering.updatedAt)}
                  </td>
                  <td className="py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/offerings/${offering.id}/edit`}
                        className="inline-flex h-9 items-center border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleArchive(offering)}
                        disabled={offering.status === "archived" || isArchivingId === offering.id}
                        className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-red-700 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {isArchivingId === offering.id ? "Archiving" : "Archive"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
