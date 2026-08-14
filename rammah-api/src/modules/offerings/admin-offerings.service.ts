import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import {
  archiveAdminOffering,
  archiveAdminOfferingPrice,
  findAdminOfferingCategories,
  findAdminOfferingById,
  findAdminOfferingPriceById,
  findAdminOfferingPricesByOfferingId,
  findAdminOfferings,
  findOfferingSchedulingDependencies,
  findOfferingPriceByCountryCurrency,
  findOfferingBySlug,
  findOfferingCategoryById,
  insertAdminOfferingPrice,
  insertAdminOffering,
  updateAdminOffering,
  updateAdminOfferingPrice,
  type AdminOfferingFilters,
  type AdminOfferingCategoryRow,
  type AdminOfferingInsert,
  type AdminOfferingPriceInsert,
  type AdminOfferingPriceRow,
  type AdminOfferingPriceUpdate,
  type AdminOfferingRow,
  type AdminOfferingUpdate,
} from "./admin-offerings.repository.js";

export type AdminOfferingInput = {
  categoryId?: string | null;
  title: string;
  slug: string;
  shortDescription?: string | null;
  longDescription?: string | null;
  offeringType: AdminOfferingInsert["offeringType"];
  attendanceMode: AdminOfferingInsert["attendanceMode"];
  bookingMode: AdminOfferingInsert["bookingMode"];
  schedulingMode: "appointment" | "scheduled_program";
  durationMinutes: number | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  capacity: number;
  requiresPayment: boolean;
  quoteOnly: boolean;
  sortOrder: number;
  displayConfig: AdminOfferingInsert["displayConfig"];
  status: AdminOfferingInsert["status"];
};

export type AdminOfferingPatchInput = Partial<AdminOfferingInput>;

export type AdminOfferingPriceInput = {
  countryCode: string;
  currency: string;
  baseAmountMinor: number;
  earlyBirdAmountMinor?: number | null;
  earlyBirdEndsAt?: string | null;
  status: AdminOfferingPriceInsert["status"];
};

export type AdminOfferingPricePatchInput = Partial<AdminOfferingPriceInput>;

const toNullableText = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
};

const removeUndefined = <T extends Record<string, unknown>>(input: T) =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

const notFoundError = () =>
  new AppError({
    code: "NOT_FOUND",
    message: "Offering was not found.",
    statusCode: httpStatus.notFound,
  });

const toAdminOffering = (offering: AdminOfferingRow) => ({
  id: offering.id,
  category: offering.categoryId
    ? {
        id: offering.categoryId,
        name: offering.categoryName ?? "",
        slug: offering.categorySlug ?? "",
      }
    : null,
  title: offering.title,
  slug: offering.slug,
  shortDescription: offering.shortDescription,
  longDescription: offering.longDescription,
  offeringType: offering.offeringType,
  attendanceMode: offering.attendanceMode,
  bookingMode: offering.bookingMode,
  schedulingMode: offering.schedulingMode,
  durationMinutes: offering.durationMinutes,
  bufferBeforeMinutes: offering.bufferBeforeMinutes,
  bufferAfterMinutes: offering.bufferAfterMinutes,
  capacity: offering.capacity,
  requiresPayment: offering.requiresPayment,
  quoteOnly: offering.quoteOnly,
  sortOrder: offering.sortOrder,
  displayConfig: offering.displayConfig,
  status: offering.status,
  createdAt: offering.createdAt.toISOString(),
  updatedAt: offering.updatedAt.toISOString(),
});

const toAdminOfferingCategory = (category: AdminOfferingCategoryRow) => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  description: category.description,
  sortOrder: category.sortOrder,
  status: category.status,
  createdAt: category.createdAt.toISOString(),
  updatedAt: category.updatedAt.toISOString(),
});

const toAdminOfferingPrice = (price: AdminOfferingPriceRow) => ({
  id: price.id,
  offeringId: price.offeringId,
  countryCode: price.countryCode,
  currency: price.currency,
  baseAmountMinor: price.baseAmountMinor,
  earlyBirdAmountMinor: price.earlyBirdAmountMinor,
  earlyBirdEndsAt: price.earlyBirdEndsAt?.toISOString() ?? null,
  status: price.status,
  createdAt: price.createdAt.toISOString(),
  updatedAt: price.updatedAt.toISOString(),
});

const toUpperCode = (value: string) => value.trim().toUpperCase();

const toNullableDate = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  return new Date(value);
};

const assertCategoryExists = async (categoryId?: string | null) => {
  if (!categoryId) return;

  const category = await findOfferingCategoryById(categoryId);

  if (!category) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering category was not found.",
      statusCode: httpStatus.notFound,
    });
  }
};

const assertSlugAvailable = async (slug: string, excludeId?: string) => {
  const existingOffering = await findOfferingBySlug(slug, excludeId);

  if (existingOffering) {
    throw new AppError({
      code: "CONFLICT",
      message: "Offering slug already exists.",
      statusCode: httpStatus.conflict,
      details: [
        {
          field: "slug",
          message: "Use a unique offering slug.",
        },
      ],
    });
  }
};

export const validateEarlyBookingPrice = (
  baseAmountMinor: number,
  earlyBirdAmountMinor: number | null,
  earlyBirdEndsAt: Date | null,
) => {
  const hasAmount = earlyBirdAmountMinor !== null;
  const hasExpiry = earlyBirdEndsAt !== null;

  if (hasAmount !== hasExpiry) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Early-booking amount and expiry must be supplied together.",
      statusCode: httpStatus.badRequest,
      details: [
        {
          field: hasAmount ? "earlyBirdEndsAt" : "earlyBirdAmountMinor",
          message: "Provide both the early-booking price and its end date and time.",
        },
      ],
    });
  }

  if (
    earlyBirdAmountMinor !== null &&
    earlyBirdAmountMinor >= baseAmountMinor
  ) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Early-booking price must be lower than the Standard price.",
      statusCode: httpStatus.badRequest,
      details: [
        {
          field: "earlyBirdAmountMinor",
          message: "Enter a discounted amount below the Standard price.",
        },
      ],
    });
  }
};

const assertSchedulingConfiguration = (input: {
  schedulingMode: "appointment" | "scheduled_program";
  durationMinutes: number | null;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
}) => {
  const durationIsInvalid =
    input.schedulingMode === "appointment"
      ? input.durationMinutes === null || input.durationMinutes <= 0
      : input.durationMinutes !== null;

  if (
    durationIsInvalid ||
    input.bufferBeforeMinutes < 0 ||
    input.bufferAfterMinutes < 0
  ) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Offering scheduling configuration is invalid.",
      statusCode: httpStatus.badRequest,
      details: [
        {
          field: "durationMinutes",
          message:
            input.schedulingMode === "appointment"
              ? "Appointments require a positive duration."
              : "Scheduled programs must not define an appointment duration.",
        },
      ],
    });
  }
};

const assertSchedulingModeChangeAllowed = async (
  offeringId: string,
  currentMode: "appointment" | "scheduled_program",
  nextMode: "appointment" | "scheduled_program",
) => {
  if (currentMode === nextMode) return;

  const dependencies = await findOfferingSchedulingDependencies(offeringId);
  const blocked =
    (nextMode === "scheduled_program" && dependencies.hasAppointmentTargets) ||
    (nextMode === "appointment" && dependencies.hasProgramTargets);

  if (blocked) {
    throw new AppError({
      code: "CONFLICT",
      message: "Scheduling mode cannot change while incompatible future bookings or events exist.",
      statusCode: httpStatus.conflict,
      details: [
        {
          field: "schedulingMode",
          message: "Archive or resolve the incompatible future schedule before changing modes.",
        },
      ],
    });
  }
};

const assertOfferingExists = async (offeringId: string) => {
  const offering = await findAdminOfferingById(offeringId);

  if (!offering) {
    throw notFoundError();
  }
};

const assertPriceAvailable = async (
  offeringId: string,
  countryCode: string,
  currency: string,
  excludeId?: string,
) => {
  const existingPrice = await findOfferingPriceByCountryCurrency(
    offeringId,
    countryCode,
    currency,
    excludeId,
  );

  if (existingPrice) {
    throw new AppError({
      code: "CONFLICT",
      message: "Offering price already exists for this country and currency.",
      statusCode: httpStatus.conflict,
      details: [
        {
          field: "countryCode",
          message: "Use a unique country/currency pair for each offering.",
        },
      ],
    });
  }
};

export const listAdminOfferings = async (filters: AdminOfferingFilters) => {
  const offerings = await findAdminOfferings(filters);
  return offerings.map(toAdminOffering);
};

export const listAdminOfferingCategories = async () => {
  const categories = await findAdminOfferingCategories();
  return categories.map(toAdminOfferingCategory);
};

export const getAdminOffering = async (id: string) => {
  const offering = await findAdminOfferingById(id);

  if (!offering) {
    throw notFoundError();
  }

  return toAdminOffering(offering);
};

export const listAdminOfferingPrices = async (offeringId: string) => {
  await assertOfferingExists(offeringId);
  const prices = await findAdminOfferingPricesByOfferingId(offeringId);
  return prices.map(toAdminOfferingPrice);
};

export const createAdminOffering = async (
  input: AdminOfferingInput,
  auditContext?: AuditContext,
) => {
  const slug = input.slug.toLowerCase();

  await assertCategoryExists(input.categoryId);
  await assertSlugAvailable(slug);
  assertSchedulingConfiguration(input);

  const offering = await insertAdminOffering({
    categoryId: input.categoryId ?? null,
    title: input.title.trim(),
    slug,
    shortDescription: toNullableText(input.shortDescription),
    longDescription: toNullableText(input.longDescription),
    offeringType: input.offeringType,
    attendanceMode: input.attendanceMode,
    bookingMode: input.bookingMode,
    schedulingMode: input.schedulingMode,
    durationMinutes: input.durationMinutes,
    bufferBeforeMinutes: input.bufferBeforeMinutes,
    bufferAfterMinutes: input.bufferAfterMinutes,
    capacity: input.capacity,
    requiresPayment: input.requiresPayment,
    quoteOnly: input.quoteOnly,
    sortOrder: input.sortOrder,
    displayConfig: input.displayConfig,
    status: input.status,
  });

  if (!offering) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Offering could not be created.",
      statusCode: httpStatus.internalServerError,
    });
  }

  const createdOffering = toAdminOffering(offering);

  await writeAuditLog(auditContext, {
    action: "admin.offerings.create",
    resourceType: "offering",
    resourceId: createdOffering.id,
    beforeSnapshot: null,
    afterSnapshot: createdOffering,
  });

  return createdOffering;
};

export const createAdminOfferingPrice = async (
  offeringId: string,
  input: AdminOfferingPriceInput,
  auditContext?: AuditContext,
) => {
  await assertOfferingExists(offeringId);

  const countryCode = toUpperCode(input.countryCode);
  const currency = toUpperCode(input.currency);
  const earlyBirdAmountMinor = input.earlyBirdAmountMinor ?? null;
  const earlyBirdEndsAt = toNullableDate(input.earlyBirdEndsAt) ?? null;

  await assertPriceAvailable(offeringId, countryCode, currency);
  validateEarlyBookingPrice(
    input.baseAmountMinor,
    earlyBirdAmountMinor,
    earlyBirdEndsAt,
  );

  const price = await insertAdminOfferingPrice({
    offeringId,
    countryCode,
    currency,
    baseAmountMinor: input.baseAmountMinor,
    earlyBirdAmountMinor,
    earlyBirdEndsAt,
    status: input.status,
  });

  if (!price) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Offering price could not be created.",
      statusCode: httpStatus.internalServerError,
    });
  }

  const createdPrice = toAdminOfferingPrice(price);

  await writeAuditLog(auditContext, {
    action: "admin.offering_prices.create",
    resourceType: "offering_price",
    resourceId: createdPrice.id,
    beforeSnapshot: null,
    afterSnapshot: createdPrice,
  });

  return createdPrice;
};

export const updateAdminOfferingById = async (
  id: string,
  input: AdminOfferingPatchInput,
  auditContext?: AuditContext,
) => {
  const existingOffering = await findAdminOfferingById(id);

  if (!existingOffering) {
    throw notFoundError();
  }

  if (input.categoryId !== undefined) {
    await assertCategoryExists(input.categoryId);
  }

  if (input.slug !== undefined) {
    await assertSlugAvailable(input.slug.toLowerCase(), id);
  }

  const nextSchedulingConfiguration = {
    schedulingMode: input.schedulingMode ?? existingOffering.schedulingMode,
    durationMinutes:
      input.durationMinutes !== undefined
        ? input.durationMinutes
        : existingOffering.durationMinutes,
    bufferBeforeMinutes:
      input.bufferBeforeMinutes ?? existingOffering.bufferBeforeMinutes,
    bufferAfterMinutes:
      input.bufferAfterMinutes ?? existingOffering.bufferAfterMinutes,
  };
  assertSchedulingConfiguration(nextSchedulingConfiguration);
  await assertSchedulingModeChangeAllowed(
    id,
    existingOffering.schedulingMode,
    nextSchedulingConfiguration.schedulingMode,
  );

  const updatePayload = removeUndefined<AdminOfferingUpdate>({
    categoryId: input.categoryId,
    title: input.title?.trim(),
    slug: input.slug?.toLowerCase(),
    shortDescription: toNullableText(input.shortDescription),
    longDescription: toNullableText(input.longDescription),
    offeringType: input.offeringType,
    attendanceMode: input.attendanceMode,
    bookingMode: input.bookingMode,
    schedulingMode: input.schedulingMode,
    durationMinutes: input.durationMinutes,
    bufferBeforeMinutes: input.bufferBeforeMinutes,
    bufferAfterMinutes: input.bufferAfterMinutes,
    capacity: input.capacity,
    requiresPayment: input.requiresPayment,
    quoteOnly: input.quoteOnly,
    sortOrder: input.sortOrder,
    displayConfig: input.displayConfig,
    status: input.status,
  });

  const beforeOffering = toAdminOffering(existingOffering);
  const updatedOffering = await updateAdminOffering(id, updatePayload);

  if (!updatedOffering) {
    throw notFoundError();
  }

  const afterOffering = toAdminOffering(updatedOffering);

  await writeAuditLog(auditContext, {
    action: "admin.offerings.update",
    resourceType: "offering",
    resourceId: afterOffering.id,
    beforeSnapshot: beforeOffering,
    afterSnapshot: afterOffering,
  });

  return afterOffering;
};

export const updateAdminOfferingPriceById = async (
  offeringId: string,
  priceId: string,
  input: AdminOfferingPricePatchInput,
  auditContext?: AuditContext,
) => {
  await assertOfferingExists(offeringId);

  const existingPrice = await findAdminOfferingPriceById(offeringId, priceId);

  if (!existingPrice) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering price was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const countryCode =
    input.countryCode !== undefined ? toUpperCode(input.countryCode) : existingPrice.countryCode;
  const currency =
    input.currency !== undefined ? toUpperCode(input.currency) : existingPrice.currency;

  if (input.countryCode !== undefined || input.currency !== undefined) {
    await assertPriceAvailable(offeringId, countryCode, currency, priceId);
  }

  const baseAmountMinor = input.baseAmountMinor ?? existingPrice.baseAmountMinor;
  const earlyBirdAmountMinor =
    input.earlyBirdAmountMinor !== undefined
      ? input.earlyBirdAmountMinor
      : existingPrice.earlyBirdAmountMinor;
  const earlyBirdEndsAt =
    input.earlyBirdEndsAt !== undefined
      ? toNullableDate(input.earlyBirdEndsAt) ?? null
      : existingPrice.earlyBirdEndsAt;
  validateEarlyBookingPrice(baseAmountMinor, earlyBirdAmountMinor, earlyBirdEndsAt);

  const updatePayload = removeUndefined<AdminOfferingPriceUpdate>({
    countryCode: input.countryCode !== undefined ? countryCode : undefined,
    currency: input.currency !== undefined ? currency : undefined,
    baseAmountMinor: input.baseAmountMinor,
    earlyBirdAmountMinor: input.earlyBirdAmountMinor,
    earlyBirdEndsAt:
      input.earlyBirdEndsAt === undefined ? undefined : earlyBirdEndsAt,
    status: input.status,
  });

  const beforePrice = toAdminOfferingPrice(existingPrice);
  const updatedPrice = await updateAdminOfferingPrice(offeringId, priceId, updatePayload);

  if (!updatedPrice) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering price was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const afterPrice = toAdminOfferingPrice(updatedPrice);

  await writeAuditLog(auditContext, {
    action: "admin.offering_prices.update",
    resourceType: "offering_price",
    resourceId: afterPrice.id,
    beforeSnapshot: beforePrice,
    afterSnapshot: afterPrice,
  });

  return afterPrice;
};

export const archiveAdminOfferingById = async (
  id: string,
  auditContext?: AuditContext,
) => {
  const existingOffering = await findAdminOfferingById(id);

  if (!existingOffering) {
    throw notFoundError();
  }

  const beforeOffering = toAdminOffering(existingOffering);
  const archivedOffering = await archiveAdminOffering(id);

  if (!archivedOffering) {
    throw notFoundError();
  }

  const afterOffering = await getAdminOffering(id);

  await writeAuditLog(auditContext, {
    action: "admin.offerings.archive",
    resourceType: "offering",
    resourceId: id,
    beforeSnapshot: beforeOffering,
    afterSnapshot: afterOffering,
  });
};

export const archiveAdminOfferingPriceById = async (
  offeringId: string,
  priceId: string,
  auditContext?: AuditContext,
) => {
  await assertOfferingExists(offeringId);
  const existingPrice = await findAdminOfferingPriceById(offeringId, priceId);

  if (!existingPrice) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering price was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const beforePrice = toAdminOfferingPrice(existingPrice);
  const archivedPrice = await archiveAdminOfferingPrice(offeringId, priceId);

  if (!archivedPrice) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering price was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  const afterPrice = await findAdminOfferingPriceById(offeringId, priceId);

  await writeAuditLog(auditContext, {
    action: "admin.offering_prices.archive",
    resourceType: "offering_price",
    resourceId: priceId,
    beforeSnapshot: beforePrice,
    afterSnapshot: afterPrice ? toAdminOfferingPrice(afterPrice) : null,
  });
};
