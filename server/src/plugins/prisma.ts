import { PrismaClient } from "@prisma/client";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { AppEnv } from "../config/env.js";

type PrismaPluginOptions = {
  env: AppEnv;
};

const prismaPlugin: FastifyPluginAsync<PrismaPluginOptions> = async (fastify, options) => {
  const prisma = new PrismaClient({
    log: options.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
};

export default fp(prismaPlugin, {
  name: "prisma",
});
