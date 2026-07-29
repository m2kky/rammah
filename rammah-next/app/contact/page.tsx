import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import PublicFrame from "@/components/PublicFrame";
import { fetchPublicSiteSettings, fetchPublicPage } from "@/lib/api/cms";
import { getContactPageContent, getPageMetadata } from "@/lib/api/cms-content";

export async function generateMetadata() {
  const page = await fetchPublicPage("contact").catch(() => null);
  return getPageMetadata(
    page,
    "Contact | Ahmed Rammah",
    "Send a message, request a program, or start a booking conversation.",
  );
}

export default async function ContactPage() {
  const [settings, page] = await Promise.all([
    fetchPublicSiteSettings().catch(() => null),
    fetchPublicPage("contact").catch(() => null)
  ]);

  const content = getContactPageContent(page);

  return (
    <PublicFrame>
      <section className="min-h-[100svh] bg-[#0F3B46] px-5 pb-16 pt-28 md:px-8 md:pt-36">
        <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-white/64">
              {content.details.title}
            </p>
            <h1 className="mt-5 text-[clamp(4rem,12vw,12rem)] font-extrabold leading-[0.82] tracking-normal">
              {content.hero.title}
            </h1>
            <p className="mt-7 max-w-xl font-inter text-base leading-7 text-white/70 md:text-lg">
              {content.hero.body}
            </p>
            {content.details.body && (
              <p className="mt-5 max-w-xl whitespace-pre-wrap font-inter text-sm leading-7 text-white/58">
                {content.details.body}
              </p>
            )}
            <div className="mt-8 grid gap-2 font-inter text-sm text-white/62">
              {settings?.contactEmail && <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>}
              {settings?.contactPhone && <a href={`tel:${settings.contactPhone}`}>{settings.contactPhone}</a>}
              <Link href={content.cta.ctaHref} className="font-semibold text-white">
                {content.cta.title} {content.cta.ctaText}
              </Link>
              {content.cta.body && <p>{content.cta.body}</p>}
            </div>
          </div>

          <div className="border-t border-white/18 pt-6">
            <ContactForm />
          </div>
        </div>
      </section>
    </PublicFrame>
  );
}
