import { NextFunction, Request, RequestHandler, Response } from "express";
import mongoose from "mongoose";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Wraps an async route handler so rejections reach the error middleware
// instead of becoming unhandled promise rejections.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
};

// Single place that maps errors to HTTP responses. Every error body is
// { message } so clients only need to handle one shape.
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: `Invalid ${err.path}: ${err.value}` });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: err.message });
  }
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ message: "Malformed JSON body" });
  }
  const anyErr = err as { code?: number; keyValue?: Record<string, unknown>; message?: string; stack?: string };
  if (anyErr?.code === 11000) {
    const field = Object.keys(anyErr.keyValue || {}).join(", ");
    return res.status(409).json({ message: `Duplicate value for ${field || "unique field"}` });
  }
  console.error(anyErr?.stack || err);
  return res.status(500).json({ message: anyErr?.message || "Internal server error" });
};
