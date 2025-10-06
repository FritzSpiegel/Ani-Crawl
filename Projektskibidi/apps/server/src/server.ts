import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";
import { createApp } from "./app";

async function main() {
  await mongoose.connect(env.mongoUri);
  const app = createApp();
  app.listen(env.port, () => logger.info({ port: env.port }, "server listening"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
