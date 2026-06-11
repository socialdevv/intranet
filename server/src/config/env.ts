import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVER_HOST: z.string().min(1).default("127.0.0.1"),
  SERVER_PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  RATE_LIMIT_TIME_WINDOW: z.string().min(1).default("1 minute"),
  UPLOAD_MAX_FILE_SIZE_BYTES: z.coerce.number().int().positive().default(314_572_800),
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  UPLOAD_RATE_LIMIT_TIME_WINDOW: z.string().min(1).default("1 minute"),
  ENABLE_SWAGGER: z.preprocess((value) => value === true || value === "true", z.boolean()).default(false),
  ENABLE_PREVIEW_AUTH: z.preprocess((value) => value === true || value === "true", z.boolean()).default(false),
  PREVIEW_AUTH_DEFAULT_USER_EMAIL: z.string().optional(),
  STATIC_WEB_ROOT: z.string().optional(),
  MEDIA_STORAGE_ROOT: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formattedIssues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment configuration:\n${formattedIssues}`);
}

export type AppEnv = z.infer<typeof envSchema>;

export const env: AppEnv = parsedEnv.data;
