import { httpStatus } from "../http/status.js";

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SCHEDULE_CONFLICT"
  | "INVALID_MEDIA_SLOT"
  | "MEDIA_KIND_MISMATCH"
  | "MEDIA_IN_USE"
  | "MEDIA_UPLOAD_INVALID"
  | "CMS_PUBLICATION_INVALID"
  | "SLOT_CARDINALITY_EXCEEDED"
  | "SLOT_UNAVAILABLE"
  | "PROGRAM_FULL"
  | "PRICE_CHANGED"
  | "PRICE_COUNTRY_CONFLICT"
  | "COUNTRY_PRICE_UNAVAILABLE"
  | "PAYMENT_REQUIRED"
  | "PAYMENT_FAILED"
  | "PAYMENT_ATTEMPT_CLOSED"
  | "PROVIDER_ERROR"
  | "CONFIGURATION_ERROR"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type AppErrorDetail = {
  field?: string;
  message: string;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;
  readonly details: AppErrorDetail[];
  readonly meta?: Record<string, unknown>;
  readonly expose: boolean;

  constructor(input: {
    code: AppErrorCode;
    message: string;
    statusCode?: number;
    details?: AppErrorDetail[];
    meta?: Record<string, unknown>;
    expose?: boolean;
  }) {
    super(input.message);
    this.name = "AppError";
    this.code = input.code;
    this.statusCode = input.statusCode ?? httpStatus.internalServerError;
    this.details = input.details ?? [];
    this.meta = input.meta;
    this.expose = input.expose ?? this.statusCode < 500;
  }
}
