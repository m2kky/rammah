import PublicFrame from "@/components/PublicFrame";
import ServicesStack from "@/components/services/ServicesStack";
import { fetchPublicOfferingRecords, type PublicOffering } from "@/lib/api/offerings";
import { servicesFallback } from "@/data/servicesFallback";

const fallbackOfferings = servicesFallback.map((service) => ({
  id: service.slug,
  slug: service.slug,
  title: service.title,
  subtitle: service.subtitle,
  description: service.desc,
  category: null,
  offeringType: "custom",
  attendanceMode: "hybrid",
  bookingMode: service.slug === "corporate-training" ? "quote_only" : "paid",
  durationMinutes: service.slug === "workshops" ? 180 : 60,
  capacity: service.slug === "workshops" ? 30 : 1,
  requiresPayment: service.slug !== "corporate-training",
  quoteOnly: service.slug === "corporate-training",
  colors: { background: service.bg, text: service.text },
  prices: [],
})) satisfies PublicOffering[];

const getOfferings = async () => {
  try {
    const offerings = await fetchPublicOfferingRecords();
    return offerings.length ? offerings : fallbackOfferings;
  } catch {
    return fallbackOfferings;
  }
};

const modeLabel: Record<PublicOffering["bookingMode"], string> = {
  free: "Free booking",
  paid: "Paid booking",
  quote_only: "Quote request",
};

export const metadata = {
  title: "Services | Ahmed Rammah",
  description: "Coaching, therapy-style sessions, workshops, and corporate aCRL programs.",
};

export default async function ServicesPage() {
  const offerings = await getOfferings();
  const categories = Array.from(
    new Set(offerings.map((offering) => offering.category?.name ?? "Programs")),
  );

  return (
    <PublicFrame>
      <section className="min-h-[78svh] bg-[#02040A] px-5 pb-16 pt-28 md:px-8 md:pt-36">
        <div className="mx-auto max-w-[1440px]">
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-white/52">
            Services
          </p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <h1 className="text-[clamp(4.2rem,13vw,13rem)] font-extrabold leading-[0.82] tracking-normal">
              Work on the system.
            </h1>
            <p className="max-w-xl font-inter text-base leading-7 text-white/64 md:text-lg">
              Choose the format that matches the work: personal decoding,
              therapy-style support, intensive workshops, or custom team programs.
            </p>
          </div>
          <div className="mt-10 flex flex-wrap gap-3 font-inter text-sm font-semibold text-white/70">
            {categories.map((category) => (
              <span key={category} className="rounded-full border border-white/18 px-4 py-2">
                {category}
              </span>
            ))}
          </div>
        </div>
      </section>

      <ServicesStack offerings={offerings} />
    </PublicFrame>
  );
}
