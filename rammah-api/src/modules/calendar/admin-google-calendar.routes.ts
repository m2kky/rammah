import { Router, type Request } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/require-admin.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import {
  buildGoogleCalendarCallbackRedirectUrl,
  completeGoogleCalendarOAuth,
  getGoogleCalendarConnectUrl,
  getGoogleCalendarIntegrationStatus,
  updateGoogleCalendarSettings,
} from "./google-calendar.service.js";

export const adminGoogleCalendarRouter = Router();

const callbackQuerySchema = z.object({
  code: z.string().trim().min(1),
  state: z.string().trim().min(1),
});

const settingsBodySchema = z.object({
  calendarId: z.string().trim().min(1).max(255),
});

const getAdminUserId = (req: Request) => req.admin?.id as string;

adminGoogleCalendarRouter.use(requireAdmin);

adminGoogleCalendarRouter.get("/status", async (_req, res, next) => {
  try {
    const status = await getGoogleCalendarIntegrationStatus();

    res.status(httpStatus.ok).json({
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

adminGoogleCalendarRouter.get("/connect-url", (req, res, next) => {
  try {
    const url = getGoogleCalendarConnectUrl(getAdminUserId(req));

    res.status(httpStatus.ok).json({
      data: {
        url,
      },
    });
  } catch (error) {
    next(error);
  }
});

adminGoogleCalendarRouter.get(
  "/callback",
  validateRequest({ query: callbackQuerySchema }),
  async (req, res) => {
    try {
      await completeGoogleCalendarOAuth({
        code: req.query.code as string,
        state: req.query.state as string,
        adminUserId: getAdminUserId(req),
      });

      res.redirect(302, buildGoogleCalendarCallbackRedirectUrl("connected"));
    } catch {
      res.redirect(302, buildGoogleCalendarCallbackRedirectUrl("failed"));
    }
  },
);

adminGoogleCalendarRouter.patch(
  "/settings",
  validateRequest({ body: settingsBodySchema }),
  async (req, res, next) => {
    try {
      const settings = await updateGoogleCalendarSettings(req.body);

      res.status(httpStatus.ok).json({
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  },
);
