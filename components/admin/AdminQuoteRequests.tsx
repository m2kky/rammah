"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  fetchAdminQuoteRequest,
  fetchAdminQuoteRequests,
  updateAdminQuoteRequest,
  type AdminQuoteRequest,
  type AdminQuoteRequestStatus,
} from "@/lib/api/admin";

const statusOptions: Array<AdminQuoteRequestStatus | "all"> = [
  "all",
  "new",
  "reviewing",
  "contacted",
  "won",
  "lost",
  "archived",
];

const statusLabels: Record<AdminQuoteRequestStatus | "all", string> = {
  all: "All",
  new: "New",
  reviewing: "Reviewing",
  contacted: "Contacted",
  won: "Won",
  lost: "Lost",
  archived: "Archived",
};

const statusClasses: Record<AdminQuoteRequestStatus, string> = {
  new: "border-[#8A6F2A] bg-[#8A6F2A] text-white",
  reviewing: "border-[#8A6F2A] text-[#8A6F2A]",
  contacted: "border-[#0F3B46] text-[#0F3B46]",
  won: "border-[#0F3B46] bg-[#0F3B46] text-white",
  lost: "border-red-700 text-red-700",
  archived: "border-[#102329]/15 text-[#102329]/38",
};

const formatDate = (value: string | null) => {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export default function AdminQuoteRequests() {
  const [quoteRequests, setQuoteRequests] = useState<AdminQuoteRequest[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<AdminQuoteRequest | null>(null);
  const [status, setStatus] = useState<AdminQuoteRequestStatus | "all">("all");
  const [nextStatus, setNextStatus] = useState<AdminQuoteRequestStatus>("reviewing");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    return quoteRequests.reduce(
      (acc, quoteRequest) => {
        acc[quoteRequest.status] += 1;
        return acc;
      },
      {
        new: 0,
        reviewing: 0,
        contacted: 0,
        won: 0,
        lost: 0,
        archived: 0,
      } as Record<AdminQuoteRequestStatus, number>,
    );
  }, [quoteRequests]);

  const loadQuoteRequests = async () => {
    setIsLoading(true);
    setError("");

    try {
      const nextQuoteRequests = await fetchAdminQuoteRequests({ status, search });
      const nextSelected = selectedQuote
        ? nextQuoteRequests.find((quoteRequest) => quoteRequest.id === selectedQuote.id)
        : nextQuoteRequests[0];
      setQuoteRequests(nextQuoteRequests);
      setSelectedQuote(nextSelected ?? null);
      setNotes(nextSelected?.adminNotes ?? "");
      setNextStatus(nextSelected?.status ?? "reviewing");
    } catch (loadError) {
      setError(loadError instanceof AdminApiError ? loadError.message : "Could not load quote requests.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadQuoteRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleSelectQuote = async (quoteRequest: AdminQuoteRequest) => {
    setSelectedQuote(quoteRequest);
    setNotes(quoteRequest.adminNotes ?? "");
    setNextStatus(quoteRequest.status);
    setIsLoadingDetail(true);
    setError("");
    setMessage("");

    try {
      const detail = await fetchAdminQuoteRequest(quoteRequest.id);
      setSelectedQuote(detail);
      setNotes(detail.adminNotes ?? "");
      setNextStatus(detail.status);
    } catch (detailError) {
      setError(detailError instanceof AdminApiError ? detailError.message : "Could not load quote request.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const replaceQuote = (updatedQuote: AdminQuoteRequest) => {
    setSelectedQuote(updatedQuote);
    setNotes(updatedQuote.adminNotes ?? "");
    setNextStatus(updatedQuote.status);
    setQuoteRequests((current) => {
      if (status !== "all" && updatedQuote.status !== status) {
        return current.filter((quoteRequest) => quoteRequest.id !== updatedQuote.id);
      }

      return current.map((quoteRequest) =>
        quoteRequest.id === updatedQuote.id ? updatedQuote : quoteRequest,
      );
    });
  };

  const handleStatusSave = async () => {
    if (!selectedQuote) return;

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const updatedQuote = await updateAdminQuoteRequest(selectedQuote.id, {
        status: nextStatus,
      });
      replaceQuote(updatedQuote);
      setMessage("Quote status updated.");
    } catch (saveError) {
      setError(saveError instanceof AdminApiError ? saveError.message : "Could not update quote status.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotesSave = async () => {
    if (!selectedQuote) return;

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const updatedQuote = await updateAdminQuoteRequest(selectedQuote.id, {
        adminNotes: notes.trim() || null,
      });
      replaceQuote(updatedQuote);
      setMessage("Quote notes saved.");
    } catch (saveError) {
      setError(saveError instanceof AdminApiError ? saveError.message : "Could not save notes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 border-b border-[#102329]/10 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
            Sales
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">
            Quote requests
          </h1>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Review corporate and custom requests submitted from the public quote flow.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadQuoteRequests()}
          disabled={isLoading}
          className="h-11 w-fit border border-[#102329]/20 px-5 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
        >
          {isLoading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(["new", "reviewing", "contacted", "won"] as AdminQuoteRequestStatus[]).map((item) => (
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
            placeholder="Search customer, company, email"
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

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse">
            <thead>
              <tr className="border-b border-[#102329]/14 text-left">
                <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Customer
                </th>
                <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Request
                </th>
                <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Status
                </th>
                <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Submitted
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
                    <td colSpan={5} className="py-5">
                      <div className="h-7 animate-pulse bg-[#102329]/8" />
                    </td>
                  </tr>
                ))
              ) : quoteRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center font-inter text-sm text-[#102329]/55">
                    No quote requests match the current filters.
                  </td>
                </tr>
              ) : (
                quoteRequests.map((quoteRequest) => (
                  <tr key={quoteRequest.id} className="border-b border-[#102329]/8 align-top transition-colors hover:bg-white/55">
                    <td className="py-5 pr-5">
                      <p className="text-lg font-semibold leading-tight">{quoteRequest.customer.fullName}</p>
                      <p className="mt-1 font-inter text-xs text-[#102329]/48">{quoteRequest.customer.email}</p>
                      {quoteRequest.customer.companyName && (
                        <p className="mt-1 font-inter text-xs text-[#102329]/48">
                          {quoteRequest.customer.companyName}
                        </p>
                      )}
                    </td>
                    <td className="py-5 pr-5">
                      <p className="font-inter text-sm font-semibold">
                        {quoteRequest.offering?.title ?? "Custom request"}
                      </p>
                      <p className="mt-1 font-inter text-xs text-[#102329]/48">
                        {quoteRequest.participantsCount
                          ? `${quoteRequest.participantsCount} participants`
                          : "Participants not set"}
                      </p>
                    </td>
                    <td className="py-5 pr-5">
                      <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${statusClasses[quoteRequest.status]}`}>
                        {statusLabels[quoteRequest.status]}
                      </span>
                    </td>
                    <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">
                      {formatDate(quoteRequest.createdAt)}
                    </td>
                    <td className="py-5 text-right">
                      <button
                        type="button"
                        onClick={() => void handleSelectQuote(quoteRequest)}
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

          {!selectedQuote ? (
            <p className="mt-5 font-inter text-sm leading-6 text-[#102329]/55">
              Select a quote request to review details.
            </p>
          ) : (
            <div className="mt-5 space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">{selectedQuote.customer.fullName}</h2>
                <p className="mt-1 font-inter text-sm text-[#102329]/55">
                  {selectedQuote.customer.email}
                </p>
                {selectedQuote.customer.phone && (
                  <p className="mt-1 font-inter text-sm text-[#102329]/55">
                    {selectedQuote.customer.phone}
                  </p>
                )}
              </div>

              <div className="grid gap-4 border-y border-[#102329]/10 py-4">
                <div>
                  <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Offering
                  </p>
                  <p className="mt-2 font-inter text-sm font-semibold">
                    {selectedQuote.offering?.title ?? "Custom request"}
                  </p>
                </div>
                <div>
                  <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Preferred date
                  </p>
                  <p className="mt-2 font-inter text-sm text-[#102329]/70">
                    {selectedQuote.preferredDate ?? "Not set"}
                  </p>
                </div>
                <div>
                  <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Message
                  </p>
                  <p className="mt-2 whitespace-pre-wrap font-inter text-sm leading-6 text-[#102329]/70">
                    {selectedQuote.message ?? "No message."}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Status
                </label>
                <div className="flex gap-2">
                  <select
                    value={nextStatus}
                    onChange={(event) => setNextStatus(event.target.value as AdminQuoteRequestStatus)}
                    className="h-11 min-w-0 flex-1 border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
                  >
                    {statusOptions
                      .filter((option): option is AdminQuoteRequestStatus => option !== "all")
                      .map((option) => (
                        <option key={option} value={option}>
                          {statusLabels[option]}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleStatusSave()}
                    disabled={isSaving || nextStatus === selectedQuote.status}
                    className="h-11 border border-[#0F3B46] bg-[#0F3B46] px-4 font-inter text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Admin notes
                </label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={5}
                  className="w-full resize-none border border-[#102329]/18 bg-white px-3 py-3 font-inter text-sm leading-6 outline-none focus:border-[#0F3B46]"
                />
                <button
                  type="button"
                  onClick={() => void handleNotesSave()}
                  disabled={isSaving || notes === (selectedQuote.adminNotes ?? "")}
                  className="h-11 w-full border border-[#102329]/20 px-4 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isSaving ? "Saving" : "Save notes"}
                </button>
              </div>

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
