import Link from "next/link";
import PublicFrame from "./PublicFrame";
import { fetchPublicLegalPage } from "@/lib/api/cms";

const fallbacks: Record<string, { title: string; body: string }> = {
  "privacy-policy": {
    title: "Privacy Policy",
    body:
      "This page is ready for CMS-managed privacy content. Add and publish a legal page with slug privacy-policy from the admin CMS to replace this placeholder.",
  },
  "terms-and-conditions": {
    title: "Terms and Conditions",
    body:
      "This page is ready for CMS-managed terms content. Add and publish a legal page with slug terms-and-conditions from the admin CMS to replace this placeholder.",
  },
};

export default async function LegalDocument({ slug }: { slug: string }) {
  const fallback = fallbacks[slug];
  const page = await fetchPublicLegalPage(slug).catch(() => null);
  const title = page?.title ?? fallback.title;
  const body = page?.body ?? fallback.body;

  return (
    <PublicFrame>
      <section className="min-h-[100svh] bg-white px-5 pb-20 pt-28 text-[#102329] md:px-8 md:pt-36">
        <div className="mx-auto max-w-5xl">
          <Link href="/" className="font-inter text-sm font-semibold text-[#0F3B46]">
            Back home
          </Link>
          <p className="mt-10 font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#102329]/45">
            Legal · Version {page?.version ?? "draft"}
          </p>
          <h1 className="mt-5 text-[clamp(3.8rem,11vw,10rem)] font-extrabold leading-[0.84] tracking-normal">
            {title}
          </h1>
          <div className="mt-12 whitespace-pre-wrap border-t border-[#102329]/14 pt-8 font-inter text-base leading-8 text-[#102329]/76">
            {body}
          </div>
        </div>
      </section>
    </PublicFrame>
  );
}
