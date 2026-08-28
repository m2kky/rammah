"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  guideNavigation,
  searchGuideSections,
  type GuideBlock,
  type GuideEntry,
} from "./how-to-use-content";

const blockClasses: Record<NonNullable<GuideBlock["tone"]>, string> = {
  default: "border-[#102329]/10 bg-white",
  warning: "border-[#b45309]/25 bg-[#fff8eb]",
  success: "border-[#0F3B46]/20 bg-[#f3f8f5]",
};

function GuideEntryCard({ entry, forceOpen }: { entry: GuideEntry; forceOpen: boolean }) {
  return (
    <details
      id={entry.id}
      open={forceOpen || undefined}
      className="scroll-mt-6 border border-[#102329]/12 bg-[#fbfaf6] open:bg-white"
    >
      <summary className="cursor-pointer list-none px-4 py-4 marker:hidden sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-start justify-between gap-4">
          <span>
            <strong className="block text-lg font-semibold leading-7 text-[#102329]">{entry.title}</strong>
            <span className="mt-1 block font-inter text-sm leading-6 text-[#102329]/58">{entry.summary}</span>
          </span>
          <span aria-hidden="true" className="mt-1 shrink-0 text-xl text-[#0F3B46]">＋</span>
        </span>
      </summary>

      <div className="space-y-4 border-t border-[#102329]/10 px-4 py-5 sm:px-5">
        {entry.blocks.map((block) => {
          const List = block.ordered ? "ol" : "ul";
          return (
            <section
              key={block.heading}
              className={`border-r-2 p-4 ${blockClasses[block.tone ?? "default"]}`}
            >
              <h4 className="font-inter text-sm font-bold text-[#102329]">{block.heading}</h4>
              <List className={`mt-3 space-y-2 pr-5 font-inter text-sm leading-7 text-[#102329]/76 ${block.ordered ? "list-decimal" : "list-disc"}`}>
                {block.items.map((item) => <li key={item}>{item}</li>)}
              </List>
            </section>
          );
        })}

        {entry.href ? (
          <Link
            href={entry.href}
            className="inline-flex min-h-11 items-center border border-[#0F3B46] bg-[#0F3B46] px-4 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#102329] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3B46]"
          >
            افتح الصفحة
            <span aria-hidden="true" className="mr-2">←</span>
          </Link>
        ) : null}
      </div>
    </details>
  );
}

export default function HowToUsePage() {
  const [query, setQuery] = useState("");
  const sections = useMemo(() => searchGuideSections(query), [query]);
  const resultsCount = sections.reduce((total, section) => total + section.entries.length, 0);

  return (
    <main dir="rtl" className="mx-auto max-w-[1480px] text-right text-[#102329]">
      <header className="border-b border-[#102329]/12 pb-7">
        <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#0F3B46]">
          دليل التشغيل
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">كيف تستخدم الداشبورد؟</h1>
        <p className="mt-4 max-w-3xl font-inter text-sm leading-7 text-[#102329]/62 sm:text-base">
          هذا الدليل مبني على الشكل الحالي للنظام. ابدأ بالسيناريو الذي تريد تنفيذه، واتبع الخطوات بالترتيب، واقرأ ما الذي سيتأثر قبل الحفظ أوالنشر.
        </p>

        <div className="mt-6 max-w-3xl">
          <label htmlFor="admin-guide-search" className="font-inter text-xs font-bold text-[#102329]">
            ابحث في الدليل
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="admin-guide-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="مثال: سيشن، سعة، صورة، Capacity، Early bird"
              className="h-12 min-w-0 flex-1 border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none transition-colors placeholder:text-[#102329]/38 focus:border-[#0F3B46]"
            />
            {query && sections.length > 0 ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="h-12 shrink-0 border border-[#102329]/18 px-4 font-inter text-sm font-semibold hover:border-[#0F3B46]"
              >
                مسح البحث
              </button>
            ) : null}
          </div>
          <p className="mt-2 font-inter text-xs text-[#102329]/48">
            {query ? `${resultsCount} نتيجة مطابقة` : "يمكنك البحث بالعربي أوباسم الحقل الإنجليزي الظاهر في الواجهة."}
          </p>
        </div>
      </header>

      <nav aria-label="أقسام دليل الاستخدام" className="mt-5 flex gap-2 overflow-x-auto pb-2 lg:hidden">
        {guideNavigation.map((item) => (
          <a key={item.id} href={`#${item.id}`} className="whitespace-nowrap border border-[#102329]/16 bg-white px-3 py-2 font-inter text-xs font-semibold">
            {item.title}
          </a>
        ))}
      </nav>

      {sections.length === 0 ? (
        <section role="status" className="mt-8 border border-[#102329]/12 bg-white p-8 text-center">
          <h2 className="text-2xl font-semibold">لم نجد شرحًا مطابقًا</h2>
          <p className="mt-2 font-inter text-sm text-[#102329]/58">جرّب كلمة أقصر مثل حجز، سعر، صورة، Session أوCapacity.</p>
          <button type="button" onClick={() => setQuery("")} className="mt-5 h-11 bg-[#0F3B46] px-5 font-inter text-sm font-semibold text-white">
            مسح البحث
          </button>
        </section>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start">
          <aside className="sticky top-6 hidden border border-[#102329]/12 bg-[#fbfaf6] p-4 lg:block">
            <p className="font-inter text-xs font-bold uppercase tracking-[0.14em] text-[#102329]/45">المحتويات</p>
            <nav aria-label="جدول محتويات الدليل" className="mt-3 space-y-1">
              {(query ? sections.map(({ id, title }) => ({ id, title })) : guideNavigation).map((item) => (
                <a key={item.id} href={`#${item.id}`} className="block border-r-2 border-transparent px-3 py-2 font-inter text-sm font-semibold text-[#102329]/68 hover:border-[#0F3B46] hover:text-[#0F3B46]">
                  {item.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 space-y-12">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-6">
                <div className="border-b border-[#102329]/12 pb-4">
                  <h2 className="text-3xl font-semibold leading-tight">{section.title}</h2>
                  <p className="mt-2 max-w-3xl font-inter text-sm leading-6 text-[#102329]/58">{section.description}</p>
                </div>
                <div className="mt-4 space-y-3">
                  {section.entries.map((entry) => (
                    <GuideEntryCard key={entry.id} entry={entry} forceOpen={Boolean(query)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
