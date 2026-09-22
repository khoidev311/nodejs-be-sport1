import { NextFunction, Request, Response } from "express";
import { ZodType } from "zod";
import { HttpError } from "../helper/http";

type Part = "body" | "params" | "query";

// Validates one part of the request against a zod schema and replaces it
// with the parsed (coerced, stripped) value. Unknown body keys are dropped.
const validate =
  (schema: ZodType, part: Part = "body") =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const detail = result.error.issues.map((i) => `${i.path.join(".") || part}: ${i.message}`).join("; ");
      return next(new HttpError(400, `Validation failed — ${detail}`));
    }
    if (part === "query") {
      // Express 4 exposes req.query as a plain object we can overwrite.
      (req as { query: unknown }).query = result.data;
    } else {
      req[part] = result.data as never;
    }
    next();
  };

export { validate };
