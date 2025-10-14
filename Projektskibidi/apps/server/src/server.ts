import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";
import { createApp } from "./app";

async function main() {
  try {
    // Versuche MongoDB zu verbinden, falls verfügbar
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 2000 });
    logger.info("Connected to MongoDB");
  } catch (error) {
    logger.warn("MongoDB not available, using in-memory storage for development");
    // Für Development ohne MongoDB - verwende in-memory models
  }

  const app = createApp();
  app.listen(env.port, () => logger.info({ port: env.port }, "server listening"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
