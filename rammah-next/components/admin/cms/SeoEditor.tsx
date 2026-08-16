"use client";

import { useEffect, useState } from "react";
import {
  fetchAdminMediaAssets,
  fetchAdminSeoMetadata,
  saveAdminSeoMetadata,
  type AdminMediaAsset,
} from "@/lib/api/admin";
import { MediaPicker } from "./MediaPicker";

type SeoEditorProps = {
  resourceType: "page" | "legal_page" | "blog_post";
  resourceId: string;
};

type SeoForm = {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  noindex: boolean;
};

const emptyForm: SeoForm = {
  metaTitle: "",
  metaDescription: "",
  canonicalUrl: "",
  noindex: false,
};

export function SeoEditor({ resourceType, resourceId }: SeoEditorProps) {
  const [form, setForm] = useState<SeoForm>(emptyForm);
  const [image, setImage] = useState<AdminMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessage(null);
    setError(null);

    void Promise.allSettled([
      fetchAdminSeoMetadata(resourceType, resourceId),
      fetchAdminMediaAssets({ mediaKind: "image" }),
    ]).then(([metadataResult, assetsResult]) => {
      if (cancelled) return;
      const metadata = metadataResult.status === "fulfilled" ? metadataResult.value : null;
      const assets = assetsResult.status === "fulfilled" ? assetsResult.value : [];

      setForm(metadata ? {
        metaTitle: metadata.metaTitle ?? "",
        metaDescription: metadata.metaDescription ?? "",
        canonicalUrl: metadata.canonicalUrl ?? "",
        noindex: metadata.noindex,
      } : emptyForm);
      setImage(metadata?.ogImageAssetId
        ? assets.filter(({ id }) => id === metadata.ogImageAssetId).slice(0, 1)
        : []);

      const failures = [metadataResult, assetsResult]
        .filter((result) => result.status === "rejected")
        .map((result) => result.status === "rejected" && result.reason instanceof Error
          ? result.reason.message
          : "Could not load SEO settings.");
      setError(failures.length ? failures.join(" ") : null);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [resourceId, resourceType]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await saveAdminSeoMetadata({
        resourceType,
        resourceId,
        metaTitle: form.metaTitle.trim() || null,
        metaDescription: form.metaDescription.trim() || null,
        canonicalUrl: form.canonicalUrl.trim() || null,
        ogImageAssetId: image[0]?.id ?? null,
        noindex: form.noindex,
      });
      setMessage("SEO saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save SEO.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="space-y-4 border border-[#102329]/12 bg-white p-5">
      <div>
        <h3 className="text-lg font-semibold">SEO & social sharing</h3>
        <p className="mt-1 text-xs leading-5 text-[#102329]/52">
          Control search metadata, the canonical address, and the image shown when this content is shared.
        </p>
      </div>
      {loading ? <p className="text-sm text-[#102329]/52">Loading SEO settings…</p> : (
        <>
          <label className="block text-xs font-semibold">
            Meta title
            <input value={form.metaTitle} onChange={(event) => setForm({ ...form, metaTitle: event.target.value })} className="mt-1 h-11 w-full border border-[#102329]/18 px-3 text-sm" />
          </label>
          <label className="block text-xs font-semibold">
            Meta description
            <textarea value={form.metaDescription} onChange={(event) => setForm({ ...form, metaDescription: event.target.value })} rows={3} className="mt-1 w-full border border-[#102329]/18 p-3 text-sm" />
          </label>
          <label className="block text-xs font-semibold">
            Canonical URL
            <input type="url" value={form.canonicalUrl} onChange={(event) => setForm({ ...form, canonicalUrl: event.target.value })} placeholder="https://example.com/page" className="mt-1 h-11 w-full border border-[#102329]/18 px-3 text-sm" />
          </label>
          <div className="space-y-2">
            <p className="text-xs font-semibold">Open Graph image</p>
            <MediaPicker accepts={["image"]} value={image} onChange={setImage} />
          </div>
          <div className="flex flex-col justify-between gap-3 border-t border-[#102329]/10 pt-4 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.noindex} onChange={(event) => setForm({ ...form, noindex: event.target.checked })} />
              Hide from search engines
            </label>
            <button type="button" onClick={() => void save()} disabled={saving} className="border border-[#0F3B46] px-4 py-2 text-sm font-semibold text-[#0F3B46] disabled:opacity-40">
              {saving ? "Saving…" : "Save SEO"}
            </button>
          </div>
        </>
      )}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </article>
  );
}
