"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  createAdminOffering,
  fetchAdminOffering,
  fetchAdminOfferingCategories,
  updateAdminOffering,
  type AdminOffering,
  type AdminOfferingCategory,
  type AdminOfferingPayload,
  type AdminOfferingStatus,
} from "@/lib/api/admin";
import AdminOfferingPricing from "./AdminOfferingPricing";

type OfferingType = AdminOffering["offeringType"];
type AttendanceMode = AdminOffering["attendanceMode"];
type BookingMode = AdminOffering["bookingMode"];

type FormState = {
  categoryId: string;
  title: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  offeringType: OfferingType;
  attendanceMode: AttendanceMode;
  bookingMode: BookingMode;
  durationMinutes: string;
  capacity: string;
  requiresPayment: boolean;
  quoteOnly: boolean;
  sortOrder: string;
  backgroundColor: string;
  textColor: string;
  status: AdminOfferingStatus;
};

const offeringTypes: Array<{ value: OfferingType; label: string }> = [
  { value: "coaching", label: "Coaching" },
  { value: "therapy_session", label: "Therapy session" },
  { value: "workshop", label: "Workshop" },
  { value: "webinar", label: "Webinar" },
  { value: "course", label: "Course" },
  { value: "corporate_training", label: "Corporate training" },
  { value: "custom", label: "Custom" },
];

const attendanceModes: Array<{ value: AttendanceMode; label: string }> = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "hybrid", label: "Hybrid" },
];

const bookingModes: Array<{ value: BookingMode; label: string; hint: string }> = [
  { value: "free", label: "Free", hint: "Confirm without checkout" },
  { value: "paid", label: "Paid", hint: "Requires payment before confirmation" },
  { value: "quote_only", label: "Quote", hint: "Collect inquiry before pricing" },
];

const contentStatuses: Array<{ value: AdminOfferingStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
  { value: "archived", label: "Archived" },
];

const defaultState: FormState = {
  categoryId: "",
  title: "",
  slug: "",
  shortDescription: "",
  longDescription: "",
  offeringType: "coaching",
  attendanceMode: "online",
  bookingMode: "free",
  durationMinutes: "60",
  capacity: "1",
  requiresPayment: false,
  quoteOnly: false,
  sortOrder: "0",
  backgroundColor: "#ffffff",
  textColor: "#0F3B46",
  status: "draft",
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toFormState = (offering: AdminOffering): FormState => ({
  categoryId: offering.category?.id ?? "",
  title: offering.title,
  slug: offering.slug,
  shortDescription: offering.shortDescription ?? "",
  longDescription: offering.longDescription ?? "",
  offeringType: offering.offeringType,
  attendanceMode: offering.attendanceMode,
  bookingMode: offering.bookingMode,
  durationMinutes: String(offering.durationMinutes),
  capacity: String(offering.capacity),
  requiresPayment: offering.requiresPayment,
  quoteOnly: offering.quoteOnly,
  sortOrder: String(offering.sortOrder),
  backgroundColor: offering.displayConfig.backgroundColor ?? "#ffffff",
  textColor: offering.displayConfig.textColor ?? "#0F3B46",
  status: offering.status,
});

const toNumber = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildPayload = (state: FormState): AdminOfferingPayload => ({
  categoryId: state.categoryId || null,
  title: state.title.trim(),
  slug: slugify(state.slug),
  shortDescription: state.shortDescription.trim() || null,
  longDescription: state.longDescription.trim() || null,
  offeringType: state.offeringType,
  attendanceMode: state.attendanceMode,
  bookingMode: state.bookingMode,
  durationMinutes: toNumber(state.durationMinutes, 60),
  capacity: toNumber(state.capacity, 1),
  requiresPayment: state.requiresPayment,
  quoteOnly: state.quoteOnly,
  sortOrder: toNumber(state.sortOrder, 0),
  displayConfig: {
    backgroundColor: state.backgroundColor.trim() || "#ffffff",
    textColor: state.textColor.trim() || "#0F3B46",
  },
  status: state.status,
});

export default function AdminOfferingEditor({ offeringId }: { offeringId?: string }) {
  const router = useRouter();
  const isEditing = Boolean(offeringId);
  const [state, setState] = useState<FormState>(defaultState);
  const [categories, setCategories] = useState<AdminOfferingCategory[]>([]);
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError("");

      try {
        const [nextCategories, offering] = await Promise.all([
          fetchAdminOfferingCategories(),
          offeringId ? fetchAdminOffering(offeringId) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setCategories(nextCategories);

        if (offering) {
          setState(toFormState(offering));
          setSlugTouched(true);
        }
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load offering form.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [offeringId]);

  const previewStyle = useMemo(
    () => ({
      backgroundColor: state.backgroundColor || "#ffffff",
      color: state.textColor || "#0F3B46",
    }),
    [state.backgroundColor, state.textColor],
  );

  const updateField = <T extends keyof FormState>(field: T, value: FormState[T]) => {
    setState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleTitleChange = (value: string) => {
    setState((current) => ({
      ...current,
      title: value,
      slug: slugTouched ? current.slug : slugify(value),
    }));
  };

  const handleBookingModeChange = (value: BookingMode) => {
    setState((current) => ({
      ...current,
      bookingMode: value,
      requiresPayment: value === "paid",
      quoteOnly: value === "quote_only",
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const payload = buildPayload(state);

      if (isEditing && offeringId) {
        await updateAdminOffering(offeringId, payload);
      } else {
        await createAdminOffering(payload);
      }

      router.replace("/admin/offerings");
      router.refresh();
    } catch (saveError) {
      if (saveError instanceof AdminApiError) {
        const firstDetail = saveError.details[0]?.message;
        setError(firstDetail ? `${saveError.message} ${firstDetail}` : saveError.message);
      } else {
        setError("Could not save offering.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-[#102329]/10 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
            Offering
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">
            {isEditing ? "Edit offering" : "New offering"}
          </h1>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Manage the service record used by the public website and future booking flow.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/offerings"
            className="inline-flex h-11 items-center border border-[#102329]/20 px-5 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            form="admin-offering-form"
            disabled={isLoading || isSaving}
            className="h-11 bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
          >
            {isSaving ? "Saving" : "Save offering"}
          </button>
        </div>
      </div>

      {error && (
        <p className="border-l-2 border-red-600 pl-3 font-inter text-sm leading-6 text-red-700">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-12 animate-pulse bg-[#102329]/8" />
          <div className="h-28 animate-pulse bg-[#102329]/8" />
          <div className="h-44 animate-pulse bg-[#102329]/8" />
        </div>
      ) : (
        <>
        <form
          id="admin-offering-form"
          onSubmit={handleSubmit}
          className="grid gap-9 xl:grid-cols-[minmax(0,1fr)_340px]"
        >
          <div className="space-y-8">
            <section className="space-y-5 border-t border-[#102329]/12 pt-5">
              <h2 className="text-2xl font-semibold">Content</h2>
              <div className="grid gap-5 lg:grid-cols-2">
                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                    Title
                  </span>
                  <input
                    value={state.title}
                    onChange={(event) => handleTitleChange(event.target.value)}
                    className="mt-2 h-12 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                    required
                  />
                </label>

                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                    Slug
                  </span>
                  <input
                    value={state.slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      updateField("slug", slugify(event.target.value));
                    }}
                    className="mt-2 h-12 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                  Short description
                </span>
                <textarea
                  value={state.shortDescription}
                  onChange={(event) => updateField("shortDescription", event.target.value)}
                  rows={3}
                  className="mt-2 w-full resize-y border border-[#102329]/18 bg-white px-4 py-3 font-inter text-sm leading-6 outline-none transition-colors focus:border-[#0F3B46]"
                />
              </label>

              <label className="block">
                <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                  Long description
                </span>
                <textarea
                  value={state.longDescription}
                  onChange={(event) => updateField("longDescription", event.target.value)}
                  rows={7}
                  className="mt-2 w-full resize-y border border-[#102329]/18 bg-white px-4 py-3 font-inter text-sm leading-6 outline-none transition-colors focus:border-[#0F3B46]"
                />
              </label>
            </section>

            <section className="space-y-5 border-t border-[#102329]/12 pt-5">
              <h2 className="text-2xl font-semibold">Classification</h2>
              <div className="grid gap-5 lg:grid-cols-3">
                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                    Category
                  </span>
                  <select
                    value={state.categoryId}
                    onChange={(event) => updateField("categoryId", event.target.value)}
                    className="mt-2 h-12 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                  >
                    <option value="">Unassigned</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                    Type
                  </span>
                  <select
                    value={state.offeringType}
                    onChange={(event) => updateField("offeringType", event.target.value as OfferingType)}
                    className="mt-2 h-12 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                  >
                    {offeringTypes.map((type) => (
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
                    value={state.status}
                    onChange={(event) => updateField("status", event.target.value as AdminOfferingStatus)}
                    className="mt-2 h-12 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                  >
                    {contentStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="space-y-5 border-t border-[#102329]/12 pt-5">
              <h2 className="text-2xl font-semibold">Booking Behavior</h2>
              <div className="grid gap-3 lg:grid-cols-3">
                {bookingModes.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => handleBookingModeChange(mode.value)}
                    className={`min-h-24 border p-4 text-left transition-colors ${
                      state.bookingMode === mode.value
                        ? "border-[#0F3B46] bg-[#0F3B46] text-white"
                        : "border-[#102329]/16 bg-white text-[#102329] hover:border-[#0F3B46]/50"
                    }`}
                  >
                    <span className="block text-lg font-semibold">{mode.label}</span>
                    <span className="mt-2 block font-inter text-xs leading-5 opacity-70">{mode.hint}</span>
                  </button>
                ))}
              </div>

              <div className="grid gap-5 lg:grid-cols-4">
                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                    Attendance
                  </span>
                  <select
                    value={state.attendanceMode}
                    onChange={(event) => updateField("attendanceMode", event.target.value as AttendanceMode)}
                    className="mt-2 h-12 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                  >
                    {attendanceModes.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                    Duration
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={state.durationMinutes}
                    onChange={(event) => updateField("durationMinutes", event.target.value)}
                    className="mt-2 h-12 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                    required
                  />
                </label>

                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                    Capacity
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={state.capacity}
                    onChange={(event) => updateField("capacity", event.target.value)}
                    className="mt-2 h-12 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                    required
                  />
                </label>

                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                    Sort order
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    value={state.sortOrder}
                    onChange={(event) => updateField("sortOrder", event.target.value)}
                    className="mt-2 h-12 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46]"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex min-h-12 items-center gap-3 border border-[#102329]/14 bg-white px-4 font-inter text-sm">
                  <input
                    type="checkbox"
                    checked={state.requiresPayment}
                    onChange={(event) => updateField("requiresPayment", event.target.checked)}
                    className="h-4 w-4 accent-[#0F3B46]"
                  />
                  Requires payment
                </label>

                <label className="flex min-h-12 items-center gap-3 border border-[#102329]/14 bg-white px-4 font-inter text-sm">
                  <input
                    type="checkbox"
                    checked={state.quoteOnly}
                    onChange={(event) => updateField("quoteOnly", event.target.checked)}
                    className="h-4 w-4 accent-[#0F3B46]"
                  />
                  Quote only
                </label>
              </div>
            </section>
          </div>

          <aside className="space-y-6 border-t border-[#102329]/12 pt-5 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
            <section className="space-y-5">
              <h2 className="text-2xl font-semibold">Display</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                    Background
                  </span>
                  <div className="mt-2 flex h-12 border border-[#102329]/18 bg-white">
                    <input
                      type="color"
                      value={state.backgroundColor}
                      onChange={(event) => updateField("backgroundColor", event.target.value)}
                      className="h-full w-14 border-0 bg-transparent p-1"
                    />
                    <input
                      value={state.backgroundColor}
                      onChange={(event) => updateField("backgroundColor", event.target.value)}
                      className="min-w-0 flex-1 px-3 font-inter text-sm outline-none"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                    Text
                  </span>
                  <div className="mt-2 flex h-12 border border-[#102329]/18 bg-white">
                    <input
                      type="color"
                      value={state.textColor}
                      onChange={(event) => updateField("textColor", event.target.value)}
                      className="h-full w-14 border-0 bg-transparent p-1"
                    />
                    <input
                      value={state.textColor}
                      onChange={(event) => updateField("textColor", event.target.value)}
                      className="min-w-0 flex-1 px-3 font-inter text-sm outline-none"
                    />
                  </div>
                </label>
              </div>
            </section>

            <section className="border-t border-[#102329]/12 pt-5">
              <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
                Public card preview
              </p>
              <div className="mt-4 min-h-56 p-6" style={previewStyle}>
                <p className="text-4xl font-semibold leading-none">
                  {state.title || "Offering title"}
                </p>
                <p className="mt-4 font-inter text-sm leading-6 opacity-75">
                  {state.shortDescription || "Short description appears here."}
                </p>
                <span className="mt-7 inline-flex h-10 items-center border px-4 font-inter text-sm font-semibold" style={{ borderColor: `${state.textColor}66` }}>
                  Book Now
                </span>
              </div>
            </section>
          </aside>
        </form>
        <AdminOfferingPricing offeringId={offeringId} />
        </>
      )}
    </div>
  );
}
