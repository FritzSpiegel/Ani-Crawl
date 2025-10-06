import pino from "pino";
import pinoHttp from "pino-http";

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
});

export const httpLogger = pinoHttp({
  logger,
  serializers: {
    req(req) {
      return { method: req.method, url: req.url };
    },
  },
});
