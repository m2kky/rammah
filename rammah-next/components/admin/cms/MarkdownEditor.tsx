"use client";

import { useRef } from "react";
import { SafeMarkdown } from "../../cms/SafeMarkdown";

type MarkdownEditorProps = {
  label?: string;
  value: string;
  onChange(value: string): void;
  rows?: number;
};

const tools = [
  { label: "H2", before: "## ", after: "" },
  { label: "Bold", before: "**", after: "**" },
  { label: "Italic", before: "_", after: "_" },
  { label: "List", before: "- ", after: "" },
  { label: "Link", before: "[", after: "](https://)" },
  { label: "Table", before: "| Column | Column |\n| --- | --- |\n| Value | Value |", after: "" },
] as const;

export function MarkdownEditor({ label = "Content", value, onChange, rows = 12 }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insert = (before: string, after: string) => {
    const element = textareaRef.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/55">
          {label}
        </label>
        <div className="flex flex-wrap gap-1" aria-label="Markdown toolbar">
          {tools.map((tool) => (
            <button
              key={tool.label}
              type="button"
              onClick={() => insert(tool.before, tool.after)}
              className="border border-[#102329]/15 bg-white px-2.5 py-1 font-inter text-xs font-semibold text-[#102329]/70 hover:border-[#0F3B46]"
            >
              {tool.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <textarea
          ref={textareaRef}
          value={value}
          rows={rows}
          onChange={(event) => onChange(event.target.value)}
          className="w-full resize-y border border-[#102329]/18 bg-white px-3 py-3 font-mono text-sm leading-6 outline-none focus:border-[#0F3B46]"
        />
        <div className="min-h-40 border border-[#102329]/12 bg-white p-4">
          <p className="mb-3 font-inter text-[10px] font-semibold uppercase tracking-[0.16em] text-[#102329]/40">
            Preview
          </p>
          <SafeMarkdown className="space-y-3 font-inter text-sm leading-7 text-[#102329]/80">
            {value || "Nothing to preview yet."}
          </SafeMarkdown>
        </div>
      </div>
    </div>
  );
}
