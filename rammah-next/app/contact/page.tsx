import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import PublicFrame from "@/components/PublicFrame";
import { fetchPublicSiteSettings } from "@/lib/api/cms";

export const metadata = {
  title: "Contact | Ahmed Rammah",
  description: "Send a message, request a program, or start a booking conversation.",
};

export default async function ContactPage() {
  const settings = await fetchPublicSiteSettings().catch(() => null);

  return (
    <PublicFrame>
      <section className="min-h-[100svh] bg-[#0F3B46] px-5 pb-16 pt-28 md:px-8 md:pt-36">
        <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-white/64">
              Contact
            </p>
            <h1 className="mt-5 text-[clamp(4rem,12vw,12rem)] font-extrabold leading-[0.82] tracking-normal">
              Start with context.
            </h1>
            <p className="mt-7 max-w-xl font-inter text-base leading-7 text-white/70 md:text-lg">
              Send the problem, the pattern, or the program you want to build.
              The reply can route you to a session, quote, or the right next step.
            </p>
            <div className="mt-8 grid gap-2 font-inter text-sm text-white/62">
              {settings?.contactEmail && <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>}
              {settings?.contactPhone && <a href={`tel:${settings.contactPhone}`}>{settings.contactPhone}</a>}
              <Link href="/booking" className="font-semibold text-white">
                Prefer a slot? Open booking
              </Link>
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
