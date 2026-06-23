import type { Request, Response } from "express";
import { httpStatus } from "../shared/http/status.js";

export const notFoundMiddleware = (req: Request, res: Response) => {
  res.status(httpStatus.notFound).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.originalUrl} was not found.`,
      details: [],
      requestId: req.requestId,
    },
  });
};
