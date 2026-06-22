import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import PublicFrame from "@/components/PublicFrame";
import { servicesFallback } from "@/data/servicesFallback";
import { fetchPublicOffering, type PublicOffering } from "@/lib/api/offerings";

const fallbackOffering = (slug: string): PublicOffering | null => {
  const service = servicesFallback.find((item) => item.slug === slug);
  if (!service) return null;

  return {
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
  };
};

const getOffering = async (slug: string) => {
  try {
    return await fetchPublicOffering(slug);
  } catch {
    return fallbackOffering(slug);
  }
};

const bookingCopy: Record<PublicOffering["bookingMode"], string> = {
  free: "Book now",
  paid: "Review dates",
  quote_only: "Request quote",
};

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const offering = await getOffering(decodeURIComponent(slug));

  if (!offering) notFound();

  const facts = [
    ["Mode", offering.attendanceMode],
    ["Duration", `${offering.durationMinutes} minutes`],
    ["Capacity", `${offering.capacity}`],
    ["Path", offering.bookingMode.replace("_", " ")],
  ];

  return (
    <PublicFrame>
      <section className="relative min-h-[100svh] overflow-hidden bg-[#0F3B46] px-5 pb-12 pt-28 md:px-8 md:pt-32">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-white lg:block" />
        <div className="relative z-10 mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div className="pb-8">
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-white/64">
              {offering.category?.name ?? "Service"}
            </p>
            <h1 className="mt-5 text-[clamp(4rem,11vw,10rem)] font-extrabold leading-[0.82] tracking-normal text-white">
              {offering.title}
            </h1>
            <p className="mt-7 max-w-xl font-inter text-base leading-7 text-white/74 md:text-lg">
              {offering.description ?? offering.subtitle ?? "A structured Rammah service."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/booking/${offering.slug}`}
                className="rounded-full bg-white px-6 py-3 font-inter text-sm font-semibold text-[#0F3B46] transition-opacity hover:opacity-90"
              >
                {bookingCopy[offering.bookingMode]}
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-white/35 px-6 py-3 font-inter text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Ask first
              </Link>
            </div>
          </div>

          <div className="relative min-h-[420px] lg:min-h-[620px]">
            <Image
              src="/RammahPortrait1.png"
              alt="Ahmed Rammah"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-contain object-bottom"
              priority
            />
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 text-[#102329] md:px-8 md:py-24">
        <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
              What changes
            </p>
            <h2 className="mt-4 text-5xl font-bold leading-[0.9] md:text-7xl">
              Less advice. More diagnosis.
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {facts.map(([label, value]) => (
              <div key={label} className="border-t border-[#102329]/14 pt-5">
                <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/45">
                  {label}
                </p>
                <p className="mt-3 text-3xl font-semibold capitalize">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicFrame>
  );
}
