"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminApiError, fetchCurrentAdmin, type AdminUser } from "@/lib/api/admin";

type AdminAuthContextValue = {
  admin: AdminUser;
  refreshAdmin: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error("useAdminAuth must be used inside AdminAuthGate.");
  }

  return context;
};

export default function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("Could not verify the admin session.");

  const refreshAdmin = async () => {
    const nextAdmin = await fetchCurrentAdmin();
    setAdmin(nextAdmin);
    setStatus("ready");
  };

  useEffect(() => {
    let cancelled = false;

    fetchCurrentAdmin()
      .then((nextAdmin) => {
        if (cancelled) return;
        setAdmin(nextAdmin);
        setStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;

        if (error instanceof AdminApiError && error.status === 401) {
          const next = encodeURIComponent(pathname || "/admin");
          router.replace(`/admin/login?next=${next}`);
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Could not verify the admin session.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  const contextValue = useMemo(
    () => (admin ? { admin, refreshAdmin } : null),
    [admin],
  );

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-[#f4f1ea] text-[#102329]">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-sm border-l border-[#0F3B46]/30 pl-6">
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
              Admin
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">Checking session</h1>
            <div className="mt-6 h-1 overflow-hidden bg-[#102329]/10">
              <div className="h-full w-1/2 animate-[admin-loading_1s_ease-in-out_infinite] bg-[#0F3B46]" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (status === "error" || !contextValue) {
    return (
      <main className="min-h-screen bg-[#f4f1ea] text-[#102329]">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-md border-l border-red-500/40 pl-6">
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-red-700">
              Session error
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">Admin access is unavailable</h1>
            <p className="mt-4 font-inter text-sm leading-6 text-[#102329]/70">{errorMessage}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-7 inline-flex h-11 items-center justify-center bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46]"
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <AdminAuthContext.Provider value={contextValue}>
      {children}
    </AdminAuthContext.Provider>
  );
}
