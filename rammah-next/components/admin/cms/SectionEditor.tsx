"use client";

import type {
  AdminCmsFieldDefinition,
  AdminCmsPageSection,
  AdminCmsSectionDefinition,
  AdminMediaAsset,
} from "../../../lib/api/admin";
import { MarkdownEditor } from "./MarkdownEditor";
import { assignmentToMediaAsset, MediaPicker } from "./MediaPicker";

export type SectionEditorProps = {
  definition: AdminCmsSectionDefinition;
  section: AdminCmsPageSection;
  onChange(section: AdminCmsPageSection): void;
  onMediaChange?(slotKey: string, assets: AdminMediaAsset[]): void;
  mediaValues?: Record<string, AdminMediaAsset[]>;
};

const valueFor = (section: AdminCmsPageSection, key: string) => {
  if (key === "title" || key === "heading") return section.title ?? "";
  if (key === "body") return section.body ?? "";
  return section.config[key];
};

const withField = (section: AdminCmsPageSection, key: string, value: unknown) => {
  if (key === "title" || key === "heading") return { ...section, title: String(value) };
  if (key === "body") return { ...section, body: String(value) };
  return { ...section, config: { ...section.config, [key]: value } };
};

const inputClass = "h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]";

const LinkField = ({ field, section, onChange }: {
  field: AdminCmsFieldDefinition;
  section: AdminCmsPageSection;
  onChange(section: AdminCmsPageSection): void;
}) => {
  const current = valueFor(section, field.key);
  const link = typeof current === "object" && current ? current as { label?: string; url?: string } : {};
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <input aria-label={`${field.label} label`} value={link.label ?? ""} onChange={(event) => onChange(withField(section, field.key, { ...link, label: event.target.value }))} placeholder="Button label" className={inputClass} />
      <input aria-label={`${field.label} URL`} value={link.url ?? ""} onChange={(event) => onChange(withField(section, field.key, { ...link, url: event.target.value }))} placeholder="/booking or https://…" className={inputClass} />
    </div>
  );
};

export function SectionEditor({ definition, section, onChange, onMediaChange, mediaValues }: SectionEditorProps) {
  return (
    <div className="space-y-5">
      <div><h3 className="text-xl font-semibold">{definition.label}</h3><p className="mt-1 text-sm text-[#102329]/55">{definition.description}</p></div>
      {definition.fields.map((field) => {
        const value = valueFor(section, field.key);
        return (
          <div key={field.key} className="space-y-2">
            <label className="block font-inter text-xs font-semibold uppercase tracking-[0.12em] text-[#102329]/55">
              {field.label}{field.required ? " *" : ""}
            </label>
            {field.helpText ? <p className="font-inter text-xs text-[#102329]/45">{field.helpText}</p> : null}
            {field.type === "text" ? (
              <input value={typeof value === "string" ? value : ""} onChange={(event) => onChange(withField(section, field.key, event.target.value))} className={inputClass} />
            ) : field.type === "markdown" ? (
              <MarkdownEditor label={field.label} value={typeof value === "string" ? value : ""} onChange={(next) => onChange(withField(section, field.key, next))} rows={7} />
            ) : field.type === "boolean" ? (
              <label className="flex items-center gap-3 font-inter text-sm"><input type="checkbox" checked={typeof value === "boolean" ? value : field.defaultValue ?? false} onChange={(event) => onChange(withField(section, field.key, event.target.checked))} /> Enabled</label>
            ) : field.type === "choice" ? (
              <select value={typeof value === "string" ? value : ""} onChange={(event) => onChange(withField(section, field.key, event.target.value))} className={inputClass}><option value="">Choose…</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
            ) : field.type === "link" ? (
              <LinkField field={field} section={section} onChange={onChange} />
            ) : field.type === "media" ? (
              <MediaPicker
                accepts={[...(field.accepts ?? ["image"])]}
                multiple={field.cardinality === "multiple"}
                value={mediaValues?.[field.key] ?? (section.media[field.key] ?? []).map(assignmentToMediaAsset)}
                onChange={(assets) => onMediaChange?.(field.key, assets)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
