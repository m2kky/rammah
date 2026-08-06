"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  createAdminProgram,
  deleteOrArchiveAdminProgram,
  fetchAdminLocations,
  fetchAdminOfferings,
  fetchAdminPrograms,
  publishAdminProgram,
  retryAdminProgramCalendar,
  updateAdminProgram,
  type AdminLocation,
  type AdminOffering,
  type AdminProgram,
  type AdminProgramPayload,
  type AdminProgramStatus,
} from "@/lib/api/admin";

type AttendanceMode = AdminOffering["attendanceMode"];
type OccurrenceForm = {
  id?: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  attendanceMode: AttendanceMode;
  locationId: string;
  status: "scheduled" | "cancelled";
};
type ProgramForm = {
  offeringId: string;
  title: string;
  timezone: string;
  attendanceMode: AttendanceMode;
  locationId: string;
  capacity: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  occurrences: OccurrenceForm[];
};

const emptyOccurrence = (timezone = "Africa/Cairo", attendanceMode: AttendanceMode = "online"): OccurrenceForm => ({
  startsAt: "",
  endsAt: "",
  timezone,
  attendanceMode,
  locationId: "",
  status: "scheduled",
});
const emptyForm = (): ProgramForm => ({
  offeringId: "",
  title: "",
  timezone: "Africa/Cairo",
  attendanceMode: "online",
  locationId: "",
  capacity: "1",
  registrationOpensAt: "",
  registrationClosesAt: "",
  occurrences: [emptyOccurrence()],
});

const toLocalInput = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const toIso = (value: string) => (value ? new Date(value).toISOString() : null);
const toForm = (program: AdminProgram): ProgramForm => ({
  offeringId: program.offering.id,
  title: program.title,
  timezone: program.timezone,
  attendanceMode: program.attendanceMode,
  locationId: program.location?.id ?? "",
  capacity: String(program.capacity.total),
  registrationOpensAt: toLocalInput(program.registrationOpensAt),
  registrationClosesAt: toLocalInput(program.registrationClosesAt),
  occurrences: program.occurrences.map((occurrence) => ({
    id: occurrence.id,
    startsAt: toLocalInput(occurrence.startsAt),
    endsAt: toLocalInput(occurrence.endsAt),
    timezone: occurrence.timezone,
    attendanceMode: occurrence.attendanceMode,
    locationId: occurrence.locationId ?? "",
    status: occurrence.status,
  })),
});

const statusClasses: Record<AdminProgramStatus, string> = {
  draft: "border-[#8A6F2A] text-[#8A6F2A]",
  published: "border-[#0F3B46] bg-[#0F3B46] text-white",
  archived: "border-[#102329]/15 text-[#102329]/38",
};
const formatDateTime = (value: string, timezone: string) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
const calendarLabel = (
  programStatus: AdminProgramStatus,
  occurrence: AdminProgram["occurrences"][number],
) => {
  if (programStatus === "archived") {
    return occurrence.googleCalendarEventId
      ? "Archived · calendar cleanup can be retried"
      : "Archived · no calendar event";
  }
  if (occurrence.googleCalendarEventId) return "Calendar synced";
  return programStatus === "published" ? "Not synced — retry calendar" : "Syncs when published";
};

export default function AdminPrograms() {
  const [programs, setPrograms] = useState<AdminProgram[]>([]);
  const [offerings, setOfferings] = useState<AdminOffering[]>([]);
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [form, setForm] = useState<ProgramForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<AdminProgramStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const scheduledOfferings = useMemo(
    () => offerings.filter((offering) => offering.schedulingMode === "scheduled_program" && offering.status !== "archived"),
    [offerings],
  );

  const loadSetup = useCallback(async () => {
    const [nextOfferings, nextLocations] = await Promise.all([
      fetchAdminOfferings(),
      fetchAdminLocations({ status: "published" }),
    ]);
    setOfferings(nextOfferings);
    setLocations(nextLocations);
  }, []);
  const loadPrograms = useCallback(async () => {
    setIsLoading(true);
    try {
      setPrograms(await fetchAdminPrograms({ status, search }));
    } finally {
      setIsLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void Promise.all([loadSetup(), loadPrograms()]).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load Programs.");
    });
  }, [loadPrograms, loadSetup]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setMessage("");
  };
  const editProgram = (program: AdminProgram) => {
    setEditingId(program.id);
    setForm(toForm(program));
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const updateOccurrence = (index: number, field: keyof OccurrenceForm, value: string) => {
    setForm((current) => ({
      ...current,
      occurrences: current.occurrences.map((occurrence, occurrenceIndex) =>
        occurrenceIndex === index ? { ...occurrence, [field]: value } : occurrence,
      ),
    }));
  };
  const removeOccurrence = (index: number) => {
    setForm((current) => ({
      ...current,
      occurrences: current.occurrences.filter((_, occurrenceIndex) => occurrenceIndex !== index),
    }));
  };
  const addOccurrence = () => {
    setForm((current) => ({
      ...current,
      occurrences: [...current.occurrences, emptyOccurrence(current.timezone, current.attendanceMode)],
    }));
  };

  const payloadFromForm = (): AdminProgramPayload => ({
    offeringId: form.offeringId,
    title: form.title.trim(),
    timezone: form.timezone.trim(),
    attendanceMode: form.attendanceMode,
    locationId: form.locationId || null,
    capacity: Number(form.capacity),
    registrationOpensAt: toIso(form.registrationOpensAt),
    registrationClosesAt: toIso(form.registrationClosesAt),
    occurrences: form.occurrences.map((occurrence) => ({
      id: occurrence.id,
      startsAt: toIso(occurrence.startsAt)!,
      endsAt: toIso(occurrence.endsAt)!,
      timezone: occurrence.timezone.trim(),
      attendanceMode: occurrence.attendanceMode,
      locationId: occurrence.locationId || null,
      status: occurrence.status,
    })),
  });

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!form.offeringId) return setError("Select an Events / Programs Offering.");
    if (form.occurrences.some((occurrence) => !occurrence.startsAt || !occurrence.endsAt)) {
      return setError("Every occurrence needs a start and end time.");
    }
    setIsSaving(true);
    try {
      if (editingId) {
        await updateAdminProgram(editingId, payloadFromForm());
        setMessage("Program updated.");
      } else {
        const created = await createAdminProgram(payloadFromForm());
        setEditingId(created.id);
        setForm(toForm(created));
        setMessage("Draft Program created.");
      }
      await loadPrograms();
    } catch (saveError) {
      setError(saveError instanceof AdminApiError ? saveError.message : "Could not save Program.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async (program: AdminProgram) => {
    setBusyAction(program.id);
    setError("");
    try {
      const published = await publishAdminProgram(program.id);
      if (editingId === program.id) setForm(toForm(published));
      const unsynced = published.occurrences.filter(
        (occurrence) => occurrence.status === "scheduled" && !occurrence.googleCalendarEventId,
      ).length;
      setMessage(
        unsynced > 0
          ? `Program published. ${unsynced} calendar occurrence${unsynced === 1 ? " is" : "s are"} not synced; connect Google Calendar or use Retry calendar sync.`
          : "Program published and all occurrences are calendar-synced.",
      );
      await loadPrograms();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Could not publish Program.");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteOrArchive = async (program: AdminProgram) => {
    const verb = program.allowedActions.delete ? "delete" : "archive";
    if (!window.confirm(`${verb === "delete" ? "Delete" : "Archive"} ${program.title}?`)) return;
    setBusyAction(program.id);
    setError("");
    try {
      await deleteOrArchiveAdminProgram(program.id);
      if (editingId === program.id) resetForm();
      setMessage(`Program ${verb}d.`);
      await loadPrograms();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Could not ${verb} Program.`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCalendarRetry = async (program: AdminProgram) => {
    setBusyAction(program.id);
    setError("");
    try {
      const result = await retryAdminProgramCalendar(program.id);
      const failures = result.calendarSync.filter(({ status: syncStatus }) => syncStatus === "failed");
      setMessage(
        failures.length > 0
          ? `Calendar retry completed with ${failures.length} failed occurrence${failures.length === 1 ? "" : "s"}. Check the Google Calendar connection.`
          : "All Program occurrences are synced to Google Calendar.",
      );
      if (editingId === program.id) setForm(toForm(result.data));
      await loadPrograms();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Could not sync Program calendar.");
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 border-b border-[#102329]/10 pb-7 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#0F3B46]">Events &amp; Programs</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">Program schedule</h1>
          <p className="mt-3 max-w-3xl font-inter text-sm leading-6 text-[#102329]/62">
            Create a dated event, workshop, webinar, or course cohort. Add one occurrence for a one-off event or several occurrences for a course. Customers enroll once in the complete program.
          </p>
        </div>
        <button type="button" onClick={resetForm} className="h-11 border border-[#102329]/20 px-5 font-inter text-sm font-semibold">New Program</button>
      </header>

      {(error || message) && (
        <div className={`border-l-2 px-4 py-3 font-inter text-sm ${error ? "border-red-700 text-red-700" : "border-[#0F3B46] text-[#0F3B46]"}`}>
          {error || message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 border border-[#102329]/12 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/45">{editingId ? "Edit Program" : "New Program"}</p>
            <h2 className="mt-2 text-3xl font-semibold">Enrollment setup</h2>
          </div>
          <span className="font-inter text-xs text-[#102329]/48">Saved as draft until you publish</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <label className="block"><span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/48">Offering</span><select required value={form.offeringId} onChange={(event) => setForm((current) => ({ ...current, offeringId: event.target.value }))} className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm"><option value="">Select Events / Programs Offering</option>{scheduledOfferings.map((offering) => <option key={offering.id} value={offering.id}>{offering.title} · {offering.status}</option>)}</select></label>
          <label className="block lg:col-span-2"><span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/48">Program title</span><input required maxLength={220} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="mt-2 h-11 w-full border border-[#102329]/18 px-3 font-inter text-sm" placeholder="September leadership cohort" /></label>
          <label className="block"><span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/48">Timezone</span><input required value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))} className="mt-2 h-11 w-full border border-[#102329]/18 px-3 font-inter text-sm" /></label>
          <label className="block"><span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/48">Attendance</span><select value={form.attendanceMode} onChange={(event) => setForm((current) => ({ ...current, attendanceMode: event.target.value as AttendanceMode }))} className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm"><option value="online">Online</option><option value="offline">In person</option><option value="hybrid">Hybrid</option></select></label>
          <label className="block"><span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/48">Default location</span><select value={form.locationId} onChange={(event) => setForm((current) => ({ ...current, locationId: event.target.value }))} className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm"><option value="">Online / none</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <label className="block"><span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/48">Enrollment capacity</span><input required type="number" min={1} max={10000} value={form.capacity} onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))} className="mt-2 h-11 w-full border border-[#102329]/18 px-3 font-inter text-sm" /><span className="mt-1 block font-inter text-xs text-[#102329]/45">Maximum customers enrolled in the complete Program.</span></label>
          <label className="block"><span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/48">Registration opens</span><input type="datetime-local" value={form.registrationOpensAt} onChange={(event) => setForm((current) => ({ ...current, registrationOpensAt: event.target.value }))} className="mt-2 h-11 w-full border border-[#102329]/18 px-3 font-inter text-sm" /></label>
          <label className="block"><span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/48">Registration closes</span><input type="datetime-local" value={form.registrationClosesAt} onChange={(event) => setForm((current) => ({ ...current, registrationClosesAt: event.target.value }))} className="mt-2 h-11 w-full border border-[#102329]/18 px-3 font-inter text-sm" /><span className="mt-1 block font-inter text-xs text-[#102329]/45">Must be before the first occurrence.</span></label>
        </div>

        <div className="space-y-3 border-t border-[#102329]/10 pt-5">
          <div className="flex items-center justify-between gap-4"><div><h3 className="text-2xl font-semibold">Occurrences</h3><p className="mt-1 font-inter text-xs text-[#102329]/48">One date for an event; several dates for a course.</p></div><button type="button" onClick={addOccurrence} className="h-10 border border-[#0F3B46] px-4 font-inter text-sm font-semibold text-[#0F3B46]">Add occurrence</button></div>
          {form.occurrences.length === 0 ? <p className="border border-dashed border-[#102329]/15 p-4 font-inter text-sm text-[#102329]/50">Add at least one occurrence before publishing.</p> : form.occurrences.map((occurrence, index) => (
            <div key={occurrence.id ?? index} className="grid gap-3 border border-[#102329]/10 bg-[#F7F4EE]/60 p-4 md:grid-cols-2 xl:grid-cols-6">
              <label className="block xl:col-span-2"><span className="font-inter text-[11px] font-semibold uppercase tracking-[0.12em] text-[#102329]/45">Starts</span><input required type="datetime-local" value={occurrence.startsAt} onChange={(event) => updateOccurrence(index, "startsAt", event.target.value)} className="mt-1 h-10 w-full border border-[#102329]/16 bg-white px-2 font-inter text-xs" /></label>
              <label className="block xl:col-span-2"><span className="font-inter text-[11px] font-semibold uppercase tracking-[0.12em] text-[#102329]/45">Ends</span><input required type="datetime-local" value={occurrence.endsAt} onChange={(event) => updateOccurrence(index, "endsAt", event.target.value)} className="mt-1 h-10 w-full border border-[#102329]/16 bg-white px-2 font-inter text-xs" /></label>
              <label className="block"><span className="font-inter text-[11px] font-semibold uppercase tracking-[0.12em] text-[#102329]/45">Timezone</span><input required value={occurrence.timezone} onChange={(event) => updateOccurrence(index, "timezone", event.target.value)} className="mt-1 h-10 w-full border border-[#102329]/16 bg-white px-2 font-inter text-xs" /></label>
              <div className="flex items-end"><button type="button" onClick={() => removeOccurrence(index)} className="h-10 w-full border border-red-700/50 px-3 font-inter text-xs font-semibold text-red-700">Remove</button></div>
              <label className="block"><span className="font-inter text-[11px] font-semibold uppercase tracking-[0.12em] text-[#102329]/45">Attendance</span><select value={occurrence.attendanceMode} onChange={(event) => updateOccurrence(index, "attendanceMode", event.target.value)} className="mt-1 h-10 w-full border border-[#102329]/16 bg-white px-2 font-inter text-xs"><option value="online">Online</option><option value="offline">In person</option><option value="hybrid">Hybrid</option></select></label>
              <label className="block xl:col-span-2"><span className="font-inter text-[11px] font-semibold uppercase tracking-[0.12em] text-[#102329]/45">Location</span><select value={occurrence.locationId} onChange={(event) => updateOccurrence(index, "locationId", event.target.value)} className="mt-1 h-10 w-full border border-[#102329]/16 bg-white px-2 font-inter text-xs"><option value="">Online / none</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
              <label className="block"><span className="font-inter text-[11px] font-semibold uppercase tracking-[0.12em] text-[#102329]/45">Status</span><select value={occurrence.status} onChange={(event) => updateOccurrence(index, "status", event.target.value)} className="mt-1 h-10 w-full border border-[#102329]/16 bg-white px-2 font-inter text-xs"><option value="scheduled">Scheduled</option><option value="cancelled">Cancelled</option></select></label>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3"><button disabled={isSaving} className="h-11 bg-[#102329] px-6 font-inter text-sm font-semibold text-white disabled:opacity-50">{isSaving ? "Saving" : editingId ? "Save changes" : "Create draft"}</button>{editingId && <button type="button" onClick={resetForm} className="h-11 border border-[#102329]/18 px-5 font-inter text-sm font-semibold">Cancel edit</button>}</div>
      </form>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#0F3B46]">Saved Programs</p><h2 className="mt-2 text-3xl font-semibold">Enrollment inventory</h2></div><div className="flex gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="h-10 border border-[#102329]/16 bg-white px-3 font-inter text-sm" /><select value={status} onChange={(event) => setStatus(event.target.value as AdminProgramStatus | "all")} className="h-10 border border-[#102329]/16 bg-white px-3 font-inter text-sm"><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></div></div>
        {isLoading ? <p className="border border-[#102329]/10 bg-white p-5 font-inter text-sm text-[#102329]/50">Loading Programs...</p> : programs.length === 0 ? <p className="border border-dashed border-[#102329]/15 p-6 text-center font-inter text-sm text-[#102329]/50">No Programs match these filters.</p> : (
          <div className="grid gap-4">
            {programs.map((program) => (
              <article key={program.id} className="border border-[#102329]/12 bg-white p-5">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-2xl font-semibold">{program.title}</h3><span className={`border px-2 py-1 font-inter text-[10px] font-semibold uppercase tracking-[0.12em] ${statusClasses[program.status]}`}>{program.status}</span></div><p className="mt-1 font-inter text-xs text-[#102329]/48">{program.offering.title} · {program.timezone}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{program.occurrences.filter((occurrence) => occurrence.status === "scheduled").map((occurrence) => <div key={occurrence.id} className="border-l border-[#102329]/16 pl-3 font-inter text-xs leading-5"><span className="font-semibold">{formatDateTime(occurrence.startsAt, occurrence.timezone)}</span><br /><span className="text-[#102329]/48">to {formatDateTime(occurrence.endsAt, occurrence.timezone)}</span><span className="mt-1 block text-[#102329]/48">{calendarLabel(program.status, occurrence)}{occurrence.meetUrl && <> · <a href={occurrence.meetUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#0F3B46] underline">Meet</a></>}</span></div>)}</div></div>
                  <div className="grid shrink-0 grid-cols-4 gap-2 text-center font-inter text-xs"><div className="border border-[#102329]/10 p-2"><span className="block text-lg font-semibold">{program.capacity.total}</span>Total</div><div className="border border-[#102329]/10 p-2"><span className="block text-lg font-semibold">{program.capacity.booked}</span>Booked</div><div className="border border-[#102329]/10 p-2"><span className="block text-lg font-semibold">{program.capacity.held}</span>Held</div><div className="border border-[#102329]/10 p-2"><span className="block text-lg font-semibold">{program.capacity.remaining}</span>Left</div></div>
                </div>
                {program.conflicts.length > 0 && <p className="mt-4 border-l-2 border-red-700 pl-3 font-inter text-xs text-red-700">{program.conflicts.length} schedule conflict{program.conflicts.length === 1 ? "" : "s"}. Resolve before publishing or saving a published Program.</p>}
                <div className="mt-5 flex flex-wrap gap-2 border-t border-[#102329]/10 pt-4"><button type="button" onClick={() => editProgram(program)} disabled={!program.allowedActions.edit} className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold disabled:opacity-35">Edit</button>{program.allowedActions.publish && <button type="button" onClick={() => void handlePublish(program)} disabled={busyAction === program.id} className="h-9 bg-[#0F3B46] px-4 font-inter text-xs font-semibold text-white disabled:opacity-50">Publish</button>}{(program.status === "published" || (program.status === "archived" && program.occurrences.some((occurrence) => occurrence.googleCalendarEventId))) && <button type="button" onClick={() => void handleCalendarRetry(program)} disabled={busyAction === program.id} className="h-9 border border-[#0F3B46] px-4 font-inter text-xs font-semibold text-[#0F3B46] disabled:opacity-50">Retry calendar sync</button>}{(program.allowedActions.delete || program.allowedActions.archive) && <button type="button" onClick={() => void handleDeleteOrArchive(program)} disabled={busyAction === program.id} className="h-9 border border-red-700/45 px-4 font-inter text-xs font-semibold text-red-700 disabled:opacity-50">{program.allowedActions.delete ? "Delete" : "Archive"}</button>}</div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
