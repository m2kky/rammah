import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../shared/errors/app-error.js";
import { httpStatus } from "../shared/http/status.js";
import { logger } from "../shared/logger/logger.js";

const isMalformedJsonError = (
  error: unknown,
): error is SyntaxError & { status: number; type: string } =>
  error instanceof SyntaxError &&
  "status" in error &&
  "type" in error &&
  (error as { status?: number; type?: string }).status === httpStatus.badRequest &&
  (error as { status?: number; type?: string }).type === "entity.parse.failed";

export const errorHandlerMiddleware: ErrorRequestHandler = (error, req, res, _next) => {
  if (isMalformedJsonError(error)) {
    res.status(httpStatus.badRequest).json({
      error: {
        code: "INVALID_JSON",
        message: "Request body contains malformed JSON.",
        details: [],
        requestId: req.requestId,
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(httpStatus.badRequest).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Some fields are invalid.",
        details: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
        requestId: req.requestId,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error(error.message, {
        code: error.code,
        requestId: req.requestId,
        stack: error.stack,
      });
    }

    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.expose ? error.message : "Unexpected server error.",
        details: error.details,
        requestId: req.requestId,
      },
    });
    return;
  }

  logger.error("Unexpected server error", {
    requestId: req.requestId,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(httpStatus.internalServerError).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error.",
      details: [],
      requestId: req.requestId,
    },
  });
};
