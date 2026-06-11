import rateLimit from "@fastify/rate-limit";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { AppEnv } from "../config/env.js";

type RateLimitPluginOptions = {
  env: AppEnv;
};

const OPERATIONAL_PATHS = new Set(["/metrics", "/docs", "/docs/json", "/docs/yaml"]);

function isOperationalPath(pathname: string): boolean {
  if (OPERATIONAL_PATHS.has(pathname)) {
    return true;
  }

  return pathname.endsWith("/health/live") || pathname.endsWith("/health/ready");
}

const rateLimitPlugin: FastifyPluginAsync<RateLimitPluginOptions> = async (fastify, options) => {
  const { env } = options;
  const max = env.NODE_ENV === "test" ? 10_000 : env.RATE_LIMIT_MAX;

  await fastify.register(rateLimit, {
    global: true,
    max,
    timeWindow: env.RATE_LIMIT_TIME_WINDOW,
    allowList: (request) => isOperationalPath(request.url.split("?")[0] ?? ""),
    errorResponseBuilder: (_request, context) => ({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Rate limit exceeded. Retry after ${context.after}.`,
        details: {
          limit: context.max,
          timeWindow: env.RATE_LIMIT_TIME_WINDOW,
        },
        fieldErrors: [],
        retryable: true,
      },
      meta: {
        requestId: "rate-limit",
        timestamp: new Date().toISOString(),
      },
    }),
  });

  fastify.log.info(
    {
      max,
      timeWindow: env.RATE_LIMIT_TIME_WINDOW,
      testModeBypass: env.NODE_ENV === "test",
    },
    "Global API rate limiting enabled."
  );
};

export default fp(rateLimitPlugin, {
  name: "rate-limit",
});
