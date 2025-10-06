import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { httpLogger, logger } from "./../src/logger";
import api from "./routes/api";

export function createApp() {
  const app = express();
  app.use(httpLogger);
  app.use(helmet());
  app.use(compression());
  app.use(cors());
  app.use(express.json());
  app.use(rateLimit({ windowMs: 60_000, limit: 10 }));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", api);

  app.use((err: any, _req: any, res: any, _next: any) => {
    logger.error({ err }, "Unhandled error");
    res.status(500).json({ error: { code: "CRAWL_FAILED", message: "Internal server error" } });
  });
  return app;
}
