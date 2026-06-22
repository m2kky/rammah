"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  archiveAdminBookingFormField,
  createAdminBookingFormField,
  fetchAdminBookingFormFields,
  fetchAdminOfferings,
  updateAdminBookingFormField,
  type AdminBookingFormField,
  type AdminBookingFormFieldPayload,
  type AdminBookingFormFieldType,
  type AdminOffering,
  type AdminOfferingStatus,
} from "@/lib/api/admin";

type FormState = {
  offeringId: string;
  fieldKey: string;
  label: string;
  fieldType: AdminBookingFormFieldType;
  required: boolean;
  optionsText: string;
  sortOrder: string;
  status: AdminOfferingStatus;
};

const defaultForm: FormState = {
  offeringId: "",
  fieldKey: "",
  label: "",
  fieldType: "text",
  required: false,
  optionsText: "",
  sortOrder: "0",
  status: "published",
};

const fieldTypeOptions: Array<{ value: AdminBookingFormFieldType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "textarea", label: "Textarea" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "number", label: "Number" },
];

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

const slugifyKey = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

const parseOptions = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [labelPart = "", valuePart] = line.split("|");
      const label = labelPart.trim();
      const optionValue = slugifyKey((valuePart ?? labelPart).trim());

      return { label, value: optionValue };
    })
    .filter((option) => option.label && option.value);

const formatOptions = (field: AdminBookingFormField) =>
  field.options.map((option) => `${option.label}|${option.value}`).join("\n");

const toFormState = (field: AdminBookingFormField): FormState => ({
  offeringId: field.offering?.id ?? "",
  fieldKey: field.fieldKey,
  label: field.label,
  fieldType: field.fieldType,
  required: field.required,
  optionsText: formatOptions(field),
  sortOrder: String(field.sortOrder),
  status: field.status,
});

const buildPayload = (form: FormState): AdminBookingFormFieldPayload => ({
  offeringId: form.offeringId || null,
  fieldKey: slugifyKey(form.fieldKey),
  label: form.label.trim(),
  fieldType: form.fieldType,
  required: form.required,
  options: parseOptions(form.optionsText),
  validationRules: {},
  sortOrder: Number(form.sortOrder) || 0,
  status: form.status,
});

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function AdminBookingFormFields() {
  const [fields, setFields] = useState<AdminBookingFormField[]>([]);
  const [offerings, setOfferings] = useState<AdminOffering[]>([]);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [offeringFilter, setOfferingFilter] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AdminOfferingStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchivingId, setIsArchivingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const firstUsableOfferingId = useMemo(
    () => offerings.find((offering) => offering.status !== "archived")?.id ?? offerings[0]?.id ?? "",
    [offerings],
  );

  const counts = useMemo(() => {
    return fields.reduce(
      (acc, field) => {
        acc[field.status] += 1;
        return acc;
      },
      { draft: 0, published: 0, scheduled: 0, archived: 0 } as Record<AdminOfferingStatus, number>,
    );
  }, [fields]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [nextOfferings, nextFields] = await Promise.all([
        fetchAdminOfferings({ status: "all" }),
        fetchAdminBookingFormFields({
          offeringId: offeringFilter,
          status: statusFilter,
        }),
      ]);

      setOfferings(nextOfferings);
      setFields(nextFields);
      setForm((current) => ({
        ...current,
        offeringId:
          current.offeringId ||
          nextOfferings.find((offering) => offering.status !== "archived")?.id ||
          nextOfferings[0]?.id ||
          "",
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load form fields.");
    } finally {
      setIsLoading(false);
    }
  }, [offeringFilter, statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const updateForm = <T extends keyof FormState>(field: T, value: FormState[T]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      ...defaultForm,
      offeringId: firstUsableOfferingId,
    });
    setEditingFieldId(null);
  };

  const handleEdit = (field: AdminBookingFormField) => {
    setForm(toFormState(field));
    setEditingFieldId(field.id);
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.fieldKey.trim() || !form.label.trim()) {
      setError("Field key and label are required.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const payload = buildPayload(form);

      if (editingFieldId) {
        await updateAdminBookingFormField(editingFieldId, payload);
      } else {
        await createAdminBookingFormField(payload);
      }

      resetForm();
      await loadData();
    } catch (saveError) {
      if (saveError instanceof AdminApiError) {
        const firstDetail = saveError.details[0]?.message;
        setError(firstDetail ? `${saveError.message} ${firstDetail}` : saveError.message);
      } else {
        setError("Could not save booking form field.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (field: AdminBookingFormField) => {
    if (field.status === "archived") return;

    setIsArchivingId(field.id);
    setError("");

    try {
      await archiveAdminBookingFormField(field.id);
      await loadData();

      if (editingFieldId === field.id) {
        resetForm();
      }
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Could not archive field.");
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
            Form fields
          </h1>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Configure the extra questions shown during public booking.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
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
        className="grid gap-4 border border-[#102329]/12 bg-white/55 p-4 xl:grid-cols-[minmax(220px,1.3fr)_1fr_1fr_0.8fr_0.7fr_auto]"
      >
        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Offering
          </span>
          <select
            value={form.offeringId}
            onChange={(event) => updateForm("offeringId", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          >
            <option value="">Global</option>
            {offerings.map((offering) => (
              <option key={offering.id} value={offering.id}>
                {offering.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Key
          </span>
          <input
            value={form.fieldKey}
            onChange={(event) => updateForm("fieldKey", slugifyKey(event.target.value))}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Label
          </span>
          <input
            value={form.label}
            onChange={(event) => updateForm("label", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Type
          </span>
          <select
            value={form.fieldType}
            onChange={(event) => updateForm("fieldType", event.target.value as AdminBookingFormFieldType)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          >
            {fieldTypeOptions.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
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
            {isSaving ? "Saving" : editingFieldId ? "Update" : "Add"}
          </button>
          {editingFieldId && (
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
            Sort
          </span>
          <input
            type="number"
            min={0}
            max={100000}
            value={form.sortOrder}
            onChange={(event) => updateForm("sortOrder", event.target.value)}
            className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
          />
        </label>

        <label className="flex min-h-11 items-center gap-3 self-end border border-[#102329]/14 bg-white px-4 font-inter text-sm">
          <input
            type="checkbox"
            checked={form.required}
            onChange={(event) => updateForm("required", event.target.checked)}
            className="h-4 w-4 accent-[#0F3B46]"
          />
          Required
        </label>

        <label className="block xl:col-span-4">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Options
          </span>
          <textarea
            value={form.optionsText}
            onChange={(event) => updateForm("optionsText", event.target.value)}
            rows={3}
            placeholder={"This week|this_week\nThis month|this_month"}
            className="mt-2 w-full resize-y border border-[#102329]/18 bg-white px-3 py-3 font-inter text-sm leading-6 outline-none transition-colors focus:border-[#0F3B46]"
          />
        </label>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="border-b border-[#102329]/14 text-left">
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Field
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Offering
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Type
              </th>
              <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                Options
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
            ) : fields.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-14 text-center font-inter text-sm text-[#102329]/55">
                  No booking form fields match the current filters.
                </td>
              </tr>
            ) : (
              fields.map((field) => (
                <tr key={field.id} className="border-b border-[#102329]/8 align-top transition-colors hover:bg-white/55">
                  <td className="py-5 pr-5">
                    <p className="text-lg font-semibold leading-tight">{field.label}</p>
                    <p className="mt-1 font-inter text-xs text-[#102329]/48">{field.fieldKey}</p>
                    {field.required && (
                      <p className="mt-2 font-inter text-xs font-semibold text-[#0F3B46]">Required</p>
                    )}
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">
                    {field.offering ? field.offering.title : "Global"}
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">
                    {field.fieldType}
                    <p className="mt-1 text-xs text-[#102329]/45">Sort {field.sortOrder}</p>
                  </td>
                  <td className="py-5 pr-5 font-inter text-sm text-[#102329]/62">
                    {field.options.length > 0
                      ? field.options.map((option) => option.label).join(", ")
                      : "None"}
                  </td>
                  <td className="py-5 pr-5">
                    <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${statusClasses[field.status]}`}>
                      {statusLabels[field.status]}
                    </span>
                  </td>
                  <td className="py-5 pr-5 font-inter text-xs leading-5 text-[#102329]/55">
                    {formatDateTime(field.updatedAt)}
                  </td>
                  <td className="py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(field)}
                        className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleArchive(field)}
                        disabled={field.status === "archived" || isArchivingId === field.id}
                        className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-red-700 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {isArchivingId === field.id ? "Archiving" : "Archive"}
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
