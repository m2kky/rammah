"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  createAdminAvailabilityOverride,
  deleteAdminAvailabilityOverride,
  fetchAdminAvailabilityOverrides,
  fetchAdminAvailabilityRules,
  fetchAdminOfferings,
  updateAdminAvailabilityOverride,
  type AdminAvailabilityOverride,
  type AdminAvailabilityOverridePayload,
  type AdminAvailabilityOverrideType,
  type AdminAvailabilityRule,
  type AdminOffering,
} from "@/lib/api/admin";

type OverrideFormState = {
  offeringId: string;
  availabilityRuleId: string;
  date: string;
  overrideType: AdminAvailabilityOverrideType;
  isFullDay: boolean;
  startsAtTime: string;
  endsAtTime: string;
  reason: string;
};

const padNumber = (value: number) => String(value).padStart(2, "0");

const getTodayInputValue = () => {
  const today = new Date();
  return `${today.getFullYear()}-${padNumber(today.getMonth() + 1)}-${padNumber(today.getDate())}`;
};

const defaultOverrideState: OverrideFormState = {
  offeringId: "",
  availabilityRuleId: "",
  date: getTodayInputValue(),
  overrideType: "blocked",
  isFullDay: true,
  startsAtTime: "09:00",
  endsAtTime: "11:00",
  reason: "",
};

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const overrideTypeLabels: Record<AdminAvailabilityOverrideType | "all", string> = {
  all: "All",
  available: "Available",
  blocked: "Blocked",
};

const overrideTypeClasses: Record<AdminAvailabilityOverrideType, string> = {
  available: "border-[#0F3B46] bg-[#0F3B46] text-white",
  blocked: "border-red-700 text-red-700",
};

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(year, month - 1, day));
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const formatTime = (value: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
};

const toIsoTimestamp = (date: string, time: string) => {
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const getRuleLabel = (rule: AdminAvailabilityRule) => {
  const day = weekdays[rule.weekday] ?? `Day ${rule.weekday}`;
  return `${day}, ${rule.startTime}-${rule.endTime}`;
};

const toFormState = (override: AdminAvailabilityOverride): OverrideFormState => ({
  offeringId: override.offering.id,
  availabilityRuleId: override.availabilityRule?.id ?? "",
  date: override.date,
  overrideType: override.overrideType,
  isFullDay: !override.startsAt && !override.endsAt,
  startsAtTime: formatTime(override.startsAt) || "09:00",
  endsAtTime: formatTime(override.endsAt) || "11:00",
  reason: override.reason ?? "",
});

const toPayload = (state: OverrideFormState): AdminAvailabilityOverridePayload => {
  const shouldSendWindow = state.overrideType === "available" || !state.isFullDay;
  const startsAt = shouldSendWindow ? toIsoTimestamp(state.date, state.startsAtTime) : null;
  const endsAt = shouldSendWindow ? toIsoTimestamp(state.date, state.endsAtTime) : null;

  return {
    offeringId: state.offeringId,
    availabilityRuleId: state.availabilityRuleId || null,
    date: state.date,
    overrideType: state.overrideType,
    startsAt,
    endsAt,
    reason: state.reason.trim() || null,
  };
};

const getWindowLabel = (override: AdminAvailabilityOverride) => {
  if (!override.startsAt && !override.endsAt) {
    return "Full day";
  }

  return `${formatTime(override.startsAt)} - ${formatTime(override.endsAt)}`;
};

export default function AdminAvailabilityOverrides() {
  const [overrides, setOverrides] = useState<AdminAvailabilityOverride[]>([]);
  const [offerings, setOfferings] = useState<AdminOffering[]>([]);
  const [rules, setRules] = useState<AdminAvailabilityRule[]>([]);
  const [form, setForm] = useState<OverrideFormState>(defaultOverrideState);
  const [editingOverrideId, setEditingOverrideId] = useState<string | null>(null);
  const [offeringFilter, setOfferingFilter] = useState<string | "all">("all");
  const [typeFilter, setTypeFilter] = useState<AdminAvailabilityOverrideType | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isLoadingSetup, setIsLoadingSetup] = useState(true);
  const [isLoadingOverrides, setIsLoadingOverrides] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const firstUsableOfferingId = useMemo(
    () =>
      offerings.find((offering) => offering.status !== "archived")?.id ??
      offerings[0]?.id ??
      "",
    [offerings],
  );

  const availableRuleOptions = useMemo(
    () =>
      rules.filter(
        (rule) => rule.offering.id === form.offeringId && rule.status !== "archived",
      ),
    [form.offeringId, rules],
  );

  const counts = useMemo(
    () =>
      overrides.reduce(
        (acc, override) => {
          acc[override.overrideType] += 1;
          return acc;
        },
        { available: 0, blocked: 0 } as Record<AdminAvailabilityOverrideType, number>,
      ),
    [overrides],
  );

  const loadSetup = useCallback(async () => {
    setIsLoadingSetup(true);
    setError("");

    try {
      const [nextOfferings, nextRules] = await Promise.all([
        fetchAdminOfferings({ status: "all" }),
        fetchAdminAvailabilityRules(),
      ]);

      setOfferings(nextOfferings);
      setRules(nextRules);
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
      setError(loadError instanceof Error ? loadError.message : "Could not load override setup.");
    } finally {
      setIsLoadingSetup(false);
    }
  }, []);

  const loadOverrides = useCallback(async () => {
    setIsLoadingOverrides(true);
    setError("");

    try {
      const nextOverrides = await fetchAdminAvailabilityOverrides({
        offeringId: offeringFilter,
        overrideType: typeFilter,
        dateFrom,
        dateTo,
      });
      setOverrides(nextOverrides);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load overrides.");
    } finally {
      setIsLoadingOverrides(false);
    }
  }, [dateFrom, dateTo, offeringFilter, typeFilter]);

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  useEffect(() => {
    void loadOverrides();
  }, [loadOverrides]);

  const updateForm = <T extends keyof OverrideFormState>(
    field: T,
    value: OverrideFormState[T],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleOfferingChange = (offeringId: string) => {
    setForm((current) => ({
      ...current,
      offeringId,
      availabilityRuleId: "",
    }));
  };

  const handleOverrideTypeChange = (overrideType: AdminAvailabilityOverrideType) => {
    setForm((current) => ({
      ...current,
      overrideType,
      isFullDay: overrideType === "available" ? false : current.isFullDay,
    }));
  };

  const resetForm = () => {
    setForm({
      ...defaultOverrideState,
      offeringId: firstUsableOfferingId,
    });
    setEditingOverrideId(null);
  };

  const handleEdit = (override: AdminAvailabilityOverride) => {
    setForm(toFormState(override));
    setEditingOverrideId(override.id);
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.offeringId) {
      setError("Select an offering before saving an override.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const payload = toPayload(form);

      if (editingOverrideId) {
        await updateAdminAvailabilityOverride(editingOverrideId, payload);
      } else {
        await createAdminAvailabilityOverride(payload);
      }

      resetForm();
      await loadOverrides();
    } catch (saveError) {
      if (saveError instanceof AdminApiError) {
        const firstDetail = saveError.details[0]?.message;
        setError(firstDetail ? `${saveError.message} ${firstDetail}` : saveError.message);
      } else {
        setError("Could not save override.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (override: AdminAvailabilityOverride) => {
    setIsDeletingId(override.id);
    setError("");

    try {
      await deleteAdminAvailabilityOverride(override.id);
      await loadOverrides();

      if (editingOverrideId === override.id) {
        resetForm();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete override.");
    } finally {
      setIsDeletingId(null);
    }
  };

  const isLoading = isLoadingSetup || isLoadingOverrides;

  return (
    <section className="space-y-7 border-t border-[#102329]/12 pt-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
            Exceptions
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
            Date overrides
          </h2>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            One-off blocked or available windows layered on top of the weekly rules.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void Promise.all([loadSetup(), loadOverrides()])}
          disabled={isLoading}
          className="h-11 w-fit border border-[#102329]/20 px-5 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
        >
          {isLoading ? "Refreshing" : "Refresh overrides"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(["blocked", "available"] as AdminAvailabilityOverrideType[]).map((item) => (
          <div key={item} className="border-t border-[#102329]/12 pt-3">
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/45">
              {overrideTypeLabels[item]}
            </p>
            <p className="mt-2 text-3xl font-semibold">{counts[item]}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 border-y border-[#102329]/10 py-4 xl:grid-cols-[minmax(220px,320px)_minmax(140px,180px)_minmax(140px,180px)_minmax(140px,180px)_auto] xl:items-center">
        <label className="block">
          <span className="sr-only">Filter overrides by offering</span>
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

        <label className="block">
          <span className="sr-only">Filter by override type</span>
          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as AdminAvailabilityOverrideType | "all")
            }
            className="h-11 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          >
            {(["all", "blocked", "available"] as Array<AdminAvailabilityOverrideType | "all">).map(
              (type) => (
                <option key={type} value={type}>
                  {overrideTypeLabels[type]}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Date from</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-11 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          />
        </label>

        <label className="block">
          <span className="sr-only">Date to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-11 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          />
        </label>

        <button
          type="button"
          onClick={() => {
            setOfferingFilter("all");
            setTypeFilter("all");
            setDateFrom("");
            setDateTo("");
          }}
          className="h-11 border border-[#102329]/20 px-5 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
        >
          Clear filters
        </button>
      </div>

      {error && (
        <p className="border-l-2 border-red-600 pl-3 font-inter text-sm leading-6 text-red-700">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 border border-[#102329]/12 bg-white/55 p-4 xl:grid-cols-[minmax(220px,1.4fr)_minmax(190px,1.1fr)_1fr_1fr_1fr_auto]"
      >
        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Offering
          </span>
          <select
            value={form.offeringId}
            onChange={(event) => handleOfferingChange(event.target.value)}
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
            Rule
          </span>
          <select
            value={form.availabilityRuleId}
            onChange={(event) => updateForm("availabilityRuleId", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          >
            <option value="">Offering-level</option>
            {availableRuleOptions.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {getRuleLabel(rule)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Date
          </span>
          <input
            type="date"
            value={form.date}
            onChange={(event) => updateForm("date", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Type
          </span>
          <select
            value={form.overrideType}
            onChange={(event) =>
              handleOverrideTypeChange(event.target.value as AdminAvailabilityOverrideType)
            }
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          >
            {(["blocked", "available"] as AdminAvailabilityOverrideType[]).map((type) => (
              <option key={type} value={type}>
                {overrideTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-end gap-3 pb-3">
          <input
            type="checkbox"
            checked={form.isFullDay}
            disabled={form.overrideType === "available"}
            onChange={(event) => updateForm("isFullDay", event.target.checked)}
            className="h-4 w-4 accent-[#0F3B46] disabled:cursor-not-allowed"
          />
          <span className="font-inter text-sm font-semibold text-[#102329]/65">
            Full day
          </span>
        </label>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={isSaving || isLoadingSetup}
            className="h-11 bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
          >
            {isSaving ? "Saving" : editingOverrideId ? "Update" : "Add"}
          </button>
          {editingOverrideId && (
            <button
              type="button"
              onClick={resetForm}
              className="h-11 border border-[#102329]/20 px-4 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
            >
              Clear
            </button>
          )}
        </div>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Start
          </span>
          <input
            type="time"
            value={form.startsAtTime}
            disabled={form.overrideType === "blocked" && form.isFullDay}
            onChange={(event) => updateForm("startsAtTime", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46] disabled:cursor-not-allowed disabled:bg-[#102329]/5 disabled:text-[#102329]/35"
            required={form.overrideType === "available" || !form.isFullDay}
          />
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            End
          </span>
          <input
            type="time"
            value={form.endsAtTime}
            disabled={form.overrideType === "blocked" && form.isFullDay}
            onChange={(event) => updateForm("endsAtTime", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46] disabled:cursor-not-allowed disabled:bg-[#102329]/5 disabled:text-[#102329]/35"
            required={form.overrideType === "available" || !form.isFullDay}
          />
        </label>

        <label className="block xl:col-span-3">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Reason
          </span>
          <input
            value={form.reason}
            onChange={(event) => updateForm("reason", event.target.value)}
            placeholder="Optional internal note"
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          />
        </label>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="border-b border-[#102329]/14 text-left">
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Date
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Offering
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Type
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Window
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Rule
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Reason
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
            {isLoadingOverrides ? (
              Array.from({ length: 3 }).map((_, index) => (
                <tr key={index} className="border-b border-[#102329]/8">
                  <td colSpan={8} className="py-5">
                    <div className="h-7 animate-pulse bg-[#102329]/8" />
                  </td>
                </tr>
              ))
            ) : overrides.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-14 text-center font-inter text-sm text-[#102329]/55">
                  No date overrides match the current filters.
                </td>
              </tr>
            ) : (
              overrides.map((override) => (
                <tr key={override.id} className="border-b border-[#102329]/8 align-top transition-colors hover:bg-white/55">
                  <td className="py-5 pr-5">
                    <p className="font-inter text-sm font-semibold">{formatDate(override.date)}</p>
                    <p className="mt-1 font-inter text-xs text-[#102329]/48">{override.date}</p>
                  </td>
                  <td className="py-5 pr-5">
                    <p className="text-lg font-semibold leading-tight">{override.offering.title}</p>
                    <p className="mt-1 font-inter text-xs text-[#102329]/48">/{override.offering.slug}</p>
                  </td>
                  <td className="py-5 pr-5">
                    <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${overrideTypeClasses[override.overrideType]}`}>
                      {overrideTypeLabels[override.overrideType]}
                    </span>
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">
                    {getWindowLabel(override)}
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm text-[#102329]/65">
                    {override.availabilityRule
                      ? `${weekdays[override.availabilityRule.weekday ?? -1] ?? "Rule"} ${override.availabilityRule.startTime ?? ""}-${override.availabilityRule.endTime ?? ""}`
                      : "Offering-level"}
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm leading-5 text-[#102329]/62">
                    {override.reason ?? "No note"}
                  </td>
                  <td className="py-5 pr-5 font-inter text-xs leading-5 text-[#102329]/55">
                    {formatDateTime(override.updatedAt)}
                  </td>
                  <td className="py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(override)}
                        className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(override)}
                        disabled={isDeletingId === override.id}
                        className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-red-700 hover:text-red-700 disabled:cursor-wait disabled:opacity-35"
                      >
                        {isDeletingId === override.id ? "Deleting" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
