"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  archiveAdminSession,
  createAdminSession,
  fetchAdminLocations,
  fetchAdminOfferings,
  fetchAdminSessions,
  updateAdminSession,
  type AdminLocation,
  type AdminOffering,
  type AdminOfferingStatus,
  type AdminSession,
  type AdminSessionPayload,
} from "@/lib/api/admin";

type SessionFormState = {
  offeringId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: string;
  attendanceMode: AdminOffering["attendanceMode"];
  locationId: string;
  googleCalendarEventId: string;
  status: AdminOfferingStatus;
};

const padNumber = (value: number) => String(value).padStart(2, "0");

const toDateTimeLocalValue = (value: Date) =>
  `${value.getFullYear()}-${padNumber(value.getMonth() + 1)}-${padNumber(value.getDate())}T${padNumber(value.getHours())}:${padNumber(value.getMinutes())}`;

const addHours = (value: Date, hours: number) => {
  const nextValue = new Date(value);
  nextValue.setHours(nextValue.getHours() + hours);
  return nextValue;
};

const todayAt = (hour: number) => {
  const value = new Date();
  value.setHours(hour, 0, 0, 0);
  return value;
};

const defaultForm: SessionFormState = {
  offeringId: "",
  startsAt: toDateTimeLocalValue(todayAt(18)),
  endsAt: toDateTimeLocalValue(addHours(todayAt(18), 2)),
  timezone: "Africa/Cairo",
  capacity: "20",
  attendanceMode: "online",
  locationId: "",
  googleCalendarEventId: "",
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

const attendanceOptions: Array<AdminOffering["attendanceMode"] | "all"> = [
  "all",
  "online",
  "offline",
  "hybrid",
];

const attendanceLabels: Record<AdminOffering["attendanceMode"] | "all", string> = {
  all: "All modes",
  online: "Online",
  offline: "Offline",
  hybrid: "Hybrid",
};

const nullableText = (value: string) => {
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const dateInputToIso = (value: string) => new Date(value).toISOString();

const dateFilterToIso = (value: string, endOfDay = false) => {
  if (!value) return "";

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const formatDateTime = (value: string, timezone?: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone || undefined,
  }).format(new Date(value));

const toFormState = (session: AdminSession): SessionFormState => ({
  offeringId: session.offering.id,
  startsAt: toDateTimeLocalValue(new Date(session.startsAt)),
  endsAt: toDateTimeLocalValue(new Date(session.endsAt)),
  timezone: session.timezone,
  capacity: String(session.capacity),
  attendanceMode: session.attendanceMode,
  locationId: session.location?.id ?? "",
  googleCalendarEventId: session.googleCalendarEventId ?? "",
  status: session.status,
});

const buildPayload = (form: SessionFormState): AdminSessionPayload => ({
  offeringId: form.offeringId,
  startsAt: dateInputToIso(form.startsAt),
  endsAt: dateInputToIso(form.endsAt),
  timezone: form.timezone.trim() || "Africa/Cairo",
  capacity: Number(form.capacity) || 1,
  attendanceMode: form.attendanceMode,
  locationId: form.attendanceMode === "online" ? null : form.locationId || null,
  googleCalendarEventId: nullableText(form.googleCalendarEventId),
  status: form.status,
});

const getCompatibleAttendanceMode = (
  offering: AdminOffering | undefined,
  currentMode: AdminOffering["attendanceMode"],
) => {
  if (!offering || offering.attendanceMode === "hybrid") return currentMode;
  return offering.attendanceMode;
};

export default function AdminSessions() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [offerings, setOfferings] = useState<AdminOffering[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [form, setForm] = useState<SessionFormState>(defaultForm);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [offeringFilter, setOfferingFilter] = useState<string | "all">("all");
  const [locationFilter, setLocationFilter] = useState<string | "all">("all");
  const [attendanceFilter, setAttendanceFilter] =
    useState<AdminOffering["attendanceMode"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AdminOfferingStatus | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isLoadingSetup, setIsLoadingSetup] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchivingId, setIsArchivingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const firstUsableOffering = useMemo(
    () => offerings.find((offering) => offering.status !== "archived") ?? offerings[0],
    [offerings],
  );

  const activeLocations = useMemo(
    () => locations.filter((location) => location.status !== "archived"),
    [locations],
  );

  const selectedOffering = useMemo(
    () => offerings.find((offering) => offering.id === form.offeringId),
    [form.offeringId, offerings],
  );

  const isLocationRequired = form.attendanceMode !== "online";

  const counts = useMemo(() => {
    return sessions.reduce(
      (acc, session) => {
        acc[session.status] += 1;
        return acc;
      },
      { draft: 0, published: 0, scheduled: 0, archived: 0 } as Record<AdminOfferingStatus, number>,
    );
  }, [sessions]);

  const loadSetup = useCallback(async () => {
    setIsLoadingSetup(true);
    setError("");

    try {
      const [nextOfferings, nextLocations] = await Promise.all([
        fetchAdminOfferings({ status: "all" }),
        fetchAdminLocations({ status: "all" }),
      ]);

      setOfferings(nextOfferings);
      setLocations(nextLocations);
      setForm((current) => {
        if (current.offeringId || nextOfferings.length === 0) return current;

        const offering = nextOfferings.find((item) => item.status !== "archived") ?? nextOfferings[0];

        return {
          ...current,
          offeringId: offering.id,
          attendanceMode: offering.attendanceMode === "hybrid" ? "online" : offering.attendanceMode,
        };
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load session setup.");
    } finally {
      setIsLoadingSetup(false);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    setError("");

    try {
      const nextSessions = await fetchAdminSessions({
        offeringId: offeringFilter,
        locationId: locationFilter,
        attendanceMode: attendanceFilter,
        status: statusFilter,
        dateFrom: dateFilterToIso(dateFrom),
        dateTo: dateFilterToIso(dateTo, true),
      });
      setSessions(nextSessions);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load sessions.");
    } finally {
      setIsLoadingSessions(false);
    }
  }, [attendanceFilter, dateFrom, dateTo, locationFilter, offeringFilter, statusFilter]);

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const updateForm = <T extends keyof SessionFormState>(
    field: T,
    value: SessionFormState[T],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleOfferingChange = (offeringId: string) => {
    const offering = offerings.find((item) => item.id === offeringId);

    setForm((current) => ({
      ...current,
      offeringId,
      attendanceMode: getCompatibleAttendanceMode(offering, current.attendanceMode),
    }));
  };

  const resetForm = () => {
    setForm({
      ...defaultForm,
      offeringId: firstUsableOffering?.id ?? "",
      attendanceMode:
        firstUsableOffering?.attendanceMode && firstUsableOffering.attendanceMode !== "hybrid"
          ? firstUsableOffering.attendanceMode
          : "online",
    });
    setEditingSessionId(null);
  };

  const handleEdit = (session: AdminSession) => {
    setForm(toFormState(session));
    setEditingSessionId(session.id);
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.offeringId) {
      setError("Select an offering before saving a session.");
      return;
    }

    if (new Date(form.startsAt) >= new Date(form.endsAt)) {
      setError("Session start must be before end.");
      return;
    }

    if (isLocationRequired && !form.locationId) {
      setError("Offline and hybrid sessions need a location.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const payload = buildPayload(form);

      if (editingSessionId) {
        await updateAdminSession(editingSessionId, payload);
      } else {
        await createAdminSession(payload);
      }

      resetForm();
      await loadSessions();
    } catch (saveError) {
      if (saveError instanceof AdminApiError) {
        const firstDetail = saveError.details[0]?.message;
        setError(firstDetail ? `${saveError.message} ${firstDetail}` : saveError.message);
      } else {
        setError("Could not save session.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (session: AdminSession) => {
    if (session.status === "archived") return;

    setIsArchivingId(session.id);
    setError("");

    try {
      await archiveAdminSession(session.id);
      await loadSessions();

      if (editingSessionId === session.id) {
        resetForm();
      }
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not archive session.");
    } finally {
      setIsArchivingId(null);
    }
  };

  const isLoading = isLoadingSetup || isLoadingSessions;

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 border-b border-[#102329]/10 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
            Booking
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">
            Sessions
          </h1>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Manage fixed-date events for workshops, webinars, courses, and special cohorts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void Promise.all([loadSetup(), loadSessions()])}
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

      <div className="grid gap-3 border-y border-[#102329]/10 py-4 xl:grid-cols-[minmax(220px,1fr)_minmax(180px,0.7fr)_minmax(160px,0.6fr)_minmax(120px,0.5fr)_minmax(120px,0.5fr)]">
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

        <label className="block">
          <span className="sr-only">Filter by location</span>
          <select
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            className="h-11 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          >
            <option value="all">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Filter by mode</span>
          <select
            value={attendanceFilter}
            onChange={(event) =>
              setAttendanceFilter(event.target.value as AdminOffering["attendanceMode"] | "all")
            }
            className="h-11 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          >
            {attendanceOptions.map((option) => (
              <option key={option} value={option}>
                {attendanceLabels[option]}
              </option>
            ))}
          </select>
        </label>

        <input
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
          aria-label="Date from"
          className="h-11 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
        />

        <input
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
          aria-label="Date to"
          className="h-11 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
        />

        <div className="flex items-center gap-2 overflow-x-auto xl:col-span-5">
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
        className="grid gap-4 border border-[#102329]/12 bg-white/55 p-4 xl:grid-cols-[minmax(240px,1.3fr)_1fr_1fr_0.7fr_0.6fr_auto]"
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
          {selectedOffering && selectedOffering.attendanceMode !== "hybrid" && (
            <span className="mt-2 block font-inter text-xs text-[#102329]/42">
              Offering mode: {attendanceLabels[selectedOffering.attendanceMode]}
            </span>
          )}
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Starts
          </span>
          <input
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) => updateForm("startsAt", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Ends
          </span>
          <input
            type="datetime-local"
            value={form.endsAt}
            onChange={(event) => updateForm("endsAt", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Mode
          </span>
          <select
            value={form.attendanceMode}
            onChange={(event) =>
              updateForm("attendanceMode", event.target.value as AdminOffering["attendanceMode"])
            }
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          >
            {(["online", "offline", "hybrid"] as AdminOffering["attendanceMode"][]).map((mode) => (
              <option
                key={mode}
                value={mode}
                disabled={
                  selectedOffering?.attendanceMode !== "hybrid" &&
                  selectedOffering?.attendanceMode !== mode
                }
              >
                {attendanceLabels[mode]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Capacity
          </span>
          <input
            type="number"
            min={1}
            max={100000}
            value={form.capacity}
            onChange={(event) => updateForm("capacity", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={isSaving || isLoadingSetup}
            className="h-11 bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
          >
            {isSaving ? "Saving" : editingSessionId ? "Update" : "Add"}
          </button>
          {editingSessionId && (
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
            Location
          </span>
          <select
            value={form.locationId}
            onChange={(event) => updateForm("locationId", event.target.value)}
            disabled={!isLocationRequired}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46] disabled:bg-[#102329]/5 disabled:text-[#102329]/35"
            required={isLocationRequired}
          >
            <option value="">{isLocationRequired ? "Select location" : "Online session"}</option>
            {activeLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
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
            Calendar event id
          </span>
          <input
            value={form.googleCalendarEventId}
            onChange={(event) => updateForm("googleCalendarEventId", event.target.value)}
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
            {(["draft", "published", "scheduled", "archived"] as AdminOfferingStatus[]).map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse">
          <thead>
            <tr className="border-b border-[#102329]/14 text-left">
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Offering
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Schedule
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Mode
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Capacity
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
            {isLoadingSessions ? (
              Array.from({ length: 4 }).map((_, index) => (
                <tr key={index} className="border-b border-[#102329]/8">
                  <td colSpan={7} className="py-5">
                    <div className="h-7 animate-pulse bg-[#102329]/8" />
                  </td>
                </tr>
              ))
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center font-inter text-sm text-[#102329]/55">
                  No sessions match the current filters.
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} className="border-b border-[#102329]/8 align-top transition-colors hover:bg-white/55">
                  <td className="py-5 pr-5">
                    <p className="text-lg font-semibold leading-tight">{session.offering.title}</p>
                    <p className="mt-1 font-inter text-xs text-[#102329]/48">/{session.offering.slug}</p>
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm leading-6 text-[#102329]/70">
                    <p className="font-semibold text-[#102329]">
                      {formatDateTime(session.startsAt, session.timezone)}
                    </p>
                    <p>{formatDateTime(session.endsAt, session.timezone)}</p>
                    <p className="mt-1 text-xs text-[#102329]/45">{session.timezone}</p>
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm leading-6 text-[#102329]/70">
                    <p className="font-semibold capitalize text-[#102329]">
                      {session.attendanceMode.replace("_", " ")}
                    </p>
                    <p className="text-xs text-[#102329]/48">
                      {session.location
                        ? `${session.location.name}${session.location.city ? `, ${session.location.city}` : ""}`
                        : "No location"}
                    </p>
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm font-semibold">
                    {session.capacity}
                  </td>
                  <td className="py-5 pr-5">
                    <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${statusClasses[session.status]}`}>
                      {statusLabels[session.status]}
                    </span>
                  </td>
                  <td className="py-5 pr-5 font-inter text-xs leading-5 text-[#102329]/55">
                    {formatDateTime(session.updatedAt)}
                  </td>
                  <td className="py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(session)}
                        className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleArchive(session)}
                        disabled={session.status === "archived" || isArchivingId === session.id}
                        className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-red-700 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {isArchivingId === session.id ? "Archiving" : "Archive"}
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
