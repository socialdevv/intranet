import type { FastifyPluginAsync } from "fastify";
import type { AppEnv } from "../config/env.js";
import healthRoutes from "./health.js";
import metaRoutes, { type MetaRouteOptions } from "./meta.js";
import platformRoutes from "./platform.js";
import projectFormsRoutes from "./project-forms.js";
import projectRoutes from "./projects.js";
import uploadRoutes from "./uploads.js";

type ApiRoutesOptions = {
  meta: MetaRouteOptions;
  env: AppEnv;
};

const apiRoutes: FastifyPluginAsync<ApiRoutesOptions> = async (fastify, options) => {
  await fastify.register(healthRoutes);
  await fastify.register(metaRoutes, options.meta);
  await fastify.register(platformRoutes);
  await fastify.register(uploadRoutes, { env: options.env });
  await fastify.register(projectRoutes);
  await fastify.register(projectFormsRoutes);
};

export default apiRoutes;
