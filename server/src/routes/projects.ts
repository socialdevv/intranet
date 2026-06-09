import type { FastifyPluginAsync } from "fastify";
import { errorEnvelope, successEnvelope } from "../lib/envelope.js";
import {
  buildProjectAnnouncements,
  createProjectAnnouncement,
  deleteProjectAnnouncement,
  updateProjectAnnouncement,
} from "../lib/project-announcements.js";
import {
  buildProjectCommunications,
  createProjectCommunication,
  deleteProjectCommunication,
  updateProjectCommunication,
} from "../lib/project-communications.js";
import {
  buildProjectContacts,
  createProjectContact,
  deleteProjectContact,
  reorderProjectContacts,
  updateProjectContact,
} from "../lib/project-contacts.js";
import {
  replaceProjectHomeSpotlights,
  replaceProjectLeadConfig,
  updateProjectMetadata,
  updateProjectModuleConfiguration,
  updateProjectNavigation,
} from "../lib/project-configuration.js";
import { buildProjectAuditHistory } from "../lib/project-audit.js";
import {
  buildProjectImportantTopics,
  createProjectImportantTopic,
  deleteProjectImportantTopic,
  updateProjectImportantTopic,
} from "../lib/project-important-topics.js";
import {
  buildProjectKnowledgeArticles,
  buildProjectKnowledgeCategories,
  createProjectKnowledgeArticle,
  createProjectKnowledgeCategory,
  deleteProjectKnowledgeArticle,
  deleteProjectKnowledgeCategory,
  reorderProjectKnowledgeArticles,
  reorderProjectKnowledgeCategories,
  updateProjectKnowledgeArticle,
  updateProjectKnowledgeCategory,
} from "../lib/project-knowledge.js";
import {
  buildProjectMatrix,
  createProjectMatrix,
  deleteProjectMatrix,
  reorderProjectMatrixCategories,
  reorderProjectMatrixEntries,
  updateProjectMatrix,
} from "../lib/project-matrix.js";
import {
  buildProjectPhrases,
  createProjectPhrase,
  deleteProjectPhrase,
  reorderProjectPhrases,
  updateProjectPhrase,
} from "../lib/project-phrases.js";
import {
  buildProjectPricing,
  createProjectPricing,
  deleteProjectPricing,
  updateProjectPricing,
} from "../lib/project-pricing.js";
import {
  buildProjectTemplates,
  createProjectTemplate,
  deleteProjectTemplate,
  reorderProjectTemplates,
  updateProjectTemplate,
} from "../lib/project-templates.js";
import { buildProjectBootstrap } from "../lib/project-bootstrap.js";
import {
  buildProjectLinks,
  createProjectLink,
  deleteProjectLink,
  reorderProjectLinks,
  updateProjectLink,
} from "../lib/project-links.js";
import {
  buildProjectQuickLinks,
  createProjectQuickLink,
  deleteProjectQuickLink,
  reorderProjectQuickLinks,
  updateProjectQuickLink,
} from "../lib/project-quick-links.js";
import { DEV_USER_HEADER_NAME, resolveCurrentPlatformUser } from "../lib/platform-bootstrap.js";

const projectRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { projectSlug: string } }>("/projects/:projectSlug/bootstrap", async (request, reply) => {
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

    const result = await buildProjectBootstrap(fastify.prisma, currentUser, request.params.projectSlug);

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.get<{ Params: { projectSlug: string }; Querystring: unknown }>(
    "/projects/:projectSlug/audit",
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

      const result = await buildProjectAuditHistory(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.query
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project audit history requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_FORBIDDEN",
          message: "Project audit history requires project administration or content management rights.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.patch<{ Params: { projectSlug: string }; Body: unknown }>(
    "/projects/:projectSlug",
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

      const result = await updateProjectMetadata(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_FORBIDDEN",
          message: "Project metadata editing requires Super Admin rights.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.patch<{ Params: { projectSlug: string; moduleKey: string }; Body: unknown }>(
    "/projects/:projectSlug/modules/:moduleKey",
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

      const result = await updateProjectModuleConfiguration(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.moduleKey,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            moduleKey: request.params.moduleKey,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project configuration editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_FORBIDDEN",
          message: "Project module configuration requires project administration rights.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.put<{ Params: { projectSlug: string }; Body: unknown }>(
    "/projects/:projectSlug/navigation",
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

      const result = await updateProjectNavigation(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project configuration editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_FORBIDDEN",
          message: "Project navigation configuration requires project administration rights.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.put<{ Params: { projectSlug: string }; Body: unknown }>(
    "/projects/:projectSlug/home-spotlights",
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

      const result = await replaceProjectHomeSpotlights(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project home spotlights require an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_FORBIDDEN",
          message: "Project home spotlights require content editing rights.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.put<{ Params: { projectSlug: string }; Body: unknown }>(
    "/projects/:projectSlug/lead-config",
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

      const result = await replaceProjectLeadConfig(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project lead configuration requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_FORBIDDEN",
          message: "Project lead configuration requires content editing rights.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.get<{ Params: { projectSlug: string } }>("/projects/:projectSlug/categories", async (request, reply) => {
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

    const result = await buildProjectKnowledgeCategories(
      fastify.prisma,
      currentUser,
      request.params.projectSlug
    );

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project knowledge categories require an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>("/projects/:projectSlug/categories", async (request, reply) => {
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

    const result = await createProjectKnowledgeCategory(
      fastify.prisma,
      currentUser,
      request.params.projectSlug,
      request.body
    );

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        details: {
          projectSlug: request.params.projectSlug,
        },
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project knowledge category editing requires an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project knowledge category editing requires content editing permissions.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    reply.code(201);

    return successEnvelope(request.id, result.data);
  });

  fastify.patch<{ Params: { projectSlug: string; categoryId: string }; Body: unknown }>(
    "/projects/:projectSlug/categories/:categoryId",
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

      const result = await updateProjectKnowledgeCategory(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.categoryId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            categoryId: request.params.categoryId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project knowledge category editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project knowledge category editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "category_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_KNOWLEDGE_CATEGORY_NOT_FOUND",
          message: "Project knowledge category was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            categoryId: request.params.categoryId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.delete<{ Params: { projectSlug: string; categoryId: string } }>(
    "/projects/:projectSlug/categories/:categoryId",
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

      const result = await deleteProjectKnowledgeCategory(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.categoryId
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            categoryId: request.params.categoryId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project knowledge category editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project knowledge category editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "category_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_KNOWLEDGE_CATEGORY_NOT_FOUND",
          message: "Project knowledge category was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            categoryId: request.params.categoryId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>(
    "/projects/:projectSlug/categories/reorder",
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

      const result = await reorderProjectKnowledgeCategories(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project knowledge category editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project knowledge category editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "category_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_KNOWLEDGE_CATEGORY_NOT_FOUND",
          message: "Project knowledge category was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.get<{ Params: { projectSlug: string } }>("/projects/:projectSlug/articles", async (request, reply) => {
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

    const result = await buildProjectKnowledgeArticles(
      fastify.prisma,
      currentUser,
      request.params.projectSlug
    );

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project knowledge articles require an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>("/projects/:projectSlug/articles", async (request, reply) => {
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

    const result = await createProjectKnowledgeArticle(
      fastify.prisma,
      currentUser,
      request.params.projectSlug,
      request.body
    );

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        details: {
          projectSlug: request.params.projectSlug,
        },
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project knowledge article editing requires an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project knowledge article editing requires content editing permissions.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok && result.reason === "category_not_found") {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_KNOWLEDGE_CATEGORY_NOT_FOUND",
        message: "Project knowledge category was not found within the selected project.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    reply.code(201);

    return successEnvelope(request.id, result.data);
  });

  fastify.patch<{ Params: { projectSlug: string; articleId: string }; Body: unknown }>(
    "/projects/:projectSlug/articles/:articleId",
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

      const result = await updateProjectKnowledgeArticle(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.articleId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            articleId: request.params.articleId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project knowledge article editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project knowledge article editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "category_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_KNOWLEDGE_CATEGORY_NOT_FOUND",
          message: "Project knowledge category was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            articleId: request.params.articleId,
          },
        });
      }

      if (!result.ok && result.reason === "article_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_KNOWLEDGE_ARTICLE_NOT_FOUND",
          message: "Project knowledge article was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            articleId: request.params.articleId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.delete<{ Params: { projectSlug: string; articleId: string } }>(
    "/projects/:projectSlug/articles/:articleId",
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

      const result = await deleteProjectKnowledgeArticle(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.articleId
      );

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project knowledge article editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project knowledge article editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "article_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_KNOWLEDGE_ARTICLE_NOT_FOUND",
          message: "Project knowledge article was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            articleId: request.params.articleId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>(
    "/projects/:projectSlug/articles/reorder",
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

      const result = await reorderProjectKnowledgeArticles(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project knowledge article editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project knowledge article editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.get<{ Params: { projectSlug: string } }>("/projects/:projectSlug/communications", async (request, reply) => {
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

    const result = await buildProjectCommunications(fastify.prisma, currentUser, request.params.projectSlug);

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project communications require an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>("/projects/:projectSlug/communications", async (request, reply) => {
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

    const result = await createProjectCommunication(
      fastify.prisma,
      currentUser,
      request.params.projectSlug,
      request.body
    );

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        details: {
          projectSlug: request.params.projectSlug,
        },
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project communication editing requires an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project communication editing requires content editing permissions.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    reply.code(201);

    return successEnvelope(request.id, result.data);
  });

  fastify.patch<{ Params: { projectSlug: string; communicationId: string }; Body: unknown }>(
    "/projects/:projectSlug/communications/:communicationId",
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

      const result = await updateProjectCommunication(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.communicationId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            communicationId: request.params.communicationId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project communication editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project communication editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "communication_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_COMMUNICATION_NOT_FOUND",
          message: "Project communication was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            communicationId: request.params.communicationId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.delete<{ Params: { projectSlug: string; communicationId: string } }>(
    "/projects/:projectSlug/communications/:communicationId",
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

      const result = await deleteProjectCommunication(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.communicationId
      );

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project communication editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project communication editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "communication_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_COMMUNICATION_NOT_FOUND",
          message: "Project communication was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            communicationId: request.params.communicationId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.get<{ Params: { projectSlug: string } }>("/projects/:projectSlug/matrix", async (request, reply) => {
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

    const result = await buildProjectMatrix(fastify.prisma, currentUser, request.params.projectSlug);

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project matrix requires an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>(
    "/projects/:projectSlug/matrix/categories/reorder",
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

      const result = await reorderProjectMatrixCategories(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project matrix editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project matrix editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>(
    "/projects/:projectSlug/matrix/reorder",
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

      const result = await reorderProjectMatrixEntries(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project matrix editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project matrix editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>("/projects/:projectSlug/matrix", async (request, reply) => {
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

    const result = await createProjectMatrix(
      fastify.prisma,
      currentUser,
      request.params.projectSlug,
      request.body
    );

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        details: {
          projectSlug: request.params.projectSlug,
        },
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project matrix editing requires an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project matrix editing requires content editing permissions.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    reply.code(201);

    return successEnvelope(request.id, result.data);
  });

  fastify.patch<{ Params: { projectSlug: string; matrixId: string }; Body: unknown }>(
    "/projects/:projectSlug/matrix/:matrixId",
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

      const result = await updateProjectMatrix(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.matrixId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            matrixId: request.params.matrixId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project matrix editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project matrix editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "matrix_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_MATRIX_NOT_FOUND",
          message: "Project matrix entry was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            matrixId: request.params.matrixId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.delete<{ Params: { projectSlug: string; matrixId: string } }>(
    "/projects/:projectSlug/matrix/:matrixId",
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

      const result = await deleteProjectMatrix(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.matrixId
      );

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project matrix editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project matrix editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "matrix_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_MATRIX_NOT_FOUND",
          message: "Project matrix entry was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            matrixId: request.params.matrixId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.get<{ Params: { projectSlug: string } }>("/projects/:projectSlug/quick-links", async (request, reply) => {
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

    const result = await buildProjectQuickLinks(fastify.prisma, currentUser, request.params.projectSlug);

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project quick links require an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>(
    "/projects/:projectSlug/quick-links/reorder",
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

      const result = await reorderProjectQuickLinks(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project quick link editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project quick link editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.get<{ Params: { projectSlug: string } }>("/projects/:projectSlug/announcements", async (request, reply) => {
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

    const result = await buildProjectAnnouncements(fastify.prisma, currentUser, request.params.projectSlug);

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project announcements require an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>("/projects/:projectSlug/announcements", async (request, reply) => {
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

    const result = await createProjectAnnouncement(
      fastify.prisma,
      currentUser,
      request.params.projectSlug,
      request.body
    );

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        details: {
          projectSlug: request.params.projectSlug,
        },
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project announcement editing requires an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project announcement editing requires content editing permissions.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    reply.code(201);

    return successEnvelope(request.id, result.data);
  });

  fastify.patch<{ Params: { projectSlug: string; announcementId: string }; Body: unknown }>(
    "/projects/:projectSlug/announcements/:announcementId",
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

      const result = await updateProjectAnnouncement(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.announcementId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            announcementId: request.params.announcementId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project announcement editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project announcement editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "announcement_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_ANNOUNCEMENT_NOT_FOUND",
          message: "Project announcement was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            announcementId: request.params.announcementId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.delete<{ Params: { projectSlug: string; announcementId: string } }>(
    "/projects/:projectSlug/announcements/:announcementId",
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

      const result = await deleteProjectAnnouncement(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.announcementId
      );

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project announcement editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project announcement editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "announcement_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_ANNOUNCEMENT_NOT_FOUND",
          message: "Project announcement was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            announcementId: request.params.announcementId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.get<{ Params: { projectSlug: string } }>("/projects/:projectSlug/contacts", async (request, reply) => {
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

    const result = await buildProjectContacts(fastify.prisma, currentUser, request.params.projectSlug);

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project contacts require an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>(
    "/projects/:projectSlug/contacts/reorder",
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

      const result = await reorderProjectContacts(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project contact editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project contact editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>("/projects/:projectSlug/contacts", async (request, reply) => {
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

    const result = await createProjectContact(
      fastify.prisma,
      currentUser,
      request.params.projectSlug,
      request.body
    );

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        details: {
          projectSlug: request.params.projectSlug,
        },
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project contact editing requires an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project contact editing requires content editing permissions.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    reply.code(201);

    return successEnvelope(request.id, result.data);
  });

  fastify.patch<{ Params: { projectSlug: string; contactId: string }; Body: unknown }>(
    "/projects/:projectSlug/contacts/:contactId",
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

      const result = await updateProjectContact(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.contactId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            contactId: request.params.contactId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project contact editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project contact editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "contact_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_CONTACT_NOT_FOUND",
          message: "Project contact was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            contactId: request.params.contactId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.delete<{ Params: { projectSlug: string; contactId: string } }>(
    "/projects/:projectSlug/contacts/:contactId",
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

      const result = await deleteProjectContact(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.contactId
      );

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project contact editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project contact editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "contact_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_CONTACT_NOT_FOUND",
          message: "Project contact was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            contactId: request.params.contactId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.get<{ Params: { projectSlug: string } }>("/projects/:projectSlug/important-topics", async (request, reply) => {
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

    const result = await buildProjectImportantTopics(fastify.prisma, currentUser, request.params.projectSlug);

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project important topics require an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>("/projects/:projectSlug/important-topics", async (request, reply) => {
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

    const result = await createProjectImportantTopic(
      fastify.prisma,
      currentUser,
      request.params.projectSlug,
      request.body
    );

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        details: {
          projectSlug: request.params.projectSlug,
        },
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project important topic editing requires an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project important topic editing requires content editing permissions.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    reply.code(201);

    return successEnvelope(request.id, result.data);
  });

  fastify.patch<{ Params: { projectSlug: string; topicId: string }; Body: unknown }>(
    "/projects/:projectSlug/important-topics/:topicId",
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

      const result = await updateProjectImportantTopic(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.topicId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            topicId: request.params.topicId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project important topic editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project important topic editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "topic_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_IMPORTANT_TOPIC_NOT_FOUND",
          message: "Project important topic was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            topicId: request.params.topicId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.delete<{ Params: { projectSlug: string; topicId: string } }>(
    "/projects/:projectSlug/important-topics/:topicId",
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

      const result = await deleteProjectImportantTopic(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.topicId
      );

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project important topic editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project important topic editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "topic_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_IMPORTANT_TOPIC_NOT_FOUND",
          message: "Project important topic was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            topicId: request.params.topicId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.get<{ Params: { projectSlug: string } }>("/projects/:projectSlug/phrases", async (request, reply) => {
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

    const result = await buildProjectPhrases(fastify.prisma, currentUser, request.params.projectSlug);

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project approved responses require an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>(
    "/projects/:projectSlug/phrases/reorder",
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

      const result = await reorderProjectPhrases(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project approved response editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project approved response editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>("/projects/:projectSlug/phrases", async (request, reply) => {
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

    const result = await createProjectPhrase(
      fastify.prisma,
      currentUser,
      request.params.projectSlug,
      request.body
    );

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        details: {
          projectSlug: request.params.projectSlug,
        },
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project approved response editing requires an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project approved response editing requires content editing permissions.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    reply.code(201);

    return successEnvelope(request.id, result.data);
  });

  fastify.patch<{ Params: { projectSlug: string; phraseId: string }; Body: unknown }>(
    "/projects/:projectSlug/phrases/:phraseId",
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

      const result = await updateProjectPhrase(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.phraseId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            phraseId: request.params.phraseId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project approved response editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project approved response editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "phrase_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_PHRASE_NOT_FOUND",
          message: "Project approved response was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            phraseId: request.params.phraseId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.delete<{ Params: { projectSlug: string; phraseId: string } }>(
    "/projects/:projectSlug/phrases/:phraseId",
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

      const result = await deleteProjectPhrase(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.phraseId
      );

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project approved response editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project approved response editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "phrase_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_PHRASE_NOT_FOUND",
          message: "Project approved response was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            phraseId: request.params.phraseId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.get<{ Params: { projectSlug: string } }>("/projects/:projectSlug/templates", async (request, reply) => {
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

    const result = await buildProjectTemplates(fastify.prisma, currentUser, request.params.projectSlug);

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project templates require an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>(
    "/projects/:projectSlug/templates/reorder",
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

      const result = await reorderProjectTemplates(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project template editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project template editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>("/projects/:projectSlug/templates", async (request, reply) => {
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

    const result = await createProjectTemplate(
      fastify.prisma,
      currentUser,
      request.params.projectSlug,
      request.body
    );

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        details: {
          projectSlug: request.params.projectSlug,
        },
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project template editing requires an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project template editing requires content editing permissions.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    reply.code(201);

    return successEnvelope(request.id, result.data);
  });

  fastify.patch<{ Params: { projectSlug: string; templateId: string }; Body: unknown }>(
    "/projects/:projectSlug/templates/:templateId",
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

      const result = await updateProjectTemplate(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.templateId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            templateId: request.params.templateId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project template editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project template editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "template_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_TEMPLATE_NOT_FOUND",
          message: "Project template was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            templateId: request.params.templateId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.delete<{ Params: { projectSlug: string; templateId: string } }>(
    "/projects/:projectSlug/templates/:templateId",
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

      const result = await deleteProjectTemplate(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.templateId
      );

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project template editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project template editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "template_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_TEMPLATE_NOT_FOUND",
          message: "Project template was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            templateId: request.params.templateId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.get<{ Params: { projectSlug: string } }>("/projects/:projectSlug/pricing", async (request, reply) => {
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

    const result = await buildProjectPricing(fastify.prisma, currentUser, request.params.projectSlug);

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project pricing documents require an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>("/projects/:projectSlug/pricing", async (request, reply) => {
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

    const result = await createProjectPricing(
      fastify.prisma,
      currentUser,
      request.params.projectSlug,
      request.body
    );

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        details: {
          projectSlug: request.params.projectSlug,
        },
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project pricing editing requires an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project pricing editing requires content editing permissions.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    reply.code(201);

    return successEnvelope(request.id, result.data);
  });

  fastify.patch<{ Params: { projectSlug: string; pricingId: string }; Body: unknown }>(
    "/projects/:projectSlug/pricing/:pricingId",
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

      const result = await updateProjectPricing(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.pricingId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            pricingId: request.params.pricingId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project pricing editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project pricing editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "pricing_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_PRICING_NOT_FOUND",
          message: "Project pricing document was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            pricingId: request.params.pricingId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.delete<{ Params: { projectSlug: string; pricingId: string } }>(
    "/projects/:projectSlug/pricing/:pricingId",
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

      const result = await deleteProjectPricing(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.pricingId
      );

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project pricing editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project pricing editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "pricing_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_PRICING_NOT_FOUND",
          message: "Project pricing document was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            pricingId: request.params.pricingId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>("/projects/:projectSlug/quick-links", async (request, reply) => {
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

    const result = await createProjectQuickLink(
      fastify.prisma,
      currentUser,
      request.params.projectSlug,
      request.body
    );

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        details: {
          projectSlug: request.params.projectSlug,
        },
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project quick link editing requires an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project quick link editing requires content editing permissions.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    reply.code(201);

    return successEnvelope(request.id, result.data);
  });

  fastify.patch<{ Params: { projectSlug: string; quickLinkId: string }; Body: unknown }>(
    "/projects/:projectSlug/quick-links/:quickLinkId",
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

      const result = await updateProjectQuickLink(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.quickLinkId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            quickLinkId: request.params.quickLinkId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project quick link editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project quick link editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "quick_link_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_QUICK_LINK_NOT_FOUND",
          message: "Project quick link was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            quickLinkId: request.params.quickLinkId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.delete<{ Params: { projectSlug: string; quickLinkId: string } }>(
    "/projects/:projectSlug/quick-links/:quickLinkId",
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

      const result = await deleteProjectQuickLink(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.quickLinkId
      );

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project quick link editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project quick link editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "quick_link_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_QUICK_LINK_NOT_FOUND",
          message: "Project quick link was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            quickLinkId: request.params.quickLinkId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>("/projects/:projectSlug/links", async (request, reply) => {
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

    const result = await createProjectLink(fastify.prisma, currentUser, request.params.projectSlug, request.body);

    if (!result.ok && result.reason === "validation") {
      reply.code(400);

      return errorEnvelope(request.id, {
        code: "VALIDATION_ERROR",
        message: result.message,
        details: {
          projectSlug: request.params.projectSlug,
        },
        fieldErrors: result.fieldErrors,
      });
    }

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project link editing requires an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok && result.reason === "forbidden") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project link editing requires content editing permissions.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    reply.code(201);

    return successEnvelope(request.id, result.data);
  });

  fastify.patch<{ Params: { projectSlug: string; linkId: string }; Body: unknown }>(
    "/projects/:projectSlug/links/:linkId",
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

      const result = await updateProjectLink(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.linkId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            linkId: request.params.linkId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project link editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project link editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "link_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_LINK_NOT_FOUND",
          message: "Project link was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            linkId: request.params.linkId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.delete<{ Params: { projectSlug: string; linkId: string } }>(
    "/projects/:projectSlug/links/:linkId",
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

      const result = await deleteProjectLink(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.linkId
      );

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project link editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project link editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "link_not_found") {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_LINK_NOT_FOUND",
          message: "Project link was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            linkId: request.params.linkId,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );

  fastify.get<{ Params: { projectSlug: string } }>("/projects/:projectSlug/links", async (request, reply) => {
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

    const result = await buildProjectLinks(fastify.prisma, currentUser, request.params.projectSlug);

    if (!result.ok && result.reason === "locked") {
      reply.code(403);

      return errorEnvelope(request.id, {
        code: "PROJECT_ACCESS_DENIED",
        message: "Project links require an active project membership.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    if (!result.ok) {
      reply.code(404);

      return errorEnvelope(request.id, {
        code: "PROJECT_NOT_FOUND",
        message: "Project was not found or is not visible to the current user.",
        details: {
          projectSlug: request.params.projectSlug,
        },
      });
    }

    return successEnvelope(request.id, result.data);
  });

  fastify.post<{ Params: { projectSlug: string }; Body: unknown }>(
    "/projects/:projectSlug/links/reorder",
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

      const result = await reorderProjectLinks(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);

        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project link editing requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);

        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project link editing requires content editing permissions.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok) {
        reply.code(404);

        return errorEnvelope(request.id, {
          code: "PROJECT_NOT_FOUND",
          message: "Project was not found or is not visible to the current user.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      return successEnvelope(request.id, result.data);
    }
  );
};

export default projectRoutes;