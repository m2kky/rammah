import { Suspense } from "react";
import AdminLoginForm from "@/components/admin/AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#102329]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_0.82fr]">
        <section className="flex items-center px-6 py-12 sm:px-10 lg:px-16">
          <Suspense
            fallback={
              <div className="w-full max-w-[430px]">
                <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
                  Admin
                </p>
                <h1 className="mt-4 text-5xl font-semibold leading-[0.95] tracking-normal text-[#102329]">
                  Loading
                </h1>
              </div>
            }
          >
            <AdminLoginForm />
          </Suspense>
        </section>

        <section className="relative hidden overflow-hidden bg-[#102329] lg:block">
          <div className="absolute inset-0 opacity-35">
            <div className="absolute left-[-18%] top-[18%] h-[58vh] w-[58vh] rounded-full border border-white/16" />
            <div className="absolute right-[-10%] top-[8%] h-[42vh] w-[42vh] rounded-full border border-white/10" />
            <div className="absolute bottom-[-15%] left-[20%] h-[46vh] w-[46vh] rounded-full border border-white/12" />
          </div>

          <div className="relative flex h-full flex-col justify-between p-12 text-white">
            <div>
              <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                Ahmed Ramah Platform
              </p>
              <p className="mt-5 max-w-sm text-4xl font-semibold leading-[1.02] tracking-normal">
                Operational control for content, offerings, and bookings.
              </p>
            </div>

            <div className="border-t border-white/18 pt-6">
              <p className="font-inter text-sm leading-6 text-white/68">
                Local development uses the seeded admin account. Production credentials must be configured separately.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
