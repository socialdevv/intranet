import { ModuleKey, Prisma, ProjectRole, TemplateChannel, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  collectChangedFields,
  recordAuditLogBestEffort,
} from "./audit-log.js";
import type { ApiFieldError } from "./envelope.js";
import type { ResolvedUser } from "./platform-bootstrap.js";

export type ProjectTemplateItem = {
  id: string;
  title: string;
  channel: TemplateChannel;
  body: Prisma.JsonValue;
  example: Prisma.JsonValue;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ProjectTemplatesResult =
  | {
      ok: true;
      data: {
        project: {
          id: string;
          slug: string;
          code: string;
          name: string;
        };
        items: ProjectTemplateItem[];
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked";
    };

type EditableProjectTemplatesResult =
  | {
      ok: true;
      data: {
        project: {
          id: string;
          slug: string;
          code: string;
          name: string;
        };
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden";
    };

type ProjectTemplateMutationValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type ProjectTemplateMutationFailure =
  | ProjectTemplateMutationValidationFailure
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden" | "template_not_found";
    };

type ProjectTemplateMutationSuccess<T> = {
  ok: true;
  data: T;
};

type ProjectTemplateMutationResult<T> =
  | ProjectTemplateMutationSuccess<T>
  | ProjectTemplateMutationFailure;

type SerializableProjectTemplateRecord = {
  id: string;
  title: string;
  channel: TemplateChannel;
  bodyJson: Prisma.JsonValue | null;
  exampleJson: Prisma.JsonValue | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

const EMPTY_TIPTAP_DOC = {
  type: "doc",
  content: [],
} satisfies Prisma.JsonObject;

const templateDocSchema = z.record(z.string(), z.unknown());

const projectTemplateSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters."),
  channel: z.enum(["email", "zgloszenie"]),
  body: templateDocSchema,
  example: templateDocSchema.default(EMPTY_TIPTAP_DOC as unknown as Record<string, unknown>),
});

const projectTemplatePatchSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters.").optional(),
    channel: z.enum(["email", "zgloszenie"]).optional(),
    body: templateDocSchema.optional(),
    example: templateDocSchema.optional(),
    sortOrder: z.number().int().min(0, "Sort order must be zero or greater.").optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

const projectTemplateReorderSchema = z.object({
  orderedIds: z
    .array(z.string().trim().min(1, "Template id is required."))
    .min(1, "Provide at least one template id to reorder."),
});

function canEditProjectContent(role: ProjectRole | null): boolean {
  return role === ProjectRole.project_admin || role === ProjectRole.content_manager;
}

function toFieldErrors(error: z.ZodError): ApiFieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    code: issue.code,
    message: issue.message,
  }));
}

function validationFailure(
  error: z.ZodError,
  message: string
): ProjectTemplateMutationValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

function toStoredJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function serializeProjectTemplate(item: SerializableProjectTemplateRecord): ProjectTemplateItem {
  return {
    id: item.id,
    title: item.title,
    channel: item.channel,
    body: item.bodyJson ?? EMPTY_TIPTAP_DOC,
    example: item.exampleJson ?? EMPTY_TIPTAP_DOC,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toAuditComparableTemplate(item: SerializableProjectTemplateRecord) {
  return {
    title: item.title,
    channel: item.channel,
    sortOrder: item.sortOrder,
    body: JSON.stringify(item.bodyJson ?? EMPTY_TIPTAP_DOC),
    example: JSON.stringify(item.exampleJson ?? EMPTY_TIPTAP_DOC),
  };
}

function toAuditMetadata(item: SerializableProjectTemplateRecord): Prisma.InputJsonObject {
  return {
    title: item.title,
    channel: item.channel,
    sortOrder: item.sortOrder,
    hasBody: item.bodyJson !== null,
    hasExample: item.exampleJson !== null,
  } satisfies Prisma.InputJsonObject;
}

async function resolveEditableProjectTemplates(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<EditableProjectTemplatesResult> {
  const project = await prisma.project.findFirst({
    where: {
      slug: projectSlug,
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      code: true,
      name: true,
      isListed: true,
      memberships: {
        where: {
          userId: currentUser.id,
        },
        select: {
          effectiveRole: true,
        },
        take: 1,
      },
    },
  });

  if (!project) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  const membership = project.memberships[0] ?? null;
  const effectiveRole = membership?.effectiveRole ?? null;
  const hasMembership = effectiveRole !== null;
  const canSeeProject = project.isListed || hasMembership;

  if (!canSeeProject) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  if (!hasMembership) {
    return {
      ok: false,
      reason: "locked",
    };
  }

  if (!canEditProjectContent(effectiveRole)) {
    return {
      ok: false,
      reason: "forbidden",
    };
  }

  return {
    ok: true,
    data: {
      project: {
        id: project.id,
        slug: project.slug,
        code: project.code,
        name: project.name,
      },
    },
  };
}

export async function buildProjectTemplates(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<ProjectTemplatesResult> {
  const project = await prisma.project.findFirst({
    where: {
      slug: projectSlug,
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      code: true,
      name: true,
      isListed: true,
      memberships: {
        where: {
          userId: currentUser.id,
        },
        select: {
          effectiveRole: true,
        },
        take: 1,
      },
      templates: {
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          channel: true,
          bodyJson: true,
          exampleJson: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!project) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  const hasMembership = project.memberships.length > 0;
  const canSeeProject = project.isListed || hasMembership;

  if (!canSeeProject) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  if (!hasMembership) {
    return {
      ok: false,
      reason: "locked",
    };
  }

  return {
    ok: true,
    data: {
      project: {
        id: project.id,
        slug: project.slug,
        code: project.code,
        name: project.name,
      },
      items: project.templates.map(serializeProjectTemplate),
    },
  };
}

export async function createProjectTemplate(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectTemplateMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    item: ProjectTemplateItem;
  }>
> {
  const parsed = projectTemplateSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project template payload is invalid.");
  }

  const access = await resolveEditableProjectTemplates(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const sortOrderAggregate = await prisma.projectTemplate.aggregate({
    where: {
      projectId: access.data.project.id,
    },
    _max: {
      sortOrder: true,
    },
  });

  const created = await prisma.projectTemplate.create({
    data: {
      projectId: access.data.project.id,
      title: parsed.data.title,
      channel: parsed.data.channel,
      bodyJson: toStoredJson(parsed.data.body),
      exampleJson: toStoredJson(parsed.data.example),
      sortOrder: (sortOrderAggregate._max.sortOrder ?? -1) + 1,
    },
    select: {
      id: true,
      title: true,
      channel: true,
      bodyJson: true,
      exampleJson: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.templates,
    entityType: AUDIT_ENTITY_TYPES.projectTemplate,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: toAuditMetadata(created),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeProjectTemplate(created),
    },
  };
}

export async function updateProjectTemplate(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  templateId: string,
  input: unknown
): Promise<
  ProjectTemplateMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    item: ProjectTemplateItem;
  }>
> {
  const parsedPatch = projectTemplatePatchSchema.safeParse(input);

  if (!parsedPatch.success) {
    return validationFailure(parsedPatch.error, "Project template update payload is invalid.");
  }

  const access = await resolveEditableProjectTemplates(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectTemplate.findFirst({
    where: {
      id: templateId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      title: true,
      channel: true,
      bodyJson: true,
      exampleJson: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "template_not_found",
    };
  }

  const normalized = projectTemplateSchema.safeParse({
    title: parsedPatch.data.title ?? existing.title,
    channel: parsedPatch.data.channel ?? existing.channel,
    body:
      parsedPatch.data.body === undefined
        ? ((existing.bodyJson ?? EMPTY_TIPTAP_DOC) as Record<string, unknown>)
        : parsedPatch.data.body,
    example:
      parsedPatch.data.example === undefined
        ? ((existing.exampleJson ?? EMPTY_TIPTAP_DOC) as Record<string, unknown>)
        : parsedPatch.data.example,
  });

  if (!normalized.success) {
    return validationFailure(normalized.error, "Project template update payload is invalid.");
  }

  const updated = await prisma.projectTemplate.update({
    where: {
      id: existing.id,
    },
    data: {
      title: normalized.data.title,
      channel: normalized.data.channel,
      bodyJson: toStoredJson(normalized.data.body),
      exampleJson: toStoredJson(normalized.data.example),
      sortOrder: parsedPatch.data.sortOrder ?? existing.sortOrder,
    },
    select: {
      id: true,
      title: true,
      channel: true,
      bodyJson: true,
      exampleJson: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.templates,
    entityType: AUDIT_ENTITY_TYPES.projectTemplate,
    entityId: updated.id,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      ...toAuditMetadata(updated),
      changedFields: collectChangedFields(
        toAuditComparableTemplate(existing),
        toAuditComparableTemplate(updated)
      ),
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeProjectTemplate(updated),
    },
  };
}

export async function deleteProjectTemplate(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  templateId: string
): Promise<
  ProjectTemplateMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    deletedId: string;
  }>
> {
  const access = await resolveEditableProjectTemplates(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectTemplate.findFirst({
    where: {
      id: templateId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      title: true,
      channel: true,
      bodyJson: true,
      exampleJson: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "template_not_found",
    };
  }

  const deleted = await prisma.projectTemplate.deleteMany({
    where: {
      id: templateId,
      projectId: access.data.project.id,
    },
  });

  if (deleted.count === 0) {
    return {
      ok: false,
      reason: "template_not_found",
    };
  }

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.templates,
    entityType: AUDIT_ENTITY_TYPES.projectTemplate,
    entityId: existing.id,
    actionType: AUDIT_ACTION_TYPES.delete,
    metadata: toAuditMetadata(existing),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      deletedId: existing.id,
    },
  };
}

export async function reorderProjectTemplates(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectTemplateMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    items: ProjectTemplateItem[];
  }>
> {
  const parsed = projectTemplateReorderSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project template reorder payload is invalid.");
  }

  const access = await resolveEditableProjectTemplates(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectTemplate.findMany({
    where: {
      projectId: access.data.project.id,
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      channel: true,
      bodyJson: true,
      exampleJson: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const orderedIds = [...new Set(parsed.data.orderedIds.map((id) => id.trim()))];
  const existingIds = existing.map((item) => item.id);

  if (orderedIds.length !== existingIds.length) {
    return {
      ok: false,
      reason: "validation",
      message: "Project template reorder payload must include every template exactly once.",
      fieldErrors: [
        {
          field: "orderedIds",
          code: "custom",
          message: "Project template reorder payload must include every template exactly once.",
        },
      ],
    };
  }

  const existingIdSet = new Set(existingIds);

  if (orderedIds.some((id) => !existingIdSet.has(id))) {
    return {
      ok: false,
      reason: "validation",
      message: "Project template reorder payload contains unknown templates.",
      fieldErrors: [
        {
          field: "orderedIds",
          code: "custom",
          message: "Project template reorder payload contains unknown templates.",
        },
      ],
    };
  }

  const changedItems = existing
    .map((item) => ({
      before: item,
      afterSortOrder: orderedIds.indexOf(item.id),
    }))
    .filter((item) => item.afterSortOrder !== item.before.sortOrder);

  await prisma.$transaction(
    changedItems.map((item) =>
      prisma.projectTemplate.update({
        where: {
          id: item.before.id,
        },
        data: {
          sortOrder: item.afterSortOrder,
        },
      })
    )
  );

  for (const item of changedItems) {
    await recordAuditLogBestEffort(prisma, {
      actor: currentUser,
      project: access.data.project,
      moduleKey: ModuleKey.templates,
      entityType: AUDIT_ENTITY_TYPES.projectTemplate,
      entityId: item.before.id,
      actionType: AUDIT_ACTION_TYPES.update,
      metadata: {
        ...toAuditMetadata(item.before),
        sortOrder: item.afterSortOrder,
        changedFields: ["sortOrder"],
      },
    });
  }

  const items = await prisma.projectTemplate.findMany({
    where: {
      projectId: access.data.project.id,
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      channel: true,
      bodyJson: true,
      exampleJson: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      items: items.map(serializeProjectTemplate),
    },
  };
}