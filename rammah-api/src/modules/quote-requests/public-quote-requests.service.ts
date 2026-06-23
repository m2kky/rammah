import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  findPublicQuoteOfferingById,
  insertPublicQuoteRequest,
} from "./public-quote-requests.repository.js";
import { sendQuoteRequestEmails } from "../emails/email.service.js";

export type PublicQuoteRequestInput = {
  offeringId?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  companyName?: string | null;
  participantsCount?: number | null;
  preferredDate?: string | null;
  message?: string | null;
};

const normalizeOptionalText = (value: string | null | undefined) => {
  if (value === undefined || value === null) return null;

  const normalized = value.trim();
  return normalized ? normalized : null;
};

const assertPreferredDate = (value: string | null | undefined) => {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

  if (!match) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Preferred date must use YYYY-MM-DD format.",
      statusCode: httpStatus.badRequest,
      details: [{ field: "preferredDate", message: "Use YYYY-MM-DD format." }],
    });
  }

  const [, year, month, day] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Preferred date is invalid.",
      statusCode: httpStatus.badRequest,
      details: [{ field: "preferredDate", message: "Use a valid calendar date." }],
    });
  }

  return normalized;
};

const assertQuoteOffering = async (offeringId: string | null | undefined) => {
  if (!offeringId) return null;

  const offering = await findPublicQuoteOfferingById(offeringId);

  if (!offering || offering.status !== "published") {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (offering.bookingMode !== "quote_only" && !offering.quoteOnly) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "This offering does not accept quote requests.",
      statusCode: httpStatus.badRequest,
      details: [
        {
          field: "offeringId",
          message: "Select a quote-only offering.",
        },
      ],
    });
  }

  return offering;
};

export const submitPublicQuoteRequest = async (input: PublicQuoteRequestInput) => {
  const offering = await assertQuoteOffering(input.offeringId);
  const request = await insertPublicQuoteRequest({
    offeringId: offering?.id ?? null,
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalizeOptionalText(input.phone),
    companyName: normalizeOptionalText(input.companyName),
    participantsCount: input.participantsCount ?? null,
    preferredDate: assertPreferredDate(input.preferredDate),
    message: normalizeOptionalText(input.message),
    status: "new",
  });

  if (!request) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Quote request could not be submitted.",
      statusCode: httpStatus.internalServerError,
    });
  }

  await sendQuoteRequestEmails(request.id);

  return {
    id: request.id,
    offering: offering
      ? {
          id: offering.id,
          title: offering.title,
          slug: offering.slug,
        }
      : null,
    status: request.status,
    fullName: request.fullName,
    email: request.email,
    phone: request.phone,
    companyName: request.companyName,
    participantsCount: request.participantsCount,
    preferredDate: request.preferredDate,
    message: request.message,
    createdAt: request.createdAt.toISOString(),
  };
};
