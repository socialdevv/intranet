import { readFileSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import type { AppEnv } from "./config/env.js";
import { createCorsOriginValidator, resolveAllowedOrigins } from "./lib/cors-policy.js";
import {
  MEDIA_KIND_FOLDERS,
  resolveMediaDiskDirectory,
} from "./lib/media-storage.js";
import frontendStaticPlugin from "./plugins/frontend-static.js";
import metricsPlugin from "./plugins/metrics.js";
import prismaPlugin from "./plugins/prisma.js";
import rateLimitPlugin from "./plugins/rate-limit.js";
import {
  isSwaggerUiEnabled,
  swaggerRegistration,
  swaggerUiRegistration,
} from "./plugins/swagger.js";
import {
  configurePreviewAuth,
  isPreviewAuthEnabled,
  PREVIEW_AUTH_SECURITY_WARNING,
} from "./lib/preview-auth.js";
import apiRoutes from "./routes/index.js";

const SERVICE_NAME = "intranetv2-mock-api";
const API_VERSION = "v1";

function resolveServiceVersion(): string {
  try {
    const packageJsonUrl = new URL("../../package.json", import.meta.url);
    const raw = readFileSync(packageJsonUrl, "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export async function buildApp(env: AppEnv): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      // Application/system logs go to stdout only (Pino). Business audit events
      // are persisted separately via the AuditLog Prisma model.
      stream: process.stdout,
    },
    disableRequestLogging: false,
  });

  configurePreviewAuth(env);

  if (isPreviewAuthEnabled()) {
    app.log.warn(PREVIEW_AUTH_SECURITY_WARNING);
  } else if (env.NODE_ENV !== "production") {
    app.log.warn(
      "Development header-based auth (x-dev-user-email) is enabled. This mode is non-production only."
    );
  }

  const allowedOrigins = resolveAllowedOrigins(env);

  if (env.NODE_ENV === "production" && allowedOrigins.size === 0) {
    app.log.warn(
      "CORS_ALLOWED_ORIGINS is empty in production. Cross-origin browser requests will be rejected."
    );
  }

  const serviceVersion = resolveServiceVersion();

  await app.register(metricsPlugin, { serviceName: SERVICE_NAME });
  await app.register(rateLimitPlugin, { env });
  await app.register(fastifyCors, {
    origin: createCorsOriginValidator(env, allowedOrigins),
  });
  await app.register(swaggerRegistration, {
    serviceName: SERVICE_NAME,
    serviceVersion,
    apiVersion: API_VERSION,
  });

  await app.register(fastifyMultipart, {
    limits: {
      files: 1,
      fileSize: env.UPLOAD_MAX_FILE_SIZE_BYTES,
    },
  });

  await app.register(fastifyStatic, {
    root: resolveMediaDiskDirectory(env, "image"),
    prefix: `/${MEDIA_KIND_FOLDERS.image}/`,
    decorateReply: false,
  });

  await app.register(fastifyStatic, {
    root: resolveMediaDiskDirectory(env, "video"),
    prefix: `/${MEDIA_KIND_FOLDERS.video}/`,
    decorateReply: false,
  });

  await app.register(fastifyStatic, {
    root: resolveMediaDiskDirectory(env, "file"),
    prefix: `/${MEDIA_KIND_FOLDERS.file}/`,
    decorateReply: false,
  });

  await app.register(prismaPlugin, { env });
  await app.register(apiRoutes, {
    prefix: `/api/${API_VERSION}`,
    meta: {
      serviceName: SERVICE_NAME,
      serviceVersion,
      environment: env.NODE_ENV,
      apiVersion: API_VERSION,
    },
    env,
  });

  if (isSwaggerUiEnabled(env)) {
    await app.register(swaggerUiRegistration);
  } else {
    app.log.info("Swagger UI disabled for production. Set ENABLE_SWAGGER=true to expose /docs.");
  }

  await app.register(frontendStaticPlugin, {
    staticWebRoot: env.STATIC_WEB_ROOT,
  });

  return app;
}
