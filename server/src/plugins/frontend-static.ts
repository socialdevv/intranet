import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

export type FrontendStaticPluginOptions = {
  staticWebRoot?: string;
};

function resolveDefaultFrontendDist(): string {
  const repoRoot = path.dirname(fileURLToPath(new URL("../../../package.json", import.meta.url)));
  return path.join(repoRoot, "dist");
}

const frontendStaticPlugin: FastifyPluginAsync<FrontendStaticPluginOptions> = async (
  fastify,
  options
) => {
  const root = path.resolve(options.staticWebRoot?.trim() || resolveDefaultFrontendDist());

  if (!existsSync(path.join(root, "index.html"))) {
    fastify.log.info({ root }, "Frontend static bundle not found; SPA hosting disabled.");
    return;
  }

  await fastify.register(fastifyStatic, {
    root,
    prefix: "/",
    decorateReply: true,
  });

  fastify.setNotFoundHandler((request, reply) => {
    const pathname = request.url.split("?")[0] ?? "";

    if (
      request.method === "GET" &&
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/photos/") &&
      !pathname.startsWith("/videos/") &&
      !pathname.startsWith("/files/") &&
      pathname !== "/metrics" &&
      !pathname.startsWith("/docs")
    ) {
      return reply.sendFile("index.html");
    }

    return reply.code(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
        details: {},
        fieldErrors: [],
        retryable: false,
      },
    });
  });

  fastify.log.info({ root }, "Frontend static bundle enabled.");
};

export default fp(frontendStaticPlugin, {
  name: "frontend-static",
});
