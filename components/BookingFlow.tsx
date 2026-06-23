"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createPublicSlotHold,
  fetchPublicAvailabilitySlots,
  fetchPublicOfferingSessions,
  fetchPublicPricePreview,
  PublicApiError,
  submitPublicFreeBooking,
  submitPublicPaidBooking,
  submitPublicQuoteRequest,
  type PublicAvailabilitySlot,
  type PublicBooking,
  type PublicOfferingSession,
  type PublicPricePreview,
  type PublicQuoteRequest,
} from "@/lib/api/bookings";
import {
  fetchPublicOffering,
  fetchPublicOfferingBookingConfig,
  type PublicBookingFormField,
  type PublicOffering,
  type PublicOfferingLocation,
} from "@/lib/api/offerings";

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));

const formatWeekday = (value: string) =>
  new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(`${value}T00:00:00`));

const formatDayNumber = (value: string) =>
  new Intl.DateTimeFormat("en", { day: "2-digit" }).format(new Date(`${value}T00:00:00`));

const formatMonth = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(`${value}T00:00:00`));

const formatTime = (value: string) =>
  new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const formatMoney = (amountMinor: number, currency: string) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);

const attendanceLabels = (mode: PublicOffering["attendanceMode"]) =>
  mode === "online" ? "Online" : mode === "offline" ? "Offline" : "Hybrid";

const formatPublicLocation = (
  location:
    | PublicOfferingLocation
    | NonNullable<PublicOfferingSession["location"]>
    | null
    | undefined,
) => {
  if (!location) return "";

  return [location.name, location.city, location.countryCode].filter(Boolean).join(", ");
};

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  countryCode: "EG",
};

const initialQuoteForm = {
  fullName: "",
  email: "",
  phone: "",
  companyName: "",
  participantsCount: "",
  preferredDate: "",
  message: "",
};

const normalizeAnswer = (value: string | undefined) => value?.trim() ?? "";

const getAnswerLabel = (field: PublicBookingFormField, value: string | undefined) => {
  const normalizedValue = normalizeAnswer(value);

  if (!normalizedValue) return "Not answered";

  if (field.fieldType === "select") {
    return field.options.find((option) => option.value === normalizedValue)?.label ?? normalizedValue;
  }

  if (field.fieldType === "checkbox") {
    if (field.options.length === 0) {
      return normalizedValue === "true" ? "Yes" : "No";
    }

    const values = normalizedValue.split(",").filter(Boolean);
    return values
      .map((valueItem) => field.options.find((option) => option.value === valueItem)?.label ?? valueItem)
      .join(", ");
  }

  return normalizedValue;
};

const buildAnswerPayload = (
  fields: PublicBookingFormField[],
  answers: Record<string, string>,
) =>
  fields
    .map((field) => {
      const value = normalizeAnswer(answers[field.fieldKey]);

      if (!value) {
        return null;
      }

      return {
        fieldId: field.id,
        fieldKey: field.fieldKey,
        label: field.label,
        value,
      };
    })
    .filter((answer): answer is NonNullable<typeof answer> => answer !== null);

type BookingFlowProps = {
  slug: string;
};

type BookingStep = "details" | "review";
type DynamicAnswers = Record<string, string>;

export default function BookingFlow({ slug }: BookingFlowProps) {
  const router = useRouter();
  const [offering, setOffering] = useState<PublicOffering | null>(null);
  const [fields, setFields] = useState<PublicBookingFormField[]>([]);
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [sessions, setSessions] = useState<PublicOfferingSession[]>([]);
  const [locations, setLocations] = useState<PublicOfferingLocation[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PublicAvailabilitySlot | null>(null);
  const [selectedSession, setSelectedSession] = useState<PublicOfferingSession | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [attendanceMode, setAttendanceMode] =
    useState<PublicOffering["attendanceMode"]>("online");
  const [form, setForm] = useState(initialForm);
  const [answers, setAnswers] = useState<DynamicAnswers>({});
  const [step, setStep] = useState<BookingStep>("details");
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [quoteForm, setQuoteForm] = useState(initialQuoteForm);
  const [quoteRequest, setQuoteRequest] = useState<PublicQuoteRequest | null>(null);
  const [pricePreview, setPricePreview] = useState<PublicPricePreview | null>(null);
  const [priceCountryCode, setPriceCountryCode] = useState("");
  const [priceError, setPriceError] = useState("");
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const dateRange = useMemo(() => {
    const today = new Date();
    return {
      from: toDateKey(today),
      to: toDateKey(addDays(today, 13)),
    };
  }, []);

  const sessionDateRange = useMemo(() => {
    const today = new Date();
    return {
      from: toDateKey(today),
      to: toDateKey(addDays(today, 89)),
    };
  }, []);

  const isFreeBooking =
    offering?.bookingMode === "free" && !offering.requiresPayment && !offering.quoteOnly;
  const isQuoteOffering = offering?.bookingMode === "quote_only" || offering?.quoteOnly;
  const isPaidOffering = offering?.bookingMode === "paid" || offering?.requiresPayment;
  const isBookableOffering = isFreeBooking || isPaidOffering;
  const hasSessionOptions = sessions.length > 0;
  const selectedBookableTime = selectedSession ?? selectedSlot;
  const selectedFormLocation =
    locations.find((location) => location.id === selectedLocationId) ?? null;
  const selectedLocation = selectedSession?.location ?? selectedFormLocation;
  const needsLocation =
    !hasSessionOptions && attendanceMode !== "online" && locations.length > 0;
  const dateOptions = useMemo(() => {
    if (hasSessionOptions) {
      const sessionDates = Array.from(new Set(sessions.map((session) => session.date))).sort();

      return sessionDates.map((date) => ({
        date,
        count: sessions.filter((session) => session.date === date).length,
      }));
    }

    return Array.from({ length: 14 }, (_, index) => {
      const date = toDateKey(addDays(new Date(`${dateRange.from}T00:00:00`), index));

      return {
        date,
        count: slots.filter((slot) => slot.date === date).length,
      };
    });
  }, [dateRange.from, hasSessionOptions, sessions, slots]);
  const activeDate =
    selectedDate ||
    dateOptions.find((dateOption) => dateOption.count > 0)?.date ||
    dateOptions[0]?.date ||
    "";
  const activeDateSessions = sessions.filter((session) => session.date === activeDate);
  const activeDateSlots = slots.filter((slot) => slot.date === activeDate);
  const activeDateCount = hasSessionOptions
    ? activeDateSessions.length
    : activeDateSlots.length;

  const updateAnswer = (fieldKey: string, value: string) => {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [fieldKey]: value,
    }));
  };

  const toggleCheckboxOption = (field: PublicBookingFormField, optionValue: string) => {
    setAnswers((currentAnswers) => {
      const values = new Set(
        normalizeAnswer(currentAnswers[field.fieldKey])
          .split(",")
          .filter(Boolean),
      );

      if (values.has(optionValue)) {
        values.delete(optionValue);
      } else {
        values.add(optionValue);
      }

      return {
        ...currentAnswers,
        [field.fieldKey]: Array.from(values).join(","),
      };
    });
  };

  useEffect(() => {
    let isCancelled = false;

    const loadBookingData = async () => {
      setIsLoading(true);
      setError("");
      setBooking(null);
      setQuoteRequest(null);
      setPricePreview(null);
      setPriceError("");
      setPriceCountryCode("");
      setLocations([]);
      setSelectedLocationId("");
      setStep("details");
      setSessions([]);
      setSlots([]);
      setSelectedSession(null);
      setSelectedSlot(null);
      setSelectedDate("");

      try {
        const nextOffering = await fetchPublicOffering(slug);
        const bookingConfig = await fetchPublicOfferingBookingConfig(nextOffering.id);
        const configuredOffering = bookingConfig.offering;

        if (isCancelled) return;

        setOffering(configuredOffering);
        setFields(bookingConfig.fields);
        setLocations(bookingConfig.locations);
        setAnswers({});
        setSelectedLocationId(
          configuredOffering.attendanceMode === "offline"
            ? bookingConfig.locations[0]?.id ?? ""
            : "",
        );
        setAttendanceMode(
          configuredOffering.attendanceMode === "hybrid" ? "online" : configuredOffering.attendanceMode,
        );

        const canBook =
          !configuredOffering.quoteOnly &&
          (configuredOffering.bookingMode === "free" ||
            configuredOffering.bookingMode === "paid" ||
            configuredOffering.requiresPayment);

        if (!canBook) {
          return;
        }

        const sessionPreview = await fetchPublicOfferingSessions({
          offeringId: configuredOffering.id,
          dateFrom: sessionDateRange.from,
          dateTo: sessionDateRange.to,
        });

        if (isCancelled) return;

        const availableSessions = sessionPreview.sessions.filter(
          (session) => session.status === "available",
        );

        if (availableSessions.length > 0) {
          setSessions(availableSessions);
          setSelectedSession(availableSessions[0] ?? null);
          setSelectedDate(availableSessions[0]?.date ?? "");
          setAttendanceMode(availableSessions[0]?.attendanceMode ?? configuredOffering.attendanceMode);
          setSelectedLocationId("");
          return;
        }

        const preview = await fetchPublicAvailabilitySlots({
          offeringId: configuredOffering.id,
          dateFrom: dateRange.from,
          dateTo: dateRange.to,
        });

        if (isCancelled) return;

        const availableSlots = preview.days
          .flatMap((day) => day.slots)
          .filter((slot) => slot.status === "available");

        setSlots(availableSlots);
        setSelectedSlot(availableSlots[0] ?? null);
        setSelectedDate(availableSlots[0]?.date ?? dateRange.from);
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load booking.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadBookingData();

    return () => {
      isCancelled = true;
    };
  }, [dateRange.from, dateRange.to, sessionDateRange.from, sessionDateRange.to, slug]);

  useEffect(() => {
    if (!offering || !isPaidOffering) {
      return;
    }

    const normalizedCountryCode = priceCountryCode.trim().toUpperCase();

    if (normalizedCountryCode && normalizedCountryCode.length !== 2) {
      setPricePreview(null);
      setPriceError("Use a two-letter country code.");
      return;
    }

    let isCancelled = false;

    const loadPricePreview = async () => {
      setIsPriceLoading(true);
      setPriceError("");

      try {
        const nextPricePreview = await fetchPublicPricePreview({
          offeringId: offering.id,
          countryCode: normalizedCountryCode || null,
        });

        if (!isCancelled) {
          setPricePreview(nextPricePreview);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setPricePreview(null);
          setPriceError(
            loadError instanceof Error ? loadError.message : "Could not load price.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsPriceLoading(false);
        }
      }
    };

    const timeout = window.setTimeout(() => {
      void loadPricePreview();
    }, normalizedCountryCode ? 250 : 0);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeout);
    };
  }, [isPaidOffering, offering, priceCountryCode]);

  const validateRequiredAnswers = () => {
    const missingField = fields.find((field) => {
      const value = normalizeAnswer(answers[field.fieldKey]);

      if (!field.required) return false;

      if (field.fieldType === "checkbox" && field.options.length === 0) {
        return value !== "true";
      }

      return !value;
    });

    if (missingField) {
      setError(`${missingField.label} is required.`);
      return false;
    }

    return true;
  };

  const handleDetailsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!offering || !selectedBookableTime || !isBookableOffering) {
      setError("Select an available time first.");
      return;
    }

    if (needsLocation && !selectedLocationId) {
      setError("Select where you want to attend.");
      return;
    }

    if (!validateRequiredAnswers()) {
      return;
    }

    setError("");
    setStep("review");
  };

  const handleConfirmBooking = async () => {
    if (!offering || !selectedBookableTime || !isBookableOffering) {
      setError("Select an available time first.");
      setStep("details");
      return;
    }

    if (needsLocation && !selectedLocationId) {
      setError("Select where you want to attend.");
      setStep("details");
      return;
    }

    if (isPaidOffering && !pricePreview) {
      setError("Wait for the payment amount to load first.");
      setStep("details");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const hold = await createPublicSlotHold({
        offeringId: offering.id,
        offeringSessionId: selectedSession?.id ?? null,
        startsAt: selectedBookableTime.startsAt,
        endsAt: selectedBookableTime.endsAt,
      });

      const bookingPayload = {
        holdId: hold.id,
        attendanceMode: selectedSession?.attendanceMode ?? attendanceMode,
        locationId:
          selectedSession?.location?.id ??
          (attendanceMode === "online" ? null : selectedLocationId || null),
        customer: {
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || null,
        },
        countryCode: form.countryCode || null,
        timezone: selectedBookableTime.timezone,
        answers: buildAnswerPayload(fields, answers),
      };
      const nextBooking = isPaidOffering
        ? (await submitPublicPaidBooking(bookingPayload)).booking
        : await submitPublicFreeBooking(bookingPayload);

      setBooking(nextBooking);

      if (isPaidOffering) {
        router.push(`/booking/payment/${encodeURIComponent(nextBooking.publicToken)}`);
        return;
      }
      if (selectedSession) {
        setSessions((currentSessions) =>
          currentSessions
            .map((session) => {
              if (session.id !== selectedSession.id) return session;

              const remainingCapacity = Math.max(session.remainingCapacity - 1, 0);
              const status: PublicOfferingSession["status"] =
                remainingCapacity > 0 ? "available" : "booked";

              return {
                ...session,
                remainingCapacity,
                bookedCount: session.bookedCount + 1,
                status,
              };
            })
            .filter((session) => session.status === "available"),
        );
      } else if (selectedSlot) {
        setSlots((currentSlots) =>
          currentSlots.filter((slot) => slot.startsAt !== selectedSlot.startsAt),
        );
      }
      setSelectedSlot(null);
      setSelectedSession(null);
      setForm(initialForm);
      setAnswers({});
      setStep("details");
    } catch (submitError) {
      if (submitError instanceof PublicApiError && submitError.code === "SLOT_UNAVAILABLE") {
        setError("That slot was just taken. Choose another time.");
      } else if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Could not submit the booking.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuoteSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!offering || !isQuoteOffering) {
      setError("This offering does not accept quote requests.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const nextQuoteRequest = await submitPublicQuoteRequest({
        offeringId: offering.id,
        fullName: quoteForm.fullName,
        email: quoteForm.email,
        phone: quoteForm.phone || null,
        companyName: quoteForm.companyName || null,
        participantsCount: quoteForm.participantsCount
          ? Number(quoteForm.participantsCount)
          : null,
        preferredDate: quoteForm.preferredDate || null,
        message: quoteForm.message || null,
      });

      setQuoteRequest(nextQuoteRequest);
      setQuoteForm(initialQuoteForm);
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Could not submit the quote request.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDynamicField = (field: PublicBookingFormField) => {
    const value = answers[field.fieldKey] ?? "";
    const label = (
      <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
        {field.label}
        {field.required ? " *" : ""}
      </span>
    );
    const inputClassName =
      "mt-2 h-12 w-full border border-[#102329]/18 px-4 font-inter text-sm outline-none focus:border-[#0F3B46]";

    if (field.fieldType === "textarea") {
      return (
        <label key={field.id} className="block">
          {label}
          <textarea
            required={field.required}
            value={value}
            onChange={(event) => updateAnswer(field.fieldKey, event.target.value)}
            rows={4}
            className="mt-2 w-full resize-none border border-[#102329]/18 px-4 py-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
          />
        </label>
      );
    }

    if (field.fieldType === "select") {
      return (
        <label key={field.id} className="block">
          {label}
          <select
            required={field.required}
            value={value}
            onChange={(event) => updateAnswer(field.fieldKey, event.target.value)}
            className="mt-2 h-12 w-full border border-[#102329]/18 bg-white px-4 font-inter text-sm outline-none focus:border-[#0F3B46]"
          >
            <option value="">Select</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (field.fieldType === "checkbox") {
      if (field.options.length === 0) {
        return (
          <label
            key={field.id}
            className="flex min-h-12 items-center gap-3 border border-[#102329]/12 px-4"
          >
            <input
              type="checkbox"
              checked={value === "true"}
              onChange={(event) =>
                updateAnswer(field.fieldKey, event.target.checked ? "true" : "false")
              }
              className="h-4 w-4 accent-[#0F3B46]"
            />
            <span className="font-inter text-sm font-semibold text-[#102329]/72">
              {field.label}
              {field.required ? " *" : ""}
            </span>
          </label>
        );
      }

      const selectedValues = new Set(value.split(",").filter(Boolean));

      return (
        <fieldset key={field.id} className="space-y-2">
          {label}
          <div className="mt-2 grid gap-2">
            {field.options.map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 items-center gap-3 border border-[#102329]/12 px-4"
              >
                <input
                  type="checkbox"
                  checked={selectedValues.has(option.value)}
                  onChange={() => toggleCheckboxOption(field, option.value)}
                  className="h-4 w-4 accent-[#0F3B46]"
                />
                <span className="font-inter text-sm text-[#102329]/72">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    }

    const inputType =
      field.fieldType === "email"
        ? "email"
        : field.fieldType === "phone"
          ? "tel"
          : field.fieldType === "date"
            ? "date"
            : field.fieldType === "number"
              ? "number"
              : "text";

    return (
      <label key={field.id} className="block">
        {label}
        <input
          required={field.required}
          type={inputType}
          value={value}
          onChange={(event) => updateAnswer(field.fieldKey, event.target.value)}
          className={inputClassName}
        />
      </label>
    );
  };

  return (
    <main className="min-h-screen bg-[#F7F4EE] text-[#102329]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between border-b border-[#102329]/12 pb-5">
          <Link href="/" className="font-inter text-xs font-semibold uppercase tracking-[0.22em]">
            Rammah
          </Link>
          <Link
            href="/#services"
            className="font-inter text-sm font-semibold text-[#102329]/62 transition-colors hover:text-[#0F3B46]"
          >
            Services
          </Link>
        </header>

        <section className="grid flex-1 gap-10 py-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(420px,0.62fr)] lg:items-start lg:py-14">
          <div>
            <p className="font-inter text-xs font-semibold uppercase tracking-[0.22em] text-[#0F3B46]">
              Booking
            </p>

            {isLoading ? (
              <div className="mt-6 space-y-4">
                <div className="h-14 w-3/4 animate-pulse bg-[#102329]/10" />
                <div className="h-6 w-1/2 animate-pulse bg-[#102329]/10" />
                <div className="h-28 w-full animate-pulse bg-[#102329]/8" />
              </div>
            ) : offering ? (
              <>
                <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-none tracking-normal sm:text-6xl lg:text-7xl">
                  {offering.title}
                </h1>
                <p className="mt-5 max-w-2xl font-inter text-base leading-7 text-[#102329]/68">
                  {offering.description || offering.subtitle || "Choose an available time and confirm your session."}
                </p>

                <dl className="mt-8 grid gap-4 border-y border-[#102329]/12 py-5 sm:grid-cols-3">
                  <div>
                    <dt className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                      Duration
                    </dt>
                    <dd className="mt-2 font-inter text-sm font-semibold">
                      {offering.durationMinutes} min
                    </dd>
                  </div>
                  <div>
                    <dt className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                      Mode
                    </dt>
                    <dd className="mt-2 font-inter text-sm font-semibold capitalize">
                      {offering.attendanceMode.replace("_", " ")}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                      Booking
                    </dt>
                    <dd className="mt-2 font-inter text-sm font-semibold capitalize">
                      {offering.bookingMode.replace("_", " ")}
                    </dd>
                  </div>
                </dl>

                {!isFreeBooking && (
                  <div className="mt-8 border-l-2 border-[#0F3B46] pl-4">
                    <p className="font-inter text-sm leading-6 text-[#102329]/70">
                      {isQuoteOffering
                        ? "Share the basics and the team will follow up with a tailored quote."
                        : "Review the backend-resolved price for your country before checkout."}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <h1 className="mt-4 text-5xl font-semibold tracking-normal">Offering not found</h1>
            )}
          </div>

          <div className="border border-[#102329]/14 bg-white p-5 sm:p-6">
            {booking ? (
              <div className="space-y-5">
                <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#0F3B46]">
                  Confirmed
                </p>
                <h2 className="text-3xl font-semibold tracking-normal">Your booking is confirmed.</h2>
                <p className="font-inter text-sm leading-6 text-[#102329]/62">
                  We saved your session for{" "}
                  {booking.slot.startsAt
                    ? `${formatDate(toDateKey(new Date(booking.slot.startsAt)))}, ${formatTime(booking.slot.startsAt)}`
                    : "the selected time"}
                  .
                </p>
                <div className="border-y border-[#102329]/10 py-4">
                  <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                    Reference token
                  </p>
                  <p className="mt-2 break-all font-inter text-sm text-[#102329]/68">
                    {booking.publicToken}
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={`/booking/status/${booking.publicToken}`}
                    className="inline-flex h-11 items-center justify-center bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46]"
                  >
                    View status
                  </Link>
                  <Link
                    href="/"
                    className="inline-flex h-11 items-center justify-center border border-[#102329]/18 px-5 font-inter text-sm font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46]"
                  >
                    Back home
                  </Link>
                </div>
              </div>
            ) : quoteRequest ? (
              <div className="space-y-5">
                <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#0F3B46]">
                  Submitted
                </p>
                <h2 className="text-3xl font-semibold tracking-normal">Quote request received.</h2>
                <p className="font-inter text-sm leading-6 text-[#102329]/62">
                  We saved your request for {quoteRequest.offering?.title ?? "this service"}.
                </p>
                <div className="border-y border-[#102329]/10 py-4">
                  <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                    Request reference
                  </p>
                  <p className="mt-2 break-all font-inter text-sm text-[#102329]/68">
                    {quoteRequest.id}
                  </p>
                </div>
                <Link
                  href="/"
                  className="inline-flex h-11 items-center justify-center bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46]"
                >
                  Back home
                </Link>
              </div>
            ) : isQuoteOffering && offering ? (
              <form onSubmit={handleQuoteSubmit} className="space-y-5">
                <div>
                  <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#0F3B46]">
                    Quote request
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-normal">Tell us what you need.</h2>
                </div>

                <div className="grid gap-4">
                  <label className="block">
                    <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                      Full name
                    </span>
                    <input
                      required
                      value={quoteForm.fullName}
                        onChange={(event) =>
                          setQuoteForm((currentForm) => ({
                            ...currentForm,
                            fullName: event.target.value,
                          }))
                        }
                      className="mt-2 h-12 w-full border border-[#102329]/18 px-4 font-inter text-sm outline-none focus:border-[#0F3B46]"
                    />
                  </label>

                  <label className="block">
                    <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                      Email
                    </span>
                    <input
                      required
                      type="email"
                      value={quoteForm.email}
                        onChange={(event) =>
                          setQuoteForm((currentForm) => ({
                            ...currentForm,
                            email: event.target.value,
                          }))
                        }
                      className="mt-2 h-12 w-full border border-[#102329]/18 px-4 font-inter text-sm outline-none focus:border-[#0F3B46]"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                        Phone
                      </span>
                      <input
                        value={quoteForm.phone}
                        onChange={(event) =>
                          setQuoteForm((currentForm) => ({
                            ...currentForm,
                            phone: event.target.value,
                          }))
                        }
                        className="mt-2 h-12 w-full border border-[#102329]/18 px-4 font-inter text-sm outline-none focus:border-[#0F3B46]"
                      />
                    </label>

                    <label className="block">
                      <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                        Company
                      </span>
                      <input
                        value={quoteForm.companyName}
                        onChange={(event) =>
                          setQuoteForm((currentForm) => ({
                            ...currentForm,
                            companyName: event.target.value,
                          }))
                        }
                        className="mt-2 h-12 w-full border border-[#102329]/18 px-4 font-inter text-sm outline-none focus:border-[#0F3B46]"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                        Participants
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={quoteForm.participantsCount}
                        onChange={(event) =>
                          setQuoteForm((currentForm) => ({
                            ...currentForm,
                            participantsCount: event.target.value,
                          }))
                        }
                        className="mt-2 h-12 w-full border border-[#102329]/18 px-4 font-inter text-sm outline-none focus:border-[#0F3B46]"
                      />
                    </label>

                    <label className="block">
                      <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                        Preferred date
                      </span>
                      <input
                        type="date"
                        value={quoteForm.preferredDate}
                        onChange={(event) =>
                          setQuoteForm((currentForm) => ({
                            ...currentForm,
                            preferredDate: event.target.value,
                          }))
                        }
                        className="mt-2 h-12 w-full border border-[#102329]/18 px-4 font-inter text-sm outline-none focus:border-[#0F3B46]"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                      Message
                    </span>
                    <textarea
                      value={quoteForm.message}
                      onChange={(event) =>
                        setQuoteForm((currentForm) => ({
                          ...currentForm,
                          message: event.target.value,
                        }))
                      }
                      rows={5}
                      className="mt-2 w-full resize-none border border-[#102329]/18 px-4 py-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
                    />
                  </label>
                </div>

                {error && (
                  <p className="border-l-2 border-red-700 pl-3 font-inter text-sm leading-6 text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 w-full bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting" : "Submit request"}
                </button>
              </form>
            ) : step === "review" && selectedBookableTime && offering ? (
              <div className="space-y-6">
                <div>
                  <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#0F3B46]">
                    Review
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-normal">Confirm your details.</h2>
                </div>

                <div className="grid gap-4 border-y border-[#102329]/10 py-4">
                  <div>
                    <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/42">
                      Service
                    </p>
                    <p className="mt-2 font-inter text-sm font-semibold">{offering.title}</p>
                  </div>
                  <div>
                    <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/42">
                      Slot
                    </p>
                    <p className="mt-2 font-inter text-sm text-[#102329]/70">
                      {formatDate(selectedBookableTime.date)}, {formatTime(selectedBookableTime.startsAt)}
                    </p>
                    {selectedLocation && (
                      <p className="mt-1 font-inter text-xs text-[#102329]/48">
                        {formatPublicLocation(selectedLocation)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/42">
                      Customer
                    </p>
                    <p className="mt-2 font-inter text-sm font-semibold">{form.fullName}</p>
                    <p className="mt-1 font-inter text-sm text-[#102329]/58">{form.email}</p>
                  </div>
                  {fields.length > 0 && (
                    <div>
                      <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/42">
                        Answers
                      </p>
                      <div className="mt-2 grid gap-2">
                        {fields.map((field) => (
                          <p key={field.id} className="font-inter text-sm text-[#102329]/68">
                            <span className="font-semibold text-[#102329]">{field.label}:</span>{" "}
                            {getAnswerLabel(field, answers[field.fieldKey])}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {isPaidOffering && pricePreview && (
                    <div>
                      <p className="font-inter text-xs font-semibold uppercase tracking-[0.14em] text-[#102329]/42">
                        Payment
                      </p>
                      <p className="mt-2 font-inter text-sm font-semibold">
                        {formatMoney(
                          pricePreview.price.totalAmountMinor,
                          pricePreview.price.currency,
                        )}
                      </p>
                      <p className="mt-1 font-inter text-xs text-[#102329]/48">
                        Country: {pricePreview.resolvedCountryCode}
                        {pricePreview.fallbackApplied
                          ? `, fallback from ${pricePreview.requestedCountryCode}`
                          : ""}
                        {pricePreview.price.earlyBirdApplied ? ", early bird applied" : ""}
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <p className="border-l-2 border-red-700 pl-3 font-inter text-sm leading-6 text-red-700">
                    {error}
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleConfirmBooking}
                    disabled={isSubmitting}
                    className="h-12 flex-1 bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
                  >
                    {isSubmitting
                      ? isPaidOffering
                        ? "Preparing payment"
                        : "Confirming"
                      : isPaidOffering
                        ? "Continue to payment"
                        : "Confirm booking"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("details")}
                    disabled={isSubmitting}
                    className="h-12 border border-[#102329]/18 px-5 font-inter text-sm font-semibold text-[#102329]/70 transition-colors hover:border-[#0F3B46] hover:text-[#0F3B46] disabled:cursor-wait disabled:opacity-50"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleDetailsSubmit} className="space-y-6">
                <div>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/42">
                        {hasSessionOptions ? "Available sessions" : "Available times"}
                      </p>
                      {activeDate && (
                        <p className="mt-2 font-inter text-sm font-semibold text-[#102329]/72">
                          {formatDate(activeDate)}
                        </p>
                      )}
                    </div>
                    {!isLoading && activeDate && (
                      <p className="shrink-0 font-inter text-xs font-semibold uppercase tracking-[0.12em] text-[#102329]/40">
                        {activeDateCount === 1
                          ? "1 option"
                          : `${activeDateCount} options`}
                      </p>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="mt-4 space-y-4">
                      <div className="flex gap-2 overflow-hidden">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <div
                            key={index}
                            className="min-h-[82px] min-w-[82px] border border-[#102329]/10 bg-white/35 p-3"
                          >
                            <div className="h-3 animate-pulse bg-[#102329]/8" />
                            <div className="mt-4 h-7 w-8 animate-pulse bg-[#102329]/8" />
                            <div className="mt-3 h-3 w-10 animate-pulse bg-[#102329]/8" />
                          </div>
                        ))}
                      </div>
                      <div className="border border-[#102329]/12 bg-white/45 p-4">
                        <div className="h-4 w-40 animate-pulse bg-[#102329]/8" />
                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <div
                              key={index}
                              className="h-11 animate-pulse border border-[#102329]/10 bg-white/40"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : dateOptions.length === 0 ? (
                    <p className="mt-4 border border-dashed border-[#102329]/16 px-4 py-5 text-center font-inter text-sm text-[#102329]/48">
                      No available times right now.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div
                        aria-label="Choose a booking date"
                        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
                      >
                        {dateOptions.map((day) => {
                          const isActive = day.date === activeDate;
                          const hasTimes = day.count > 0;

                          return (
                            <button
                              key={day.date}
                              type="button"
                              aria-pressed={isActive}
                              onClick={() => {
                                setSelectedDate(day.date);
                                if (selectedSession?.date !== day.date) {
                                  setSelectedSession(null);
                                }
                                if (selectedSlot?.date !== day.date) {
                                  setSelectedSlot(null);
                                }
                              }}
                              className={`grid min-h-[82px] min-w-[82px] content-between border px-3 py-2 text-left transition-colors ${
                                isActive
                                  ? "border-[#0F3B46] bg-[#0F3B46] text-white"
                                  : hasTimes
                                    ? "border-[#102329]/14 bg-white/45 text-[#102329] hover:border-[#0F3B46]"
                                    : "border-[#102329]/10 bg-white/25 text-[#102329]/34"
                              }`}
                            >
                              <span
                                className={`font-inter text-[11px] font-semibold uppercase tracking-[0.12em] ${
                                  isActive ? "text-white/70" : "text-inherit"
                                }`}
                              >
                                {formatWeekday(day.date)}
                              </span>
                              <span className="text-2xl font-semibold leading-none">
                                {formatDayNumber(day.date)}
                              </span>
                              <span
                                className={`font-inter text-[11px] font-semibold uppercase tracking-[0.1em] ${
                                  isActive ? "text-white/70" : "text-inherit"
                                }`}
                              >
                                {formatMonth(day.date)}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="border border-[#102329]/12 bg-white/45 p-3 sm:p-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-inter text-sm font-semibold text-[#102329]">
                            {activeDate ? formatDate(activeDate) : "Choose a day"}
                          </p>
                          <p className="font-inter text-xs font-semibold uppercase tracking-[0.12em] text-[#102329]/42">
                            {activeDateCount === 0
                              ? "No times available"
                              : activeDateCount === 1
                                ? "1 available"
                                : `${activeDateCount} available`}
                          </p>
                        </div>

                        <div className="mt-3">
                          {hasSessionOptions ? (
                            activeDateSessions.length === 0 ? (
                              <p className="border border-dashed border-[#102329]/14 px-3 py-5 text-center font-inter text-sm text-[#102329]/46">
                                No sessions available on this day.
                              </p>
                            ) : (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {activeDateSessions.map((session) => {
                                  const isSelected = selectedSession?.id === session.id;

                                  return (
                                    <button
                                      key={session.id}
                                      type="button"
                                      aria-pressed={isSelected}
                                      onClick={() => {
                                        setSelectedSession(session);
                                        setSelectedSlot(null);
                                        setSelectedDate(session.date);
                                        setSelectedLocationId("");
                                        setAttendanceMode(session.attendanceMode);
                                      }}
                                      className={`min-h-[64px] border px-3 py-2.5 text-left transition-colors ${
                                        isSelected
                                          ? "border-[#0F3B46] bg-[#0F3B46] text-white"
                                          : "border-[#102329]/12 bg-white/35 text-[#102329] hover:border-[#0F3B46]"
                                      }`}
                                    >
                                      <span className="font-inter text-sm font-semibold">
                                        {formatTime(session.startsAt)}
                                      </span>
                                      <span
                                        className={`mt-1 block font-inter text-[11px] leading-4 ${
                                          isSelected ? "text-white/72" : "text-[#102329]/50"
                                        }`}
                                      >
                                        {formatPublicLocation(session.location) ||
                                          attendanceLabels(session.attendanceMode)}
                                        {" · "}
                                        {session.remainingCapacity} left
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )
                          ) : activeDateSlots.length === 0 ? (
                            <p className="border border-dashed border-[#102329]/14 px-3 py-5 text-center font-inter text-sm text-[#102329]/46">
                              No times available on this day.
                            </p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {activeDateSlots.map((slot) => {
                                const isSelected = selectedSlot?.startsAt === slot.startsAt;

                                return (
                                  <button
                                    key={`${slot.startsAt}-${slot.endsAt}`}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => {
                                      setSelectedSlot(slot);
                                      setSelectedSession(null);
                                      setSelectedDate(slot.date);
                                    }}
                                    className={`min-h-11 border px-3 py-2 text-center font-inter text-sm font-semibold transition-colors ${
                                      isSelected
                                        ? "border-[#0F3B46] bg-[#0F3B46] text-white"
                                        : "border-[#102329]/12 bg-white/35 text-[#102329] hover:border-[#0F3B46]"
                                    }`}
                                  >
                                    {formatTime(slot.startsAt)}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {offering?.attendanceMode === "hybrid" && !hasSessionOptions && (
                  <label className="block">
                    <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                      Attendance
                    </span>
                    <select
                      value={attendanceMode}
                      onChange={(event) => {
                        const nextMode = event.target.value as PublicOffering["attendanceMode"];
                        setAttendanceMode(nextMode);
                        setSelectedLocationId(
                          nextMode === "online" ? "" : selectedLocationId || locations[0]?.id || "",
                        );
                      }}
                      className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
                    >
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                    </select>
                  </label>
                )}

                {needsLocation && (
                  <label className="block">
                    <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                      Location
                    </span>
                    <select
                      value={selectedLocationId}
                      onChange={(event) => setSelectedLocationId(event.target.value)}
                      className="mt-2 h-11 w-full border border-[#102329]/18 bg-white px-3 font-inter text-sm outline-none focus:border-[#0F3B46]"
                      required
                    >
                      <option value="">Select location</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {formatPublicLocation(location)}
                        </option>
                      ))}
                    </select>
                    {selectedFormLocation?.instructions && (
                      <p className="mt-2 font-inter text-xs leading-5 text-[#102329]/48">
                        {selectedFormLocation.instructions}
                      </p>
                    )}
                  </label>
                )}

                <div className="grid gap-4">
                  <label className="block">
                    <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                      Full name
                    </span>
                    <input
                      required
                      value={form.fullName}
                      onChange={(event) =>
                        setForm((currentForm) => ({
                          ...currentForm,
                          fullName: event.target.value,
                        }))
                      }
                      className="mt-2 h-12 w-full border border-[#102329]/18 px-4 font-inter text-sm outline-none focus:border-[#0F3B46]"
                    />
                  </label>

                  <label className="block">
                    <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                      Email
                    </span>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((currentForm) => ({
                          ...currentForm,
                          email: event.target.value,
                        }))
                      }
                      className="mt-2 h-12 w-full border border-[#102329]/18 px-4 font-inter text-sm outline-none focus:border-[#0F3B46]"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                    <label className="block">
                      <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                        Phone
                      </span>
                      <input
                        value={form.phone}
                        onChange={(event) =>
                          setForm((currentForm) => ({
                            ...currentForm,
                            phone: event.target.value,
                          }))
                        }
                        className="mt-2 h-12 w-full border border-[#102329]/18 px-4 font-inter text-sm outline-none focus:border-[#0F3B46]"
                      />
                    </label>

                    <label className="block">
                      <span className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                        Country
                      </span>
                      <input
                        value={form.countryCode}
                        maxLength={2}
                        onChange={(event) => {
                          const nextCountryCode = event.target.value.toUpperCase();
                          setForm((currentForm) => ({
                            ...currentForm,
                            countryCode: nextCountryCode,
                          }));
                          setPriceCountryCode(nextCountryCode);
                        }}
                        className="mt-2 h-12 w-full border border-[#102329]/18 px-4 font-inter text-sm uppercase outline-none focus:border-[#0F3B46]"
                      />
                    </label>
                  </div>
                </div>

                {fields.length > 0 && (
                  <div className="grid gap-4 border-t border-[#102329]/10 pt-5">
                    <p className="font-inter text-xs font-semibold uppercase tracking-[0.18em] text-[#102329]/42">
                      Questions
                    </p>
                    {fields.map((field) => renderDynamicField(field))}
                  </div>
                )}

                {isPaidOffering && (
                  <div className="border-y border-[#102329]/10 py-5">
                    {isPriceLoading ? (
                      <div className="space-y-3">
                        <div className="h-8 w-2/3 animate-pulse bg-[#102329]/10" />
                        <div className="h-4 w-1/2 animate-pulse bg-[#102329]/8" />
                      </div>
                    ) : pricePreview ? (
                      <div className="grid gap-3">
                        <p className="font-inter text-xs font-semibold uppercase tracking-[0.16em] text-[#102329]/42">
                          Payment amount
                        </p>
                        <p className="text-3xl font-semibold tracking-normal">
                          {formatMoney(
                            pricePreview.price.totalAmountMinor,
                            pricePreview.price.currency,
                          )}
                        </p>
                        <p className="font-inter text-xs leading-5 text-[#102329]/55">
                          Country: {pricePreview.resolvedCountryCode}
                          {pricePreview.fallbackApplied
                            ? `, fallback from ${pricePreview.requestedCountryCode}`
                            : ""}
                          {pricePreview.price.earlyBirdApplied ? ", early bird applied" : ""}.
                        </p>
                      </div>
                    ) : (
                      <p className="font-inter text-sm leading-6 text-red-700">
                        {priceError || "Could not load the payment amount."}
                      </p>
                    )}
                  </div>
                )}

                {error && (
                  <p className="border-l-2 border-red-700 pl-3 font-inter text-sm leading-6 text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    !selectedBookableTime ||
                    !isBookableOffering ||
                    (isPaidOffering && (!pricePreview || isPriceLoading)) ||
                    isSubmitting
                  }
                  className="h-12 w-full bg-[#102329] px-5 font-inter text-sm font-semibold text-white transition-colors hover:bg-[#0F3B46] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isPaidOffering ? "Review and pay" : "Review booking"}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
