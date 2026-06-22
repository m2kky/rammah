"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  archiveAdminOfferingPrice,
  createAdminOfferingPrice,
  fetchAdminOfferingPrices,
  updateAdminOfferingPrice,
  type AdminOfferingPrice,
  type AdminOfferingPricePayload,
  type AdminOfferingStatus,
} from "@/lib/api/admin";

type PriceFormState = {
  countryCode: string;
  currency: string;
  baseAmount: string;
  earlyBirdAmount: string;
  earlyBirdEndsAt: string;
  status: AdminOfferingStatus;
};

const defaultPriceState: PriceFormState = {
  countryCode: "EG",
  currency: "EGP",
  baseAmount: "",
  earlyBirdAmount: "",
  earlyBirdEndsAt: "",
  status: "published",
};

const statusLabels: Record<AdminOfferingStatus, string> = {
  draft: "Draft",
  published: "Published",
  scheduled: "Scheduled",
  archived: "Archived",
};

const statusClasses: Record<AdminOfferingStatus, string> = {
  draft: "border-[#102329]/20 text-[#102329]/65",
  published: "border-[#0F3B46] bg-[#0F3B46] text-white",
  scheduled: "border-[#8A6F2A] text-[#8A6F2A]",
  archived: "border-[#102329]/15 text-[#102329]/38",
};

const commonCurrencies = ["EGP", "USD", "SAR", "AED", "EUR", "GBP"];
const commonCountries = ["EG", "US", "SA", "AE", "GB", "KW", "QA"];

const normalizeCode = (value: string, length: number) =>
  value
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, length);

const amountToMinor = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return 0;

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return 0;

  return Math.round(amount * 100);
};

const minorToAmount = (value: number | null) => {
  if (value === null) return "";
  return (value / 100).toFixed(2).replace(/\.00$/, "");
};

const isoToInputDateTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
};

const inputDateTimeToIso = (value: string) => {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const formatAmount = (minor: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);

const formatDateTime = (value: string | null) => {
  if (!value) return "No end date";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const toFormState = (price: AdminOfferingPrice): PriceFormState => ({
  countryCode: price.countryCode,
  currency: price.currency,
  baseAmount: minorToAmount(price.baseAmountMinor),
  earlyBirdAmount: minorToAmount(price.earlyBirdAmountMinor),
  earlyBirdEndsAt: isoToInputDateTime(price.earlyBirdEndsAt),
  status: price.status,
});

const toPayload = (state: PriceFormState): AdminOfferingPricePayload => ({
  countryCode: normalizeCode(state.countryCode, 2),
  currency: normalizeCode(state.currency, 3),
  baseAmountMinor: amountToMinor(state.baseAmount),
  earlyBirdAmountMinor: state.earlyBirdAmount.trim()
    ? amountToMinor(state.earlyBirdAmount)
    : null,
  earlyBirdEndsAt: inputDateTimeToIso(state.earlyBirdEndsAt),
  status: state.status,
});

export default function AdminOfferingPricing({ offeringId }: { offeringId?: string }) {
  const [prices, setPrices] = useState<AdminOfferingPrice[]>([]);
  const [form, setForm] = useState<PriceFormState>(defaultPriceState);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(offeringId));
  const [isSaving, setIsSaving] = useState(false);
  const [isArchivingId, setIsArchivingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const canManagePrices = Boolean(offeringId);

  const sortedPrices = useMemo(
    () =>
      [...prices].sort((a, b) => {
        if (a.status === "archived" && b.status !== "archived") return 1;
        if (a.status !== "archived" && b.status === "archived") return -1;
        return `${a.countryCode}-${a.currency}`.localeCompare(`${b.countryCode}-${b.currency}`);
      }),
    [prices],
  );

  const loadPrices = async () => {
    if (!offeringId) return;

    setIsLoading(true);
    setError("");

    try {
      const nextPrices = await fetchAdminOfferingPrices(offeringId);
      setPrices(nextPrices);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load prices.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringId]);

  const updateForm = <T extends keyof PriceFormState>(field: T, value: PriceFormState[T]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(defaultPriceState);
    setEditingPriceId(null);
  };

  const handleEdit = (price: AdminOfferingPrice) => {
    setForm(toFormState(price));
    setEditingPriceId(price.id);
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!offeringId) return;

    setIsSaving(true);
    setError("");

    try {
      const payload = toPayload(form);

      if (editingPriceId) {
        await updateAdminOfferingPrice(offeringId, editingPriceId, payload);
      } else {
        await createAdminOfferingPrice(offeringId, payload);
      }

      resetForm();
      await loadPrices();
    } catch (saveError) {
      if (saveError instanceof AdminApiError) {
        const firstDetail = saveError.details[0]?.message;
        setError(firstDetail ? `${saveError.message} ${firstDetail}` : saveError.message);
      } else {
        setError("Could not save price.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (price: AdminOfferingPrice) => {
    if (!offeringId || price.status === "archived") return;

    setIsArchivingId(price.id);
    setError("");

    try {
      await archiveAdminOfferingPrice(offeringId, price.id);
      await loadPrices();
      if (editingPriceId === price.id) {
        resetForm();
      }
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not archive price.");
    } finally {
      setIsArchivingId(null);
    }
  };

  return (
    <section className="space-y-5 border-t border-[#102329]/12 pt-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Pricing</h2>
          <p className="mt-2 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Country and currency rows used later by paid booking and country detection.
          </p>
        </div>

        {canManagePrices && (
          <button
            type="button"
            onClick={() => void loadPrices()}
            disabled={isLoading}
            className="h-10 w-fit border border-[#102329]/20 px-4 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
          >
            {isLoading ? "Refreshing" : "Refresh prices"}
          </button>
        )}
      </div>

      {!canManagePrices ? (
        <p className="border-l-2 border-[#0F3B46] pl-3 font-inter text-sm leading-6 text-[#102329]/65">
          Save the offering first, then add country pricing.
        </p>
      ) : (
        <>
          {error && (
            <p className="border-l-2 border-red-600 pl-3 font-inter text-sm leading-6 text-red-700">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="grid gap-4 border border-[#102329]/12 bg-white/55 p-4 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
            <label className="block">
              <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                Country
              </span>
              <input
                list="admin-price-countries"
                value={form.countryCode}
                onChange={(event) => updateForm("countryCode", normalizeCode(event.target.value, 2))}
                className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                required
              />
            </label>

            <label className="block">
              <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                Currency
              </span>
              <input
                list="admin-price-currencies"
                value={form.currency}
                onChange={(event) => updateForm("currency", normalizeCode(event.target.value, 3))}
                className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                required
              />
            </label>

            <label className="block">
              <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                Base amount
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.baseAmount}
                onChange={(event) => updateForm("baseAmount", event.target.value)}
                className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                required
              />
            </label>

            <label className="block">
              <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                Early bird
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.earlyBirdAmount}
                onChange={(event) => updateForm("earlyBirdAmount", event.target.value)}
                className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
              />
            </label>

            <label className="block">
              <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                Status
              </span>
              <select
                value={form.status}
                onChange={(event) => updateForm("status", event.target.value as AdminOfferingStatus)}
                className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="h-11 bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
              >
                {isSaving ? "Saving" : editingPriceId ? "Update" : "Add"}
              </button>
              {editingPriceId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-11 border border-[#102329]/20 px-4 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
                >
                  Clear
                </button>
              )}
            </div>

            <label className="block xl:col-span-2">
              <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                Early bird ends
              </span>
              <input
                type="datetime-local"
                value={form.earlyBirdEndsAt}
                onChange={(event) => updateForm("earlyBirdEndsAt", event.target.value)}
                className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
              />
            </label>

            <datalist id="admin-price-countries">
              {commonCountries.map((countryCode) => (
                <option key={countryCode} value={countryCode} />
              ))}
            </datalist>
            <datalist id="admin-price-currencies">
              {commonCurrencies.map((currency) => (
                <option key={currency} value={currency} />
              ))}
            </datalist>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse">
              <thead>
                <tr className="border-b border-[#102329]/14 text-left">
                  <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Market
                  </th>
                  <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Base
                  </th>
                  <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Early bird
                  </th>
                  <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Status
                  </th>
                  <th className="py-3 text-right font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 2 }).map((_, index) => (
                    <tr key={index} className="border-b border-[#102329]/8">
                      <td colSpan={5} className="py-5">
                        <div className="h-7 animate-pulse bg-[#102329]/8" />
                      </td>
                    </tr>
                  ))
                ) : sortedPrices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center font-inter text-sm text-[#102329]/55">
                      No prices have been added for this offering.
                    </td>
                  </tr>
                ) : (
                  sortedPrices.map((price) => (
                    <tr key={price.id} className="border-b border-[#102329]/8 align-top transition-colors hover:bg-white/55">
                      <td className="py-5 pr-5">
                        <p className="text-lg font-semibold leading-tight">{price.countryCode}</p>
                        <p className="mt-1 font-inter text-xs text-[#102329]/48">{price.currency}</p>
                      </td>
                      <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">
                        {formatAmount(price.baseAmountMinor, price.currency)}
                      </td>
                      <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">
                        {price.earlyBirdAmountMinor === null
                          ? "Not set"
                          : formatAmount(price.earlyBirdAmountMinor, price.currency)}
                        <p className="mt-1 text-xs text-[#102329]/45">
                          {formatDateTime(price.earlyBirdEndsAt)}
                        </p>
                      </td>
                      <td className="py-5 pr-5">
                        <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${statusClasses[price.status]}`}>
                          {statusLabels[price.status]}
                        </span>
                      </td>
                      <td className="py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(price)}
                            className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleArchive(price)}
                            disabled={price.status === "archived" || isArchivingId === price.id}
                            className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-red-700 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {isArchivingId === price.id ? "Archiving" : "Archive"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
