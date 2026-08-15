"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  archiveAdminCmsPage,
  archiveAdminCmsPageSection,
  createAdminCmsPage,
  createAdminCmsPageSection,
  createAdminPagePreviewToken,
  duplicateAdminCmsPageSection,
  fetchAdminCmsPageSections,
  fetchAdminCmsPages,
  fetchAdminCmsSectionDefinitions,
  fetchAdminSeoMetadata,
  reorderAdminCmsPageSections,
  replaceAdminCmsSectionMedia,
  saveAdminSeoMetadata,
  updateAdminCmsPage,
  updateAdminCmsPageSection,
  type AdminCmsPage,
  type AdminCmsPagePayload,
  type AdminCmsPageSection,
  type AdminCmsSectionDefinition,
  type AdminMediaAsset,
  type AdminSeoMetadata,
} from "../../../lib/api/admin";
import { assignmentToMediaAsset } from "./MediaPicker";
import { SectionEditor } from "./SectionEditor";

const reservedSlugs = new Set(["admin", "api", "booking", "blog", "services", "about", "contact", "legal", "privacy", "privacy-policy", "terms", "terms-and-conditions", "thank-you", "cms-preview"]);
const validSlug = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !reservedSlugs.has(slug);
const emptyPage: AdminCmsPagePayload = { slug: "", title: "", template: "default", status: "draft", publishedAt: null };
const emptySeo = (resourceId: string): Omit<AdminSeoMetadata, "id" | "createdAt" | "updatedAt"> => ({ resourceType: "page", resourceId, metaTitle: null, metaDescription: null, canonicalUrl: null, ogImageAssetId: null, noindex: false });
const dateTimeLocal = (value: string | null | undefined) => value ? new Date(value).toISOString().slice(0, 16) : "";
const isoOrNull = (value: string | null | undefined) => value ? new Date(value).toISOString() : null;

export function CmsPagesEditor() {
  const [pages, setPages] = useState<AdminCmsPage[]>([]);
  const [definitions, setDefinitions] = useState<AdminCmsSectionDefinition[]>([]);
  const [selectedPage, setSelectedPage] = useState<AdminCmsPage | null>(null);
  const [pageForm, setPageForm] = useState<AdminCmsPagePayload>(emptyPage);
  const [sections, setSections] = useState<AdminCmsPageSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<AdminCmsPageSection | null>(null);
  const [mediaValues, setMediaValues] = useState<Record<string, AdminMediaAsset[]>>({});
  const [newSectionType, setNewSectionType] = useState("hero");
  const [seo, setSeo] = useState<Omit<AdminSeoMetadata, "id" | "createdAt" | "updatedAt"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadIndex = useCallback(async () => {
    try {
      const [nextPages, nextDefinitions] = await Promise.all([
        fetchAdminCmsPages(),
        fetchAdminCmsSectionDefinitions(),
      ]);
      setPages(nextPages);
      setDefinitions(nextDefinitions);
      if (nextDefinitions[0] && !nextDefinitions.some(({ key }) => key === newSectionType)) setNewSectionType(nextDefinitions[0].key);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load pages."); }
  }, [newSectionType]);

  useEffect(() => { void loadIndex(); }, [loadIndex]);

  const choosePage = async (page: AdminCmsPage) => {
    setSelectedPage(page);
    setPageForm({ slug: page.slug, title: page.title, template: page.template, status: page.status, publishedAt: dateTimeLocal(page.publishedAt) || null });
    setSelectedSection(null);
    setBusy(true);
    try {
      const [nextSections, metadata] = await Promise.all([
        fetchAdminCmsPageSections(page.id),
        fetchAdminSeoMetadata("page", page.id),
      ]);
      setSections(nextSections);
      setSeo(metadata ? {
        resourceType: metadata.resourceType,
        resourceId: metadata.resourceId,
        metaTitle: metadata.metaTitle,
        metaDescription: metadata.metaDescription,
        canonicalUrl: metadata.canonicalUrl,
        ogImageAssetId: metadata.ogImageAssetId,
        noindex: metadata.noindex,
      } : emptySeo(page.id));
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not load this page."); }
    finally { setBusy(false); }
  };

  const chooseSection = (section: AdminCmsPageSection) => {
    setSelectedSection({ ...section, config: { ...section.config } });
    setMediaValues(Object.fromEntries(Object.entries(section.media).map(([slot, assignments]) => [slot, assignments.map(assignmentToMediaAsset)])));
  };

  const savePage = async () => {
    if (!pageForm.title.trim() || !pageForm.slug.trim()) return;
    if (!selectedPage && !validSlug(pageForm.slug)) { setError("Use a lowercase, single-segment slug that is not reserved."); return; }
    setBusy(true);
    setError(null);
    try {
      const payload = { ...pageForm, publishedAt: isoOrNull(pageForm.publishedAt) };
      const saved = selectedPage
        ? await updateAdminCmsPage(selectedPage.id, {
            title: payload.title,
            status: payload.status,
            publishedAt: payload.publishedAt,
            ...(payload.slug !== selectedPage.slug ? { slug: payload.slug } : {}),
          })
        : await createAdminCmsPage(payload);
      await loadIndex();
      await choosePage(saved);
    } catch (saveError) { setError(saveError instanceof AdminApiError ? saveError.message : "Could not save page."); }
    finally { setBusy(false); }
  };

  const saveSection = async () => {
    if (!selectedPage || !selectedSection) return;
    setBusy(true);
    setError(null);
    try {
      await updateAdminCmsPageSection(selectedPage.id, selectedSection.id, {
        sectionType: selectedSection.sectionType,
        title: selectedSection.title,
        body: selectedSection.body,
        config: selectedSection.config,
        sortOrder: selectedSection.sortOrder,
        status: selectedSection.status,
      });
      await replaceAdminCmsSectionMedia(
        selectedPage.id,
        selectedSection.id,
        Object.fromEntries(Object.entries(mediaValues).map(([slot, assets]) => [slot, assets.map((asset) => ({ mediaAssetId: asset.id, decorative: asset.mediaKind !== "image" }))])),
      );
      const next = await fetchAdminCmsPageSections(selectedPage.id);
      setSections(next);
      const refreshed = next.find(({ id }) => id === selectedSection.id);
      if (refreshed) chooseSection(refreshed);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save section."); }
    finally { setBusy(false); }
  };

  const addSection = async () => {
    if (!selectedPage) return;
    setBusy(true);
    try {
      const created = await createAdminCmsPageSection(selectedPage.id, { sectionType: newSectionType, title: null, body: null, config: {}, status: "draft" });
      const next = await fetchAdminCmsPageSections(selectedPage.id);
      setSections(next);
      chooseSection(next.find(({ id }) => id === created.id) ?? created);
    } catch (createError) { setError(createError instanceof Error ? createError.message : "Could not add section."); }
    finally { setBusy(false); }
  };

  const moveSection = async (sectionId: string, direction: -1 | 1) => {
    if (!selectedPage) return;
    const index = sections.findIndex(({ id }) => id === sectionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sections.length) return;
    const reordered = [...sections];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    setSections(reordered);
    try { setSections(await reorderAdminCmsPageSections(selectedPage.id, reordered.map(({ id }) => id))); }
    catch (orderError) { setError(orderError instanceof Error ? orderError.message : "Could not reorder sections."); }
  };

  const archiveSection = async (section: AdminCmsPageSection) => {
    if (!selectedPage || !window.confirm(`Archive ${section.sectionType} section?`)) return;
    try { await archiveAdminCmsPageSection(selectedPage.id, section.id); setSections(await fetchAdminCmsPageSections(selectedPage.id)); if (selectedSection?.id === section.id) setSelectedSection(null); }
    catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "Could not archive section."); }
  };

  const duplicateSection = async (section: AdminCmsPageSection) => {
    if (!selectedPage) return;
    try { await duplicateAdminCmsPageSection(selectedPage.id, section.id); setSections(await fetchAdminCmsPageSections(selectedPage.id)); }
    catch (duplicateError) { setError(duplicateError instanceof Error ? duplicateError.message : "Could not duplicate section."); }
  };

  const saveSeo = async () => {
    if (!seo) return;
    setBusy(true);
    try { await saveAdminSeoMetadata(seo); }
    catch (seoError) { setError(seoError instanceof Error ? seoError.message : "Could not save SEO."); }
    finally { setBusy(false); }
  };

  const preview = async () => {
    if (!selectedPage) return;
    try {
      const issued = await createAdminPagePreviewToken(selectedPage.id);
      const url = `/cms-preview?token=${encodeURIComponent(issued.token)}&pageId=${encodeURIComponent(issued.pageId)}&slug=${encodeURIComponent(issued.slug)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (previewError) { setError(previewError instanceof Error ? previewError.message : "Could not create preview."); }
  };

  const definition = useMemo(() => definitions.find(({ key }) => key === selectedSection?.sectionType), [definitions, selectedSection?.sectionType]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">CMS</p><h2 className="mt-2 text-3xl font-semibold">Pages & sections</h2></div><button type="button" onClick={() => { setSelectedPage(null); setPageForm(emptyPage); setSections([]); setSelectedSection(null); setSeo(null); }} className="border border-[#102329]/18 px-4 py-2 text-sm font-semibold">New page</button></div>
      {error ? <p className="border border-red-700/20 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-2 border-r border-[#102329]/10 pr-4">
          {pages.map((page) => <button key={page.id} type="button" onClick={() => void choosePage(page)} className={`block w-full border p-3 text-left ${selectedPage?.id === page.id ? "border-[#0F3B46] bg-white" : "border-[#102329]/10"}`}><strong className="block text-sm">{page.title}</strong><span className="mt-1 block text-xs text-[#102329]/48">/{page.slug} · {page.status}</span></button>)}
        </aside>
        <div className="space-y-7">
          <article className="space-y-4 border border-[#102329]/12 bg-white p-5"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Details</h3>{selectedPage ? <button type="button" onClick={() => void preview()} className="text-sm font-semibold text-[#0F3B46]">Open preview</button> : null}</div><div className="grid gap-3 md:grid-cols-2"><input value={pageForm.title} onChange={(event) => setPageForm({ ...pageForm, title: event.target.value })} placeholder="Page title" className="h-11 border border-[#102329]/18 px-3 text-sm" /><input value={pageForm.slug} onChange={(event) => setPageForm({ ...pageForm, slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })} placeholder="page-slug" className="h-11 border border-[#102329]/18 px-3 text-sm" /><select value={pageForm.status} onChange={(event) => setPageForm({ ...pageForm, status: event.target.value as AdminCmsPagePayload["status"] })} className="h-11 border border-[#102329]/18 px-3 text-sm"><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option><option value="archived">Archived</option></select><input type="datetime-local" value={pageForm.publishedAt ?? ""} onChange={(event) => setPageForm({ ...pageForm, publishedAt: event.target.value || null })} disabled={pageForm.status !== "scheduled"} className="h-11 border border-[#102329]/18 px-3 text-sm disabled:opacity-40" /></div>{selectedPage?.publicationError ? <p className="text-xs text-red-700">Last publication check: {selectedPage.publicationError}</p> : null}<div className="flex justify-end gap-2"><button type="button" onClick={() => void savePage()} disabled={busy} className="bg-[#0F3B46] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{selectedPage ? "Save page" : "Create page"}</button>{selectedPage ? <button type="button" onClick={() => { if (window.confirm("Archive this page?")) void archiveAdminCmsPage(selectedPage.id).then(loadIndex); }} className="border border-red-700/40 px-4 py-2 text-sm font-semibold text-red-700">Archive</button> : null}</div></article>

          {selectedPage && seo ? <article className="space-y-4 border border-[#102329]/12 bg-white p-5"><h3 className="text-lg font-semibold">SEO</h3><input value={seo.metaTitle ?? ""} onChange={(event) => setSeo({ ...seo, metaTitle: event.target.value || null })} placeholder="Meta title" className="h-11 w-full border border-[#102329]/18 px-3 text-sm" /><textarea value={seo.metaDescription ?? ""} onChange={(event) => setSeo({ ...seo, metaDescription: event.target.value || null })} placeholder="Meta description" rows={3} className="w-full border border-[#102329]/18 p-3 text-sm" /><div className="flex items-center justify-between"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={seo.noindex} onChange={(event) => setSeo({ ...seo, noindex: event.target.checked })} /> Hide from search engines</label><button type="button" onClick={() => void saveSeo()} className="border border-[#0F3B46] px-4 py-2 text-sm font-semibold text-[#0F3B46]">Save SEO</button></div></article> : null}

          {selectedPage ? <article className="space-y-4 border border-[#102329]/12 bg-white p-5"><div className="flex flex-col justify-between gap-2 sm:flex-row"><h3 className="text-lg font-semibold">Sections</h3><div className="flex gap-2"><select value={newSectionType} onChange={(event) => setNewSectionType(event.target.value)} className="h-9 border border-[#102329]/18 px-2 text-xs">{definitions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select><button type="button" onClick={() => void addSection()} className="bg-[#102329] px-3 text-xs font-semibold text-white">Add section</button></div></div><div className="space-y-2">{sections.filter(({ status }) => status !== "archived").map((section, index) => <div key={section.id} className="flex items-center gap-2 border border-[#102329]/10 p-2"><button type="button" onClick={() => chooseSection(section)} className="min-w-0 flex-1 text-left"><strong className="block truncate text-sm">{definitions.find(({ key }) => key === section.sectionType)?.label ?? section.sectionType}</strong><span className="text-xs text-[#102329]/45">{section.status}</span></button><button type="button" aria-label="Move up" onClick={() => void moveSection(section.id, -1)} disabled={index === 0} className="px-2 disabled:opacity-30">↑</button><button type="button" aria-label="Move down" onClick={() => void moveSection(section.id, 1)} disabled={index === sections.length - 1} className="px-2 disabled:opacity-30">↓</button><button type="button" onClick={() => void duplicateSection(section)} className="px-2 text-xs font-semibold">Duplicate</button><button type="button" onClick={() => void archiveSection(section)} className="px-2 text-xs font-semibold text-red-700">Archive</button></div>)}</div></article> : null}

          {selectedSection && definition ? <article className="space-y-5 border border-[#0F3B46]/30 bg-white p-5"><SectionEditor definition={definition} section={selectedSection} onChange={setSelectedSection} mediaValues={mediaValues} onMediaChange={(slot, assets) => setMediaValues((current) => ({ ...current, [slot]: assets }))} /><div className="flex items-center justify-between border-t border-[#102329]/10 pt-4"><select value={selectedSection.status} onChange={(event) => setSelectedSection({ ...selectedSection, status: event.target.value as AdminCmsPageSection["status"] })} className="h-10 border border-[#102329]/18 px-3 text-sm"><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option><option value="archived">Archived</option></select><button type="button" onClick={() => void saveSection()} disabled={busy} className="bg-[#0F3B46] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Save section</button></div></article> : null}
        </div>
      </div>
    </section>
  );
}
