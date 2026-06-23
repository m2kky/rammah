import { AppError } from "../../shared/errors/app-error.js";
import { httpStatus } from "../../shared/http/status.js";
import { writeAuditLog, type AuditContext } from "../audit/audit.service.js";
import {
  archiveAdminBookingFormField,
  findAdminBookingFormFieldById,
  findAdminBookingFormFields,
  findBookingFormFieldKeyConflict,
  findOfferingExistsById,
  findPublicBookingFormFieldsByOfferingId,
  insertAdminBookingFormField,
  updateAdminBookingFormField,
  type AdminBookingFormFieldFilters,
  type AdminBookingFormFieldRow,
  type BookingFormFieldInsert,
  type BookingFormFieldUpdate,
  type ContentStatus,
  type PublicBookingFormFieldRow,
} from "./booking-form-fields.repository.js";

export type FieldType =
  | "text"
  | "email"
  | "phone"
  | "textarea"
  | "date"
  | "select"
  | "checkbox"
  | "number";

export type BookingFormFieldInput = {
  offeringId?: string | null;
  fieldKey: string;
  label: string;
  fieldType: FieldType;
  required: boolean;
  options: Array<{ label: string; value: string }>;
  validationRules: Record<string, unknown>;
  sortOrder: number;
  status: ContentStatus;
};

export type BookingFormFieldPatchInput = Partial<BookingFormFieldInput>;

export type PublicBookingAnswerInput = {
  fieldId?: string | null;
  fieldKey: string;
  label: string;
  value?: string | null;
};

const normalizeText = (value: string | null | undefined) => {
  if (value === undefined || value === null) return "";
  return value.trim();
};

const toPublicBookingFormField = (field: PublicBookingFormFieldRow) => ({
  id: field.id,
  fieldKey: field.fieldKey,
  label: field.label,
  fieldType: field.fieldType,
  required: field.required,
  options: field.options,
  validationRules: field.validationRules,
  sortOrder: field.sortOrder,
});

const toAdminBookingFormField = (field: AdminBookingFormFieldRow) => ({
  id: field.id,
  offering: field.offeringId
    ? {
        id: field.offeringId,
        title: field.offeringTitle ?? "",
        slug: field.offeringSlug ?? "",
      }
    : null,
  fieldKey: field.fieldKey,
  label: field.label,
  fieldType: field.fieldType,
  required: field.required,
  options: field.options,
  validationRules: field.validationRules,
  sortOrder: field.sortOrder,
  status: field.status,
  createdAt: field.createdAt.toISOString(),
  updatedAt: field.updatedAt.toISOString(),
});

const normalizeFieldKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeOptions = (options: Array<{ label: string; value: string }>) =>
  options
    .map((option) => ({
      label: option.label.trim(),
      value: normalizeFieldKey(option.value || option.label),
    }))
    .filter((option) => option.label && option.value);

const normalizeNullableId = (value: string | null | undefined) => value || null;

const removeUndefined = <T extends Record<string, unknown>>(input: T) =>
  Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;

const notFoundError = () =>
  new AppError({
    code: "NOT_FOUND",
    message: "Booking form field was not found.",
    statusCode: httpStatus.notFound,
  });

const assertOfferingExists = async (offeringId: string | null) => {
  if (!offeringId) return;

  const exists = await findOfferingExistsById(offeringId);

  if (!exists) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Offering was not found.",
      statusCode: httpStatus.notFound,
    });
  }
};

const assertFieldKeyAvailable = async (
  offeringId: string | null,
  fieldKey: string,
  excludeId?: string,
) => {
  const conflict = await findBookingFormFieldKeyConflict(offeringId, fieldKey, excludeId);

  if (conflict) {
    throw new AppError({
      code: "CONFLICT",
      message: "A booking form field with this key already exists for this offering.",
      statusCode: httpStatus.conflict,
    });
  }
};

const validateOptionsForFieldType = (
  fieldType: FieldType,
  options: Array<{ label: string; value: string }>,
) => {
  if (fieldType === "select" && options.length === 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Select fields require at least one option.",
      statusCode: httpStatus.badRequest,
      details: [{ field: "options", message: "Add at least one option." }],
    });
  }
};

export const listAdminBookingFormFields = async (filters: AdminBookingFormFieldFilters = {}) => {
  const fields = await findAdminBookingFormFields(filters);
  return fields.map(toAdminBookingFormField);
};

export const getAdminBookingFormField = async (id: string) => {
  const field = await findAdminBookingFormFieldById(id);

  if (!field) {
    throw notFoundError();
  }

  return toAdminBookingFormField(field);
};

export const createAdminBookingFormField = async (
  input: BookingFormFieldInput,
  auditContext?: AuditContext,
) => {
  const offeringId = normalizeNullableId(input.offeringId);
  const fieldKey = normalizeFieldKey(input.fieldKey);
  const options = normalizeOptions(input.options);

  validateOptionsForFieldType(input.fieldType, options);
  await assertOfferingExists(offeringId);
  await assertFieldKeyAvailable(offeringId, fieldKey);

  const createdField = await insertAdminBookingFormField({
    offeringId,
    fieldKey,
    label: input.label.trim(),
    fieldType: input.fieldType,
    required: input.required,
    options,
    validationRules: input.validationRules,
    sortOrder: input.sortOrder,
    status: input.status,
  });

  if (!createdField) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      message: "Booking form field could not be created.",
      statusCode: httpStatus.internalServerError,
    });
  }

  const afterField = toAdminBookingFormField(createdField);

  await writeAuditLog(auditContext, {
    action: "admin.booking_form_fields.create",
    resourceType: "booking_form_field",
    resourceId: afterField.id,
    beforeSnapshot: null,
    afterSnapshot: afterField,
  });

  return afterField;
};

export const updateAdminBookingFormFieldById = async (
  id: string,
  input: BookingFormFieldPatchInput,
  auditContext?: AuditContext,
) => {
  const existingField = await findAdminBookingFormFieldById(id);

  if (!existingField) {
    throw notFoundError();
  }

  const beforeField = toAdminBookingFormField(existingField);
  const offeringId =
    input.offeringId !== undefined
      ? normalizeNullableId(input.offeringId)
      : existingField.offeringId;
  const fieldKey =
    input.fieldKey !== undefined ? normalizeFieldKey(input.fieldKey) : existingField.fieldKey;
  const fieldType = input.fieldType ?? existingField.fieldType;
  const options =
    input.options !== undefined ? normalizeOptions(input.options) : existingField.options;

  validateOptionsForFieldType(fieldType, options);

  if (input.offeringId !== undefined) {
    await assertOfferingExists(offeringId);
  }

  if (input.offeringId !== undefined || input.fieldKey !== undefined) {
    await assertFieldKeyAvailable(offeringId, fieldKey, id);
  }

  const updatePayload = removeUndefined<BookingFormFieldUpdate>({
    offeringId: input.offeringId !== undefined ? offeringId : undefined,
    fieldKey: input.fieldKey !== undefined ? fieldKey : undefined,
    label: input.label?.trim(),
    fieldType: input.fieldType,
    required: input.required,
    options: input.options !== undefined ? options : undefined,
    validationRules: input.validationRules,
    sortOrder: input.sortOrder,
    status: input.status,
  });
  const updatedField = await updateAdminBookingFormField(id, updatePayload);

  if (!updatedField) {
    throw notFoundError();
  }

  const afterField = toAdminBookingFormField(updatedField);

  await writeAuditLog(auditContext, {
    action: "admin.booking_form_fields.update",
    resourceType: "booking_form_field",
    resourceId: afterField.id,
    beforeSnapshot: beforeField,
    afterSnapshot: afterField,
  });

  return afterField;
};

export const archiveAdminBookingFormFieldById = async (
  id: string,
  auditContext?: AuditContext,
) => {
  const existingField = await findAdminBookingFormFieldById(id);

  if (!existingField) {
    throw notFoundError();
  }

  const beforeField = toAdminBookingFormField(existingField);
  const archivedField = await archiveAdminBookingFormField(id);

  if (!archivedField) {
    throw notFoundError();
  }

  const afterField = toAdminBookingFormField(archivedField);

  await writeAuditLog(auditContext, {
    action: "admin.booking_form_fields.archive",
    resourceType: "booking_form_field",
    resourceId: afterField.id,
    beforeSnapshot: beforeField,
    afterSnapshot: afterField,
  });
};

export const listPublicBookingFormFields = async (offeringId: string) => {
  const fields = await findPublicBookingFormFieldsByOfferingId(offeringId);
  return fields.map(toPublicBookingFormField);
};

type PublicBookingFormField = Awaited<
  ReturnType<typeof listPublicBookingFormFields>
>[number];

const getAnswerValue = (
  field: PublicBookingFormField,
  answersById: Map<string, PublicBookingAnswerInput>,
  answersByKey: Map<string, PublicBookingAnswerInput>,
) => {
  const answer = answersById.get(field.id) ?? answersByKey.get(field.fieldKey);
  return normalizeText(answer?.value);
};

const validateFieldValue = (
  field: PublicBookingFormField,
  value: string,
  details: Array<{ field?: string; message: string }>,
) => {
  if (!value) {
    if (field.required) {
      details.push({
        field: field.fieldKey,
        message: `${field.label} is required.`,
      });
    }

    return;
  }

  if (field.fieldType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    details.push({ field: field.fieldKey, message: `${field.label} must be a valid email.` });
  }

  if (field.fieldType === "number" && Number.isNaN(Number(value))) {
    details.push({ field: field.fieldKey, message: `${field.label} must be a number.` });
  }

  if (field.fieldType === "date" && Number.isNaN(new Date(`${value}T00:00:00`).getTime())) {
    details.push({ field: field.fieldKey, message: `${field.label} must be a valid date.` });
  }

  if (field.fieldType === "select") {
    const allowedValues = new Set(field.options.map((option) => option.value));

    if (allowedValues.size > 0 && !allowedValues.has(value)) {
      details.push({ field: field.fieldKey, message: `${field.label} is not a valid option.` });
    }
  }

  if (field.fieldType === "checkbox") {
    const values = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const allowedValues = new Set(field.options.map((option) => option.value));

    if (allowedValues.size > 0 && values.some((item) => !allowedValues.has(item))) {
      details.push({ field: field.fieldKey, message: `${field.label} contains an invalid option.` });
    }

    if (allowedValues.size === 0 && !["true", "false"].includes(value)) {
      details.push({ field: field.fieldKey, message: `${field.label} must be true or false.` });
    }
  }
};

export const validateAndNormalizeBookingAnswers = (
  fields: PublicBookingFormField[],
  answers: PublicBookingAnswerInput[],
) => {
  const details: Array<{ field?: string; message: string }> = [];
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const fieldsByKey = new Map(fields.map((field) => [field.fieldKey, field]));
  const answersById = new Map<string, PublicBookingAnswerInput>();
  const answersByKey = new Map<string, PublicBookingAnswerInput>();

  answers.forEach((answer, index) => {
    if (answer.fieldId) {
      answersById.set(answer.fieldId, answer);
    }

    answersByKey.set(answer.fieldKey, answer);

    const field = (answer.fieldId ? fieldsById.get(answer.fieldId) : undefined) ?? fieldsByKey.get(answer.fieldKey);

    if (!field) {
      details.push({
        field: `answers.${index}`,
        message: "Unknown booking form field.",
      });
    }
  });

  for (const field of fields) {
    validateFieldValue(field, getAnswerValue(field, answersById, answersByKey), details);
  }

  if (details.length > 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Booking answers are invalid.",
      statusCode: httpStatus.badRequest,
      details,
    });
  }

  return answers
    .map((answer) => {
      const field =
        (answer.fieldId ? fieldsById.get(answer.fieldId) : undefined) ??
        fieldsByKey.get(answer.fieldKey);
      const value = normalizeText(answer.value);

      if (!field || !value) {
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
};
