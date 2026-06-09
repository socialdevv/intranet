import type { FastifyPluginAsync } from "fastify";
import { successEnvelope } from "../lib/envelope.js";

export type MetaRouteOptions = {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  apiVersion: string;
};

const metaRoutes: FastifyPluginAsync<MetaRouteOptions> = async (fastify, options) => {
  fastify.get("/meta", async (request) => {
    return successEnvelope(request.id, {
      service: {
        name: options.serviceName,
        version: options.serviceVersion,
        environment: options.environment,
        apiVersion: options.apiVersion,
      },
    });
  });
};

export default metaRoutes;
