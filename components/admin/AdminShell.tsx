"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logoutAdmin } from "@/lib/api/admin";
import { useAdminAuth } from "./AdminAuthGate";

const navItems = [
  { label: "Overview", href: "/admin" },
  { label: "Offerings", href: "/admin/offerings" },
  { label: "Availability", href: "/admin/availability" },
  { label: "Locations", href: "/admin/locations" },
  { label: "Sessions", href: "/admin/sessions" },
  { label: "Form Fields", href: "/admin/form-fields" },
  { label: "Bookings", href: "/admin/bookings" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Quotes", href: "/admin/quotes" },
  { label: "Emails", href: "/admin/emails" },
  { label: "CMS", href: "/admin/cms" },
  { label: "Integrations", href: "/admin/integrations" },
  { label: "Settings", href: "/admin/settings", disabled: true },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin } = useAdminAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logoutAdmin();
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#102329]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-[#102329]/10 bg-[#fbfaf6] px-5 py-4 lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
          <div className="flex items-center justify-between gap-5 lg:block">
            <Link href="/admin" className="inline-flex items-baseline gap-2">
              <span className="text-3xl font-bold leading-none">RAMMAH</span>
              <span className="font-inter text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
                Admin
              </span>
            </Link>

            <div className="hidden text-right lg:mt-9 lg:block lg:text-left">
              <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/45">
                Signed in
              </p>
              <p className="mt-2 text-base font-semibold">{admin.name}</p>
              <p className="mt-1 font-inter text-xs text-[#102329]/55">{admin.email}</p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="h-10 border border-[#102329]/20 px-4 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50 lg:hidden"
            >
              {isLoggingOut ? "Signing out" : "Sign out"}
            </button>
          </div>

        <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:mt-10 lg:flex-col lg:overflow-visible lg:pb-0">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));

              if (item.disabled) {
                return (
                  <span
                    key={item.href}
                    className="whitespace-nowrap border border-transparent px-4 py-3 font-inter text-sm font-semibold text-[#102329]/35"
                  >
                    {item.label}
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap border px-4 py-3 font-inter text-sm font-semibold transition-colors ${
                    isActive
                      ? "border-[#0F3B46] bg-[#0F3B46] text-white"
                      : "border-transparent text-[#102329]/72 hover:border-[#102329]/18 hover:text-[#102329]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-10 hidden lg:block">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="h-11 w-full border border-[#102329]/20 px-4 font-inter text-sm font-semibold transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
            >
              {isLoggingOut ? "Signing out" : "Sign out"}
            </button>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-6 sm:px-7 lg:px-10 lg:py-9">
          {children}
        </section>
      </div>
    </main>
  );
}
