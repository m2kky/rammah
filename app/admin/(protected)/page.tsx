import Link from "next/link";

const nextSteps = [
  {
    title: "Offerings",
    status: "Available",
    href: "/admin/offerings",
    description: "Review public services and archive outdated entries.",
  },
  {
    title: "Availability",
    status: "Available",
    href: "/admin/availability",
    description: "Define weekly booking windows per offering.",
  },
  {
    title: "Locations",
    status: "Available",
    href: "/admin/locations",
    description: "Manage offline venues used by hybrid and in-person bookings.",
  },
  {
    title: "Sessions",
    status: "Available",
    href: "/admin/sessions",
    description: "Schedule fixed-date workshops, webinars, and course events.",
  },
  {
    title: "Form Fields",
    status: "Available",
    href: "/admin/form-fields",
    description: "Manage the questions shown in public booking forms.",
  },
  {
    title: "Bookings",
    status: "Available",
    href: "/admin/bookings",
    description: "Review confirmed and in-progress customer bookings.",
  },
  {
    title: "Quotes",
    status: "Available",
    href: "/admin/quotes",
    description: "Review and follow up on quote-only and custom requests.",
  },
  {
    title: "Emails",
    status: "Available",
    href: "/admin/emails",
    description: "Review deliveries, retry failures, and edit email templates.",
  },
  {
    title: "CMS",
    status: "Available",
    href: "/admin/cms",
    description: "Manage site settings, navigation, and legal pages.",
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="space-y-8">
      <div className="border-b border-[#102329]/10 pb-7">
        <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
          Overview
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal sm:text-5xl">
          Admin workspace
        </h1>
        <p className="mt-3 max-w-2xl font-inter text-sm leading-6 text-[#102329]/62">
          Current MVP surface for authenticated content and offering operations.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        {nextSteps.map((item) => (
          <div key={item.title} className="border-t border-[#102329]/14 pt-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold">{item.title}</h2>
              <span className="border border-[#102329]/15 px-3 py-1 font-inter text-xs font-semibold text-[#102329]/58">
                {item.status}
              </span>
            </div>
            <p className="mt-4 min-h-12 font-inter text-sm leading-6 text-[#102329]/62">
              {item.description}
            </p>
            {item.href ? (
              <Link
                href={item.href}
                className="mt-5 inline-flex h-10 items-center bg-[#102329] px-4 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46]"
              >
                Open
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
