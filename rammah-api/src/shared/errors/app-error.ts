import { httpStatus } from "../http/status.js";

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SCHEDULE_CONFLICT"
  | "SLOT_UNAVAILABLE"
  | "PROGRAM_FULL"
  | "PRICE_CHANGED"
  | "PAYMENT_REQUIRED"
  | "PAYMENT_FAILED"
  | "PAYMENT_ATTEMPT_CLOSED"
  | "PROVIDER_ERROR"
  | "CONFIGURATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type AppErrorDetail = {
  field?: string;
  message: string;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;
  readonly details: AppErrorDetail[];
  readonly expose: boolean;

  constructor(input: {
    code: AppErrorCode;
    message: string;
    statusCode?: number;
    details?: AppErrorDetail[];
    expose?: boolean;
  }) {
    super(input.message);
    this.name = "AppError";
    this.code = input.code;
    this.statusCode = input.statusCode ?? httpStatus.internalServerError;
    this.details = input.details ?? [];
    this.expose = input.expose ?? this.statusCode < 500;
  }
}
