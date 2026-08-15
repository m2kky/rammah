"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAdminGlobalMediaVersion,
  fetchAdminGlobalMediaDefinitions,
  fetchAdminGlobalMediaVersions,
  publishAdminGlobalMediaVersion,
  replaceAdminGlobalMedia,
  type AdminGlobalMediaDefinition,
  type AdminGlobalMediaVersion,
  type AdminMediaAsset,
  type AdminMediaAssignmentInput,
} from "../../../lib/api/admin";
import { assignmentToMediaAsset, MediaPicker } from "./MediaPicker";

type SlotValues = Record<string, AdminMediaAsset[]>;

const valuesFromVersion = (version: AdminGlobalMediaVersion | undefined): SlotValues => {
  const values: SlotValues = {};
  for (const assignment of version?.assignments ?? []) {
    (values[assignment.slotKey] ??= []).push(assignmentToMediaAsset(assignment));
  }
  return values;
};

const assignmentPayload = (values: SlotValues): Record<string, AdminMediaAssignmentInput[]> =>
  Object.fromEntries(Object.entries(values).map(([slotKey, assets]) => [
    slotKey,
    assets.map((asset) => ({ mediaAssetId: asset.id, decorative: asset.mediaKind !== "image" })),
  ]));

export function GlobalMediaEditor() {
  const [definitions, setDefinitions] = useState<AdminGlobalMediaDefinition[]>([]);
  const [versions, setVersions] = useState<AdminGlobalMediaVersion[]>([]);
  const [values, setValues] = useState<Record<string, SlotValues>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextDefinitions, nextVersions] = await Promise.all([
        fetchAdminGlobalMediaDefinitions(),
        fetchAdminGlobalMediaVersions(),
      ]);
      setDefinitions(nextDefinitions);
      setVersions(nextVersions);
      setValues(Object.fromEntries(nextDefinitions.map((definition) => {
        const candidates = nextVersions.filter(({ definitionKey }) => definitionKey === definition.key);
        const active = candidates.find(({ status }) => status === "draft")
          ?? candidates.find(({ status }) => status === "published");
        return [definition.key, valuesFromVersion(active)];
      })));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load global media.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const byDefinition = useMemo(() => new Map(definitions.map((definition) => [
    definition.key,
    versions.filter(({ definitionKey }) => definitionKey === definition.key),
  ])), [definitions, versions]);

  const save = async (definition: AdminGlobalMediaDefinition) => {
    setBusy(definition.key);
    setError(null);
    try {
      const candidates = byDefinition.get(definition.key) ?? [];
      let draft = candidates.find(({ status }) => status === "draft");
      if (!draft) {
        const created = await createAdminGlobalMediaVersion(definition.key);
        draft = { ...created, assignments: [] };
      }
      await replaceAdminGlobalMedia(definition.key, draft.id, assignmentPayload(values[definition.key] ?? {}));
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save global media.");
    } finally { setBusy(null); }
  };

  const publish = async (definition: AdminGlobalMediaDefinition) => {
    const draft = (byDefinition.get(definition.key) ?? []).find(({ status }) => status === "draft");
    if (!draft) { setError("Save a draft version before publishing."); return; }
    setBusy(definition.key);
    try {
      await replaceAdminGlobalMedia(definition.key, draft.id, assignmentPayload(values[definition.key] ?? {}));
      await publishAdminGlobalMediaVersion(definition.key, draft.id);
      await load();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Could not publish global media.");
    } finally { setBusy(null); }
  };

  return (
    <section className="space-y-6">
      <div><p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">CMS</p><h2 className="mt-2 text-3xl font-semibold">Global media</h2><p className="mt-2 max-w-2xl text-sm text-[#102329]/60">Media shared by loading, navigation, SEO and custom page layouts. Published versions stay unchanged until a complete draft is ready.</p></div>
      {error ? <p className="border border-red-700/20 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <div className="space-y-5">
        {definitions.map((definition) => {
          const candidates = byDefinition.get(definition.key) ?? [];
          const draft = candidates.find(({ status }) => status === "draft");
          const published = candidates.find(({ status }) => status === "published");
          return (
            <article key={definition.key} className="border border-[#102329]/12 bg-white p-5">
              <div className="flex flex-col justify-between gap-3 border-b border-[#102329]/10 pb-4 sm:flex-row sm:items-start">
                <div><h3 className="text-xl font-semibold">{definition.label}</h3><p className="mt-1 text-sm text-[#102329]/55">{definition.description}</p></div>
                <div className="text-right text-xs text-[#102329]/50">Published v{published?.version ?? "—"}{draft ? ` · Draft v${draft.version}` : ""}</div>
              </div>
              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                {definition.slots.map((slot) => (
                  <div key={slot.key} className="space-y-2">
                    <div><p className="text-sm font-semibold">{slot.label}{slot.required ? " *" : ""}</p>{slot.helpText ? <p className="text-xs text-[#102329]/48">{slot.helpText}</p> : null}</div>
                    <MediaPicker
                      accepts={[...(slot.accepts ?? ["image"])]}
                      multiple={slot.cardinality === "multiple"}
                      value={values[definition.key]?.[slot.key] ?? []}
                      onChange={(next) => setValues((current) => ({
                        ...current,
                        [definition.key]: { ...current[definition.key], [slot.key]: next },
                      }))}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#102329]/10 pt-4">
                <button type="button" onClick={() => void save(definition)} disabled={busy === definition.key} className="border border-[#0F3B46] px-4 py-2 text-sm font-semibold text-[#0F3B46] disabled:opacity-40">Save draft</button>
                <button type="button" onClick={() => void publish(definition)} disabled={busy === definition.key} className="bg-[#0F3B46] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Publish version</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
