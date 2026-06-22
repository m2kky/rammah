"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  archiveAdminLocation,
  createAdminLocation,
  fetchAdminLocations,
  updateAdminLocation,
  type AdminLocation,
  type AdminLocationPayload,
  type AdminOfferingStatus,
} from "@/lib/api/admin";

type LocationFormState = {
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  countryCode: string;
  mapUrl: string;
  instructions: string;
  status: AdminOfferingStatus;
};

const defaultForm: LocationFormState = {
  name: "",
  addressLine1: "",
  addressLine2: "",
  city: "Cairo",
  countryCode: "EG",
  mapUrl: "",
  instructions: "",
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

const normalizeCode = (value: string, length: number) =>
  value
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, length);

const nullableText = (value: string) => {
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const toFormState = (location: AdminLocation): LocationFormState => ({
  name: location.name,
  addressLine1: location.addressLine1,
  addressLine2: location.addressLine2 ?? "",
  city: location.city ?? "",
  countryCode: location.countryCode,
  mapUrl: location.mapUrl ?? "",
  instructions: location.instructions ?? "",
  status: location.status,
});

const buildPayload = (form: LocationFormState): AdminLocationPayload => ({
  name: form.name.trim(),
  addressLine1: form.addressLine1.trim(),
  addressLine2: nullableText(form.addressLine2),
  city: nullableText(form.city),
  countryCode: normalizeCode(form.countryCode, 2),
  mapUrl: nullableText(form.mapUrl),
  instructions: nullableText(form.instructions),
  status: form.status,
});

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function AdminLocations() {
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [form, setForm] = useState<LocationFormState>(defaultForm);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AdminOfferingStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchivingId, setIsArchivingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    return locations.reduce(
      (acc, location) => {
        acc[location.status] += 1;
        return acc;
      },
      { draft: 0, published: 0, scheduled: 0, archived: 0 } as Record<AdminOfferingStatus, number>,
    );
  }, [locations]);

  const loadLocations = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const nextLocations = await fetchAdminLocations({
        status: statusFilter,
        search,
      });
      setLocations(nextLocations);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load locations.");
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const updateForm = <T extends keyof LocationFormState>(
    field: T,
    value: LocationFormState[T],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(defaultForm);
    setEditingLocationId(null);
  };

  const handleEdit = (location: AdminLocation) => {
    setForm(toFormState(location));
    setEditingLocationId(location.id);
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.addressLine1.trim() || normalizeCode(form.countryCode, 2).length !== 2) {
      setError("Name, address, and two-letter country code are required.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const payload = buildPayload(form);

      if (editingLocationId) {
        await updateAdminLocation(editingLocationId, payload);
      } else {
        await createAdminLocation(payload);
      }

      resetForm();
      await loadLocations();
    } catch (saveError) {
      if (saveError instanceof AdminApiError) {
        const firstDetail = saveError.details[0]?.message;
        setError(firstDetail ? `${saveError.message} ${firstDetail}` : saveError.message);
      } else {
        setError("Could not save location.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (location: AdminLocation) => {
    if (location.status === "archived") return;

    setIsArchivingId(location.id);
    setError("");

    try {
      await archiveAdminLocation(location.id);
      await loadLocations();

      if (editingLocationId === location.id) {
        resetForm();
      }
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not archive location.");
    } finally {
      setIsArchivingId(null);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 border-b border-[#102329]/10 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
            Booking
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">
            Locations
          </h1>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Manage physical venues for offline and hybrid booking paths.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadLocations()}
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
          <span className="sr-only">Search locations</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search locations"
            className="h-11 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors placeholder:text-[#102329]/35 focus:border-[#0F3B46]"
          />
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
        className="grid gap-4 border border-[#102329]/12 bg-white/55 p-4 xl:grid-cols-[minmax(220px,1.2fr)_minmax(260px,1.4fr)_1fr_0.5fr_0.7fr_auto]"
      >
        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Name
          </span>
          <input
            value={form.name}
            onChange={(event) => updateForm("name", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Address
          </span>
          <input
            value={form.addressLine1}
            onChange={(event) => updateForm("addressLine1", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            City
          </span>
          <input
            value={form.city}
            onChange={(event) => updateForm("city", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          />
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Country
          </span>
          <input
            value={form.countryCode}
            onChange={(event) => updateForm("countryCode", normalizeCode(event.target.value, 2))}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm uppercase outline-none transition-colors focus:border-[#0F3B46]"
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
            disabled={isSaving}
            className="h-11 bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
          >
            {isSaving ? "Saving" : editingLocationId ? "Update" : "Add"}
          </button>
          {editingLocationId && (
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
            Address line 2
          </span>
          <input
            value={form.addressLine2}
            onChange={(event) => updateForm("addressLine2", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          />
        </label>

        <label className="block xl:col-span-2">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Map URL
          </span>
          <input
            value={form.mapUrl}
            onChange={(event) => updateForm("mapUrl", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          />
        </label>

        <label className="block xl:col-span-2">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Instructions
          </span>
          <textarea
            value={form.instructions}
            onChange={(event) => updateForm("instructions", event.target.value)}
            rows={3}
            className="mt-2 w-full resize-y border border-[#102329]/18 bg-white px-3 py-3 font-inter text-sm leading-6 outline-none transition-colors focus:border-[#0F3B46]"
          />
        </label>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse">
          <thead>
            <tr className="border-b border-[#102329]/14 text-left">
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Location
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Address
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Country
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
                  <td colSpan={6} className="py-5">
                    <div className="h-7 animate-pulse bg-[#102329]/8" />
                  </td>
                </tr>
              ))
            ) : locations.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-14 text-center font-inter text-sm text-[#102329]/55">
                  No locations match the current filters.
                </td>
              </tr>
            ) : (
              locations.map((location) => (
                <tr key={location.id} className="border-b border-[#102329]/8 align-top transition-colors hover:bg-white/55">
                  <td className="py-5 pr-5">
                    <p className="text-lg font-semibold leading-tight">{location.name}</p>
                    {location.mapUrl && (
                      <a
                        href={location.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex font-inter text-xs font-semibold text-[#0F3B46] hover:text-[#102329]"
                      >
                        Open map
                      </a>
                    )}
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm leading-6 text-[#102329]/68">
                    <p>{location.addressLine1}</p>
                    {location.addressLine2 && <p>{location.addressLine2}</p>}
                    {location.city && <p className="text-[#102329]/48">{location.city}</p>}
                    {location.instructions && (
                      <p className="mt-2 max-w-md text-xs leading-5 text-[#102329]/45">
                        {location.instructions}
                      </p>
                    )}
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm font-semibold">
                    {location.countryCode}
                  </td>
                  <td className="py-5 pr-5">
                    <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${statusClasses[location.status]}`}>
                      {statusLabels[location.status]}
                    </span>
                  </td>
                  <td className="py-5 pr-5 font-inter text-xs leading-5 text-[#102329]/55">
                    {formatDateTime(location.updatedAt)}
                  </td>
                  <td className="py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(location)}
                        className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleArchive(location)}
                        disabled={location.status === "archived" || isArchivingId === location.id}
                        className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-red-700 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {isArchivingId === location.id ? "Archiving" : "Archive"}
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
