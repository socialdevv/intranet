import type { FastifyPluginAsync } from "fastify";
import { errorEnvelope, successEnvelope } from "../lib/envelope.js";
import { successEnvelopeResponse } from "../openapi/schemas.js";

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/health/live",
    {
      schema: {
        tags: ["Health"],
        summary: "Liveness probe",
        response: {
          200: successEnvelopeResponse(
            {
              type: "object",
              required: ["status"],
              properties: {
                status: { type: "string", enum: ["ok"] },
              },
            },
            "Service process is alive."
          ),
        },
      },
    },
    async (request) => {
      return successEnvelope(request.id, {
        status: "ok",
      });
    }
  );

  fastify.get(
    "/health/ready",
    {
      schema: {
        tags: ["Health"],
        summary: "Readiness probe",
        response: {
          200: successEnvelopeResponse(
            {
              type: "object",
              required: ["status", "dependencies"],
              properties: {
                status: { type: "string", enum: ["ok"] },
                dependencies: {
                  type: "object",
                  properties: {
                    database: { type: "string", enum: ["up"] },
                  },
                },
              },
            },
            "Service and dependencies are ready."
          ),
          503: { $ref: "ApiErrorEnvelope#" },
        },
      },
    },
    async (request, reply) => {
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
    }
  );
};

export default healthRoutes;
