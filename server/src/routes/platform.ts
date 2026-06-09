import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import {
  DEV_USER_HEADER_NAME,
  buildPlatformBootstrap,
  resolveCurrentPlatformUser,
} from "../lib/platform-bootstrap.js";
import { errorEnvelope, successEnvelope } from "../lib/envelope.js";
import {
  buildPlatformAnnouncements,
  createPlatformAnnouncement,
  deletePlatformAnnouncement,
  updatePlatformAnnouncement,
} from "../lib/platform-announcements.js";
import {
  buildPlatformLinks,
  createPlatformLink,
  deletePlatformLink,
  updatePlatformLink,
} from "../lib/platform-links.js";
import { createPlatformProject } from "../lib/platform-projects.js";
import { buildPlatformAuditHistory } from "../lib/project-audit.js";

function resolveSelectedUserEmail(request: FastifyRequest) {
  const headerValue = request.headers[DEV_USER_HEADER_NAME];
  return Array.isArray(headerValue) ? headerValue[0] : headerValue;
}

async function resolveRequestUser(
  prisma: Parameters<typeof resolveCurrentPlatformUser>[0],
  request: FastifyRequest,
  reply: FastifyReply
) {
  const selectedUserEmail = resolveSelectedUserEmail(request);
  const currentUser = await resolveCurrentPlatformUser(prisma, selectedUserEmail);

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

  return currentUser;
}

const platformRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/platform/bootstrap", async (request, reply) => {
    const currentUser = await resolveRequestUser(fastify.prisma, request, reply);

    if (!currentUser || "error" in currentUser) {
      return currentUser;
    }

    const bootstrap = await buildPlatformBootstrap(fastify.prisma, currentUser);
    return successEnvelope(request.id, bootstrap);
  });

  fastify.get("/platform/announcements", async (request, reply) => {
    const currentUser = await resolveRequestUser(fastify.prisma, request, reply);

    if (!currentUser || "error" in currentUser) {
      return currentUser;
    }

    const announcements = await buildPlatformAnnouncements(fastify.prisma);
    return successEnvelope(request.id, announcements);
  });

  fastify.post<{ Body: unknown }>("/platform/projects", async (request, reply) => {
    const currentUser = await resolveRequestUser(fastify.prisma, request, reply);

    if (!currentUser || "error" in currentUser) {
      return currentUser;
    }

    const result = await createPlatformProject(fastify.prisma, currentUser, request.body);

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PLATFORM_PROJECT_FORBIDDEN",
        message: "Project creation requires super_admin global role.",
      });
    }

    reply.code(201);
    return successEnvelope(request.id, result.data);
  });

  fastify.post<{ Body: unknown }>("/platform/announcements", async (request, reply) => {
    const currentUser = await resolveRequestUser(fastify.prisma, request, reply);

    if (!currentUser || "error" in currentUser) {
      return currentUser;
    }

    const result = await createPlatformAnnouncement(fastify.prisma, currentUser, request.body);

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PLATFORM_CONTENT_FORBIDDEN",
        message: "Global announcements require global administration or moderation rights.",
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PLATFORM_ANNOUNCEMENT_NOT_FOUND",
        message: "Global announcement was not found.",
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.patch<{ Params: { announcementId: string }; Body: unknown }>(
    "/platform/announcements/:announcementId",
    async (request, reply) => {
      const currentUser = await resolveRequestUser(fastify.prisma, request, reply);

      if (!currentUser || "error" in currentUser) {
        return currentUser;
      }

      const result = await updatePlatformAnnouncement(
        fastify.prisma,
        currentUser,
        request.params.announcementId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            announcementId: request.params.announcementId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PLATFORM_CONTENT_FORBIDDEN",
          message: "Global announcements require global administration or moderation rights.",
          details: {
            announcementId: request.params.announcementId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PLATFORM_ANNOUNCEMENT_NOT_FOUND",
          message: "Global announcement was not found.",
          details: {
            announcementId: request.params.announcementId,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.delete<{ Params: { announcementId: string } }>(
    "/platform/announcements/:announcementId",
    async (request, reply) => {
      const currentUser = await resolveRequestUser(fastify.prisma, request, reply);

      if (!currentUser || "error" in currentUser) {
        return currentUser;
      }

      const result = await deletePlatformAnnouncement(
        fastify.prisma,
        currentUser,
        request.params.announcementId
      );

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PLATFORM_CONTENT_FORBIDDEN",
          message: "Global announcements require global administration or moderation rights.",
          details: {
            announcementId: request.params.announcementId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PLATFORM_ANNOUNCEMENT_NOT_FOUND",
          message: "Global announcement was not found.",
          details: {
            announcementId: request.params.announcementId,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.get("/platform/links", async (request, reply) => {
    const currentUser = await resolveRequestUser(fastify.prisma, request, reply);

    if (!currentUser || "error" in currentUser) {
      return currentUser;
    }

    const links = await buildPlatformLinks(fastify.prisma);
    return successEnvelope(request.id, links);
  });

  fastify.post<{ Body: unknown }>("/platform/links", async (request, reply) => {
    const currentUser = await resolveRequestUser(fastify.prisma, request, reply);

    if (!currentUser || "error" in currentUser) {
      return currentUser;
    }

    const result = await createPlatformLink(fastify.prisma, currentUser, request.body);

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PLATFORM_CONTENT_FORBIDDEN",
        message: "Global links require global administration or moderation rights.",
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PLATFORM_LINK_NOT_FOUND",
        message: "Global link was not found.",
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.patch<{ Params: { linkId: string }; Body: unknown }>(
    "/platform/links/:linkId",
    async (request, reply) => {
      const currentUser = await resolveRequestUser(fastify.prisma, request, reply);

      if (!currentUser || "error" in currentUser) {
        return currentUser;
      }

      const result = await updatePlatformLink(
        fastify.prisma,
        currentUser,
        request.params.linkId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            linkId: request.params.linkId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PLATFORM_CONTENT_FORBIDDEN",
          message: "Global links require global administration or moderation rights.",
          details: {
            linkId: request.params.linkId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PLATFORM_LINK_NOT_FOUND",
          message: "Global link was not found.",
          details: {
            linkId: request.params.linkId,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.delete<{ Params: { linkId: string } }>("/platform/links/:linkId", async (request, reply) => {
    const currentUser = await resolveRequestUser(fastify.prisma, request, reply);

    if (!currentUser || "error" in currentUser) {
      return currentUser;
    }

    const result = await deletePlatformLink(fastify.prisma, currentUser, request.params.linkId);

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PLATFORM_CONTENT_FORBIDDEN",
        message: "Global links require global administration or moderation rights.",
        details: {
          linkId: request.params.linkId,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PLATFORM_LINK_NOT_FOUND",
        message: "Global link was not found.",
        details: {
          linkId: request.params.linkId,
        },
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.get<{ Querystring: unknown }>("/platform/audit", async (request, reply) => {
    const currentUser = await resolveRequestUser(fastify.prisma, request, reply);

    if (!currentUser || "error" in currentUser) {
      return currentUser;
    }

    const result = await buildPlatformAuditHistory(fastify.prisma, currentUser, request.query);

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        details: {},
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PLATFORM_AUDIT_FORBIDDEN",
        message: "Platform audit history requires super_admin global role.",
        details: {},
      });
    }

    if (!result.ok && result.reason === "not_found") {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found for the requested audit filter.",
        details: {},
      });
    }

    if (!result.ok) {
      reply.code(500);

      return errorEnvelope(request.id, {
        code: "PLATFORM_AUDIT_ERROR",
        message: "An unexpected error occurred while fetching platform audit history.",
        details: {},
      });
    }

    return successEnvelope(request.id, result.data);
  });
};

export default platformRoutes;