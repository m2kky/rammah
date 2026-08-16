import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import { trustedProxyPredicate } from "./config/env.js";
import helmet from "helmet";
import { env, frontendOrigins } from "./config/env.js";
import { errorHandlerMiddleware } from "./middleware/error-handler.js";
import { notFoundMiddleware } from "./middleware/not-found.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { adminAvailabilityOverridesRouter } from "./modules/availability/admin-availability-overrides.routes.js";
import { adminAvailabilitySlotsRouter } from "./modules/availability/admin-availability-slots.routes.js";
import { adminAvailabilityWindowsRouter } from "./modules/availability/admin-availability.routes.js";
import { adminBookingPolicyRouter } from "./modules/availability/admin-booking-policy.routes.js";
import { publicAvailabilitySlotsRouter } from "./modules/availability/public-availability-slots.routes.js";
import { slotHoldsRouter } from "./modules/availability/slot-holds.routes.js";
import { adminAuthRouter } from "./modules/auth/auth.routes.js";
import { adminBookingFormFieldsRouter } from "./modules/booking-form-fields/admin-booking-form-fields.routes.js";
import { adminBookingsRouter } from "./modules/bookings/admin-bookings.routes.js";
import { publicBookingsRouter } from "./modules/bookings/public-bookings.routes.js";
import { adminGoogleCalendarRouter } from "./modules/calendar/admin-google-calendar.routes.js";
import { adminCmsRouter } from "./modules/cms/admin-cms.routes.js";
import { mediaRouter } from "./modules/cms/media.routes.js";
import { publicCmsRouter } from "./modules/cms/public-cms.routes.js";
import { publicCountryRouter } from "./modules/country/public-country.routes.js";
import { adminEmailsRouter } from "./modules/emails/admin-emails.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { adminLocationsRouter } from "./modules/locations/admin-locations.routes.js";
import { adminOfferingsRouter } from "./modules/offerings/admin-offerings.routes.js";
import { openApiRouter } from "./modules/openapi/openapi.routes.js";
import { publicOfferingsRouter } from "./modules/offerings/offerings.routes.js";
import { adminPaymentsRouter } from "./modules/payments/admin-payments.routes.js";
import { paymentWebhooksRouter, publicPaymentsRouter } from "./modules/payments/public-payments.routes.js";
import { publicPricePreviewRouter } from "./modules/pricing/public-price-preview.routes.js";
import { adminProgramsRouter } from "./modules/programs/admin-programs.routes.js";
import { publicProgramsRouter } from "./modules/programs/public-programs.routes.js";
import { adminQuoteRequestsRouter } from "./modules/quote-requests/admin-quote-requests.routes.js";
import { publicQuoteRequestsRouter } from "./modules/quote-requests/public-quote-requests.routes.js";
import { adminSessionsRouter } from "./modules/sessions/admin-sessions.routes.js";
import { publicSessionsRouter } from "./modules/sessions/public-sessions.routes.js";

export const createApp = () => {
  const app = express();

  app.set("trust proxy", trustedProxyPredicate);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: frontendOrigins,
      credentials: true,
    }),
  );
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use(`${env.API_BASE_PATH}`, openApiRouter);
  app.use(`${env.API_BASE_PATH}/health`, healthRouter);
  app.use(`${env.API_BASE_PATH}/public/country`, publicCountryRouter);
  app.use(`${env.API_BASE_PATH}/public/offerings`, publicOfferingsRouter);
  app.use(`${env.API_BASE_PATH}/public/availability-slots`, publicAvailabilitySlotsRouter);
  app.use(`${env.API_BASE_PATH}/public/sessions`, publicSessionsRouter);
  app.use(`${env.API_BASE_PATH}/public/programs`, publicProgramsRouter);
  app.use(`${env.API_BASE_PATH}/public/slot-holds`, slotHoldsRouter);
  app.use(`${env.API_BASE_PATH}/public/booking/price-preview`, publicPricePreviewRouter);
  app.use(`${env.API_BASE_PATH}/public/payments`, publicPaymentsRouter);
  app.use(`${env.API_BASE_PATH}/public/bookings`, publicBookingsRouter);
  app.use(`${env.API_BASE_PATH}/public/quote-requests`, publicQuoteRequestsRouter);
  app.use(`${env.API_BASE_PATH}/public/cms`, publicCmsRouter);
  app.use(`${env.API_BASE_PATH}/webhooks/payments`, paymentWebhooksRouter);
  app.use(`${env.API_BASE_PATH}/admin/auth`, adminAuthRouter);
  app.use(`${env.API_BASE_PATH}/admin/offerings`, adminOfferingsRouter);
  app.use(`${env.API_BASE_PATH}/admin/bookings`, adminBookingsRouter);
  app.use(`${env.API_BASE_PATH}/admin/booking-form-fields`, adminBookingFormFieldsRouter);
  app.use(`${env.API_BASE_PATH}/admin/locations`, adminLocationsRouter);
  app.use(`${env.API_BASE_PATH}/admin/sessions`, adminSessionsRouter);
  app.use(`${env.API_BASE_PATH}/admin/programs`, adminProgramsRouter);
  app.use(`${env.API_BASE_PATH}/admin/payments`, adminPaymentsRouter);
  app.use(`${env.API_BASE_PATH}/admin/emails`, adminEmailsRouter);
  app.use(`${env.API_BASE_PATH}/admin/quote-requests`, adminQuoteRequestsRouter);
  app.use(`${env.API_BASE_PATH}/admin/cms`, adminCmsRouter);
  app.use(`${env.API_BASE_PATH}/admin/cms/media-assets`, mediaRouter);
  app.use(`${env.API_BASE_PATH}/admin/integrations/google-calendar`, adminGoogleCalendarRouter);
  app.use(`${env.API_BASE_PATH}/admin/booking-policy`, adminBookingPolicyRouter);
  app.use(`${env.API_BASE_PATH}/admin/availability-windows`, adminAvailabilityWindowsRouter);
  app.use(`${env.API_BASE_PATH}/admin/availability-overrides`, adminAvailabilityOverridesRouter);
  app.use(`${env.API_BASE_PATH}/admin/availability-slots`, adminAvailabilitySlotsRouter);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
};
