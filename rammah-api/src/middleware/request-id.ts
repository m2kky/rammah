import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const incomingRequestId = req.header("x-request-id");
  req.requestId = incomingRequestId || crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
};
