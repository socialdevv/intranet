import type { FastifyPluginAsync } from "fastify";
import { errorEnvelope, successEnvelope } from "../lib/envelope.js";
import {
  buildProjectFormSubmissions,
  buildProjectForms,
  buildProjectFormsAdmin,
  createProjectForm,
  deleteProjectForm,
  submitProjectForm,
  updateProjectForm,
} from "../lib/project-forms.js";
import { DEV_USER_HEADER_NAME, resolveCurrentPlatformUser } from "../lib/platform-bootstrap.js";

const projectFormsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { projectSlug: string } }>(
    "/projects/:projectSlug/forms",
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

      const result = await buildProjectForms(
        fastify.prisma,
        currentUser,
        request.params.projectSlug
      );

      if (!result.ok && result.reason === "locked") {
        reply.code(403);
        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project forms require an active project membership.",
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

  fastify.get<{ Params: { projectSlug: string } }>(
    "/projects/:projectSlug/forms/admin",
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

      const result = await buildProjectFormsAdmin(
        fastify.prisma,
        currentUser,
        request.params.projectSlug
      );

      if (!result.ok && result.reason === "locked") {
        reply.code(403);
        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project forms administration requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);
        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_FORBIDDEN",
          message: "Project forms administration requires content editing rights.",
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

  fastify.get<{ Params: { projectSlug: string }; Querystring: unknown }>(
    "/projects/:projectSlug/forms/submissions",
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

      const result = await buildProjectFormSubmissions(
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
          message: "Project form submissions require an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);
        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_FORBIDDEN",
          message: "Project form submissions require content editing rights.",
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
    "/projects/:projectSlug/forms",
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

      const result = await createProjectForm(
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
          message: "Project forms administration requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);
        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_FORBIDDEN",
          message: "Project forms administration requires content editing rights.",
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
    }
  );

  fastify.patch<{ Params: { projectSlug: string; formId: string }; Body: unknown }>(
    "/projects/:projectSlug/forms/:formId",
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

      const result = await updateProjectForm(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.formId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);
        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            formId: request.params.formId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);
        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project forms administration requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);
        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_FORBIDDEN",
          message: "Project forms administration requires content editing rights.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "form_not_found") {
        reply.code(404);
        return errorEnvelope(request.id, {
          code: "PROJECT_FORM_NOT_FOUND",
          message: "Project form was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            formId: request.params.formId,
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

  fastify.delete<{ Params: { projectSlug: string; formId: string } }>(
    "/projects/:projectSlug/forms/:formId",
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

      const result = await deleteProjectForm(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.formId
      );

      if (!result.ok && result.reason === "locked") {
        reply.code(403);
        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Project forms administration requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "forbidden") {
        reply.code(403);
        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_FORBIDDEN",
          message: "Project forms administration requires content editing rights.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "form_not_found") {
        reply.code(404);
        return errorEnvelope(request.id, {
          code: "PROJECT_FORM_NOT_FOUND",
          message: "Project form was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            formId: request.params.formId,
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

  fastify.post<{ Params: { projectSlug: string; formId: string }; Body: unknown }>(
    "/projects/:projectSlug/forms/:formId/submissions",
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

      const result = await submitProjectForm(
        fastify.prisma,
        currentUser,
        request.params.projectSlug,
        request.params.formId,
        request.body
      );

      if (!result.ok && result.reason === "validation") {
        reply.code(400);
        return errorEnvelope(request.id, {
          code: "VALIDATION_ERROR",
          message: result.message,
          details: {
            projectSlug: request.params.projectSlug,
            formId: request.params.formId,
          },
          fieldErrors: result.fieldErrors,
        });
      }

      if (!result.ok && result.reason === "locked") {
        reply.code(403);
        return errorEnvelope(request.id, {
          code: "PROJECT_ACCESS_DENIED",
          message: "Form submission requires an active project membership.",
          details: {
            projectSlug: request.params.projectSlug,
          },
        });
      }

      if (!result.ok && result.reason === "form_not_found") {
        reply.code(404);
        return errorEnvelope(request.id, {
          code: "PROJECT_FORM_NOT_FOUND",
          message: "Project form was not found within the selected project.",
          details: {
            projectSlug: request.params.projectSlug,
            formId: request.params.formId,
          },
        });
      }

      if (!result.ok && result.reason === "form_not_active") {
        reply.code(409);
        return errorEnvelope(request.id, {
          code: "PROJECT_FORM_NOT_ACTIVE",
          message: "This form is currently inactive and cannot accept submissions.",
          details: {
            projectSlug: request.params.projectSlug,
            formId: request.params.formId,
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
    }
  );
};

export default projectFormsRoutes;
