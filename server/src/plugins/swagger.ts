import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { AppEnv } from "../config/env.js";
import { registerOpenApiSchemas } from "../openapi/schemas.js";

export type SwaggerPluginOptions = {
  serviceName: string;
  serviceVersion: string;
  apiVersion: string;
};

export function isSwaggerUiEnabled(env: AppEnv): boolean {
  return env.NODE_ENV !== "production" || env.ENABLE_SWAGGER;
}

const swaggerRegistrationPlugin: FastifyPluginAsync<SwaggerPluginOptions> = async (
  fastify,
  options
) => {
  registerOpenApiSchemas(fastify);

  await fastify.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "AltCloud Intranet API",
        description:
          "Auto-generated OpenAPI document derived from Fastify route schemas. " +
          "Business routes are served under /api/v1.",
        version: options.serviceVersion,
      },
      servers: [
        {
          url: `/api/${options.apiVersion}`,
          description: `${options.serviceName} ${options.apiVersion}`,
        },
      ],
      tags: [
        { name: "Health", description: "Liveness and readiness probes." },
        { name: "Meta", description: "Service metadata." },
        { name: "Platform", description: "Global platform shell endpoints." },
        { name: "Projects", description: "Project-scoped business modules." },
        { name: "Uploads", description: "Project media upload endpoints." },
        { name: "Operations", description: "Operational endpoints (metrics, documentation)." },
      ],
      components: {
        securitySchemes: {
          DevUserEmail: {
            type: "apiKey",
            name: "x-dev-user-email",
            in: "header",
            description:
              "Development-only identity header. Production deployments must use gateway-offloaded auth.",
          },
        },
      },
    },
  });

  fastify.get(
    "/openapi.json",
    {
      schema: {
        hide: true,
        tags: ["Operations"],
        summary: "OpenAPI specification",
      },
    },
    async () => fastify.swagger()
  );
};

const swaggerUiPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: true,
  });
};

export const swaggerRegistration = fp(swaggerRegistrationPlugin, {
  name: "swagger-openapi",
});

export const swaggerUiRegistration = fp(swaggerUiPlugin, {
  name: "swagger-ui",
});
