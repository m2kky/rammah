"use client";

import { useCallback, useEffect, useState } from "react";
import {
  archiveAdminNavigationItem,
  createAdminNavigationItem,
  fetchAdminNavigationItems,
  fetchAdminSiteSettings,
  saveAdminSiteSettings,
  updateAdminNavigationItem,
  type AdminNavigationItem,
  type AdminNavigationItemPayload,
  type AdminSiteSettingsPayload,
} from "../../lib/api/admin";
import { CmsPagesEditor } from "./cms/CmsPagesEditor";
import { GlobalMediaEditor } from "./cms/GlobalMediaEditor";
import { LegalPagesEditor } from "./cms/LegalPagesEditor";
import { MediaLibrary } from "./cms/MediaLibrary";

type CmsView = "pages" | "media" | "global" | "legal" | "navigation" | "settings";
const views: Array<{ id: CmsView; label: string; description: string }> = [
  { id: "pages", label: "Pages", description: "Create pages and edit their ready-made sections" },
  { id: "media", label: "Media", description: "Upload, inspect and safely remove files" },
  { id: "global", label: "Global media", description: "Loading, menu, SEO and custom page visuals" },
  { id: "legal", label: "Legal", description: "Versioned Markdown legal documents" },
  { id: "navigation", label: "Navigation", description: "Header and footer links" },
  { id: "settings", label: "Settings", description: "Brand and contact details" },
];

const emptyNavigation: AdminNavigationItemPayload = { label: "", url: "", location: "header", sortOrder: 0, status: "draft" };

function SettingsEditor() {
  const [form, setForm] = useState<AdminSiteSettingsPayload>({ siteName: "", defaultLocale: "en", contactEmail: null, contactPhone: null, socialLinks: {} });
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { void fetchAdminSiteSettings().then((settings) => settings && setForm({ siteName: settings.siteName, defaultLocale: settings.defaultLocale, contactEmail: settings.contactEmail, contactPhone: settings.contactPhone, socialLinks: settings.socialLinks })); }, []);
  const save = async () => { try { await saveAdminSiteSettings(form); setMessage("Settings saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save settings."); } };
  return <section className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">CMS</p><h2 className="mt-2 text-3xl font-semibold">Site settings</h2></div>{message ? <p className="border border-[#102329]/10 bg-white p-3 text-sm">{message}</p> : null}<div className="grid gap-4 border border-[#102329]/12 bg-white p-5 md:grid-cols-2"><label className="text-xs font-semibold">Site name<input value={form.siteName} onChange={(event) => setForm({ ...form, siteName: event.target.value })} className="mt-1 h-11 w-full border border-[#102329]/18 px-3 text-sm" /></label><label className="text-xs font-semibold">Default locale<input value={form.defaultLocale} onChange={(event) => setForm({ ...form, defaultLocale: event.target.value })} className="mt-1 h-11 w-full border border-[#102329]/18 px-3 text-sm" /></label><label className="text-xs font-semibold">Contact email<input type="email" value={form.contactEmail ?? ""} onChange={(event) => setForm({ ...form, contactEmail: event.target.value || null })} className="mt-1 h-11 w-full border border-[#102329]/18 px-3 text-sm" /></label><label className="text-xs font-semibold">Contact phone<input value={form.contactPhone ?? ""} onChange={(event) => setForm({ ...form, contactPhone: event.target.value || null })} className="mt-1 h-11 w-full border border-[#102329]/18 px-3 text-sm" /></label>{["instagram", "linkedin", "youtube"].map((network) => <label key={network} className="text-xs font-semibold capitalize">{network}<input value={form.socialLinks[network] ?? ""} onChange={(event) => setForm({ ...form, socialLinks: { ...form.socialLinks, [network]: event.target.value } })} placeholder="https://…" className="mt-1 h-11 w-full border border-[#102329]/18 px-3 text-sm" /></label>)}<div className="flex items-end"><button type="button" onClick={() => void save()} className="h-11 w-full bg-[#0F3B46] px-5 text-sm font-semibold text-white">Save settings</button></div></div></section>;
}

function NavigationEditor() {
  const [items, setItems] = useState<AdminNavigationItem[]>([]);
  const [selected, setSelected] = useState<AdminNavigationItem | null>(null);
  const [form, setForm] = useState<AdminNavigationItemPayload>(emptyNavigation);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { try { setItems(await fetchAdminNavigationItems()); setError(null); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load navigation."); } }, []);
  useEffect(() => { void load(); }, [load]);
  const choose = (item: AdminNavigationItem) => { setSelected(item); setForm({ label: item.label, url: item.url, location: item.location, sortOrder: item.sortOrder, status: item.status }); };
  const save = async () => { try { if (selected) await updateAdminNavigationItem(selected.id, form); else await createAdminNavigationItem(form); setSelected(null); setForm(emptyNavigation); await load(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save navigation."); } };
  return <section className="space-y-5"><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">CMS</p><h2 className="mt-2 text-3xl font-semibold">Navigation</h2></div><button type="button" onClick={() => { setSelected(null); setForm(emptyNavigation); }} className="border border-[#102329]/18 px-4 py-2 text-sm font-semibold">New link</button></div>{error ? <p className="border border-red-700/20 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}<div className="grid gap-6 xl:grid-cols-[1fr_360px]"><div className="space-y-2">{items.map((item) => <div key={item.id} className="flex items-center gap-2 border border-[#102329]/10 bg-white p-3"><button type="button" onClick={() => choose(item)} className="min-w-0 flex-1 text-left"><strong className="block truncate text-sm">{item.label}</strong><span className="text-xs text-[#102329]/48">{item.url} · {item.location} · {item.status}</span></button><button type="button" onClick={() => { if (window.confirm(`Archive “${item.label}”?`)) void archiveAdminNavigationItem(item.id).then(load); }} className="text-xs font-semibold text-red-700">Archive</button></div>)}</div><aside className="space-y-3 border border-[#102329]/12 bg-white p-5"><h3 className="font-semibold">{selected ? "Edit link" : "New link"}</h3><input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Label" className="h-10 w-full border border-[#102329]/18 px-3 text-sm" /><input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="/booking" className="h-10 w-full border border-[#102329]/18 px-3 text-sm" /><div className="grid grid-cols-2 gap-2"><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="header" className="h-10 border border-[#102329]/18 px-3 text-sm" /><input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} className="h-10 border border-[#102329]/18 px-3 text-sm" /></div><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AdminNavigationItemPayload["status"] })} className="h-10 w-full border border-[#102329]/18 px-3 text-sm"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select><button type="button" onClick={() => void save()} className="h-10 w-full bg-[#0F3B46] text-sm font-semibold text-white">Save link</button></aside></div></section>;
}

export default function AdminCms() {
  const [activeView, setActiveView] = useState<CmsView>("pages");
  return (
    <div className="min-h-full bg-[#f4f1e9] text-[#102329]">
      <header className="border-b border-[#102329]/10 px-5 py-6 lg:px-8"><p className="font-inter text-xs font-semibold uppercase tracking-[0.2em] text-[#102329]/42">Content management</p><h1 className="mt-2 text-4xl font-semibold">Website CMS</h1><p className="mt-2 max-w-2xl font-inter text-sm leading-6 text-[#102329]/58">Control every page section, image, video and legal document from one place.</p></header>
      <div className="grid lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav className="border-b border-[#102329]/10 p-4 lg:min-h-[calc(100vh-140px)] lg:border-b-0 lg:border-r"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{views.map((view) => <button key={view.id} type="button" onClick={() => setActiveView(view.id)} className={`border p-3 text-left transition-colors ${activeView === view.id ? "border-[#0F3B46] bg-[#0F3B46] text-white" : "border-transparent hover:border-[#102329]/15 hover:bg-white"}`}><strong className="block font-inter text-sm">{view.label}</strong><span className={`mt-1 block font-inter text-xs leading-5 ${activeView === view.id ? "text-white/65" : "text-[#102329]/48"}`}>{view.description}</span></button>)}</div></nav>
        <main className="min-w-0 p-5 lg:p-8">{activeView === "pages" ? <CmsPagesEditor /> : activeView === "media" ? <MediaLibrary /> : activeView === "global" ? <GlobalMediaEditor /> : activeView === "legal" ? <LegalPagesEditor /> : activeView === "navigation" ? <NavigationEditor /> : <SettingsEditor />}</main>
      </div>
    </div>
  );
}
