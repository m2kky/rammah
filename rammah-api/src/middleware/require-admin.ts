import type { NextFunction, Request, Response } from "express";
import { getAdminFromSession } from "../modules/auth/auth.service.js";
import { adminSessionCookieName } from "../modules/auth/auth.constants.js";
import type { AuthenticatedAdmin } from "../modules/auth/auth.types.js";
import { AppError } from "../shared/errors/app-error.js";
import { httpStatus } from "../shared/http/status.js";

declare global {
  namespace Express {
    interface Request {
      admin?: AuthenticatedAdmin;
    }
  }
}

export const requireAdmin = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const sessionToken = req.cookies?.[adminSessionCookieName] as string | undefined;
    const admin = await getAdminFromSession(sessionToken);

    if (!admin) {
      throw new AppError({
        code: "AUTH_REQUIRED",
        message: "Admin authentication is required.",
        statusCode: httpStatus.unauthorized,
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    next(error);
  }
};
