import Link from "next/link";
import PublicFrame from "@/components/PublicFrame";

const copy = {
  contact: {
    title: "Message received.",
    body: "Your request is now in the admin workspace. Expect a follow-up after review.",
  },
  booking: {
    title: "Booking received.",
    body: "Your booking status page will carry the latest confirmation and meeting details.",
  },
  default: {
    title: "Thank you.",
    body: "Your submission has been received.",
  },
};

export const metadata = {
  title: "Thank You | Ahmed Rammah",
};

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const content = type === "contact" || type === "booking" ? copy[type] : copy.default;

  return (
    <PublicFrame>
      <section className="min-h-[100svh] bg-[#0F3B46] px-5 pb-16 pt-28 md:px-8 md:pt-36">
        <div className="mx-auto max-w-[1440px]">
          <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-white/64">
            Complete
          </p>
          <h1 className="mt-5 max-w-5xl text-[clamp(4.2rem,13vw,13rem)] font-extrabold leading-[0.82] tracking-normal">
            {content.title}
          </h1>
          <p className="mt-7 max-w-xl font-inter text-base leading-7 text-white/72 md:text-lg">
            {content.body}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full bg-white px-6 py-3 font-inter text-sm font-semibold text-[#0F3B46] transition-opacity hover:opacity-90"
            >
              Home
            </Link>
            <Link
              href="/booking/status"
              className="rounded-full border border-white/35 px-6 py-3 font-inter text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Check booking
            </Link>
          </div>
        </div>
      </section>
    </PublicFrame>
  );
}
