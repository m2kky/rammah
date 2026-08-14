"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  createAdminAvailabilityWindow,
  deleteOrArchiveAdminAvailabilityWindow,
  fetchAdminAvailabilityWindows,
  updateAdminAvailabilityWindow,
  type AdminAvailabilityWindow,
  type AdminAvailabilityWindowPayload,
  type AdminAvailabilityWindowStatus,
} from "@/lib/api/admin";

type WindowFormState = {
  weekday: string;
  startLocalTime: string;
  endLocalTime: string;
  status: "draft" | "published";
};

const defaultWindowState: WindowFormState = {
  weekday: "1",
  startLocalTime: "09:00",
  endLocalTime: "13:00",
  status: "published",
};

const statusOptions: Array<AdminAvailabilityWindowStatus | "all"> = [
  "all",
  "draft",
  "published",
  "archived",
];
const statusLabels: Record<AdminAvailabilityWindowStatus | "all", string> = {
  all: "All",
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};
const statusClasses: Record<AdminAvailabilityWindowStatus, string> = {
  draft: "border-[#102329]/20 text-[#102329]/65",
  published: "border-[#0F3B46] bg-[#0F3B46] text-white",
  archived: "border-[#102329]/15 text-[#102329]/38",
};
const weekdays = [
  { value: "0", shortLabel: "Sun", label: "Sunday" },
  { value: "1", shortLabel: "Mon", label: "Monday" },
  { value: "2", shortLabel: "Tue", label: "Tuesday" },
  { value: "3", shortLabel: "Wed", label: "Wednesday" },
  { value: "4", shortLabel: "Thu", label: "Thursday" },
  { value: "5", shortLabel: "Fri", label: "Friday" },
  { value: "6", shortLabel: "Sat", label: "Saturday" },
];
const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
const getWeekdayLabel = (weekday: number) =>
  weekdays.find((day) => Number(day.value) === weekday)?.label ?? `Day ${weekday}`;
const toFormState = (window: AdminAvailabilityWindow): WindowFormState => ({
  weekday: String(window.weekday),
  startLocalTime: window.startLocalTime,
  endLocalTime: window.endLocalTime,
  status: window.status === "published" ? "published" : "draft",
});
const toPayload = (state: WindowFormState): AdminAvailabilityWindowPayload => ({
  weekday: Number(state.weekday),
  startLocalTime: state.startLocalTime,
  endLocalTime: state.endLocalTime,
  status: state.status,
});

export default function AdminAvailabilityRules() {
  const [windows, setWindows] = useState<AdminAvailabilityWindow[]>([]);
  const [form, setForm] = useState<WindowFormState>(defaultWindowState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<AdminAvailabilityWindowStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const counts = useMemo(
    () =>
      windows.reduce(
        (result, window) => ({ ...result, [window.status]: result[window.status] + 1 }),
        { draft: 0, published: 0, archived: 0 },
      ),
    [windows],
  );

  const loadWindows = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setWindows(await fetchAdminAvailabilityWindows({ status: statusFilter }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load working hours.");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadWindows();
  }, [loadWindows]);

  const updateForm = <T extends keyof WindowFormState>(field: T, value: WindowFormState[T]) =>
    setForm((current) => ({ ...current, [field]: value }));
  const resetForm = () => {
    setForm(defaultWindowState);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      const payload = toPayload(form);
      if (editingId) {
        await updateAdminAvailabilityWindow(editingId, payload);
      } else {
        await createAdminAvailabilityWindow(payload);
      }
      resetForm();
      await loadWindows();
    } catch (saveError) {
      if (saveError instanceof AdminApiError) {
        const detail = saveError.details[0]?.message;
        setError(detail ? `${saveError.message} ${detail}` : saveError.message);
      } else {
        setError("Could not save the working-hours window.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOrArchive = async (window: AdminAvailabilityWindow) => {
    const action = window.allowedActions.delete ? "permanently delete" : "archive";
    if (!globalThis.confirm(`Are you sure you want to ${action} this working-hours window?`)) {
      return;
    }
    setPendingActionId(window.id);
    setError("");
    try {
      await deleteOrArchiveAdminAvailabilityWindow(window.id);
      if (editingId === window.id) resetForm();
      await loadWindows();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Could not ${action} window.`);
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 border-b border-[#102329]/10 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
            Booking
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">Availability</h1>
          <p className="mt-3 max-w-3xl font-inter text-sm leading-6 text-[#102329]/62">
            Set the coach&apos;s global weekly working hours. Add more than one window to the same
            day when there is a break; appointment duration, capacity, and buffers come from the
            selected Offering in the preview and booking flow.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadWindows()}
          disabled={isLoading}
          className="h-11 w-fit border border-[#102329]/20 px-5 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
        >
          {isLoading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["published", "draft", "archived"] as AdminAvailabilityWindowStatus[]).map((status) => (
          <div key={status} className="border-t border-[#102329]/12 pt-3">
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/45">
              {statusLabels[status]}
            </p>
            <p className="mt-2 text-3xl font-semibold">{counts[status]}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-y border-[#102329]/10 py-4">
        {statusOptions.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={`h-10 whitespace-nowrap border px-4 font-inter text-sm font-semibold transition-colors ${
              statusFilter === status
                ? "border-[#0F3B46] bg-[#0F3B46] text-white"
                : "border-[#102329]/16 text-[#102329]/65 hover:border-[#102329]/35"
            }`}
          >
            {statusLabels[status]}
          </button>
        ))}
      </div>

      {error ? (
        <p className="border-l-2 border-red-600 pl-3 font-inter text-sm leading-6 text-red-700">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 border border-[#102329]/12 bg-white/55 p-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
      >
        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">Day</span>
          <select
            value={form.weekday}
            onChange={(event) => updateForm("weekday", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
          >
            {weekdays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">Start</span>
          <input type="time" value={form.startLocalTime} onChange={(event) => updateForm("startLocalTime", event.target.value)} className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]" required />
        </label>
        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">End</span>
          <input type="time" value={form.endLocalTime} onChange={(event) => updateForm("endLocalTime", event.target.value)} className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]" required />
        </label>
        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">Status</span>
          <select value={form.status} onChange={(event) => updateForm("status", event.target.value as WindowFormState["status"])} className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" disabled={isSaving} className="h-11 bg-[#102329] px-5 font-inter text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-50">
            {isSaving ? "Saving" : editingId ? "Update" : "Add window"}
          </button>
          {editingId ? <button type="button" onClick={resetForm} className="h-11 border border-[#102329]/20 px-4 font-inter text-sm font-semibold">Clear</button> : null}
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead><tr className="border-b border-[#102329]/14 text-left">
            {['Day', 'Working window', 'Status', 'Updated'].map((label) => <th key={label} className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">{label}</th>)}
            <th className="py-3 text-right font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">Actions</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="py-12 text-center font-inter text-sm text-[#102329]/55">Loading working hours...</td></tr> : null}
            {!isLoading && windows.length === 0 ? <tr><td colSpan={5} className="py-12 text-center font-inter text-sm text-[#102329]/55">No working-hours windows match this filter.</td></tr> : null}
            {!isLoading ? windows.map((window) => (
              <tr key={window.id} className="border-b border-[#102329]/8 align-top">
                <td className="py-5 pr-5"><p className="font-inter text-sm font-semibold">{getWeekdayLabel(window.weekday)}</p><p className="mt-1 font-inter text-xs text-[#102329]/48">{weekdays[window.weekday]?.shortLabel}</p></td>
                <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">{window.startLocalTime} - {window.endLocalTime}</td>
                <td className="py-5 pr-5"><span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${statusClasses[window.status]}`}>{statusLabels[window.status]}</span></td>
                <td className="py-5 pr-5 font-inter text-xs text-[#102329]/55">{formatDateTime(window.updatedAt)}</td>
                <td className="py-5 text-right"><div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setForm(toFormState(window)); setEditingId(window.id); setError(""); }} disabled={!window.allowedActions.edit} className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold disabled:opacity-35">Edit</button>
                  {(window.allowedActions.delete || window.allowedActions.archive) ? <button type="button" onClick={() => void handleDeleteOrArchive(window)} disabled={pendingActionId === window.id} className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 hover:border-red-700 hover:text-red-700 disabled:opacity-35">{pendingActionId === window.id ? "Working" : window.allowedActions.delete ? "Delete" : "Archive"}</button> : null}
                </div></td>
              </tr>
            )) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
