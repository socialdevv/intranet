import type { FastifyPluginAsync } from "fastify";
import { errorEnvelope, successEnvelope } from "../lib/envelope.js";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health/live", async (request) => {
    return successEnvelope(request.id, {
      status: "ok",
    });
  });

  fastify.get("/health/ready", async (request, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;

      return successEnvelope(request.id, {
        status: "ok",
        dependencies: {
          database: "up",
        },
      });
    } catch (error) {
      fastify.log.error({ err: error }, "Readiness check failed.");
      reply.code(503);

      return errorEnvelope(request.id, {
        code: "SERVICE_UNREADY",
        message: "Service is not ready.",
        details: {
          database: "unavailable",
        },
      });
    }
  });
};

export default healthRoutes;
