"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  fetchAdminEmailDeliveries,
  fetchAdminEmailTemplates,
  retryAdminEmailDelivery,
  saveAdminEmailTemplate,
  type AdminEmailDelivery,
  type AdminEmailDeliveryStatus,
  type AdminEmailTemplate,
  type AdminEmailTemplateStatus,
} from "@/lib/api/admin";

const deliveryStatusOptions: Array<AdminEmailDeliveryStatus | "all"> = [
  "all",
  "queued",
  "sent",
  "failed",
  "suppressed",
];

const deliveryStatusLabels: Record<AdminEmailDeliveryStatus | "all", string> = {
  all: "All",
  queued: "Queued",
  sent: "Sent",
  failed: "Failed",
  suppressed: "Suppressed",
};

const deliveryStatusClasses: Record<AdminEmailDeliveryStatus, string> = {
  queued: "border-[#8A6F2A] text-[#8A6F2A]",
  sent: "border-[#0F3B46] bg-[#0F3B46] text-white",
  failed: "border-red-700 text-red-700",
  suppressed: "border-[#102329]/15 text-[#102329]/38",
};

const templateStatusOptions: AdminEmailTemplateStatus[] = [
  "draft",
  "published",
  "scheduled",
  "archived",
];

const formatDate = (value: string | null) => {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export default function AdminEmails() {
  const [deliveries, setDeliveries] = useState<AdminEmailDelivery[]>([]);
  const [templates, setTemplates] = useState<AdminEmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AdminEmailTemplate | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<AdminEmailDeliveryStatus | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateStatus, setTemplateStatus] = useState<AdminEmailTemplateStatus>("published");
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(true);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [retryingDeliveryId, setRetryingDeliveryId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    return deliveries.reduce(
      (acc, delivery) => {
        acc[delivery.status] += 1;
        return acc;
      },
      {
        queued: 0,
        sent: 0,
        failed: 0,
        suppressed: 0,
      } as Record<AdminEmailDeliveryStatus, number>,
    );
  }, [deliveries]);

  const loadDeliveries = async () => {
    setIsLoadingDeliveries(true);
    setError("");

    try {
      setDeliveries(await fetchAdminEmailDeliveries({ status: deliveryStatus, search }));
    } catch (loadError) {
      setError(loadError instanceof AdminApiError ? loadError.message : "Could not load email deliveries.");
    } finally {
      setIsLoadingDeliveries(false);
    }
  };

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    setError("");

    try {
      const nextTemplates = await fetchAdminEmailTemplates();
      const nextSelected = selectedTemplate
        ? nextTemplates.find((template) => template.key === selectedTemplate.key)
        : nextTemplates[0];
      setTemplates(nextTemplates);
      setSelectedTemplate(nextSelected ?? null);
      setSubject(nextSelected?.subject ?? "");
      setBody(nextSelected?.body ?? "");
      setTemplateStatus(nextSelected?.status ?? "published");
    } catch (loadError) {
      setError(loadError instanceof AdminApiError ? loadError.message : "Could not load email templates.");
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  useEffect(() => {
    void loadDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryStatus, search]);

  useEffect(() => {
    void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const selectTemplate = (template: AdminEmailTemplate) => {
    setSelectedTemplate(template);
    setSubject(template.subject);
    setBody(template.body);
    setTemplateStatus(template.status);
    setMessage("");
    setError("");
  };

  const handleRetry = async (delivery: AdminEmailDelivery) => {
    setRetryingDeliveryId(delivery.id);
    setError("");
    setMessage("");

    try {
      const updatedDelivery = await retryAdminEmailDelivery(delivery.id);
      setDeliveries((current) =>
        current.map((item) => (item.id === updatedDelivery.id ? updatedDelivery : item)),
      );
      setMessage(`Delivery is now ${updatedDelivery.status}.`);
    } catch (retryError) {
      setError(retryError instanceof AdminApiError ? retryError.message : "Could not retry delivery.");
    } finally {
      setRetryingDeliveryId(null);
    }
  };

  const handleTemplateSave = async () => {
    if (!selectedTemplate) return;

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const savedTemplate = await saveAdminEmailTemplate(selectedTemplate.key, {
        subject,
        body,
        status: templateStatus,
      });
      setTemplates((current) =>
        current.map((template) =>
          template.key === savedTemplate.key ? savedTemplate : template,
        ),
      );
      setSelectedTemplate(savedTemplate);
      setMessage("Email template saved.");
    } catch (saveError) {
      setError(saveError instanceof AdminApiError ? saveError.message : "Could not save template.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 border-b border-[#102329]/10 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
            Notifications
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">
            Emails
          </h1>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Review delivery status, retry failed messages, and edit transactional templates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadDeliveries();
            void loadTemplates();
          }}
          disabled={isLoadingDeliveries || isLoadingTemplates}
          className="h-11 w-fit border border-[#102329]/20 px-5 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
        >
          {isLoadingDeliveries || isLoadingTemplates ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(["queued", "sent", "failed", "suppressed"] as AdminEmailDeliveryStatus[]).map((item) => (
          <div key={item} className="border-t border-[#102329]/12 pt-3">
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/45">
              {deliveryStatusLabels[item]}
            </p>
            <p className="mt-2 text-3xl font-semibold">{counts[item]}</p>
          </div>
        ))}
      </div>

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

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 border-y border-[#102329]/10 py-4 xl:flex-row xl:items-center xl:justify-between">
            <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search recipient or template"
                className="h-11 w-full min-w-0 border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors focus:border-[#0F3B46] sm:w-[320px]"
              />
              <button
                type="submit"
                className="h-11 bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46]"
              >
                Search
              </button>
            </form>

            <div className="flex items-center gap-2 overflow-x-auto">
              {deliveryStatusOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDeliveryStatus(option)}
                  className={`h-10 whitespace-nowrap border px-4 font-inter text-sm font-semibold transition-colors ${
                    deliveryStatus === option
                      ? "border-[#0F3B46] bg-[#0F3B46] text-white"
                      : "border-[#102329]/16 text-[#102329]/65 hover:border-[#102329]/35"
                  }`}
                >
                  {deliveryStatusLabels[option]}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse">
              <thead>
                <tr className="border-b border-[#102329]/14 text-left">
                  <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Recipient
                  </th>
                  <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Template
                  </th>
                  <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Status
                  </th>
                  <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Created
                  </th>
                  <th className="py-3 text-right font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoadingDeliveries ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={index} className="border-b border-[#102329]/8">
                      <td colSpan={5} className="py-5">
                        <div className="h-7 animate-pulse bg-[#102329]/8" />
                      </td>
                    </tr>
                  ))
                ) : deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-14 text-center font-inter text-sm text-[#102329]/55">
                      No email deliveries match the current filters.
                    </td>
                  </tr>
                ) : (
                  deliveries.map((delivery) => (
                    <tr key={delivery.id} className="border-b border-[#102329]/8 align-top transition-colors hover:bg-white/55">
                      <td className="py-5 pr-5">
                        <p className="font-inter text-sm font-semibold">{delivery.recipientEmail}</p>
                        <p className="mt-1 font-inter text-xs text-[#102329]/48">
                          {delivery.resourceType ?? "No resource"}
                        </p>
                      </td>
                      <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">
                        {delivery.templateKey ?? "Unknown"}
                      </td>
                      <td className="py-5 pr-5">
                        <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${deliveryStatusClasses[delivery.status]}`}>
                          {deliveryStatusLabels[delivery.status]}
                        </span>
                        {delivery.lastError && (
                          <p className="mt-2 max-w-[280px] font-inter text-xs leading-5 text-red-700">
                            {delivery.lastError}
                          </p>
                        )}
                      </td>
                      <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">
                        {formatDate(delivery.createdAt)}
                      </td>
                      <td className="py-5 text-right">
                        {delivery.status !== "sent" && (
                          <button
                            type="button"
                            onClick={() => void handleRetry(delivery)}
                            disabled={retryingDeliveryId === delivery.id}
                            className="h-9 border border-[#0F3B46] px-4 font-inter text-xs font-semibold text-[#0F3B46] transition-colors hover:bg-[#0F3B46] hover:text-white disabled:cursor-wait disabled:opacity-50"
                          >
                            {retryingDeliveryId === delivery.id ? "Retrying" : "Retry"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="border-t border-[#102329]/14 pt-5 xl:border-t-0 xl:pt-0">
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">
            Templates
          </p>

          {isLoadingTemplates ? (
            <p className="mt-5 font-inter text-sm text-[#102329]/55">Loading templates...</p>
          ) : templates.length === 0 ? (
            <p className="mt-5 font-inter text-sm leading-6 text-[#102329]/55">
              No templates yet. Templates appear after first related email flow runs.
            </p>
          ) : (
            <div className="mt-5 space-y-5">
              <select
                value={selectedTemplate?.key ?? ""}
                onChange={(event) => {
                  const template = templates.find((item) => item.key === event.target.value);
                  if (template) selectTemplate(template);
                }}
                className="h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
              >
                {templates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.key}
                  </option>
                ))}
              </select>

              <div className="space-y-3">
                <label className="block font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Subject
                </label>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
                />
              </div>

              <div className="space-y-3">
                <label className="block font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                  Body
                </label>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={12}
                  className="w-full resize-none border border-[#102329]/18 bg-white px-3 py-3 font-inter text-sm leading-6 outline-none focus:border-[#0F3B46]"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <select
                  value={templateStatus}
                  onChange={(event) => setTemplateStatus(event.target.value as AdminEmailTemplateStatus)}
                  className="h-11 border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
                >
                  {templateStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleTemplateSave()}
                  disabled={
                    isSaving ||
                    !selectedTemplate ||
                    (subject === selectedTemplate.subject &&
                      body === selectedTemplate.body &&
                      templateStatus === selectedTemplate.status)
                  }
                  className="h-11 border border-[#0F3B46] bg-[#0F3B46] px-5 font-inter text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isSaving ? "Saving" : "Save"}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
