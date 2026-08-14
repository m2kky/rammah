import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../middleware/validate-request.js";
import { publicSubmissionRateLimit } from "../../middleware/rate-limit.js";
import { httpStatus } from "../../shared/http/status.js";
import { createSlotHold, releaseSlotHoldById } from "./slot-holds.service.js";

export const slotHoldsRouter = Router();

const idParamsSchema = z.object({
  id: z.string().uuid(),
});

const timestampSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Use an ISO timestamp.",
  });

const slotHoldBodySchema = z.union([
  z.object({
    offeringId: z.string().uuid(),
    target: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("appointment"),
        startsAt: timestampSchema,
        endsAt: timestampSchema,
      }),
      z.object({
        kind: z.literal("scheduled_program"),
        scheduledProgramId: z.string().uuid(),
      }),
    ]),
  }),
  z.object({
    offeringId: z.string().uuid(),
    offeringSessionId: z.string().uuid().nullable().optional(),
    startsAt: timestampSchema,
    endsAt: timestampSchema,
  }),
]);

slotHoldsRouter.post(
  "/",
  publicSubmissionRateLimit,
  validateRequest({ body: slotHoldBodySchema }),
  async (req, res, next) => {
    try {
      const hold = await createSlotHold(req.body);

      res.status(httpStatus.created).json({
        data: hold,
      });
    } catch (error) {
      next(error);
    }
  },
);

slotHoldsRouter.delete(
  "/:id",
  validateRequest({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const holdToken = req.get("X-Booking-Hold-Token");
      await releaseSlotHoldById(req.params.id, holdToken);

      res.status(httpStatus.noContent).send();
    } catch (error) {
      next(error);
    }
  },
);
