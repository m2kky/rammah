import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../middleware/validate-request.js";
import { httpStatus } from "../../shared/http/status.js";
import { listPublicPrograms } from "./public-programs.service.js";

export const publicProgramsRouter = Router();

const dateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date.");
const querySchema = z.object({
  offeringId: z.string().uuid().optional(),
  dateFrom: dateSchema,
  dateTo: dateSchema,
  locale: z.enum(["en", "ar"]).default("en"),
});

publicProgramsRouter.get("/", validateRequest({ query: querySchema }), async (req, res, next) => {
  try {
    res.status(httpStatus.ok).json({
      data: await listPublicPrograms(req.query as z.infer<typeof querySchema>),
    });
  } catch (error) {
    next(error);
  }
});
