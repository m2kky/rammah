"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AdminApiError,
  createAdminExternalMedia,
  createAdminMediaUploadIntent,
  fetchAdminMediaAssets,
  finalizeAdminMediaUpload,
  uploadAdminMediaFile,
  type AdminMediaAsset,
  type AdminMediaAssignment,
  type AdminMediaKind,
} from "../../../lib/api/admin";

export type MediaPickerProps = {
  accepts: AdminMediaKind[];
  multiple?: boolean;
  value: AdminMediaAsset[];
  onChange(value: AdminMediaAsset[]): void;
};

type UploadState = "idle" | "signing" | "uploading" | "finalizing" | "ready" | "failed";

const mediaAccept = (accepts: AdminMediaKind[]) => [
  accepts.includes("image") ? "image/*" : "",
  accepts.includes("video") ? "video/*" : "",
  accepts.includes("animation_bundle") ? ".zip,application/zip" : "",
].filter(Boolean).join(",");

export const assignmentToMediaAsset = (assignment: AdminMediaAssignment): AdminMediaAsset => ({
  id: assignment.assetId,
  displayName: assignment.displayName,
  fileName: assignment.displayName,
  mimeType: assignment.mimeType,
  sourceType: "r2",
  mediaKind: assignment.mediaKind,
  publicUrl: assignment.publicUrl,
  altText: assignment.altTextOverride || assignment.altText,
  sizeBytes: 0,
  width: assignment.width,
  height: assignment.height,
  durationMs: assignment.durationMs,
  metadata: {},
  processingState: assignment.processingState,
  processingError: null,
  status: assignment.status,
  createdAt: "",
  updatedAt: "",
});

const MediaPreview = ({ asset }: { asset: AdminMediaAsset }) => {
  if (!asset.publicUrl) return <div className="grid aspect-video place-items-center bg-[#102329]/8 text-xs">Processing</div>;
  if (asset.mediaKind === "image") {
    return <img src={asset.publicUrl} alt={asset.altText ?? ""} className="aspect-video h-full w-full object-cover" />;
  }
  if (asset.mediaKind === "video") {
    return <video src={asset.publicUrl} className="aspect-video h-full w-full object-cover" muted playsInline preload="metadata" />;
  }
  return (
    <div className="grid aspect-video place-items-center bg-[#0F3B46] px-3 text-center font-inter text-xs font-semibold text-white">
      Animation bundle
    </div>
  );
};

export function MediaPicker({ accepts, multiple = false, value, onChange }: MediaPickerProps) {
  const [assets, setAssets] = useState<AdminMediaAsset[]>([]);
  const [mode, setMode] = useState<"library" | "upload" | "external" | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [externalName, setExternalName] = useState("");
  const [externalKind, setExternalKind] = useState<"image" | "video">(
    accepts.includes("image") ? "image" : "video",
  );
  const [externalPreviewReady, setExternalPreviewReady] = useState(false);

  const acceptedKey = accepts.join(",");
  const loadAssets = useCallback(async () => {
    try {
      const lists = await Promise.all(accepts.map((mediaKind) => fetchAdminMediaAssets({ mediaKind })));
      const unique = new Map(lists.flat().map((asset) => [asset.id, asset]));
      setAssets([...unique.values()]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load media.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptedKey]);

  useEffect(() => {
    if (mode === "library") void loadAssets();
  }, [mode, loadAssets]);

  const usableAssets = useMemo(() => assets.filter((asset) =>
    accepts.includes(asset.mediaKind)
    && asset.processingState === "ready"
    && asset.status !== "archived",
  ), [accepts, assets]);

  const select = (asset: AdminMediaAsset) => {
    const next = multiple
      ? value.some(({ id }) => id === asset.id) ? value : [...value, asset]
      : [asset];
    onChange(next);
    if (!multiple) setMode(null);
  };

  const upload = async () => {
    if (!file) return;
    setError(null);
    try {
      setUploadState("signing");
      const intent = await createAdminMediaUploadIntent({
        displayName: file.name,
        fileName: file.name,
        mimeType: file.type || "application/zip",
        sizeBytes: file.size,
      });
      setUploadState("uploading");
      await uploadAdminMediaFile(intent.uploadUrl, file, setProgress);
      setUploadState("finalizing");
      const asset = await finalizeAdminMediaUpload(intent.assetId);
      setUploadState("ready");
      setAssets((current) => [asset, ...current.filter(({ id }) => id !== asset.id)]);
      setFile(null);
      if (asset.processingState === "ready") {
        onChange(multiple ? [...value, asset] : [asset]);
        setMode(null);
      } else {
        setError("The animation bundle is processing. Refresh the library before selecting it.");
      }
    } catch (uploadError) {
      setUploadState("failed");
      setError(uploadError instanceof AdminApiError || uploadError instanceof Error
        ? uploadError.message
        : "Upload failed.");
    }
  };

  const addExternal = async () => {
    if (!externalPreviewReady) return;
    setError(null);
    try {
      const parsed = new URL(externalUrl);
      const fileName = decodeURIComponent(parsed.pathname.split("/").pop() || `${externalKind}-asset`);
      const asset = await createAdminExternalMedia({
        displayName: externalName.trim() || fileName,
        fileName,
        mimeType: externalKind === "image" ? "image/jpeg" : "video/mp4",
        mediaKind: externalKind,
        publicUrl: externalUrl,
        altText: null,
      });
      setAssets((current) => [asset, ...current]);
      onChange(multiple ? [...value, asset] : [asset]);
      setExternalUrl("");
      setExternalName("");
      setExternalPreviewReady(false);
      setMode(null);
    } catch (externalError) {
      setError(externalError instanceof Error ? externalError.message : "Could not add external media.");
    }
  };

  return (
    <div className="space-y-3 border border-[#102329]/12 bg-[#f7f5ef] p-3">
      {value.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {value.map((asset) => (
            <div key={asset.id} className="overflow-hidden border border-[#102329]/12 bg-white">
              <MediaPreview asset={asset} />
              <div className="space-y-2 p-3">
                <p className="truncate font-inter text-xs font-semibold">{asset.displayName}</p>
                <button type="button" onClick={() => onChange(value.filter(({ id }) => id !== asset.id))} className="text-xs font-semibold text-red-700">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="font-inter text-xs text-[#102329]/48">No media selected.</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setMode("library")} className="border border-[#0F3B46] px-3 py-2 font-inter text-xs font-semibold text-[#0F3B46]">
          {value.length ? "Replace" : "Choose from library"}
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} className="border border-[#102329]/18 px-3 py-2 font-inter text-xs font-semibold">
          Upload from device
        </button>
        {accepts.some((kind) => kind === "image" || kind === "video") ? (
          <button type="button" onClick={() => setMode("external")} className="border border-[#102329]/18 px-3 py-2 font-inter text-xs font-semibold">
            External URL
          </button>
        ) : null}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        aria-label="Upload media from device"
        accept={mediaAccept(accepts)}
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setUploadState("idle");
          setMode(event.target.files?.[0] ? "upload" : null);
          event.target.value = "";
        }}
        className="hidden"
      />

      {mode ? (
        <div className="space-y-4 border-t border-[#102329]/12 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em]">
              {mode === "library" ? "Media library" : mode === "upload" ? "Upload from device" : "External URL"}
            </p>
            <button type="button" onClick={() => setMode(null)} className="font-inter text-xs font-semibold text-[#102329]/55">Close</button>
          </div>

          {mode === "upload" ? (
            <div className="space-y-3">
              {file ? (
                <button type="button" onClick={() => void upload()} disabled={uploadState === "signing" || uploadState === "uploading" || uploadState === "finalizing"} className="bg-[#0F3B46] px-4 py-2 font-inter text-xs font-semibold text-white disabled:opacity-50">
                  {uploadState === "uploading" ? `Uploading ${progress}%` : uploadState === "finalizing" ? "Checking file…" : uploadState === "failed" ? "Retry upload" : "Upload selected file"}
                </button>
              ) : null}
            </div>
          ) : mode === "external" ? (
            <div className="grid gap-3 lg:grid-cols-[1fr_160px]">
              <div className="space-y-2">
                <input value={externalName} onChange={(event) => setExternalName(event.target.value)} placeholder="Display name" className="h-10 w-full border border-[#102329]/18 bg-white px-3 text-sm" />
                <input value={externalUrl} onChange={(event) => { setExternalUrl(event.target.value); setExternalPreviewReady(false); }} placeholder="https://…" className="h-10 w-full border border-[#102329]/18 bg-white px-3 text-sm" />
                <select value={externalKind} onChange={(event) => { setExternalKind(event.target.value as "image" | "video"); setExternalPreviewReady(false); }} className="h-10 border border-[#102329]/18 bg-white px-3 text-sm">
                  {accepts.includes("image") ? <option value="image">Image</option> : null}
                  {accepts.includes("video") ? <option value="video">Video</option> : null}
                </select>
                <button type="button" onClick={() => void addExternal()} disabled={!externalPreviewReady || !externalUrl.startsWith("https://")} className="bg-[#0F3B46] px-4 py-2 font-inter text-xs font-semibold text-white disabled:opacity-40">
                  Add verified URL
                </button>
              </div>
              {externalUrl.startsWith("https://") ? externalKind === "image" ? (
                <img src={externalUrl} alt="External preview" onLoad={() => setExternalPreviewReady(true)} onError={() => setExternalPreviewReady(false)} className="aspect-video w-full object-cover" />
              ) : (
                <video src={externalUrl} muted playsInline controls onLoadedMetadata={() => setExternalPreviewReady(true)} onError={() => setExternalPreviewReady(false)} className="aspect-video w-full object-cover" />
              ) : null}
            </div>
          ) : null}

          {mode === "library" ? (
            <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-4">
              {usableAssets.map((asset) => (
                <button key={asset.id} type="button" onClick={() => select(asset)} className="overflow-hidden border border-[#102329]/12 bg-white text-left hover:border-[#0F3B46]">
                  <MediaPreview asset={asset} />
                  <span className="block truncate p-2 font-inter text-xs font-semibold">{asset.displayName}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="font-inter text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
