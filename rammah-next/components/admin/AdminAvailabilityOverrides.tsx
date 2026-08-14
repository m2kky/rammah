"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AdminApiError,
  createAdminAvailabilityOverride,
  deleteAdminAvailabilityOverride,
  fetchAdminAvailabilityOverrides,
  updateAdminAvailabilityOverride,
  type AdminAvailabilityOverride,
  type AdminAvailabilityOverridePayload,
  type AdminAvailabilityOverrideType,
} from "@/lib/api/admin";

type OverrideFormState = {
  date: string;
  type: AdminAvailabilityOverrideType;
  startLocalTime: string;
  endLocalTime: string;
  reason: string;
};

const defaultOverrideState: OverrideFormState = {
  date: "",
  type: "unavailable",
  startLocalTime: "09:00",
  endLocalTime: "13:00",
  reason: "",
};
const typeLabels: Record<AdminAvailabilityOverrideType, string> = {
  unavailable: "Closed date",
  available: "Extra available window",
};
const typeClasses: Record<AdminAvailabilityOverrideType, string> = {
  unavailable: "border-red-700 text-red-700",
  available: "border-[#0F3B46] bg-[#0F3B46] text-white",
};
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
const toFormState = (override: AdminAvailabilityOverride): OverrideFormState => ({
  date: override.date,
  type: override.type,
  startLocalTime: override.startLocalTime ?? "09:00",
  endLocalTime: override.endLocalTime ?? "13:00",
  reason: override.reason ?? "",
});
const toPayload = (form: OverrideFormState): AdminAvailabilityOverridePayload => ({
  date: form.date,
  type: form.type,
  startLocalTime: form.type === "available" ? form.startLocalTime : null,
  endLocalTime: form.type === "available" ? form.endLocalTime : null,
  reason: form.reason.trim() || null,
});

export default function AdminAvailabilityOverrides() {
  const [overrides, setOverrides] = useState<AdminAvailabilityOverride[]>([]);
  const [form, setForm] = useState<OverrideFormState>(defaultOverrideState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<AdminAvailabilityOverrideType | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadOverrides = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setOverrides(await fetchAdminAvailabilityOverrides({
        type: typeFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load date overrides.");
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, typeFilter]);

  useEffect(() => {
    void loadOverrides();
  }, [loadOverrides]);

  const updateForm = <T extends keyof OverrideFormState>(field: T, value: OverrideFormState[T]) =>
    setForm((current) => ({ ...current, [field]: value }));
  const resetForm = () => {
    setForm(defaultOverrideState);
    setEditingId(null);
  };
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      const payload = toPayload(form);
      if (editingId) {
        await updateAdminAvailabilityOverride(editingId, payload);
      } else {
        await createAdminAvailabilityOverride(payload);
      }
      resetForm();
      await loadOverrides();
    } catch (saveError) {
      if (saveError instanceof AdminApiError) {
        const detail = saveError.details[0]?.message;
        setError(detail ? `${saveError.message} ${detail}` : saveError.message);
      } else {
        setError("Could not save the date override.");
      }
    } finally {
      setIsSaving(false);
    }
  };
  const handleDelete = async (override: AdminAvailabilityOverride) => {
    if (!globalThis.confirm("Permanently delete this date override?")) return;
    setDeletingId(override.id);
    setError("");
    try {
      await deleteAdminAvailabilityOverride(override.id);
      if (editingId === override.id) resetForm();
      await loadOverrides();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete override.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="space-y-7 border-t border-[#102329]/12 pt-8">
      <div>
        <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">Exceptions</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">Date overrides</h2>
        <p className="mt-3 max-w-3xl font-inter text-sm leading-6 text-[#102329]/62">
          Close a complete local calendar date, or add one or more extra available windows for a
          specific date. These settings apply globally to every appointment Offering.
        </p>
      </div>

      <div className="grid gap-3 border-y border-[#102329]/10 py-4 sm:grid-cols-3">
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as AdminAvailabilityOverrideType | "all")} className="h-11 border border-[#102329]/18 bg-white px-3 font-inter text-sm">
          <option value="all">All override types</option>
          <option value="unavailable">Closed dates</option>
          <option value="available">Extra available windows</option>
        </select>
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="Overrides from date" className="h-11 border border-[#102329]/18 bg-white px-3 font-inter text-sm" />
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="Overrides to date" className="h-11 border border-[#102329]/18 bg-white px-3 font-inter text-sm" />
      </div>

      {error ? <p className="border-l-2 border-red-600 pl-3 font-inter text-sm leading-6 text-red-700">{error}</p> : null}

      <form onSubmit={handleSubmit} className="grid gap-4 border border-[#102329]/12 bg-white/55 p-4 lg:grid-cols-[1fr_1.2fr_1fr_1fr_auto]">
        <label className="block"><span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">Date</span><input type="date" value={form.date} onChange={(event) => updateForm("date", event.target.value)} className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm" required /></label>
        <label className="block"><span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">Type</span><select value={form.type} onChange={(event) => updateForm("type", event.target.value as AdminAvailabilityOverrideType)} className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm"><option value="unavailable">Closed date</option><option value="available">Extra available window</option></select></label>
        <label className="block"><span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">Start</span><input type="time" value={form.startLocalTime} onChange={(event) => updateForm("startLocalTime", event.target.value)} disabled={form.type === "unavailable"} className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm disabled:bg-[#102329]/5" required={form.type === "available"} /></label>
        <label className="block"><span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">End</span><input type="time" value={form.endLocalTime} onChange={(event) => updateForm("endLocalTime", event.target.value)} disabled={form.type === "unavailable"} className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm disabled:bg-[#102329]/5" required={form.type === "available"} /></label>
        <div className="flex items-end gap-2"><button type="submit" disabled={isSaving} className="h-11 bg-[#102329] px-5 font-inter text-sm font-semibold text-white disabled:opacity-50">{isSaving ? "Saving" : editingId ? "Update" : "Add override"}</button>{editingId ? <button type="button" onClick={resetForm} className="h-11 border border-[#102329]/20 px-4 font-inter text-sm font-semibold">Clear</button> : null}</div>
        <label className="block lg:col-span-4"><span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">Reason</span><input value={form.reason} onChange={(event) => updateForm("reason", event.target.value)} placeholder="Optional internal note" className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm" /></label>
      </form>

      <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse">
        <thead><tr className="border-b border-[#102329]/14 text-left">{['Date', 'Type', 'Window', 'Reason', 'Updated'].map((label) => <th key={label} className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">{label}</th>)}<th className="py-3 text-right font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">Actions</th></tr></thead>
        <tbody>
          {isLoading ? <tr><td colSpan={6} className="py-12 text-center font-inter text-sm text-[#102329]/55">Loading date overrides...</td></tr> : null}
          {!isLoading && overrides.length === 0 ? <tr><td colSpan={6} className="py-12 text-center font-inter text-sm text-[#102329]/55">No date overrides match these filters.</td></tr> : null}
          {!isLoading ? overrides.map((override) => <tr key={override.id} className="border-b border-[#102329]/8 align-top">
            <td className="py-5 pr-5"><p className="font-inter text-sm font-semibold">{formatDate(override.date)}</p><p className="mt-1 font-inter text-xs text-[#102329]/48">{override.date}</p></td>
            <td className="py-5 pr-5"><span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${typeClasses[override.type]}`}>{typeLabels[override.type]}</span></td>
            <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">{override.type === "available" ? `${override.startLocalTime} - ${override.endLocalTime}` : "Whole date"}</td>
            <td className="py-5 pr-5 font-inter text-sm text-[#102329]/62">{override.reason ?? "No note"}</td>
            <td className="py-5 pr-5 font-inter text-xs text-[#102329]/55">{formatDateTime(override.updatedAt)}</td>
            <td className="py-5 text-right"><div className="flex justify-end gap-2"><button type="button" onClick={() => { setForm(toFormState(override)); setEditingId(override.id); setError(""); }} className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold">Edit</button><button type="button" onClick={() => void handleDelete(override)} disabled={deletingId === override.id} className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 hover:border-red-700 hover:text-red-700 disabled:opacity-35">{deletingId === override.id ? "Deleting" : "Delete"}</button></div></td>
          </tr>) : null}
        </tbody>
      </table></div>
    </section>
  );
}
