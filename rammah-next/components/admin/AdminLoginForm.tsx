"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminApiError, fetchCurrentAdmin, loginAdmin } from "@/lib/api/admin";

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("admin@rammah.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const nextPath = useMemo(() => {
    const rawNext = searchParams.get("next");

    if (!rawNext?.startsWith("/admin") || rawNext.startsWith("/admin/login")) {
      return "/admin";
    }

    return rawNext;
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    fetchCurrentAdmin()
      .then(() => {
        if (!cancelled) {
          router.replace(nextPath);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [nextPath, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await loginAdmin({ email, password });
      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      if (submitError instanceof AdminApiError) {
        setError(submitError.message);
      } else {
        setError("Could not sign in. Check the API server and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[430px]">
      <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
        Admin
      </p>
      <h1 className="mt-4 text-5xl font-semibold leading-[0.95] tracking-normal text-[#102329] sm:text-6xl">
        Sign in
      </h1>
      <p className="mt-5 max-w-sm font-inter text-sm leading-6 text-[#102329]/65">
        Use your admin account to manage offerings, bookings, and CMS content.
      </p>

      <div className="mt-10 space-y-5">
        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-12 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm text-[#102329] outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>

        <label className="block">
          <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/55">
            Password
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 h-12 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm text-[#102329] outline-none transition-colors focus:border-[#0F3B46]"
            required
          />
        </label>
      </div>

      {error && (
        <p className="mt-5 border-l-2 border-red-600 pl-3 font-inter text-sm leading-6 text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || isCheckingSession}
        className="mt-8 h-12 w-full bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46] disabled:cursor-wait disabled:opacity-55"
      >
        {isCheckingSession ? "Checking session" : isSubmitting ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
