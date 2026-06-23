import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import {
  findAdminQuoteRequestById,
  findAdminQuoteRequests,
  updateAdminQuoteRequest,
  type AdminQuoteRequestFilters,
  type AdminQuoteRequestPatch,
  type AdminQuoteRequestRow,
} from "./admin-quote-requests.repository.js";

const toAdminQuoteRequest = (quoteRequest: AdminQuoteRequestRow) => ({
  id: quoteRequest.id,
  offering: quoteRequest.offeringId
    ? {
        id: quoteRequest.offeringId,
        title: quoteRequest.offeringTitle,
        slug: quoteRequest.offeringSlug,
      }
    : null,
  status: quoteRequest.status,
  customer: {
    fullName: quoteRequest.fullName,
    email: quoteRequest.email,
    phone: quoteRequest.phone,
    companyName: quoteRequest.companyName,
  },
  participantsCount: quoteRequest.participantsCount,
  preferredDate: quoteRequest.preferredDate,
  message: quoteRequest.message,
  adminNotes: quoteRequest.adminNotes,
  createdAt: quoteRequest.createdAt.toISOString(),
  updatedAt: quoteRequest.updatedAt.toISOString(),
});

export const listAdminQuoteRequests = async (filters: AdminQuoteRequestFilters) => {
  const quoteRequests = await findAdminQuoteRequests(filters);
  return quoteRequests.map(toAdminQuoteRequest);
};

export const getAdminQuoteRequest = async (id: string) => {
  const quoteRequest = await findAdminQuoteRequestById(id);

  if (!quoteRequest) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Quote request was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  return toAdminQuoteRequest(quoteRequest);
};

export const updateAdminQuoteRequestById = async (
  id: string,
  input: AdminQuoteRequestPatch,
  auditContext?: AuditContext,
) => {
  const quoteRequest = await findAdminQuoteRequestById(id);

  if (!quoteRequest) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Quote request was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const beforeQuoteRequest = toAdminQuoteRequest(quoteRequest);
  const updatedQuoteRequest = await updateAdminQuoteRequest(id, {
    status: input.status,
    adminNotes: input.adminNotes === undefined ? quoteRequest.adminNotes : input.adminNotes,
  });

  if (!updatedQuoteRequest) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Quote request was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const afterQuoteRequest = toAdminQuoteRequest(updatedQuoteRequest);

  await writeAuditLog(auditContext, {
    action: "admin.quote_requests.update",
    resourceType: "quote_request",
    resourceId: id,
    beforeSnapshot: beforeQuoteRequest,
    afterSnapshot: afterQuoteRequest,
  });

  return afterQuoteRequest;
};
