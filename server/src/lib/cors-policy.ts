import type { AppEnv } from "../config/env.js";

export const DEFAULT_DEV_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
] as const;

function parseConfiguredOrigins(rawValue: string | undefined): string[] {
  return (rawValue ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function resolveAllowedOrigins(env: AppEnv): Set<string> {
  const configured = parseConfiguredOrigins(env.CORS_ALLOWED_ORIGINS);

  if (configured.length > 0) {
    return new Set(configured);
  }

  if (env.NODE_ENV === "production") {
    return new Set();
  }

  return new Set(DEFAULT_DEV_CORS_ORIGINS);
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

export function createCorsOriginValidator(env: AppEnv, allowedOrigins: Set<string>) {
  return (
    origin: string | undefined,
    callback: (error: Error | null, allow: boolean) => void
  ): void => {
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
  };
}
