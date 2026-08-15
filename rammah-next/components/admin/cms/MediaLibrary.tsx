"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import {
  archiveAdminMediaAsset,
  fetchAdminMediaAssets,
  fetchAdminMediaUsages,
  permanentlyDeleteAdminMediaAsset,
  updateAdminMediaAsset,
  type AdminContentStatus,
  type AdminMediaAsset,
  type AdminMediaKind,
  type AdminMediaSource,
  type AdminMediaUsage,
} from "../../../lib/api/admin";
import { MediaPicker } from "./MediaPicker";

const preview = (asset: AdminMediaAsset) => {
  if (!asset.publicUrl) return <span className="text-xs">No preview</span>;
  if (asset.mediaKind === "image") return <img src={asset.publicUrl} alt={asset.altText ?? ""} className="h-full w-full object-cover" />;
  if (asset.mediaKind === "video") return <video src={asset.publicUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />;
  return <span className="px-3 text-center text-xs font-semibold">{String(asset.metadata.frameCount ?? "—")} frames</span>;
};

export function MediaLibrary() {
  const [assets, setAssets] = useState<AdminMediaAsset[]>([]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<AdminMediaKind | "all">("all");
  const [source, setSource] = useState<AdminMediaSource | "all">("all");
  const [status, setStatus] = useState<AdminContentStatus | "all">("all");
  const [selected, setSelected] = useState<AdminMediaAsset | null>(null);
  const [usages, setUsages] = useState<AdminMediaUsage[]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftAlt, setDraftAlt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAssets(await fetchAdminMediaAssets({ search, mediaKind: kind, sourceType: source, status }));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load media.");
    } finally {
      setLoading(false);
    }
  }, [kind, search, source, status]);

  useEffect(() => { void load(); }, [load]);

  const inspect = async (asset: AdminMediaAsset) => {
    setSelected(asset);
    setDraftName(asset.displayName);
    setDraftAlt(asset.altText ?? "");
    try { setUsages(await fetchAdminMediaUsages(asset.id)); } catch { setUsages([]); }
  };

  const save = async () => {
    if (!selected) return;
    try {
      const saved = await updateAdminMediaAsset(selected.id, {
        displayName: draftName,
        altText: draftAlt.trim() || null,
      });
      setSelected(saved);
      await load();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save media."); }
  };

  const archive = async () => {
    if (!selected || !window.confirm(`Archive “${selected.displayName}”?`)) return;
    try { await archiveAdminMediaAsset(selected.id); setSelected(null); await load(); }
    catch (archiveError) { setError(archiveError instanceof Error ? archiveError.message : "Could not archive media."); }
  };

  const permanentDelete = async () => {
    if (!selected || selected.status !== "archived") return;
    if (!window.confirm("Permanently delete this archived file? This cannot be recovered from the CMS.")) return;
    try { await permanentlyDeleteAdminMediaAsset(selected.id); setSelected(null); await load(); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Could not delete media."); }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div><p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">CMS</p><h2 className="mt-2 text-3xl font-semibold">Media library</h2></div>
        <button type="button" onClick={() => void load()} className="h-10 border border-[#102329]/18 px-4 text-sm font-semibold">Refresh</button>
      </div>

      <details className="border border-[#102329]/12 bg-white p-4">
        <summary className="cursor-pointer font-inter text-sm font-semibold">Add media</summary>
        <div className="mt-4">
          <MediaPicker accepts={["image", "video", "animation_bundle"]} multiple value={[]} onChange={() => void load()} />
        </div>
      </details>

      <div className="grid gap-3 border-y border-[#102329]/10 py-4 md:grid-cols-4">
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search media" className="h-10 border border-[#102329]/18 bg-white px-3 text-sm" />
        <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className="h-10 border border-[#102329]/18 bg-white px-3 text-sm"><option value="all">All kinds</option><option value="image">Images</option><option value="video">Videos</option><option value="animation_bundle">Animations</option></select>
        <select value={source} onChange={(event) => setSource(event.target.value as typeof source)} className="h-10 border border-[#102329]/18 bg-white px-3 text-sm"><option value="all">All sources</option><option value="r2">R2 uploads</option><option value="external">External URLs</option></select>
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="h-10 border border-[#102329]/18 bg-white px-3 text-sm"><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select>
      </div>

      {error ? <p className="border border-red-700/20 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="py-12 text-center text-sm text-[#102329]/50">Loading media…</p> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {assets.map((asset) => (
            <button key={asset.id} type="button" onClick={() => void inspect(asset)} className="overflow-hidden border border-[#102329]/12 bg-white text-left hover:border-[#0F3B46]">
              <span className="grid aspect-video place-items-center overflow-hidden bg-[#102329]/6">{preview(asset)}</span>
              <span className="block space-y-1 p-3"><strong className="block truncate text-sm">{asset.displayName}</strong><span className="block text-xs text-[#102329]/48">{asset.mediaKind.replace("_", " ")} · {asset.sourceType} · {asset.processingState}</span></span>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-[#102329]/15 bg-[#f7f5ef] p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-[#102329]/45">Media details</p><h3 className="mt-1 text-xl font-semibold">{selected.displayName}</h3></div><button type="button" onClick={() => setSelected(null)} className="text-sm font-semibold">Close</button></div>
          <div className="mt-5 grid aspect-video place-items-center overflow-hidden bg-[#102329]/6">{preview(selected)}</div>
          <div className="mt-5 space-y-3">
            <label className="block text-xs font-semibold">Display name<input value={draftName} onChange={(event) => setDraftName(event.target.value)} className="mt-1 h-10 w-full border border-[#102329]/18 bg-white px-3 text-sm" /></label>
            <label className="block text-xs font-semibold">Alternative text<textarea value={draftAlt} onChange={(event) => setDraftAlt(event.target.value)} rows={3} className="mt-1 w-full border border-[#102329]/18 bg-white p-3 text-sm" /></label>
            <button type="button" onClick={() => void save()} className="w-full bg-[#0F3B46] px-4 py-2.5 text-sm font-semibold text-white">Save details</button>
          </div>
          <div className="mt-7 border-t border-[#102329]/12 pt-5"><p className="text-xs font-semibold uppercase tracking-wider">Used in</p>{usages.length ? <ul className="mt-3 space-y-2 text-xs">{usages.map((usage, index) => <li key={index} className="border border-[#102329]/10 bg-white p-2">{String(usage.ownerType)}{usage.slotKey ? ` · ${usage.slotKey}` : ""}</li>)}</ul> : <p className="mt-2 text-sm text-[#102329]/50">Not currently used.</p>}</div>
          <div className="mt-7 space-y-2 border-t border-red-700/15 pt-5"><button type="button" onClick={() => void archive()} disabled={usages.length > 0 || selected.status === "archived"} className="w-full border border-red-700/40 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-40">Archive</button>{selected.status === "archived" ? <button type="button" onClick={() => void permanentDelete()} disabled={usages.length > 0} className="w-full bg-red-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Delete permanently</button> : null}</div>
        </aside>
      ) : null}
    </section>
  );
}
