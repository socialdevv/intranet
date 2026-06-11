import type { FastifyPluginAsync } from "fastify";
import { successEnvelope } from "../lib/envelope.js";
import { successEnvelopeResponse } from "../openapi/schemas.js";

export type MetaRouteOptions = {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  apiVersion: string;
};

const metaRoutes: FastifyPluginAsync<MetaRouteOptions> = async (fastify, options) => {
  fastify.get(
    "/meta",
    {
      schema: {
        tags: ["Meta"],
        summary: "Service metadata",
        response: {
          200: successEnvelopeResponse(
            {
              type: "object",
              required: ["service"],
              properties: {
                service: {
                  type: "object",
                  required: ["name", "version", "environment", "apiVersion"],
                  properties: {
                    name: { type: "string" },
                    version: { type: "string" },
                    environment: { type: "string" },
                    apiVersion: { type: "string" },
                  },
                },
              },
            },
            "Runtime service metadata."
          ),
        },
      },
    },
    async (request) => {
      return successEnvelope(request.id, {
        service: {
          name: options.serviceName,
          version: options.serviceVersion,
          environment: options.environment,
          apiVersion: options.apiVersion,
        },
      });
    }
  );
};

export default metaRoutes;
