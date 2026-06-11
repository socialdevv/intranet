import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { AppEnv } from "../src/config/env.js";
import { ensureMediaStorageDirectories } from "../src/lib/media-storage.js";

let app: FastifyInstance;

function createEnv(): AppEnv {
  return {
    NODE_ENV: "test",
    SERVER_HOST: "127.0.0.1",
    SERVER_PORT: 3198,
    LOG_LEVEL: "silent",
    DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/intranet",
    CORS_ALLOWED_ORIGINS: "https://intranet.company.com",
    RATE_LIMIT_MAX: 200,
    RATE_LIMIT_TIME_WINDOW: "1 minute",
    UPLOAD_MAX_FILE_SIZE_BYTES: 314_572_800,
    UPLOAD_RATE_LIMIT_MAX: 5,
    UPLOAD_RATE_LIMIT_TIME_WINDOW: "1 minute",
    ENABLE_SWAGGER: false,
    ENABLE_PREVIEW_AUTH: false,
    STATIC_WEB_ROOT: "",
    MEDIA_STORAGE_ROOT: "./runtime-media",
  };
}

before(async () => {
  const env = createEnv();
  await ensureMediaStorageDirectories(env);
  app = await buildApp(env);
  await app.ready();
});

after(async () => {
  await app.close();
});

test("GET /metrics exposes Prometheus text format", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/metrics",
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] ?? "", /text\/plain/);
  assert.match(response.body, /process_cpu_/);
  assert.match(response.body, /http_requests_total/);
});

test("GET /docs is available outside production", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/docs",
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] ?? "", /text\/html/);
});

test("GET /docs is disabled in production unless ENABLE_SWAGGER is true", async () => {
  const productionEnv: AppEnv = {
    ...createEnv(),
    NODE_ENV: "production",
    ENABLE_SWAGGER: false,
  };
  await ensureMediaStorageDirectories(productionEnv);
  const productionApp = await buildApp(productionEnv);
  await productionApp.ready();

  try {
    const response = await productionApp.inject({
      method: "GET",
      url: "/docs",
    });

    assert.equal(response.statusCode, 404);
  } finally {
    await productionApp.close();
  }
});

test("OpenAPI document includes registered route schemas", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/openapi.json",
  });

  assert.equal(response.statusCode, 200);

  const document = JSON.parse(response.body) as {
    paths: Record<string, Record<string, unknown>>;
  };

  assert.ok(document.paths["/health/live"]?.get);
  assert.ok(document.paths["/meta"]?.get);
});

test("CORS rejects origins outside CORS_ALLOWED_ORIGINS", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/health/live",
    headers: {
      origin: "https://evil.example.com",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.notEqual(response.headers["access-control-allow-origin"], "https://evil.example.com");
});

test("CORS allows configured production origins", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/health/live",
    headers: {
      origin: "https://intranet.company.com",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["access-control-allow-origin"], "https://intranet.company.com");
});
