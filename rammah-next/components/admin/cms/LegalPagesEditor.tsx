"use client";

import { useCallback, useEffect, useState } from "react";
import {
  archiveAdminLegalPage,
  createAdminLegalPage,
  fetchAdminLegalPages,
  updateAdminLegalPage,
  type AdminLegalPage,
  type AdminLegalPagePayload,
} from "../../../lib/api/admin";
import { MarkdownEditor } from "./MarkdownEditor";
import { SeoEditor } from "./SeoEditor";

const emptyLegal: AdminLegalPagePayload = { slug: "", title: "", body: "", version: "1.0", status: "draft", publishedAt: null };
const localDate = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : "";

export function LegalPagesEditor() {
  const [pages, setPages] = useState<AdminLegalPage[]>([]);
  const [selected, setSelected] = useState<AdminLegalPage | null>(null);
  const [form, setForm] = useState<AdminLegalPagePayload>(emptyLegal);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setPages(await fetchAdminLegalPages()); setError(null); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load legal pages."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const choose = (page: AdminLegalPage) => {
    setSelected(page);
    setForm({ slug: page.slug, title: page.title, body: page.body, version: page.version, status: page.status, publishedAt: localDate(page.publishedAt) || null });
  };

  const save = async () => {
    if (!form.title.trim() || !form.body.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) { setError("Title, body and a lowercase single-segment slug are required."); return; }
    setBusy(true);
    try {
      const payload = { ...form, publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null };
      const saved = selected ? await updateAdminLegalPage(selected.id, payload) : await createAdminLegalPage(payload);
      await load();
      choose(saved);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save legal page."); }
    finally { setBusy(false); }
  };

  const archive = async () => {
    if (!selected || !window.confirm(`Archive “${selected.title}”?`)) return;
    try { await archiveAdminLegalPage(selected.id); setSelected(null); setForm(emptyLegal); await load(); }
    catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "Could not archive legal page."); }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">CMS</p><h2 className="mt-2 text-3xl font-semibold">Legal pages</h2></div><button type="button" onClick={() => { setSelected(null); setForm(emptyLegal); }} className="border border-[#102329]/18 px-4 py-2 text-sm font-semibold">New legal page</button></div>
      {error ? <p className="border border-red-700/20 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-2">{pages.map((page) => <button key={page.id} type="button" onClick={() => choose(page)} className={`w-full border p-3 text-left ${selected?.id === page.id ? "border-[#0F3B46] bg-white" : "border-[#102329]/10"}`}><strong className="block text-sm">{page.title}</strong><span className="mt-1 block text-xs text-[#102329]/48">/{page.slug} · v{page.version} · {page.status}</span></button>)}</aside>
        <article className="space-y-4 border border-[#102329]/12 bg-white p-5">
          <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-semibold">Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 h-11 w-full border border-[#102329]/18 px-3 text-sm" /></label><label className="text-xs font-semibold">Slug<input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })} className="mt-1 h-11 w-full border border-[#102329]/18 px-3 text-sm" /></label></div>
          <MarkdownEditor label="Legal document (Markdown)" value={form.body} onChange={(body) => setForm({ ...form, body })} rows={18} />
          <div className="grid gap-3 md:grid-cols-3"><label className="text-xs font-semibold">Version<input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} className="mt-1 h-10 w-full border border-[#102329]/18 px-3 text-sm" /></label><label className="text-xs font-semibold">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AdminLegalPagePayload["status"] })} className="mt-1 h-10 w-full border border-[#102329]/18 px-3 text-sm"><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option><option value="archived">Archived</option></select></label><label className="text-xs font-semibold">Publish at<input type="datetime-local" value={form.publishedAt ?? ""} onChange={(event) => setForm({ ...form, publishedAt: event.target.value || null })} disabled={form.status !== "scheduled"} className="mt-1 h-10 w-full border border-[#102329]/18 px-3 text-sm disabled:opacity-40" /></label></div>
          {selected?.publicationError ? <p className="text-xs text-red-700">Last publication check: {selected.publicationError}</p> : null}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => void save()} disabled={busy} className="bg-[#0F3B46] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{selected ? "Save legal page" : "Create legal page"}</button>{selected ? <button type="button" onClick={() => void archive()} className="border border-red-700/40 px-4 py-2 text-sm font-semibold text-red-700">Archive</button> : null}</div>
          {selected ? <SeoEditor resourceType="legal_page" resourceId={selected.id} /> : null}
        </article>
      </div>
    </section>
  );
}
