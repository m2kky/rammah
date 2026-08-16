import { AppError } from "../../shared/errors/app-error.js";
import { env } from "../../config/env.js";
import { countryCatalog, isIsoCountryCode } from "../../shared/geo/countries.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import {
  archiveAdminOffering,
  archiveAdminOfferingPriceGroup,
  findAdminOfferingCategories,
  findAdminOfferingById,
  findAdminOfferingPriceById,
  findAdminOfferingPricesByOfferingId,
  findAdminOfferings,
  findOfferingSchedulingDependencies,
  findOfferingBySlug,
  findOfferingCategoryById,
  insertAdminOfferingPriceGroup,
  insertAdminOffering,
  updateAdminOffering,
  updateAdminOfferingPriceGroup,
  type AdminOfferingFilters,
  type AdminOfferingCategoryRow,
  type AdminOfferingInsert,
  type AdminOfferingPriceGroupWrite,
  type AdminOfferingPriceRow,
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
  name?: string;
  countryCodes?: string[];
  countryCode?: string;
  currency: string;
  baseAmountMinor: number;
  earlyBirdAmountMinor?: number | null;
  earlyBirdEndsAt?: string | null;
  status: "draft" | "published";
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
  name: price.name,
  countryCodes: price.countryCodes,
  currency: price.currency,
  baseAmountMinor: price.baseAmountMinor,
  earlyBirdAmountMinor: price.earlyBirdAmountMinor,
  earlyBirdEndsAt: price.earlyBirdEndsAt?.toISOString() ?? null,
  status: price.status,
  createdAt: price.createdAt.toISOString(),
  updatedAt: price.updatedAt.toISOString(),
});

const toUpperCode = (value: string) => value.trim().toUpperCase();

const countryNamesByCode = new Map<string, string>(
  countryCatalog.map(({ code, name }) => [code, name]),
);

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

export const validatePublishedPaidPrice = (
  baseAmountMinor: number,
  status: "draft" | "published",
  offering: Pick<AdminOfferingRow, "bookingMode" | "requiresPayment">,
) => {
  if (
    status === "published" &&
    baseAmountMinor === 0 &&
    (offering.bookingMode === "paid" || offering.requiresPayment)
  ) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Published paid prices must be greater than zero.",
      statusCode: httpStatus.badRequest,
      details: [{
        field: "baseAmountMinor",
        message: "Enter an amount greater than zero before publishing.",
      }],
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

  return offering;
};

export const assertAdminPriceWritesEnabled = (
  enabled = env.ADMIN_PRICE_WRITES_ENABLED,
) => {
  if (!enabled) {
    throw new AppError({
      code: "SERVICE_UNAVAILABLE",
      message: "Price editing is temporarily paused for maintenance.",
      statusCode: httpStatus.serviceUnavailable,
    });
  }
};

type RawAdminOfferingPriceInput = Omit<
  Partial<AdminOfferingPriceInput>,
  "status"
> & {
  currency?: string;
  baseAmountMinor?: number;
  status?: string;
};

export const normalizeAdminOfferingPriceInput = (
  input: RawAdminOfferingPriceInput,
  supportedCurrencies: readonly string[] = env.PAYMENT_SUPPORTED_CURRENCIES,
): AdminOfferingPriceGroupWrite => {
  if (input.countryCode !== undefined && input.countryCodes !== undefined) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Use countryCodes or the legacy countryCode field, not both.",
      statusCode: httpStatus.badRequest,
      details: [{ field: "countryCodes", message: "Remove one of the country fields." }],
    });
  }

  const requestedCountries = input.countryCodes ??
    (input.countryCode !== undefined ? [input.countryCode] : []);
  const countryCodes = [...new Set(requestedCountries.map(toUpperCode))].sort();
  const invalidCountryCodes = countryCodes.filter((code) => !isIsoCountryCode(code));
  if (countryCodes.length === 0 || invalidCountryCodes.length > 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Select at least one valid ISO country.",
      statusCode: httpStatus.badRequest,
      details: [{
        field: "countryCodes",
        message: invalidCountryCodes.length > 0
          ? `Unsupported country codes: ${invalidCountryCodes.join(", ")}.`
          : "Select at least one country.",
      }],
    });
  }

  const currency = input.currency ? toUpperCode(input.currency) : "";
  if (!supportedCurrencies.includes(currency)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Currency is not enabled for this payment account.",
      statusCode: httpStatus.badRequest,
      details: [{ field: "currency", message: "Choose a supported currency." }],
    });
  }
  if (input.status !== "draft" && input.status !== "published") {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Price groups can only be draft or published.",
      statusCode: httpStatus.badRequest,
      details: [{ field: "status", message: "Use draft or published; archive separately." }],
    });
  }
  if (!Number.isInteger(input.baseAmountMinor) || (input.baseAmountMinor ?? -1) < 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Standard price must be a non-negative integer.",
      statusCode: httpStatus.badRequest,
      details: [{ field: "baseAmountMinor", message: "Enter a valid minor-unit amount." }],
    });
  }

  const name = input.name?.trim() ||
    (countryCodes.length === 1 ? countryNamesByCode.get(countryCodes[0]!) : undefined);
  if (!name || name.length > 120) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Price group name is required.",
      statusCode: httpStatus.badRequest,
      details: [{ field: "name", message: "Enter a group name up to 120 characters." }],
    });
  }

  const earlyBirdAmountMinor = input.earlyBirdAmountMinor ?? null;
  const earlyBirdEndsAt = toNullableDate(input.earlyBirdEndsAt) ?? null;
  validateEarlyBookingPrice(input.baseAmountMinor!, earlyBirdAmountMinor, earlyBirdEndsAt);
  if (input.status === "published" && earlyBirdAmountMinor !== null && earlyBirdAmountMinor <= 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Published early-booking prices must be greater than zero.",
      statusCode: httpStatus.badRequest,
      details: [{
        field: "earlyBirdAmountMinor",
        message: "Enter an amount greater than zero before publishing.",
      }],
    });
  }

  return {
    name,
    countryCodes,
    countryCode: countryCodes[0]!,
    currency,
    baseAmountMinor: input.baseAmountMinor!,
    earlyBirdAmountMinor,
    earlyBirdEndsAt,
    status: input.status,
  };
};

export const getAdminOfferingPriceMetadata = () => ({
  supportedCurrencies: [...env.PAYMENT_SUPPORTED_CURRENCIES],
  countries: countryCatalog,
});

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
  assertAdminPriceWritesEnabled();
  const offering = await assertOfferingExists(offeringId);
  const normalized = normalizeAdminOfferingPriceInput(input);
  validatePublishedPaidPrice(normalized.baseAmountMinor, normalized.status, offering);
  const price = await insertAdminOfferingPriceGroup(offeringId, normalized, auditContext);

  if (!price) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Offering price could not be created.",
      statusCode: httpStatus.internalServerError,
    });
  }

  return toAdminOfferingPrice(price);
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
  assertAdminPriceWritesEnabled();
  const offering = await assertOfferingExists(offeringId);

  const existingPrice = await findAdminOfferingPriceById(offeringId, priceId);

  if (!existingPrice) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering price was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (existingPrice.status !== "draft" && existingPrice.status !== "published") {
    throw new AppError({
      code: "CONFLICT",
      message: "Archived price groups are read-only and cannot be restored.",
      statusCode: httpStatus.conflict,
    });
  }

  const suppliedCountries = input.countryCodes !== undefined || input.countryCode !== undefined;
  const normalized = normalizeAdminOfferingPriceInput({
    name: input.name ?? existingPrice.name,
    ...(suppliedCountries
      ? { countryCodes: input.countryCodes, countryCode: input.countryCode }
      : { countryCodes: existingPrice.countryCodes }),
    currency: input.currency ?? existingPrice.currency,
    baseAmountMinor: input.baseAmountMinor ?? existingPrice.baseAmountMinor,
    earlyBirdAmountMinor:
      input.earlyBirdAmountMinor !== undefined
        ? input.earlyBirdAmountMinor
        : existingPrice.earlyBirdAmountMinor,
    earlyBirdEndsAt:
      input.earlyBirdEndsAt !== undefined
        ? input.earlyBirdEndsAt
        : existingPrice.earlyBirdEndsAt?.toISOString() ?? null,
    status: input.status ?? existingPrice.status,
  });
  validatePublishedPaidPrice(normalized.baseAmountMinor, normalized.status, offering);

  const updatedPrice = await updateAdminOfferingPriceGroup(
    offeringId,
    priceId,
    normalized,
    auditContext,
  );

  if (!updatedPrice) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering price was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  return toAdminOfferingPrice(updatedPrice);
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
  assertAdminPriceWritesEnabled();
  await assertOfferingExists(offeringId);
  const existingPrice = await findAdminOfferingPriceById(offeringId, priceId);

  if (!existingPrice) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering price was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  if (existingPrice.status === "archived") {
    throw new AppError({
      code: "CONFLICT",
      message: "Archived price groups are read-only and cannot be restored.",
      statusCode: httpStatus.conflict,
    });
  }

  const archivedPrice = await archiveAdminOfferingPriceGroup(
    offeringId,
    priceId,
    auditContext,
  );

  if (!archivedPrice) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering price was not found.",
      statusCode: httpStatus.notFound,
    });
  }

  return toAdminOfferingPrice(archivedPrice);
};
