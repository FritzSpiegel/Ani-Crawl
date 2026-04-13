import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import path from "path";
import { httpLogger, logger } from "./logger";
import api from "./routes/api";
import cmsRouter from "./routes/cms";
import mediaRouter from "./routes/media";
import docsRouter from "./routes/docs";
import cookieParser from "cookie-parser";

export function createApp() {
  const app = express();
  app.use(httpLogger);
  app.use(helmet());
  app.use(compression());
  app.use(cors({
    origin: (origin: any, callback: any) => callback(null, true), // allow all origins (dev)
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.options('*', cors({
    origin: (origin: any, callback: any) => callback(null, true),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json());
  app.use(cookieParser());
  // Removed request rate limiting for crawler-heavy usage

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", api);
  app.use("/cms", cmsRouter);
  app.use("/cms/media", mediaRouter);
  app.use("/docs", docsRouter);

  // Serve uploaded files statically (legacy; Strapi now handles media)
  const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
  app.use("/uploads", express.static(path.resolve(UPLOAD_DIR)));

  app.use((err: any, _req: any, res: any, _next: any) => {
    logger.error({ err }, "Unhandled error");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  });
  return app;
}
