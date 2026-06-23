import type { NextFunction, Request, Response } from "express";
import type { z, ZodTypeAny } from "zod";

type RequestSchema = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

export const validateRequest =
  (schema: RequestSchema) => (req: Request, _res: Response, next: NextFunction) => {
    if (schema.body) {
      req.body = schema.body.parse(req.body) as z.infer<typeof schema.body>;
    }

    if (schema.query) {
      req.query = schema.query.parse(req.query) as z.infer<typeof schema.query>;
    }

    if (schema.params) {
      req.params = schema.params.parse(req.params) as z.infer<typeof schema.params>;
    }

    next();
  };
