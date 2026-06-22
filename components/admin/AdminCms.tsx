"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AdminApiError,
  archiveAdminLegalPage,
  archiveAdminNavigationItem,
  createAdminLegalPage,
  createAdminNavigationItem,
  fetchAdminLegalPages,
  fetchAdminNavigationItems,
  fetchAdminSiteSettings,
  saveAdminSiteSettings,
  updateAdminLegalPage,
  updateAdminNavigationItem,
  type AdminContentStatus,
  type AdminLegalPage,
  type AdminLegalPagePayload,
  type AdminNavigationItem,
  type AdminNavigationItemPayload,
  type AdminSiteSettingsPayload,
} from "@/lib/api/admin";

const statusOptions: Array<AdminContentStatus | "all"> = [
  "all",
  "draft",
  "published",
  "scheduled",
  "archived",
];

const editableStatusOptions: AdminContentStatus[] = [
  "draft",
  "published",
  "scheduled",
  "archived",
];

const statusLabels: Record<AdminContentStatus | "all", string> = {
  all: "All",
  draft: "Draft",
  published: "Published",
  scheduled: "Scheduled",
  archived: "Archived",
};

const statusClasses: Record<AdminContentStatus, string> = {
  draft: "border-[#8A6F2A] text-[#8A6F2A]",
  published: "border-[#0F3B46] bg-[#0F3B46] text-white",
  scheduled: "border-[#0F3B46] text-[#0F3B46]",
  archived: "border-[#102329]/15 text-[#102329]/38",
};

const emptySettings = {
  siteName: "Ahmed Ramah Coaching Platform",
  defaultLocale: "en",
  contactEmail: "",
  contactPhone: "",
  bookingDefaultTimezone: "Africa/Cairo",
};

const emptyNavigation: AdminNavigationItemPayload = {
  label: "",
  url: "/",
  location: "header",
  sortOrder: 0,
  status: "draft",
};

const emptyLegal: AdminLegalPagePayload = {
  slug: "",
  title: "",
  body: "",
  version: "1.0",
  status: "draft",
  publishedAt: null,
};

const socialLinksText = (links: Record<string, string>) =>
  JSON.stringify(links, null, 2);

const parseSocialLinks = (value: string) => {
  const parsed = JSON.parse(value || "{}") as unknown;

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Social links must be a JSON object.");
  }

  for (const item of Object.values(parsed)) {
    if (typeof item !== "string") {
      throw new Error("Social link values must be strings.");
    }
  }

  return parsed as Record<string, string>;
};

const toDatetimeLocalValue = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const toNullableIso = (value: string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

const formatDate = (value: string | null) => {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

export default function AdminCms() {
  const [siteName, setSiteName] = useState(emptySettings.siteName);
  const [defaultLocale, setDefaultLocale] = useState(emptySettings.defaultLocale);
  const [contactEmail, setContactEmail] = useState(emptySettings.contactEmail);
  const [contactPhone, setContactPhone] = useState(emptySettings.contactPhone);
  const [bookingDefaultTimezone, setBookingDefaultTimezone] = useState(
    emptySettings.bookingDefaultTimezone,
  );
  const [socialLinks, setSocialLinks] = useState("{}");

  const [navigationItems, setNavigationItems] = useState<AdminNavigationItem[]>([]);
  const [selectedNavigation, setSelectedNavigation] = useState<AdminNavigationItem | null>(null);
  const [navigationForm, setNavigationForm] =
    useState<AdminNavigationItemPayload>(emptyNavigation);
  const [navigationStatus, setNavigationStatus] =
    useState<AdminContentStatus | "all">("all");
  const [navigationSearchInput, setNavigationSearchInput] = useState("");
  const [navigationSearch, setNavigationSearch] = useState("");

  const [legalPages, setLegalPages] = useState<AdminLegalPage[]>([]);
  const [selectedLegalPage, setSelectedLegalPage] = useState<AdminLegalPage | null>(null);
  const [legalForm, setLegalForm] = useState<AdminLegalPagePayload>(emptyLegal);
  const [legalStatus, setLegalStatus] = useState<AdminContentStatus | "all">("all");
  const [legalSearchInput, setLegalSearchInput] = useState("");
  const [legalSearch, setLegalSearch] = useState("");

  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isLoadingNavigation, setIsLoadingNavigation] = useState(true);
  const [isLoadingLegal, setIsLoadingLegal] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingNavigation, setIsSavingNavigation] = useState(false);
  const [isSavingLegal, setIsSavingLegal] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSettings = async () => {
    setIsLoadingSettings(true);
    setError("");

    try {
      const settings = await fetchAdminSiteSettings();
      setSiteName(settings?.siteName ?? emptySettings.siteName);
      setDefaultLocale(settings?.defaultLocale ?? emptySettings.defaultLocale);
      setContactEmail(settings?.contactEmail ?? "");
      setContactPhone(settings?.contactPhone ?? "");
      setBookingDefaultTimezone(
        settings?.bookingDefaultTimezone ?? emptySettings.bookingDefaultTimezone,
      );
      setSocialLinks(socialLinksText(settings?.socialLinks ?? {}));
    } catch (loadError) {
      setError(loadError instanceof AdminApiError ? loadError.message : "Could not load site settings.");
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const loadNavigation = async () => {
    setIsLoadingNavigation(true);
    setError("");

    try {
      const items = await fetchAdminNavigationItems({
        status: navigationStatus,
        search: navigationSearch,
      });
      setNavigationItems(items);

      if (selectedNavigation) {
        const nextSelected = items.find((item) => item.id === selectedNavigation.id) ?? null;
        setSelectedNavigation(nextSelected);
        if (nextSelected) {
          setNavigationForm({
            label: nextSelected.label,
            url: nextSelected.url,
            location: nextSelected.location,
            sortOrder: nextSelected.sortOrder,
            status: nextSelected.status,
          });
        }
      }
    } catch (loadError) {
      setError(loadError instanceof AdminApiError ? loadError.message : "Could not load navigation.");
    } finally {
      setIsLoadingNavigation(false);
    }
  };

  const loadLegalPages = async () => {
    setIsLoadingLegal(true);
    setError("");

    try {
      const pages = await fetchAdminLegalPages({
        status: legalStatus,
        search: legalSearch,
      });
      setLegalPages(pages);

      if (selectedLegalPage) {
        const nextSelected = pages.find((page) => page.id === selectedLegalPage.id) ?? null;
        setSelectedLegalPage(nextSelected);
        if (nextSelected) {
          setLegalForm({
            slug: nextSelected.slug,
            title: nextSelected.title,
            body: nextSelected.body,
            version: nextSelected.version,
            status: nextSelected.status,
            publishedAt: toDatetimeLocalValue(nextSelected.publishedAt),
          });
        }
      }
    } catch (loadError) {
      setError(loadError instanceof AdminApiError ? loadError.message : "Could not load legal pages.");
    } finally {
      setIsLoadingLegal(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    void loadNavigation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationStatus, navigationSearch]);

  useEffect(() => {
    void loadLegalPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legalStatus, legalSearch]);

  const handleNavigationSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNavigationSearch(navigationSearchInput.trim());
  };

  const handleLegalSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLegalSearch(legalSearchInput.trim());
  };

  const selectNavigation = (item: AdminNavigationItem) => {
    setSelectedNavigation(item);
    setNavigationForm({
      label: item.label,
      url: item.url,
      location: item.location,
      sortOrder: item.sortOrder,
      status: item.status,
    });
    setMessage("");
    setError("");
  };

  const resetNavigation = () => {
    setSelectedNavigation(null);
    setNavigationForm(emptyNavigation);
  };

  const selectLegalPage = (page: AdminLegalPage) => {
    setSelectedLegalPage(page);
    setLegalForm({
      slug: page.slug,
      title: page.title,
      body: page.body,
      version: page.version,
      status: page.status,
      publishedAt: toDatetimeLocalValue(page.publishedAt),
    });
    setMessage("");
    setError("");
  };

  const resetLegal = () => {
    setSelectedLegalPage(null);
    setLegalForm(emptyLegal);
  };

  const handleSettingsSave = async () => {
    setIsSavingSettings(true);
    setError("");
    setMessage("");

    try {
      const payload: AdminSiteSettingsPayload = {
        siteName,
        defaultLocale,
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        socialLinks: parseSocialLinks(socialLinks),
        bookingDefaultTimezone,
      };
      const saved = await saveAdminSiteSettings(payload);
      setSiteName(saved.siteName);
      setDefaultLocale(saved.defaultLocale);
      setContactEmail(saved.contactEmail ?? "");
      setContactPhone(saved.contactPhone ?? "");
      setBookingDefaultTimezone(saved.bookingDefaultTimezone);
      setSocialLinks(socialLinksText(saved.socialLinks));
      setMessage("Site settings saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save site settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleNavigationSave = async () => {
    setIsSavingNavigation(true);
    setError("");
    setMessage("");

    try {
      if (selectedNavigation) {
        await updateAdminNavigationItem(selectedNavigation.id, navigationForm);
        setMessage("Navigation item saved.");
      } else {
        await createAdminNavigationItem(navigationForm);
        resetNavigation();
        setMessage("Navigation item created.");
      }
      await loadNavigation();
    } catch (saveError) {
      setError(saveError instanceof AdminApiError ? saveError.message : "Could not save navigation item.");
    } finally {
      setIsSavingNavigation(false);
    }
  };

  const handleNavigationArchive = async (item: AdminNavigationItem) => {
    setIsSavingNavigation(true);
    setError("");
    setMessage("");

    try {
      await archiveAdminNavigationItem(item.id);
      if (selectedNavigation?.id === item.id) resetNavigation();
      await loadNavigation();
      setMessage("Navigation item archived.");
    } catch (archiveError) {
      setError(archiveError instanceof AdminApiError ? archiveError.message : "Could not archive navigation item.");
    } finally {
      setIsSavingNavigation(false);
    }
  };

  const handleLegalSave = async () => {
    setIsSavingLegal(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        ...legalForm,
        publishedAt: toNullableIso(legalForm.publishedAt),
      };

      if (selectedLegalPage) {
        await updateAdminLegalPage(selectedLegalPage.id, payload);
        setMessage("Legal page saved.");
      } else {
        await createAdminLegalPage(payload);
        resetLegal();
        setMessage("Legal page created.");
      }
      await loadLegalPages();
    } catch (saveError) {
      setError(saveError instanceof AdminApiError ? saveError.message : "Could not save legal page.");
    } finally {
      setIsSavingLegal(false);
    }
  };

  const handleLegalArchive = async (page: AdminLegalPage) => {
    setIsSavingLegal(true);
    setError("");
    setMessage("");

    try {
      await archiveAdminLegalPage(page.id);
      if (selectedLegalPage?.id === page.id) resetLegal();
      await loadLegalPages();
      setMessage("Legal page archived.");
    } catch (archiveError) {
      setError(archiveError instanceof AdminApiError ? archiveError.message : "Could not archive legal page.");
    } finally {
      setIsSavingLegal(false);
    }
  };

  return (
    <div className="space-y-9">
      <div className="flex flex-col gap-4 border-b border-[#102329]/10 pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
            Content
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">
            CMS
          </h1>
          <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
            Manage launch content that is already backed by public CMS APIs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadSettings();
            void loadNavigation();
            void loadLegalPages();
          }}
          disabled={isLoadingSettings || isLoadingNavigation || isLoadingLegal}
          className="h-11 w-fit border border-[#102329]/20 px-5 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
        >
          {isLoadingSettings || isLoadingNavigation || isLoadingLegal ? "Refreshing" : "Refresh"}
        </button>
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

      <section className="space-y-5 border-b border-[#102329]/10 pb-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">
              Settings
            </p>
            <h2 className="mt-2 text-3xl font-semibold">Site settings</h2>
          </div>
          <button
            type="button"
            onClick={() => void handleSettingsSave()}
            disabled={isSavingSettings || isLoadingSettings}
            className="h-11 border border-[#0F3B46] bg-[#0F3B46] px-5 font-inter text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-45"
          >
            {isSavingSettings ? "Saving" : "Save settings"}
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
              Site name
            </span>
            <input
              value={siteName}
              onChange={(event) => setSiteName(event.target.value)}
              className="h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
            />
          </label>
          <label className="space-y-2">
            <span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
              Locale
            </span>
            <input
              value={defaultLocale}
              onChange={(event) => setDefaultLocale(event.target.value)}
              className="h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
            />
          </label>
          <label className="space-y-2">
            <span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
              Contact email
            </span>
            <input
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              className="h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
            />
          </label>
          <label className="space-y-2">
            <span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
              Contact phone
            </span>
            <input
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              className="h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
            />
          </label>
          <label className="space-y-2">
            <span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
              Booking timezone
            </span>
            <input
              value={bookingDefaultTimezone}
              onChange={(event) => setBookingDefaultTimezone(event.target.value)}
              className="h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
            />
          </label>
          <label className="space-y-2">
            <span className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
              Social links JSON
            </span>
            <textarea
              value={socialLinks}
              onChange={(event) => setSocialLinks(event.target.value)}
              rows={5}
              className="w-full resize-none border border-[#102329]/18 bg-white px-3 py-3 font-mono text-xs leading-5 outline-none focus:border-[#0F3B46]"
            />
          </label>
        </div>
      </section>

      <section className="space-y-5 border-b border-[#102329]/10 pb-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">
              Navigation
            </p>
            <h2 className="mt-2 text-3xl font-semibold">Menu items</h2>
          </div>
          <button
            type="button"
            onClick={resetNavigation}
            className="h-11 border border-[#102329]/20 px-5 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
          >
            New item
          </button>
        </div>

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 border-y border-[#102329]/10 py-4 xl:flex-row xl:items-center xl:justify-between">
              <form onSubmit={handleNavigationSearch} className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="search"
                  value={navigationSearchInput}
                  onChange={(event) => setNavigationSearchInput(event.target.value)}
                  placeholder="Search label or URL"
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
                {statusOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setNavigationStatus(option)}
                    className={`h-10 whitespace-nowrap border px-4 font-inter text-sm font-semibold transition-colors ${
                      navigationStatus === option
                        ? "border-[#0F3B46] bg-[#0F3B46] text-white"
                        : "border-[#102329]/16 text-[#102329]/65 hover:border-[#102329]/35"
                    }`}
                  >
                    {statusLabels[option]}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="border-b border-[#102329]/14 text-left">
                    <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                      Label
                    </th>
                    <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                      URL
                    </th>
                    <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                      Location
                    </th>
                    <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                      Status
                    </th>
                    <th className="py-3 text-right font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingNavigation ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <tr key={index} className="border-b border-[#102329]/8">
                        <td colSpan={5} className="py-5">
                          <div className="h-7 animate-pulse bg-[#102329]/8" />
                        </td>
                      </tr>
                    ))
                  ) : navigationItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center font-inter text-sm text-[#102329]/55">
                        No navigation items match the current filters.
                      </td>
                    </tr>
                  ) : (
                    navigationItems.map((item) => (
                      <tr key={item.id} className="border-b border-[#102329]/8 align-top transition-colors hover:bg-white/55">
                        <td className="py-5 pr-5 font-inter text-sm font-semibold">{item.label}</td>
                        <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">{item.url}</td>
                        <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">{item.location}</td>
                        <td className="py-5 pr-5">
                          <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${statusClasses[item.status]}`}>
                            {statusLabels[item.status]}
                          </span>
                        </td>
                        <td className="py-5 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => selectNavigation(item)}
                              className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleNavigationArchive(item)}
                              disabled={isSavingNavigation || item.status === "archived"}
                              className="h-9 border border-red-700/45 px-4 font-inter text-xs font-semibold text-red-700 transition-colors hover:bg-red-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Archive
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

          <aside className="space-y-4 border-t border-[#102329]/14 pt-5 xl:border-t-0 xl:pt-0">
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">
              {selectedNavigation ? "Edit item" : "New item"}
            </p>
            <input
              value={navigationForm.label}
              onChange={(event) =>
                setNavigationForm({ ...navigationForm, label: event.target.value })
              }
              placeholder="Label"
              className="h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
            />
            <input
              value={navigationForm.url}
              onChange={(event) =>
                setNavigationForm({ ...navigationForm, url: event.target.value })
              }
              placeholder="/booking"
              className="h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={navigationForm.location}
                onChange={(event) =>
                  setNavigationForm({ ...navigationForm, location: event.target.value })
                }
                placeholder="header"
                className="h-11 border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
              />
              <input
                type="number"
                value={navigationForm.sortOrder}
                onChange={(event) =>
                  setNavigationForm({
                    ...navigationForm,
                    sortOrder: Number(event.target.value),
                  })
                }
                className="h-11 border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
              />
            </div>
            <select
              value={navigationForm.status}
              onChange={(event) =>
                setNavigationForm({
                  ...navigationForm,
                  status: event.target.value as AdminContentStatus,
                })
              }
              className="h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
            >
              {editableStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {statusLabels[option]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleNavigationSave()}
              disabled={isSavingNavigation || !navigationForm.label.trim() || !navigationForm.url.trim()}
              className="h-11 w-full border border-[#0F3B46] bg-[#0F3B46] px-5 font-inter text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSavingNavigation ? "Saving" : selectedNavigation ? "Save item" : "Create item"}
            </button>
          </aside>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">
              Legal
            </p>
            <h2 className="mt-2 text-3xl font-semibold">Legal pages</h2>
          </div>
          <button
            type="button"
            onClick={resetLegal}
            className="h-11 border border-[#102329]/20 px-5 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
          >
            New page
          </button>
        </div>

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 border-y border-[#102329]/10 py-4 xl:flex-row xl:items-center xl:justify-between">
              <form onSubmit={handleLegalSearch} className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="search"
                  value={legalSearchInput}
                  onChange={(event) => setLegalSearchInput(event.target.value)}
                  placeholder="Search title or slug"
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
                {statusOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLegalStatus(option)}
                    className={`h-10 whitespace-nowrap border px-4 font-inter text-sm font-semibold transition-colors ${
                      legalStatus === option
                        ? "border-[#0F3B46] bg-[#0F3B46] text-white"
                        : "border-[#102329]/16 text-[#102329]/65 hover:border-[#102329]/35"
                    }`}
                  >
                    {statusLabels[option]}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse">
                <thead>
                  <tr className="border-b border-[#102329]/14 text-left">
                    <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                      Page
                    </th>
                    <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                      Version
                    </th>
                    <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                      Published
                    </th>
                    <th className="py-3 pr-5 font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                      Status
                    </th>
                    <th className="py-3 text-right font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/45">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingLegal ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <tr key={index} className="border-b border-[#102329]/8">
                        <td colSpan={5} className="py-5">
                          <div className="h-7 animate-pulse bg-[#102329]/8" />
                        </td>
                      </tr>
                    ))
                  ) : legalPages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center font-inter text-sm text-[#102329]/55">
                        No legal pages match the current filters.
                      </td>
                    </tr>
                  ) : (
                    legalPages.map((page) => (
                      <tr key={page.id} className="border-b border-[#102329]/8 align-top transition-colors hover:bg-white/55">
                        <td className="py-5 pr-5">
                          <p className="font-inter text-sm font-semibold">{page.title}</p>
                          <p className="mt-1 font-inter text-xs text-[#102329]/48">/{page.slug}</p>
                        </td>
                        <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">{page.version}</td>
                        <td className="py-5 pr-5 font-inter text-sm text-[#102329]/70">
                          {formatDate(page.publishedAt)}
                        </td>
                        <td className="py-5 pr-5">
                          <span className={`inline-flex h-8 items-center border px-3 font-inter text-xs font-semibold ${statusClasses[page.status]}`}>
                            {statusLabels[page.status]}
                          </span>
                        </td>
                        <td className="py-5 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => selectLegalPage(page)}
                              className="h-9 border border-[#102329]/18 px-4 font-inter text-xs font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleLegalArchive(page)}
                              disabled={isSavingLegal || page.status === "archived"}
                              className="h-9 border border-red-700/45 px-4 font-inter text-xs font-semibold text-red-700 transition-colors hover:bg-red-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Archive
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

          <aside className="space-y-4 border-t border-[#102329]/14 pt-5 xl:border-t-0 xl:pt-0">
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">
              {selectedLegalPage ? "Edit page" : "New page"}
            </p>
            <input
              value={legalForm.title}
              onChange={(event) => setLegalForm({ ...legalForm, title: event.target.value })}
              placeholder="Title"
              className="h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={legalForm.slug}
                onChange={(event) => setLegalForm({ ...legalForm, slug: event.target.value })}
                placeholder="privacy-policy"
                className="h-11 border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
              />
              <input
                value={legalForm.version}
                onChange={(event) => setLegalForm({ ...legalForm, version: event.target.value })}
                placeholder="1.0"
                className="h-11 border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
              />
            </div>
            <textarea
              value={legalForm.body}
              onChange={(event) => setLegalForm({ ...legalForm, body: event.target.value })}
              rows={14}
              placeholder="Legal page body"
              className="w-full resize-none border border-[#102329]/18 bg-white px-3 py-3 font-inter text-sm leading-6 outline-none focus:border-[#0F3B46]"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={legalForm.status}
                onChange={(event) =>
                  setLegalForm({
                    ...legalForm,
                    status: event.target.value as AdminContentStatus,
                  })
                }
                className="h-11 border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
              >
                {editableStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {statusLabels[option]}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={legalForm.publishedAt ?? ""}
                onChange={(event) =>
                  setLegalForm({ ...legalForm, publishedAt: event.target.value || null })
                }
                className="h-11 border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleLegalSave()}
              disabled={
                isSavingLegal ||
                !legalForm.title.trim() ||
                !legalForm.slug.trim() ||
                !legalForm.body.trim()
              }
              className="h-11 w-full border border-[#0F3B46] bg-[#0F3B46] px-5 font-inter text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isSavingLegal ? "Saving" : selectedLegalPage ? "Save page" : "Create page"}
            </button>
          </aside>
        </div>
      </section>
    </div>
  );
}
