import type { FastifyInstance } from "fastify";

export function registerOpenApiSchemas(fastify: FastifyInstance): void {
  fastify.addSchema({
    $id: "ApiResponseMeta",
    type: "object",
    required: ["requestId", "timestamp"],
    properties: {
      requestId: { type: "string" },
      timestamp: { type: "string", format: "date-time" },
    },
  });

  fastify.addSchema({
    $id: "ApiFieldError",
    type: "object",
    required: ["field", "code", "message"],
    properties: {
      field: { type: "string" },
      code: { type: "string" },
      message: { type: "string" },
    },
  });

  fastify.addSchema({
    $id: "ApiErrorBody",
    type: "object",
    required: ["code", "message", "details", "fieldErrors", "retryable"],
    properties: {
      code: { type: "string" },
      message: { type: "string" },
      details: { type: "object", additionalProperties: true },
      fieldErrors: {
        type: "array",
        items: { $ref: "ApiFieldError#" },
      },
      retryable: { type: "boolean" },
    },
  });

  fastify.addSchema({
    $id: "ApiErrorEnvelope",
    type: "object",
    required: ["error", "meta"],
    properties: {
      error: { $ref: "ApiErrorBody#" },
      meta: { $ref: "ApiResponseMeta#" },
    },
  });
}

export function successEnvelopeResponse(
  dataSchema: Record<string, unknown>,
  description?: string
): Record<string, unknown> {
  return {
    description,
    type: "object",
    required: ["data", "meta"],
    properties: {
      data: dataSchema,
      meta: { $ref: "ApiResponseMeta#" },
    },
  };
}
