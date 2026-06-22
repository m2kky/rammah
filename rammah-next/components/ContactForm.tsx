"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicApiError, submitPublicQuoteRequest } from "@/lib/api/bookings";

export default function ContactForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // ponytail: general inquiries reuse quote_requests, split to contact_inquiries when separate SLA/fields matter.
      await submitPublicQuoteRequest({
        fullName,
        email,
        phone: phone.trim() || null,
        companyName: companyName.trim() || null,
        preferredDate: preferredDate || null,
        message,
      });
      router.push("/thank-you?type=contact");
    } catch (submitError) {
      setError(
        submitError instanceof PublicApiError
          ? submitError.message
          : "Could not send your message.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {error && (
        <p className="border-l-2 border-red-400 pl-3 font-inter text-sm leading-6 text-red-200">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <input
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Full name"
          className="h-12 rounded-full border border-white/16 bg-white/8 px-5 font-inter text-sm text-white outline-none placeholder:text-white/38 focus:border-white/45"
        />
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="h-12 rounded-full border border-white/16 bg-white/8 px-5 font-inter text-sm text-white outline-none placeholder:text-white/38 focus:border-white/45"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Phone"
          className="h-12 rounded-full border border-white/16 bg-white/8 px-5 font-inter text-sm text-white outline-none placeholder:text-white/38 focus:border-white/45"
        />
        <input
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          placeholder="Company, if relevant"
          className="h-12 rounded-full border border-white/16 bg-white/8 px-5 font-inter text-sm text-white outline-none placeholder:text-white/38 focus:border-white/45"
        />
      </div>

      <input
        type="date"
        value={preferredDate}
        onChange={(event) => setPreferredDate(event.target.value)}
        className="h-12 rounded-full border border-white/16 bg-white/8 px-5 font-inter text-sm text-white outline-none focus:border-white/45"
      />

      <textarea
        required
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="What do you want to work on?"
        rows={7}
        className="resize-none rounded-[28px] border border-white/16 bg-white/8 px-5 py-4 font-inter text-sm leading-7 text-white outline-none placeholder:text-white/38 focus:border-white/45"
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-fit rounded-full bg-white px-7 font-inter text-sm font-semibold text-[#0F3B46] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-55"
      >
        {isSubmitting ? "Sending" : "Send message"}
      </button>
    </form>
  );
}
