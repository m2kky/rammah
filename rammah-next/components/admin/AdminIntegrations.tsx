"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AdminApiError,
  fetchGoogleCalendarConnectUrl,
  fetchGoogleCalendarIntegrationStatus,
  updateGoogleCalendarSettings,
  type GoogleCalendarIntegrationStatus,
} from "@/lib/api/admin";

export default function AdminIntegrations() {
  const searchParams = useSearchParams();
  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarIntegrationStatus | null>(null);
  const [calendarId, setCalendarId] = useState("primary");
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadStatus = async () => {
    setIsLoading(true);
    setError("");

    try {
      const status = await fetchGoogleCalendarIntegrationStatus();
      setGoogleStatus(status);
      setCalendarId(status.calendarId);
    } catch (loadError) {
      setError(loadError instanceof AdminApiError ? loadError.message : "Could not load integrations.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const callbackStatus = searchParams.get("googleCalendar");

    if (callbackStatus === "connected") {
      setMessage("Google Calendar is connected.");
    }

    if (callbackStatus === "failed") {
      setError("Google Calendar connection failed. Try connecting again.");
    }

    void loadStatus();
  }, [searchParams]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError("");
    setMessage("");

    try {
      const url = await fetchGoogleCalendarConnectUrl();
      window.location.href = url;
    } catch (connectError) {
      setError(connectError instanceof AdminApiError ? connectError.message : "Could not start Google OAuth.");
      setIsConnecting(false);
    }
  };

  const handleSaveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const settings = await updateGoogleCalendarSettings({ calendarId });
      setCalendarId(settings.calendarId);
      await loadStatus();
      setMessage("Google Calendar settings saved.");
    } catch (saveError) {
      setError(saveError instanceof AdminApiError ? saveError.message : "Could not save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-7">
      <header className="border-b border-[#102329]/10 pb-6">
        <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
          Integrations
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">
          External services
        </h1>
        <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
          Connect provider accounts used by booking operations.
        </p>
      </header>

      {error && (
        <p className="border-l-2 border-red-600 pl-3 font-inter text-sm leading-6 text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="border-l-2 border-[#0F3B46] pl-3 font-inter text-sm leading-6 text-[#0F3B46]">
          {message}
        </p>
      )}

      <section className="grid gap-6 border-y border-[#102329]/10 py-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(360px,0.5fr)]">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">
            Google Calendar
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-normal">Calendar and Meet</h2>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Confirmed online bookings create one Google Calendar event with one Google Meet link.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${
              googleStatus?.configured
                ? "border-[#0F3B46] text-[#0F3B46]"
                : "border-red-700 text-red-700"
            }`}>
              {googleStatus?.configured ? "Configured" : "Missing env"}
            </span>
            <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${
              googleStatus?.connected
                ? "border-[#0F3B46] bg-[#0F3B46] text-white"
                : "border-[#8A6F2A] text-[#8A6F2A]"
            }`}>
              {googleStatus?.connected ? "Connected" : "Disconnected"}
            </span>
            {googleStatus?.status === "error" && (
              <span className="inline-flex h-8 items-center border border-red-700 px-3 font-inter text-xs font-semibold text-red-700">
                Error
              </span>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {isLoading ? (
            <div className="h-24 animate-pulse bg-[#102329]/8" />
          ) : (
            <>
              <form onSubmit={handleSaveSettings} className="space-y-3">
                <label className="block font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Calendar ID
                </label>
                <input
                  value={calendarId}
                  onChange={(event) => setCalendarId(event.target.value)}
                  placeholder="primary"
                  className="h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
                />
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-10 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
                >
                  {isSaving ? "Saving" : "Save settings"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => void handleConnect()}
                disabled={isConnecting || !googleStatus?.configured}
                className="h-11 w-full bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isConnecting ? "Opening Google..." : googleStatus?.connected ? "Reconnect Google" : "Connect Google"}
              </button>

              {googleStatus?.lastError && (
                <p className="font-inter text-xs leading-5 text-red-700">
                  {googleStatus.lastError}
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
