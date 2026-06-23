import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../middleware/validate-request.js";
import { requireAdmin } from "../../middleware/require-admin.js";
import { authLoginRateLimit } from "../../middleware/rate-limit.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  adminSessionCookieName,
  adminSessionCookieOptions,
} from "./auth.constants.js";
import { loginAdmin, logoutAdmin } from "./auth.service.js";

export const adminAuthRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

adminAuthRouter.post(
  "/login",
  authLoginRateLimit,
  validateRequest({ body: loginSchema }),
  async (req, res, next) => {
    try {
      const result = await loginAdmin({
        email: req.body.email,
        password: req.body.password,
        ipAddress: req.ip,
        userAgent: req.header("user-agent"),
      });

      res.cookie(adminSessionCookieName, result.sessionToken, adminSessionCookieOptions);
      res.status(httpStatus.ok).json({
        data: {
          admin: result.admin,
          expiresAt: result.expiresAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

adminAuthRouter.post("/logout", async (req, res, next) => {
  try {
    const sessionToken = req.cookies?.[adminSessionCookieName] as string | undefined;
    await logoutAdmin(sessionToken);

    res.clearCookie(adminSessionCookieName, {
      ...adminSessionCookieOptions,
      maxAge: undefined,
    });
    res.status(httpStatus.noContent).send();
  } catch (error) {
    next(error);
  }
});

adminAuthRouter.get("/me", requireAdmin, (req, res) => {
  res.status(httpStatus.ok).json({
    data: {
      admin: req.admin,
    },
  });
});
