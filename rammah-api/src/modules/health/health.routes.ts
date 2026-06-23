import { Router } from "express";
import { sql } from "drizzle-orm";
import { db, pool } from "../../db/client.js";
import { httpStatus } from "../../shared/http/status.js";

export const healthRouter = Router();

healthRouter.get("/live", (_req, res) => {
  res.status(httpStatus.ok).json({
    data: {
      status: "ok",
      service: "rammah-api",
      checkedAt: new Date().toISOString(),
    },
  });
});

healthRouter.get("/ready", async (_req, res, next) => {
  try {
    await db.execute(sql`select 1`);

    res.status(httpStatus.ok).json({
      data: {
        status: "ready",
        database: "reachable",
        pool: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
        },
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});
