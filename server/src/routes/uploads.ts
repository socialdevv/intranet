import type { FastifyPluginAsync } from "fastify";
import type { AppEnv } from "../config/env.js";
import { errorEnvelope } from "../lib/envelope.js";
import { DEV_USER_HEADER_NAME, resolveCurrentPlatformUser } from "../lib/platform-bootstrap.js";
import { uploadProjectMediaAsset } from "../lib/project-media-upload.js";

type UploadRoutesOptions = {
  env: AppEnv;
};

const uploadRoutes: FastifyPluginAsync<UploadRoutesOptions> = async (fastify, options) => {
  fastify.post(
    "/uploads",
    {
      config: {
        rateLimit: {
          max: options.env.NODE_ENV === "test" ? 10_000 : options.env.UPLOAD_RATE_LIMIT_MAX,
          timeWindow: options.env.UPLOAD_RATE_LIMIT_TIME_WINDOW,
        },
      },
      schema: {
        tags: ["Uploads"],
        summary: "Upload a project media asset",
        consumes: ["multipart/form-data"],
      },
    },
    async (request, reply) => {
      const headerValue = request.headers[DEV_USER_HEADER_NAME];
      const selectedUserEmail = Array.isArray(headerValue) ? headerValue[0] : headerValue;

      const currentUser = await resolveCurrentPlatformUser(fastify.prisma, selectedUserEmail);

      if (!currentUser) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "DEV_USER_NOT_FOUND",
          message: "No active development user matched the current user selector.",
          details: {
            headerName: DEV_USER_HEADER_NAME,
            requestedEmail: selectedUserEmail?.trim() || null,
          },
        });
      }

      const file = await request.file();

      if (!file) {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: "Upload request must include a multipart file field named file.",
        });
      }

      const result = await uploadProjectMediaAsset(
        fastify.prisma,
        currentUser,
        options.env,
        file
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
        });
      }

      if (!result.ok && result.reason === "capacity_exceeded") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "UPLOAD_CAPACITY_EXCEEDED",
          message: result.message,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: result.message,
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: result.message,
        });
      }

      if (!result.ok && result.reason === "too_large") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "UPLOAD_TOO_LARGE",
          message: result.message,
          details: {
            maxBytes: result.maxBytes ?? options.env.UPLOAD_MAX_FILE_SIZE_BYTES,
          },
        });
      }

      if (!result.ok && result.reason === "unsupported_media_type") {
        reply.code(415);

        return errorEnvelope(request.id, {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: result.message,
          details: {
            allowedMimePatterns: result.allowedMimePatterns,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: result.message,
        });
      }

      reply.code(201);

      return {
        url: result.data.file.url,
        file: result.data.file,
      };
    }
  );
};

export default uploadRoutes;
