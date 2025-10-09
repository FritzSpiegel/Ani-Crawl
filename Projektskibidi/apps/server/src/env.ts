import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  MONGO_URI: z.string().min(1),
  PORT: z.string().default("3001"),
  ALLOW_LIVE_FETCH: z.string().default("false"),
  STATIC_SEARCH_HTML: z.string().min(1),
  STATIC_DETAIL_HTML: z.string().min(1),
  JWT_SECRET: z.string().min(1).default("devsecret"),
  APP_BASE_URL: z.string().default("http://localhost:5173"),
  ADMIN_EMAIL: z.string().default("admin@mail"),
  ADMIN_PASSWORD: z.string().default("password"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  mongoUri: parsed.data.MONGO_URI,
  port: Number(parsed.data.PORT),
  allowLiveFetch: parsed.data.ALLOW_LIVE_FETCH.toLowerCase() === "true",
  staticSearchHtmlPath: parsed.data.STATIC_SEARCH_HTML,
  staticDetailHtmlPath: parsed.data.STATIC_DETAIL_HTML,
  jwtSecret: parsed.data.JWT_SECRET,
  appBaseUrl: parsed.data.APP_BASE_URL,
  adminEmail: parsed.data.ADMIN_EMAIL,
  adminPassword: parsed.data.ADMIN_PASSWORD,
};
