"use client";

import {
  type FormEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AdminApiError,
  archiveAdminOfferingPrice,
  createAdminOfferingPrice,
  fetchAdminOfferingPrices,
  updateAdminOfferingPrice,
  type AdminOfferingPrice,
  type AdminOfferingPriceMetadata,
  type AdminOfferingPricePayload,
  type AdminOfferingStatus,
} from "@/lib/api/admin";

type PriceFormState = {
  name: string;
  countryCodes: string[];
  countrySearch: string;
  currency: string;
  baseAmount: string;
  earlyBirdAmount: string;
  earlyBirdEndsAt: string;
  status: AdminOfferingStatus;
};

const emptyMetadata: AdminOfferingPriceMetadata = {
  supportedCurrencies: [],
  countries: [],
};

const emptyForm = (currency = ""): PriceFormState => ({
  name: "",
  countryCodes: [],
  countrySearch: "",
  currency,
  baseAmount: "",
  earlyBirdAmount: "",
  earlyBirdEndsAt: "",
  status: "published",
});

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

const amountToMinor = (value: string) => {
  const amount = Number(value.trim());
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

const minorToAmount = (value: number | null) =>
  value === null ? "" : (value / 100).toFixed(2).replace(/\.00$/, "");

const isoToInputDateTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 16);
};

const inputDateTimeToIso = (value: string) => {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const formatAmount = (minor: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);

const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "No end date";

const toFormState = (price: AdminOfferingPrice): PriceFormState => ({
  name: price.name,
  countryCodes: price.countryCodes,
  countrySearch: "",
  currency: price.currency,
  baseAmount: minorToAmount(price.baseAmountMinor),
  earlyBirdAmount: minorToAmount(price.earlyBirdAmountMinor),
  earlyBirdEndsAt: isoToInputDateTime(price.earlyBirdEndsAt),
  status: price.status,
});

const toPayload = (state: PriceFormState): AdminOfferingPricePayload => ({
  name: state.name.trim(),
  countryCodes: state.countryCodes,
  currency: state.currency,
  baseAmountMinor: amountToMinor(state.baseAmount),
  earlyBirdAmountMinor: state.earlyBirdAmount.trim()
    ? amountToMinor(state.earlyBirdAmount)
    : null,
  earlyBirdEndsAt: inputDateTimeToIso(state.earlyBirdEndsAt),
  status: state.status === "draft" ? "draft" : "published",
});

export default function AdminOfferingPricing({ offeringId }: { offeringId?: string }) {
  const [prices, setPrices] = useState<AdminOfferingPrice[]>([]);
  const [metadata, setMetadata] = useState<AdminOfferingPriceMetadata>(emptyMetadata);
  const [form, setForm] = useState<PriceFormState>(() => emptyForm());
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(offeringId));
  const [isSaving, setIsSaving] = useState(false);
  const [isArchivingId, setIsArchivingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const canManagePrices = Boolean(offeringId);
  const editingPrice = prices.find(({ id }) => id === editingPriceId) ?? null;
  const isReadOnly = Boolean(
    editingPrice && editingPrice.status !== "draft" && editingPrice.status !== "published",
  );
  const deferredCountrySearch = useDeferredValue(form.countrySearch.trim().toLowerCase());

  const countriesByCode = useMemo(
    () => new Map(metadata.countries.map((country) => [country.code, country])),
    [metadata.countries],
  );
  const selectedCountries = form.countryCodes.map(
    (code) => countriesByCode.get(code) ?? { code, name: code },
  );
  const countryOptions = useMemo(() => {
    const selected = new Set(form.countryCodes);
    return metadata.countries
      .filter(({ code, name }) => {
        if (selected.has(code)) return false;
        return !deferredCountrySearch ||
          code.toLowerCase().includes(deferredCountrySearch) ||
          name.toLowerCase().includes(deferredCountrySearch);
      })
      .slice(0, 12);
  }, [deferredCountrySearch, form.countryCodes, metadata.countries]);

  const sortedPrices = useMemo(
    () =>
      [...prices].sort((a, b) => {
        if (a.status === "archived" && b.status !== "archived") return 1;
        if (a.status !== "archived" && b.status === "archived") return -1;
        return a.name.localeCompare(b.name) || a.currency.localeCompare(b.currency);
      }),
    [prices],
  );

  const loadPrices = useCallback(async () => {
    if (!offeringId) return;
    setIsLoading(true);
    setErrors([]);
    try {
      const result = await fetchAdminOfferingPrices(offeringId);
      setPrices(result.prices);
      setMetadata(result.meta);
      setForm((current) => ({
        ...current,
        currency: current.currency || result.meta.supportedCurrencies[0] || "",
      }));
    } catch (loadError) {
      setErrors([
        loadError instanceof Error ? loadError.message : "Could not load price groups.",
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [offeringId]);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  const updateForm = <T extends keyof PriceFormState>(field: T, value: PriceFormState[T]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm(metadata.supportedCurrencies[0] || ""));
    setEditingPriceId(null);
    setErrors([]);
  };

  const handleEdit = (price: AdminOfferingPrice) => {
    setForm(toFormState(price));
    setEditingPriceId(price.id);
    setErrors([]);
  };

  const addCountry = (countryCode: string) => {
    setForm((current) => ({
      ...current,
      countryCodes: [...current.countryCodes, countryCode],
      countrySearch: "",
    }));
  };

  const removeCountry = (countryCode: string) => {
    setForm((current) => ({
      ...current,
      countryCodes: current.countryCodes.filter((code) => code !== countryCode),
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!offeringId || isReadOnly) return;
    setErrors([]);

    const validationErrors: string[] = [];
    if (!form.name.trim()) validationErrors.push("Enter a group name.");
    if (form.countryCodes.length === 0) validationErrors.push("Select at least one country.");
    if (!form.currency) validationErrors.push("Select a supported currency.");
    const hasEarlyAmount = Boolean(form.earlyBirdAmount.trim());
    const hasEarlyExpiry = Boolean(form.earlyBirdEndsAt.trim());
    if (hasEarlyAmount !== hasEarlyExpiry) {
      validationErrors.push("Enter both the Early-booking price and its end date and time.");
    }
    if (hasEarlyAmount && amountToMinor(form.earlyBirdAmount) >= amountToMinor(form.baseAmount)) {
      validationErrors.push("Early-booking price must be lower than the Standard price.");
    }
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
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
        setErrors(
          saveError.details.length > 0
            ? saveError.details.map(({ message }) => message)
            : [saveError.message],
        );
      } else {
        setErrors(["Could not save the price group."]);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (price: AdminOfferingPrice) => {
    if (!offeringId || price.status === "archived") return;
    setIsArchivingId(price.id);
    setErrors([]);
    try {
      await archiveAdminOfferingPrice(offeringId, price.id);
      await loadPrices();
      if (editingPriceId === price.id) resetForm();
    } catch (archiveError) {
      setErrors([
        archiveError instanceof Error ? archiveError.message : "Could not archive the price group.",
      ]);
    } finally {
      setIsArchivingId(null);
    }
  };

  return (
    <section className="space-y-5 border-t border-[#102329]/12 pt-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Price groups</h2>
          <p className="mt-2 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Group countries that share one checkout price. A country can belong to one active
            group for this offering.
          </p>
        </div>
        {canManagePrices ? (
          <button
            type="button"
            onClick={() => void loadPrices()}
            disabled={isLoading}
            className="h-10 w-fit border border-[#102329]/20 px-4 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
          >
            {isLoading ? "Refreshing" : "Refresh groups"}
          </button>
        ) : null}
      </div>

      {!canManagePrices ? (
        <p className="border-l-2 border-[#0F3B46] pl-3 font-inter text-sm leading-6 text-[#102329]/65">
          Save the offering first, then add its price groups.
        </p>
      ) : (
        <>
          {errors.length > 0 ? (
            <div role="alert" className="border-l-2 border-red-600 pl-3 font-inter text-sm leading-6 text-red-700">
              {errors.map((error) => <p key={error}>{error}</p>)}
            </div>
          ) : null}

          {isReadOnly ? (
            <p className="border-l-2 border-[#8A6F2A] pl-3 font-inter text-sm text-[#6F581E]">
              Archived groups are read-only.
            </p>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5 border border-[#102329]/12 bg-white/55 p-4">
            <fieldset disabled={isReadOnly || isSaving} className="space-y-5 disabled:opacity-70">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">Group name</span>
                  <input
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    placeholder="GCC, Egypt, Europe EUR"
                    className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                    required
                  />
                </label>

                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">Currency</span>
                  <select
                    value={form.currency}
                    onChange={(event) => updateForm("currency", event.target.value)}
                    className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                    required
                  >
                    {metadata.supportedCurrencies.map((currency) => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">Standard price</span>
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
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) => updateForm("status", event.target.value as AdminOfferingStatus)}
                    className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    {isReadOnly ? <option value={form.status}>{statusLabels[form.status]}</option> : null}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr_1fr]">
                <div>
                  <label className="block">
                    <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">Search countries</span>
                    <input
                      value={form.countrySearch}
                      onChange={(event) => updateForm("countrySearch", event.target.value)}
                      placeholder="Type a country name or code"
                      className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                    />
                  </label>
                  <div className="mt-2 flex min-h-10 flex-wrap gap-2" aria-label="Selected countries">
                    {selectedCountries.length === 0 ? (
                      <span className="font-inter text-xs leading-8 text-[#102329]/45">No countries selected</span>
                    ) : selectedCountries.map(({ code, name }) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => removeCountry(code)}
                        aria-label={`Remove ${name}`}
                        className="inline-flex h-8 items-center gap-2 border border-[#0F3B46]/25 bg-[#0F3B46]/6 px-3 font-inter text-xs font-semibold text-[#0F3B46]"
                      >
                        <span>{name}</span><span aria-hidden="true">×</span>
                      </button>
                    ))}
                  </div>
                  {!isReadOnly ? (
                    <div className="mt-2 grid max-h-40 grid-cols-1 gap-1 overflow-y-auto border border-[#102329]/10 bg-white p-2 sm:grid-cols-2" aria-label="Country results">
                      {countryOptions.length === 0 ? (
                        <p className="p-2 font-inter text-xs text-[#102329]/50">No matching countries.</p>
                      ) : countryOptions.map(({ code, name }) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => addCountry(code)}
                          aria-label={`Add ${name}`}
                          className="flex min-h-9 items-center justify-between px-2 text-left font-inter text-xs text-[#102329]/72 transition-colors hover:bg-[#0F3B46]/7 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0F3B46]"
                        >
                          <span>{name}</span><span className="font-semibold text-[#102329]/42">{code}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">Early-booking price</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.earlyBirdAmount}
                    onChange={(event) => updateForm("earlyBirdAmount", event.target.value)}
                    className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                  />
                  <span className="mt-2 block font-inter text-xs leading-5 text-[#102329]/48">Optional; enter its end time too.</span>
                </label>

                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">Early-booking ends</span>
                  <input
                    type="datetime-local"
                    value={form.earlyBirdEndsAt}
                    onChange={(event) => updateForm("earlyBirdEndsAt", event.target.value)}
                    className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                  />
                </label>
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-2">
              {!isReadOnly ? (
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-11 bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
                >
                  {isSaving ? "Saving" : editingPriceId ? "Update price group" : "Add price group"}
                </button>
              ) : null}
              {editingPriceId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-11 border border-[#102329]/20 px-4 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
                >
                  Close
                </button>
              ) : null}
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b border-[#102329]/14 text-left">
                  {['Group', 'Countries', 'Standard', 'Early-booking', 'Status'].map((label) => (
                    <th key={label} className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">{label}</th>
                  ))}
                  <th className="py-3 text-right font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 2 }).map((_, index) => (
                    <tr key={index} className="border-b border-[#102329]/8"><td colSpan={6} className="py-5"><div className="h-7 animate-pulse bg-[#102329]/8" /></td></tr>
                  ))
                ) : sortedPrices.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center font-inter text-sm text-[#102329]/55">No price groups have been added for this offering.</td></tr>
                ) : sortedPrices.map((price) => (
                  <tr key={price.id} className="border-b border-[#102329]/8 align-top transition-colors hover:bg-white/55">
                    <td className="py-5 pr-5"><p className="text-lg font-semibold leading-tight">{price.name}</p><p className="mt-1 font-inter text-xs text-[#102329]/48">{price.currency}</p></td>
                    <td className="py-5 pr-5"><div className="flex max-w-xs flex-wrap gap-1">{price.countryCodes.map((code) => <span key={code} className="border border-[#102329]/12 px-2 py-1 font-inter text-xs text-[#102329]/65">{countriesByCode.get(code)?.name ?? code}</span>)}</div></td>
                    <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">{formatAmount(price.baseAmountMinor, price.currency)}</td>
                    <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">{price.earlyBirdAmountMinor === null ? "Not set" : formatAmount(price.earlyBirdAmountMinor, price.currency)}<p className="mt-1 text-xs text-[#102329]/45">{formatDateTime(price.earlyBirdEndsAt)}</p></td>
                    <td className="py-5 pr-5"><span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${statusClasses[price.status]}`}>{statusLabels[price.status]}</span></td>
                    <td className="py-5 text-right"><div className="flex justify-end gap-2">
                      <button type="button" onClick={() => handleEdit(price)} aria-label={`${price.status === "archived" ? "View" : "Edit"} ${price.name}`} className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]">{price.status === "archived" ? "View" : "Edit"}</button>
                      {price.status !== "archived" ? (
                        <button type="button" onClick={() => void handleArchive(price)} aria-label={`Archive ${price.name}`} disabled={isArchivingId === price.id} className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-red-700 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-35">{isArchivingId === price.id ? "Archiving" : "Archive"}</button>
                      ) : null}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
