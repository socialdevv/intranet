import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import client from "prom-client";

export type MetricsPluginOptions = {
  serviceName: string;
};

const metricsPlugin: FastifyPluginAsync<MetricsPluginOptions> = async (fastify, options) => {
  const register = new client.Registry();

  register.setDefaultLabels({
    service: options.serviceName,
  });

  client.collectDefaultMetrics({
    register,
  });

  const httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests processed by the server.",
    labelNames: ["method", "route", "status_code"],
    registers: [register],
  });

  fastify.addHook("onResponse", (request, reply, done) => {
    const route = request.routeOptions.url ?? request.url.split("?")[0] ?? "unknown";

    httpRequestsTotal.inc({
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    });

    done();
  });

  fastify.get(
    "/metrics",
    {
      schema: {
        hide: true,
        tags: ["Operations"],
        summary: "Prometheus metrics",
        description: "Exposes process and HTTP metrics in Prometheus text exposition format.",
        response: {
          200: {
            type: "string",
            description: "Prometheus text format metrics payload.",
          },
        },
      },
    },
    async (_request, reply) => {
      reply.header("Content-Type", register.contentType);
      return register.metrics();
    }
  );
};

export default fp(metricsPlugin, {
  name: "metrics",
});
