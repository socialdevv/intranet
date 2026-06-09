import { readFileSync } from "node:fs";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import type { AppEnv } from "./config/env.js";
import {
  MEDIA_KIND_FOLDERS,
  resolveMediaDiskDirectory,
} from "./lib/media-storage.js";
import prismaPlugin from "./plugins/prisma.js";
import apiRoutes from "./routes/index.js";

const SERVICE_NAME = "intranetv2-mock-api";
const API_VERSION = "v1";

function parseAllowedOrigins(env: AppEnv): Set<string> {
  return new Set(
    (env.CORS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

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

export function buildApp(env: AppEnv) {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  if (env.NODE_ENV !== "production") {
    app.log.warn(
      "Development header-based auth (x-dev-user-email) is enabled. This mode is non-production only."
    );
  }

  const allowedOrigins = parseAllowedOrigins(env);

  void app.register(fastifyCors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      if (env.NODE_ENV !== "production" && isLoopbackOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  });

  void app.register(fastifyMultipart, {
    limits: {
      files: 1,
      fileSize: 500 * 1024 * 1024,
    },
  });

  void app.register(fastifyStatic, {
    root: resolveMediaDiskDirectory(env, "image"),
    prefix: `/${MEDIA_KIND_FOLDERS.image}/`,
    decorateReply: false,
  });

  void app.register(fastifyStatic, {
    root: resolveMediaDiskDirectory(env, "video"),
    prefix: `/${MEDIA_KIND_FOLDERS.video}/`,
    decorateReply: false,
  });

  void app.register(fastifyStatic, {
    root: resolveMediaDiskDirectory(env, "file"),
    prefix: `/${MEDIA_KIND_FOLDERS.file}/`,
    decorateReply: false,
  });

  void app.register(prismaPlugin, { env });
  void app.register(apiRoutes, {
    prefix: `/api/${API_VERSION}`,
    meta: {
      serviceName: SERVICE_NAME,
      serviceVersion: resolveServiceVersion(),
      environment: env.NODE_ENV,
      apiVersion: API_VERSION,
    },
    env,
  });

  return app;
}
