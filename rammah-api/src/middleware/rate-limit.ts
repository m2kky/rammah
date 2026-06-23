import type { RequestHandler } from "express";
import { httpStatus } from "../shared/http/status.js";

type RateLimitOptions = {
  keyPrefix: string;
  windowMs: number;
  max: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const pruneExpiredBuckets = (now: number) => {
  if (buckets.size < 10000) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

export const createRateLimit = (options: RateLimitOptions): RequestHandler => {
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${options.keyPrefix}:${ip}`;
    const bucket = buckets.get(key);

    // ponytail: in-memory per-process limiter, move buckets to Redis before multi-instance deploy.
    if (!bucket || bucket.resetAt <= now) {
      pruneExpiredBuckets(now);
      buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      next();
      return;
    }

    bucket.count += 1;

    if (bucket.count <= options.max) {
      next();
      return;
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(httpStatus.tooManyRequests).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Try again later.",
        details: [],
        requestId: req.requestId,
      },
    });
  };
};

export const authLoginRateLimit = createRateLimit({
  keyPrefix: "auth-login",
  windowMs: 15 * 60 * 1000,
  max: 10,
});

export const publicSubmissionRateLimit = createRateLimit({
  keyPrefix: "public-submission",
  windowMs: 60 * 1000,
  max: 30,
});
