import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import {
  archiveAdminLocation,
  findAdminLocationById,
  findAdminLocations,
  insertAdminLocation,
  updateAdminLocation,
  type AdminLocationFilters,
  type AdminLocationInsert,
  type AdminLocationRow,
  type AdminLocationUpdate,
} from "./admin-locations.repository.js";

export type AdminLocationInput = {
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city?: string | null;
  countryCode: string;
  mapUrl?: string | null;
  instructions?: string | null;
  status: AdminLocationInsert["status"];
};

export type AdminLocationPatchInput = Partial<AdminLocationInput>;

const removeUndefined = <T extends Record<string, unknown>>(input: T) =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

const notFoundError = () =>
  new AppError({
    code: "NOT_FOUND",
    message: "Location was not found.",
    statusCode: httpStatus.notFound,
  });

const normalizeRequiredText = (value: string) => value.trim();

const normalizeOptionalText = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = value.trim();
  return normalized ? normalized : null;
};

const normalizeCountryCode = (value: string) => value.trim().toUpperCase();

const toAdminLocation = (location: AdminLocationRow) => ({
  id: location.id,
  name: location.name,
  addressLine1: location.addressLine1,
  addressLine2: location.addressLine2,
  city: location.city,
  countryCode: location.countryCode,
  mapUrl: location.mapUrl,
  instructions: location.instructions,
  status: location.status,
  createdAt: location.createdAt.toISOString(),
  updatedAt: location.updatedAt.toISOString(),
});

export const listAdminLocations = async (filters: AdminLocationFilters) => {
  const locations = await findAdminLocations({
    ...filters,
    search: filters.search?.trim() || undefined,
  });

  return locations.map(toAdminLocation);
};

export const getAdminLocation = async (id: string) => {
  const location = await findAdminLocationById(id);

  if (!location) {
    throw notFoundError();
  }

  return toAdminLocation(location);
};

export const createAdminLocation = async (
  input: AdminLocationInput,
  auditContext?: AuditContext,
) => {
  const location = await insertAdminLocation({
    name: normalizeRequiredText(input.name),
    addressLine1: normalizeRequiredText(input.addressLine1),
    addressLine2: normalizeOptionalText(input.addressLine2) ?? null,
    city: normalizeOptionalText(input.city) ?? null,
    countryCode: normalizeCountryCode(input.countryCode),
    mapUrl: normalizeOptionalText(input.mapUrl) ?? null,
    instructions: normalizeOptionalText(input.instructions) ?? null,
    status: input.status,
  });

  if (!location) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Location could not be created.",
      statusCode: httpStatus.internalServerError,
    });
  }

  const createdLocation = toAdminLocation(location);

  await writeAuditLog(auditContext, {
    action: "admin.locations.create",
    resourceType: "offline_location",
    resourceId: createdLocation.id,
    beforeSnapshot: null,
    afterSnapshot: createdLocation,
  });

  return createdLocation;
};

export const updateAdminLocationById = async (
  id: string,
  input: AdminLocationPatchInput,
  auditContext?: AuditContext,
) => {
  const existingLocation = await findAdminLocationById(id);

  if (!existingLocation) {
    throw notFoundError();
  }

  const beforeLocation = toAdminLocation(existingLocation);
  const updatePayload = removeUndefined<AdminLocationUpdate>({
    name: input.name !== undefined ? normalizeRequiredText(input.name) : undefined,
    addressLine1:
      input.addressLine1 !== undefined
        ? normalizeRequiredText(input.addressLine1)
        : undefined,
    addressLine2: normalizeOptionalText(input.addressLine2),
    city: normalizeOptionalText(input.city),
    countryCode:
      input.countryCode !== undefined ? normalizeCountryCode(input.countryCode) : undefined,
    mapUrl: normalizeOptionalText(input.mapUrl),
    instructions: normalizeOptionalText(input.instructions),
    status: input.status,
  });

  const updatedLocation = await updateAdminLocation(id, updatePayload);

  if (!updatedLocation) {
    throw notFoundError();
  }

  const afterLocation = toAdminLocation(updatedLocation);

  await writeAuditLog(auditContext, {
    action: "admin.locations.update",
    resourceType: "offline_location",
    resourceId: afterLocation.id,
    beforeSnapshot: beforeLocation,
    afterSnapshot: afterLocation,
  });

  return afterLocation;
};

export const archiveAdminLocationById = async (
  id: string,
  auditContext?: AuditContext,
) => {
  const existingLocation = await findAdminLocationById(id);

  if (!existingLocation) {
    throw notFoundError();
  }

  const beforeLocation = toAdminLocation(existingLocation);
  const archivedLocation = await archiveAdminLocation(id);

  if (!archivedLocation) {
    throw notFoundError();
  }

  const afterLocation = toAdminLocation(archivedLocation);

  await writeAuditLog(auditContext, {
    action: "admin.locations.archive",
    resourceType: "offline_location",
    resourceId: id,
    beforeSnapshot: beforeLocation,
    afterSnapshot: afterLocation,
  });
};
