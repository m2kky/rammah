import { Router } from "express";
import {
  defaultCountryCode,
  detectCountryFromRequest,
} from "../../shared/geo/request-country.js";

export const publicCountryRouter = Router();

publicCountryRouter.get("/", (req, res) => {
  const detection = detectCountryFromRequest(req);

  res.json({
    data: {
      countryCode: detection.countryCode ?? defaultCountryCode,
      detectedCountryCode: detection.countryCode,
      source: detection.source ?? "default",
    },
  });
});
