import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  MONGO_URI: z.string().min(1),
  API_PORT: z.string().default("3002"),
  PORT: z.string().optional(),
  ALLOW_LIVE_FETCH: z.string().default("false"),
  STATIC_SEARCH_HTML: z.string().min(1),
  STATIC_DETAIL_HTML: z.string().min(1),
  JWT_SECRET: z.string().min(1).default("devsecret"),
  APP_BASE_URL: z.string().default("http://localhost:5174"),
  ADMIN_EMAIL: z.string().default("admin@mail"),
  ADMIN_PASSWORD: z.string().default("password"),
  STRAPI_URL: z.string().default("http://localhost:1337"),
  STRAPI_API_TOKEN: z.string().default(""),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  mongoUri: parsed.data.MONGO_URI,
  port: Number(parsed.data.API_PORT),
  allowLiveFetch: parsed.data.ALLOW_LIVE_FETCH.toLowerCase() === "true",
  staticSearchHtmlPath: parsed.data.STATIC_SEARCH_HTML,
  staticDetailHtmlPath: parsed.data.STATIC_DETAIL_HTML,
  jwtSecret: parsed.data.JWT_SECRET,
  appBaseUrl: parsed.data.APP_BASE_URL,
  adminEmail: parsed.data.ADMIN_EMAIL,
  adminPassword: parsed.data.ADMIN_PASSWORD,
  strapiUrl: parsed.data.STRAPI_URL,
  strapiApiToken: parsed.data.STRAPI_API_TOKEN,
};
