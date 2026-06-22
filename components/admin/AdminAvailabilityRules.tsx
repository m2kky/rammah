"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  archiveAdminAvailabilityRule,
  createAdminAvailabilityRule,
  fetchAdminAvailabilityRules,
  fetchAdminOfferings,
  updateAdminAvailabilityRule,
  type AdminAvailabilityRule,
  type AdminAvailabilityRulePayload,
  type AdminOffering,
  type AdminOfferingStatus,
} from "@/lib/api/admin";

type RuleFormState = {
  offeringId: string;
  weekday: string;
  startTime: string;
  endTime: string;
  timezone: string;
  slotDurationMinutes: string;
  bufferBeforeMinutes: string;
  bufferAfterMinutes: string;
  status: AdminOfferingStatus;
};

const defaultRuleState: RuleFormState = {
  offeringId: "",
  weekday: "1",
  startTime: "09:00",
  endTime: "13:00",
  timezone: "Africa/Cairo",
  slotDurationMinutes: "60",
  bufferBeforeMinutes: "0",
  bufferAfterMinutes: "0",
  status: "published",
};

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

const statusClasses: Record<AdminOfferingStatus, string> = {
  draft: "border-[#102329]/20 text-[#102329]/65",
  published: "border-[#0F3B46] bg-[#0F3B46] text-white",
  scheduled: "border-[#8A6F2A] text-[#8A6F2A]",
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
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const toFormState = (rule: AdminAvailabilityRule): RuleFormState => ({
  offeringId: rule.offering.id,
  weekday: String(rule.weekday),
  startTime: rule.startTime,
  endTime: rule.endTime,
  timezone: rule.timezone,
  slotDurationMinutes: String(rule.slotDurationMinutes),
  bufferBeforeMinutes: String(rule.bufferBeforeMinutes),
  bufferAfterMinutes: String(rule.bufferAfterMinutes),
  status: rule.status,
});

const toPayload = (state: RuleFormState): AdminAvailabilityRulePayload => ({
  offeringId: state.offeringId,
  weekday: Number(state.weekday),
  startTime: state.startTime,
  endTime: state.endTime,
  timezone: state.timezone.trim() || "Africa/Cairo",
  slotDurationMinutes: Number(state.slotDurationMinutes),
  bufferBeforeMinutes: Number(state.bufferBeforeMinutes),
  bufferAfterMinutes: Number(state.bufferAfterMinutes),
  status: state.status,
});

const getWeekdayLabel = (weekday: number) =>
  weekdays.find((day) => Number(day.value) === weekday)?.label ?? `Day ${weekday}`;

export default function AdminAvailabilityRules() {
  const [rules, setRules] = useState<AdminAvailabilityRule[]>([]);
  const [offerings, setOfferings] = useState<AdminOffering[]>([]);
  const [form, setForm] = useState<RuleFormState>(defaultRuleState);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AdminOfferingStatus | "all">("all");
  const [offeringFilter, setOfferingFilter] = useState<string | "all">("all");
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true);
  const [isLoadingRules, setIsLoadingRules] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchivingId, setIsArchivingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const firstUsableOfferingId = useMemo(
    () =>
      offerings.find((offering) => offering.status !== "archived")?.id ??
      offerings[0]?.id ??
      "",
    [offerings],
  );

  const counts = useMemo(() => {
    return rules.reduce(
      (acc, rule) => {
        acc[rule.status] += 1;
        return acc;
      },
      { draft: 0, published: 0, scheduled: 0, archived: 0 } as Record<AdminOfferingStatus, number>,
    );
  }, [rules]);

  const loadOfferings = useCallback(async () => {
    setIsLoadingOfferings(true);
    setError("");

    try {
      const nextOfferings = await fetchAdminOfferings({ status: "all" });
      setOfferings(nextOfferings);
      setForm((current) => {
        if (current.offeringId || nextOfferings.length === 0) return current;

        return {
          ...current,
          offeringId:
            nextOfferings.find((offering) => offering.status !== "archived")?.id ??
            nextOfferings[0].id,
        };
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load offerings.");
    } finally {
      setIsLoadingOfferings(false);
    }
  }, []);

  const loadRules = useCallback(async () => {
    setIsLoadingRules(true);
    setError("");

    try {
      const nextRules = await fetchAdminAvailabilityRules({
        offeringId: offeringFilter,
        status: statusFilter,
      });
      setRules(nextRules);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load availability rules.");
    } finally {
      setIsLoadingRules(false);
    }
  }, [offeringFilter, statusFilter]);

  useEffect(() => {
    void loadOfferings();
  }, [loadOfferings]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const updateForm = <T extends keyof RuleFormState>(field: T, value: RuleFormState[T]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      ...defaultRuleState,
      offeringId: firstUsableOfferingId,
    });
    setEditingRuleId(null);
  };

  const handleEdit = (rule: AdminAvailabilityRule) => {
    setForm(toFormState(rule));
    setEditingRuleId(rule.id);
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.offeringId) {
      setError("Select an offering before saving an availability rule.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const payload = toPayload(form);

      if (editingRuleId) {
        await updateAdminAvailabilityRule(editingRuleId, payload);
      } else {
        await createAdminAvailabilityRule(payload);
      }

      resetForm();
      await loadRules();
    } catch (saveError) {
      if (saveError instanceof AdminApiError) {
        const firstDetail = saveError.details[0]?.message;
        setError(firstDetail ? `${saveError.message} ${firstDetail}` : saveError.message);
      } else {
        setError("Could not save availability rule.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (rule: AdminAvailabilityRule) => {
    if (rule.status === "archived") return;

    setIsArchivingId(rule.id);
    setError("");

    try {
      await archiveAdminAvailabilityRule(rule.id);
      await loadRules();

      if (editingRuleId === rule.id) {
        resetForm();
      }
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not archive rule.");
    } finally {
      setIsArchivingId(null);
    }
  };

  const isLoading = isLoadingOfferings || isLoadingRules;

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 border-b border-[#102329]/10 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
            Booking
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">
            Availability
          </h1>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Weekly rules used by the booking engine to calculate available appointment slots.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void Promise.all([loadOfferings(), loadRules()])}
          disabled={isLoading}
          className="h-11 w-fit border border-[#102329]/20 px-5 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
        >
          {isLoading ? "Refreshing" : "Refresh"}
        </button>
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

      <div className="grid gap-3 border-y border-[#102329]/10 py-4 lg:grid-cols-[minmax(220px,360px)_1fr] lg:items-center lg:justify-between">
        <label className="block">
          <span className="sr-only">Filter by offering</span>
          <select
            value={offeringFilter}
            onChange={(event) => setOfferingFilter(event.target.value)}
            className="h-11 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          >
            <option value="all">All offerings</option>
            {offerings.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offering.title}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-2 overflow-x-auto lg:justify-end">
          {statusOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatusFilter(option)}
              className={`h-10 whitespace-nowrap border px-4 font-inter text-sm font-semibold transition-colors ${
                statusFilter === option
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

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 border border-[#102329]/12 bg-white/55 p-4 xl:grid-cols-[minmax(220px,1.5fr)_1fr_1fr_1fr_1fr_1fr_auto]"
      >
        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Offering
          </span>
          <select
            value={form.offeringId}
            onChange={(event) => updateForm("offeringId", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
          >
            <option value="" disabled>
              Select offering
            </option>
            {offerings.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offering.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Day
          </span>
          <select
            value={form.weekday}
            onChange={(event) => updateForm("weekday", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          >
            {weekdays.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Start
          </span>
          <input
            type="time"
            value={form.startTime}
            onChange={(event) => updateForm("startTime", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            End
          </span>
          <input
            type="time"
            value={form.endTime}
            onChange={(event) => updateForm("endTime", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Slot
          </span>
          <input
            type="number"
            min={1}
            max={1440}
            value={form.slotDurationMinutes}
            onChange={(event) => updateForm("slotDurationMinutes", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
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
            {(["draft", "published", "scheduled", "archived"] as AdminOfferingStatus[]).map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={isSaving || isLoadingOfferings}
            className="h-11 bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
          >
            {isSaving ? "Saving" : editingRuleId ? "Update" : "Add"}
          </button>
          {editingRuleId && (
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
            Timezone
          </span>
          <input
            value={form.timezone}
            onChange={(event) => updateForm("timezone", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Buffer before
          </span>
          <input
            type="number"
            min={0}
            max={1440}
            value={form.bufferBeforeMinutes}
            onChange={(event) => updateForm("bufferBeforeMinutes", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Buffer after
          </span>
          <input
            type="number"
            min={0}
            max={1440}
            value={form.bufferAfterMinutes}
            onChange={(event) => updateForm("bufferAfterMinutes", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="border-b border-[#102329]/14 text-left">
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Offering
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Day
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Window
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Slot
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Timezone
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
            {isLoadingRules ? (
              Array.from({ length: 4 }).map((_, index) => (
                <tr key={index} className="border-b border-[#102329]/8">
                  <td colSpan={8} className="py-5">
                    <div className="h-7 animate-pulse bg-[#102329]/8" />
                  </td>
                </tr>
              ))
            ) : rules.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-14 text-center font-inter text-sm text-[#102329]/55">
                  No availability rules match the current filters.
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id} className="border-b border-[#102329]/8 align-top transition-colors hover:bg-white/55">
                  <td className="py-5 pr-5">
                    <p className="text-lg font-semibold leading-tight">{rule.offering.title}</p>
                    <p className="mt-1 font-inter text-xs text-[#102329]/48">/{rule.offering.slug}</p>
                  </td>
                  <td className="py-5 pr-5">
                    <p className="font-inter text-sm font-semibold">{getWeekdayLabel(rule.weekday)}</p>
                    <p className="mt-1 font-inter text-xs text-[#102329]/48">
                      {weekdays[rule.weekday]?.shortLabel ?? rule.weekday}
                    </p>
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">
                    {rule.startTime} - {rule.endTime}
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">
                    {rule.slotDurationMinutes} min
                    <p className="mt-1 text-xs text-[#102329]/45">
                      {rule.bufferBeforeMinutes}/{rule.bufferAfterMinutes} buffer
                    </p>
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm text-[#102329]/65">
                    {rule.timezone}
                  </td>
                  <td className="py-5 pr-5">
                    <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${statusClasses[rule.status]}`}>
                      {statusLabels[rule.status]}
                    </span>
                  </td>
                  <td className="py-5 pr-5 font-inter text-xs leading-5 text-[#102329]/55">
                    {formatDateTime(rule.updatedAt)}
                  </td>
                  <td className="py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(rule)}
                        className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleArchive(rule)}
                        disabled={rule.status === "archived" || isArchivingId === rule.id}
                        className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-red-700 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {isArchivingId === rule.id ? "Archiving" : "Archive"}
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
